# Terminal MCP

An MCP server that gives AI coding assistants persistent, interactive terminal sessions using **tmux**.

## Why?

AI coding tools can run simple one-off commands, but they can't handle long-running processes.

For example, when you run `flutter run -d macos`:
- The AI can't read the output once the initial command returns.
- Runtime errors go unnoticed — you have to copy-paste logs manually.
- Sending hotkeys like `r` (Hot Reload) or `Ctrl+C` is impossible.

**Terminal MCP** lets the AI start processes, read their output at any time, and send keystrokes — all through tmux. Sessions persist even if you close the IDE.

## Requirements

- **Node.js** ≥ 18
- **tmux**:
  - **macOS**: `brew install tmux`
  - **Linux (Ubuntu/Debian)**: `sudo apt install tmux`
  - **Linux (CentOS/RHEL)**: `sudo yum install tmux`
  - **Linux (Arch)**: `sudo pacman -S tmux`
  - **Windows**: Install [WSL](https://learn.microsoft.com/en-us/windows/wsl/install) then `sudo apt install tmux`

## Setup

### 1. Install

```bash
git clone https://github.com/YoongiKim/terminal-mcp.git
cd terminal-mcp
npm install && npm run build
```

### 2. Add to your MCP config

```json
{
  "mcpServers": {
    "terminal-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/terminal-mcp/dist/index.js"]
    }
  }
}
```

That's it. No server to run — the IDE launches the MCP process directly via stdio.

## Tools

| Tool | Description |
|------|-------------|
| `start_process` | Start a command in a new tmux session (supports custom IDs). |
| `read_output` | Capture current terminal output from a session. |
| `send_input` | Send text or control keys (`Ctrl+C`, `Enter`, etc.). |
| `list_sessions` | List all active sessions. |
| `get_session_info` | Get PID, command, and state of a session. |
| `stop_process` | Kill a session. |
| `wait_until_complete` | Block until a process exits. |
| `wait_for_seconds` | Wait N seconds, then capture output. |

## How it works

The MCP server runs as a single stdio process. It delegates all session management to **tmux**:

```
IDE ←stdio→ MCP Server ←exec→ tmux ← manages → shell sessions
```

Since sessions live inside tmux, they survive IDE restarts. You can even attach manually with `tmux attach -t <session-id>`.

## License

MIT
