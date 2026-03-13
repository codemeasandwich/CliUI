# Apprentice.js — Phase 2 Overview
**Phase 2: PTY Runner and Normalized Output Capture**

This document explains the execution and capture layer, how the system converts raw terminal output into a normalized plain-text snapshot, and why that snapshot — not the code or model claims — is the primary evaluator input.

## What Phase 2 Does

Phase 2 adds a PTY-backed (pseudoterminal) execution environment so that generated scripts produce genuine terminal output including ANSI colors, cursor movements, box-drawing characters, and full-screen redraws. The raw byte stream is captured verbatim and then fed through a virtual screen buffer that replays every escape sequence to produce a final-frame plain-text snapshot — exactly what a human would see on the terminal at exit.

This normalized text becomes the sole evaluator input surface.

## PTY Runner Behavior

### Execution Path Selection (`runner.js`)

`runScript` selects the execution backend:

1. **PTY path** (preferred): If `node-pty` loaded successfully (`isPtyAvailable()` returns `true`), the script runs inside a real pseudoterminal via `runScriptPty`.
2. **Fallback path**: If `node-pty` is unavailable (missing native addon, unsupported platform) or if the PTY spawn fails at runtime, the script runs via `child_process.spawn` with piped stdio.

The fallback is transparent — both paths return the same result shape:

```
{
  stdout:     string,   // raw output (PTY: merged ANSI stream, fallback: piped stdout)
  stderr:     string,   // separated stderr content
  rawAnsi:    string,   // PTY: identical to stdout, fallback: empty string
  exitCode:   number,   // process exit code (null → 1)
  timedOut:   boolean,  // true if wall-clock timeout was hit
  durationMs: number    // wall-clock execution time
}
```

### PTY Spawn Mechanics (`pty-runner.js`)

`runScriptPty` does the following:

1. **Generates a stderr temp file path** using `crypto.randomBytes` for uniqueness.
2. **Builds the shell command**: `bun run '<script>' 2>'<stderr-file>'`. Shell injection is prevented by single-quoting paths with internal quote escaping.
3. **Spawns the PTY** via `pty.spawn(shell, ["-c", shellCmd], opts)` where:
   - `shell` = `$SHELL` or `/bin/sh`
   - `name` = `"xterm-256color"` (terminal type)
   - `cols` / `rows` from `CONFIG.terminal`
   - `cwd` = `CONFIG.repoRoot`
   - `env` = merged process env + `CONFIG.terminal.env`
4. **Accumulates all PTY data** via `onData` into a `rawAnsi` buffer.
5. **Enforces a wall-clock timeout** — kills the PTY process if `timeoutMs` elapses.
6. **On exit**: reads stderr from the temp file, cleans up the temp file, and resolves with the result.

If `pty.spawn` throws synchronously (e.g. `posix_spawnp` failure under certain Node.js test runners), the function returns a result with `stderr: "PTY spawn error: ..."`. The caller in `runner.js` detects this sentinel and falls back to `runScriptFallback`.

### Fallback Spawn Mechanics (`runner.js`)

`runScriptFallback` uses `child_process.spawn` with `stdio: ["ignore", "pipe", "pipe"]`. It accumulates stdout and stderr via `data` events. The same timeout and settled-guard pattern applies. The `rawAnsi` field is always empty because piped stdio doesn't allocate a terminal, so TUI programs won't produce escape sequences.

## Terminal Dimensions and Environment Variables

### Dimensions (`config.js`)

```js
terminal: {
    cols: 80,
    rows: 24,
    env: {
        LANG: "en_US.utf8",
        TERM: "xterm-256color",
    },
}
```

These values serve three purposes:

1. **PTY allocation**: `pty.spawn` is called with `cols: 80, rows: 24`, so programs that query terminal size (via `ioctl` / `process.stdout.columns`) see a deterministic viewport.
2. **Normalization**: `normalizeScreen(rawAnsi, cols, rows)` uses the same dimensions to replay the ANSI stream onto a matching virtual buffer.
3. **Prompt context**: The Apprentice prompt tells the model it is targeting an 80×24 terminal so it can generate code that fits correctly.

Tasks may override dimensions via `task.cols` / `task.rows`.

### Environment Variables

