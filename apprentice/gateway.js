/**
 * apprentice/gateway.js
 *
 * Purpose: Connects to and interacts with the LLM Gateway.
 * Responsibilities: Handles WebSocket connection setup, streaming token ingestion, and provides wrapper methods for specific agent LLM requests (Apprentice, Evaluator).
 * Major sections:
 *   - connectGateway: Establishes and verifies the WebSocket handshake.
 *   - requestLLM: Core function for subscribing to token streams and resolving complete responses.
 *   - askApprentice / askEvaluator: Convenience wrappers for the two actors.
 * Important invariants: All LLM requests must stream to avoid blocking, with a hard timeout to prevent indefinite hangs.
 */

const CONFIG = require("./config");

/**
 * Purpose: Establish the WebSocket connection to the LLM Gateway and wait for the connection to be ready before returning.
 * Inputs:
 *   - api: {object} the api-ape client module instance
 * Outputs: {Promise<void>} resolves when the connection is fully established.
 * Side effects: Connects websocket socket, registers an onConnectionChange listener, and logs to console.
 * Failure behavior: Rejects if the 'connected' state is not reached within 10 seconds.
 * Important assumptions: Assumes the API server corresponds to CONFIG.gateway host/port and `api-ape` provides `onConnectionChange`.
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
 * Purpose: Send a prompt to the LLM Gateway, stream the response tokens via api-ape pub/sub, and buffer them into a single string.
 * Inputs:
 *   - api: {object} the connected api-ape client module
 *   - prompt: {string} the full prompt text to send
 *   - provider: {string} which LLM provider to route to
 *   - model: {string} [optional] model name for the provider
 * Outputs: {Promise<string>} the completely buffered response text.
 * Side effects: Subscribes to the stream channel, accumulates text chunks, and logs the stream's requestId to the console.
 * Failure behavior: Rejects if the stream times out (5 mins), throws an API error, or completes with an exit code != 0 with no content.
 * Important assumptions: Expects the stream to terminate with a `message_stop` event containing the final exit code.
 */
async function requestLLM(api, prompt, provider, model) {
    // Build the request payload. Only include model when explicitly
    // set — sending model:undefined would encode as null in JSON and
    // some providers reject null model values.
    const payload = {
        provider,
        messages: [{ role: "user", content: prompt }],
        stream: true,
        // Force print mode — the apprentice prompt already contains all
        // necessary context (task description, library docs, prior feedback).
        // Without this, CLI providers (claude-cli) enter full agentic mode
        // with tool use, exploring files and spending 5-10min per request.
        // print_mode maps to --print in the CLI for non-interactive output.
        // Note: max_turns is NOT overridden here — with --print mode, the
        // gateway's default_max_turns provides adequate turn budget for
        // generating complete code responses (~1500 chars).
        //
        // stale_stream_timeout_secs overrides the gateway's default 120s
        // watchdog. The apprentice sends large prompts (task + repo docs +
        // prior learning artifacts) that can take >120s before the first
        // streaming token arrives. Without this, the gateway kills the
        // provider process before it has a chance to respond.
        provider_options: {
            print_mode: true,
            stale_stream_timeout_secs: Math.ceil(CONFIG.streamTimeoutMs / 1000),
        },
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

        // Safety timeout — configurable via CONFIG.streamTimeoutMs.
        // Default 600s accommodates slower models and large prompts.
        const timeoutMs = CONFIG.streamTimeoutMs || 600_000;
        const timeoutSecs = timeoutMs / 1000;
        const streamTimeout = setTimeout(() => {
            unsubscribe();
            reject(
                new Error(
                    `LLM stream timeout after ${timeoutSecs}s for provider '${provider}'. ` +
                    `The stream started (requestId=${requestId}) but never ` +
                    `received message_stop. Provider may be hung or overloaded.`
                )
            );
        }, timeoutMs);

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
 * Purpose: Ask the Apprentice actor to generate runnable JavaScript for a task.
 * Inputs:
 *   - api: {object} connected api-ape client
 *   - prompt: {string} built apprentice prompt text
 * Outputs: {Promise<string>} raw Apprentice response string
 * Side effects: Logs sending attempt to console.
 * Failure behavior: Bubbles up any connection or extraction rejections from `requestLLM`.
 * Important assumptions: `requestLLM` handles timeout and connection stability.
 */
async function askApprentice(api, prompt) {
    console.log("[apprentice] Sending task to Apprentice…");
    return requestLLM(api, prompt, CONFIG.apprenticeProvider, CONFIG.apprenticeModel);
}

/**
 * Purpose: Ask the Evaluator actor to score captured output.
 * Inputs:
 *   - api: {object} connected api-ape client
 *   - prompt: {string} built evaluator prompt text containing captured real output
 * Outputs: {Promise<string>} raw evaluator response (expected to be JSON format)
 * Side effects: Logs sending attempt to console.
 * Failure behavior: Bubbles up rejections from `requestLLM`.
 * Important assumptions: Evaluator prompt MUST ONLY contain task description and real execution output, never the generated script.
 */
async function askEvaluator(api, prompt) {
    console.log("[evaluator] Sending captured output to Evaluator…");
    return requestLLM(api, prompt, CONFIG.evaluatorProvider, CONFIG.evaluatorModel);
}

/**
 * Purpose: Ask the Requirements Analyst actor to diagnose a persistent failure.
 * Inputs:
 *   - api: {object} connected api-ape client
 *   - prompt: {string} built analyst prompt containing episode data and CliUI capability inventory
 * Outputs: {Promise<string>} raw analyst response (expected to be JSON format)
 * Side effects: Logs sending attempt to console.
 * Failure behavior: Bubbles up rejections from `requestLLM`.
 * Important assumptions: Only called when shouldAnalyze() trigger conditions are met.
 */
async function askAnalyst(api, prompt) {
    console.log("[analyst] Sending failure analysis to Analyst…");
    return requestLLM(api, prompt, CONFIG.analystProvider, CONFIG.analystModel);
}

module.exports = { connectGateway, requestLLM, askApprentice, askEvaluator, askAnalyst };
