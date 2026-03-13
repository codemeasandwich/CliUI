/**
 * apprentice/gateway.js — LLM Gateway Communication
 *
 * Connects to the local LLM Gateway via api-ape WebSocket RPC.
 * Provides a streaming-buffered request function and two convenience
 * wrappers — one for the Apprentice actor, one for the Evaluator.
 * The stream is consumed internally; callers receive the fully
 * buffered response text.
 *
 * @module apprentice/gateway
 */

const CONFIG = require("./config");

/**
 * Establish the WebSocket connection to the LLM Gateway and wait
 * for the connection to be ready before returning.
 *
 * Uses api-ape's onConnectionChange callback to detect the
 * 'connected' state, matching the pattern from the gateway's own
 * E2E test suite. Timeout after 10s to avoid hanging if down.
 *
 * @param {object} api — the api-ape client module
 * @returns {Promise<void>} resolves when connected
 */
async function connectGateway(api) {
    api.connect(CONFIG.gateway.host, CONFIG.gateway.port);
    console.log(
        `[gateway] Connecting to ws://${CONFIG.gateway.host}:${CONFIG.gateway.port}…`
    );

    // Wait for the WebSocket handshake to complete. api-ape fires
    // onConnectionChange with 'connected' once the socket is open.
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(
                new Error(
                    `Gateway connection timeout after 10s. ` +
                    `Is the LLM Gateway running at ` +
                    `ws://${CONFIG.gateway.host}:${CONFIG.gateway.port}? ` +
                    `Start it with: cd ~/SOURCE/LLM && bun start`
                )
            );
        }, 10_000);

        const unsub = api.onConnectionChange((state) => {
            if (state === "connected") {
                clearTimeout(timeout);
                unsub();
                console.log("[gateway] Connected");
                resolve();
            }
        });
    });
}

/**
 * Send a prompt to the LLM Gateway, stream the response tokens
 * via api-ape pub/sub, and buffer them into a single string.
 *
 * Subscribes to the stream channel and accumulates text chunks
 * until message_stop. On stream error, rejects with diagnostics.
 * A 5-minute timeout prevents indefinite hangs if the stream stalls.
 *
 * @param {object} api      — the api-ape client module (connected)
 * @param {string} prompt   — the full prompt text to send
 * @param {string} provider — which LLM provider to route to
 * @param {string} [model]  — optional model name for the provider
 * @returns {Promise<string>} the complete response text
 */
async function requestLLM(api, prompt, provider, model) {
    // Build the request payload. Only include model when explicitly
    // set — sending model:undefined would encode as null in JSON and
    // some providers reject null model values.
    const payload = {
        provider,
        messages: [{ role: "user", content: prompt }],
        stream: true,
    };
    if (model) {
        payload.model = model;
    }

    // The gateway resolves this call immediately with a requestId
    // that identifies the stream channel for this request.
    const { requestId } = await api.messages(payload);
    console.log(`[gateway] Stream started: requestId=${requestId}`);

    // Buffer the streaming response into a Promise.
    return new Promise((resolve, reject) => {
        let buffer = "";

        // Safety timeout — LLM responses should complete within 5 min.
        const streamTimeout = setTimeout(() => {
            unsubscribe();
            reject(
                new Error(
                    `LLM stream timeout after 300s for provider '${provider}'. ` +
                    `The stream started (requestId=${requestId}) but never ` +
                    `received message_stop. Provider may be hung or overloaded.`
                )
            );
        }, 300_000);

        const unsubscribe = api.stream[requestId]((event) => {
            // Accumulate text deltas. Guard against undefined — some
            // content blocks (tool_use deltas) have event.delta without
            // a text field; buffer += undefined would produce "undefined".
            if (event.type === "content_block_delta" && event.delta?.text) {
                buffer += event.delta.text;
            }

            // Stream completion — check exit code for CLI failures.
            if (event.type === "message_stop") {
                clearTimeout(streamTimeout);
                unsubscribe();
                const exitCode = event.llmgw?.exit_code;
                if (buffer.length === 0 && exitCode !== 0) {
                    reject(
                        new Error(
                            `LLM stream from provider '${provider}' completed with ` +
                            `exit_code=${exitCode} and zero content. The model may ` +
                            `have rejected the request or the provider crashed. ` +
                            `Check gateway logs for details.`
                        )
                    );
                } else {
                    resolve(buffer);
                }
            }

            // Stream-level error — reject with context.
            if (event.type === "error") {
                clearTimeout(streamTimeout);
                unsubscribe();
                reject(
                    new Error(
                        `LLM stream error from provider '${provider}': ` +
                        `${event.error?.message || "unknown error"}. ` +
                        `Check that the provider is registered and healthy.`
                    )
                );
            }
        });
    });
}

/**
 * Ask the Apprentice actor to generate runnable JavaScript for a task.
 *
 * @param {object} api  — connected api-ape client
 * @param {string} prompt — built apprentice prompt text
 * @returns {Promise<string>} the raw Apprentice response
 */
async function askApprentice(api, prompt) {
    console.log("[apprentice] Sending task to Apprentice…");
    return requestLLM(api, prompt, CONFIG.apprenticeProvider, CONFIG.apprenticeModel);
}

/**
 * Ask the Evaluator actor to score captured output.
 * The Evaluator receives ONLY the task and captured output — never
 * the generated script — enforcing the primary truth invariant.
 *
 * @param {object} api    — connected api-ape client
 * @param {string} prompt — built evaluator prompt text
 * @returns {Promise<string>} raw evaluator response (should be JSON)
 */
async function askEvaluator(api, prompt) {
    console.log("[evaluator] Sending captured output to Evaluator…");
    return requestLLM(api, prompt, CONFIG.evaluatorProvider, CONFIG.evaluatorModel);
}

module.exports = { connectGateway, requestLLM, askApprentice, askEvaluator };