`LANG: "en_US.utf8"` ensures consistent locale handling (UTF-8 box-drawing characters render correctly). `TERM: "xterm-256color"` tells TUI programs what escape sequences are safe to emit. Both are merged on top of `process.env` so they override any host-level settings, producing deterministic output across machines.

## Raw Output Capture

The PTY runner captures every byte emitted by the child process through `pty.onData(data)`, concatenating it into a single `rawAnsi` string. This stream contains:

- ANSI SGR codes (colors, bold, underline, etc.)
- CSI cursor movement commands (`ESC[row;colH`, `ESC[nA/B/C/D`, etc.)
- CSI erase commands (`ESC[2J`, `ESC[K`, etc.)
- OSC sequences (window titles, etc.)
- Box-drawing characters (unicode: `┌ ─ ┐ │ └ ┘`, etc.)
- Carriage returns, newlines, tabs, backspaces
- All visible text content

The raw stream is preserved verbatim in the episode artifact `attempt_NNN-raw.ansi` (see Saved Capture Artifacts below).

Stderr is captured separately via shell redirection (`2>tempfile`), since the PTY merges all file descriptors into one stream.

## Normalized Screen Generation

### Architecture

Normalization is split across two modules for the 200 NCLOC file-size rule:

- **`screen-normalize.js`**: Main parser loop, grid creation, and serialization.
- **`screen-csi.js`**: CSI escape sequence processor (cursor movement, erase, scroll, SGR).

### How It Works

`normalizeScreen(rawAnsi, cols, rows)` replays the raw ANSI stream onto a virtual 2D character grid:

1. **Grid creation**: `createGrid(rows, cols)` allocates a `rows × cols` array of arrays, initialized with spaces.
2. **State tracking**: A `state` object tracks `{ row, col, grid, rows, cols }` — the virtual cursor position and buffer.
3. **Byte-by-byte parsing**: The main loop processes each character:
   - **ESC `[` (CSI)**: Collects parameter bytes, then delegates to `processCsi(paramStr, cmd, state)`.
   - **ESC `]` (OSC)**: Skips until BEL or ST terminator.
   - **Other ESC sequences**: Skips the next byte.
   - **`\r`**: Moves cursor to column 0.
   - **`\n`**: Moves cursor down one row; scrolls up if at the bottom.
   - **`\t`**: Advances to the next 8-column tab stop.
   - **`\b`**: Moves cursor back one column.
   - **Control characters** (code < 0x20): Skipped.
   - **Visible characters**: Written to `grid[row][col]`, cursor advanced. Wraps to the next line if past the right edge; scrolls up if wrap occurs at the bottom.
4. **Serialization**: `serializeGrid(grid)` joins each row, trims trailing spaces, removes trailing blank lines, and appends a final newline.

### CSI Commands Supported (`screen-csi.js`)

| Command | Description |
|---------|-------------|
| `A` / `B` / `C` / `D` | Cursor up / down / forward / back |
| `H` / `f` | Cursor absolute position (row;col) |
| `G` | Cursor to column |
| `d` | Cursor to row |
| `E` / `F` | Cursor next / previous line |
| `J` | Erase display (0=cursor→end, 1=start→cursor, 2/3=all) |
| `K` | Erase in line (0=cursor→end, 1=start→cursor, 2=all) |
| `S` / `T` | Scroll up / down |
| `m` | SGR (colors) — ignored |
| `h` / `l` / `r` / `n` / `s` / `u` | Mode / cursor save/restore — ignored |

Unknown CSI commands are silently skipped, ensuring best-effort rendering even with unusual terminal programs.

## Why Normalized Output Is the Evaluator Surface

The Evaluator must judge observable behavior, not code:

1. **Truth boundary**: The Evaluator receives `screenText` (normalized plain text), `stderr`, `exitCode`, and `timedOut` — never the generated script. This prevents the Evaluator from "grading the homework" or being fooled by plausible-looking code that produces wrong output.
2. **What you see is what you judge**: The normalized screen text is the closest machine-readable approximation of what a human user would see sitting at a terminal. It strips colors and escape codes but preserves layout, spacing, box-drawing, and text placement.
3. **Determinism**: The same raw ANSI stream always normalizes to the same text because the virtual screen buffer is a pure function of the input bytes and terminal dimensions.

The evaluator prompt (`buildEvaluatorPrompt` in `prompts.js`) explicitly instructs the judge:

> *"Do NOT speculate about the code that produced this output. Base your judgment solely on what the output shows."*

## Saved Capture Artifacts

Each attempt within an episode saves the following files to `learning/episodes/<episode-id>/`:

| File | Content |
|------|---------|
| `attempt_NNN.js` | The generated script source code |
| `attempt_NNN-raw.ansi` | Raw PTY/ANSI byte stream (escape sequences preserved) |
| `attempt_NNN-screen.txt` | Normalized plain-text final screen snapshot |
| `attempt_NNN-stderr.txt` | Captured stderr output |
| `attempt_NNN-evaluator.json` | Structured evaluator verdict (score, verdict, critique) |
| `attempt_NNN-retrieved.json` | IDs of retrieved learning artifacts (if any) |

Where `NNN` is a zero-padded 3-digit attempt number (e.g. `001`, `002`).

The `raw.ansi` file is saved only when PTY execution produced ANSI content. In fallback mode, this file is absent because `rawAnsi` is empty.

## How to Inspect a Failed Capture

When a capture fails or produces unexpected results, inspect artifacts in this order:

1. **Check exit code and stderr**: Open `attempt_NNN-stderr.txt`. Runtime errors (import failures, syntax errors, missing APIs) appear here. A non-zero exit code in the evaluator JSON confirms execution failure.

2. **Inspect the raw ANSI stream**: Open `attempt_NNN-raw.ansi` in a terminal-aware viewer. You can replay it with:
   ```bash
   cat learning/episodes/<id>/attempt_001-raw.ansi
   ```
   This shows the actual colors, cursor movements, and layout exactly as produced.

3. **Compare raw vs. normalized**: Open `attempt_NNN-screen.txt` alongside the raw replay. Discrepancies indicate a normalization gap (see Known Limitations below).

4. **Review the generated script**: Open `attempt_NNN.js` to understand what the model tried to do. This is useful for debugging the Apprentice's approach but is deliberately excluded from the Evaluator's view.

5. **Check the evaluator verdict**: Open `attempt_NNN-evaluator.json`. The `critique` field explains what the Evaluator saw and why it assigned the score. A `_parse_error: true` flag indicates the Evaluator's response couldn't be parsed as JSON.

6. **Check if PTY was available**: Look for the `[runner] Using PTY-backed execution` or `[runner] PTY unavailable, using basic spawn fallback` log line in the episode's console output. If fallback was used, `raw.ansi` will be absent and `screenText` was normalized from plain piped stdout (which lacks TUI escape sequences).

## Known Limitations in Normalization

1. **Alternate screen buffer** (`ESC[?1049h` / `ESC[?1049l`): Programs that switch to the alternate screen (common in full-screen TUIs like `less`, `vim`, `htop`) are not fully emulated. The normalizer treats the alternate buffer switch as an ignored mode command. The visible content may be incomplete if the program writes to the alternate buffer and switches back.

2. **Scrolling regions** (`ESC[n;mr` — DECSTBM): The `r` command is parsed but treated as a no-op. Programs that define scroll regions and then scroll within them will not produce correct normalized output for the scrolled region.

3. **Character width**: CJK double-width characters and combining characters are treated as single-column characters. Layouts using these will misalign in the normalized output.

4. **Mouse and keyboard input**: The normalizer only processes output. Interactive programs that wait for input will hang until timeout. The PTY runner does not inject keystrokes.

5. **Timing-dependent rendering**: Programs that render progressively (e.g. animations, spinners) capture only the final accumulated state. If a program clears and redraws rapidly, the normalized output shows the last frame only, which is by design.

6. **Color information loss**: SGR (color/style) sequences are stripped. The normalized output is plain monochrome text. If the only difference between a correct and incorrect output is color, the normalizer (and therefore the Evaluator) cannot distinguish them.

7. **Fallback mode fidelity**: When PTY is unavailable and fallback spawn is used, TUI programs that query terminal size get `undefined` columns/rows (since stdio is piped, not a TTY). Box-drawing and cursor-positioning code in TUI libraries may produce degraded or plain-text output.
