# Terminal MCP (tmux-based)

A persistent terminal session manager for AI coding tools, built as an MCP server using **tmux** as the backend.

## Why Terminal MCP?

Standard AI coding tools (Cursor, Windsurf, RooCode, etc.) execute commands in temporary shells. This has major drawbacks for complex workflows:
- **No Background Monitoring**: Long-running processes (like `flutter run`) can't be easily monitored for errors.
- **No Interaction**: You can't send hotkeys (like `r` for Hot Reload) to a running process.
- **Copy-Paste Hell**: When a build fails, you have to manually copy the logs back to the AI.
- **Lack of Persistence**: If the IDE restarts or the connection drops, you lose the terminal state.

**Terminal MCP** solves this by wrapping **tmux**. AI can now start persistent sessions, read streaming logs, and send real-time inputs. **Since it uses tmux, sessions survive even if you close the IDE — you can even attach to them from your own terminal.**

## Requirements

- **macOS or Linux**
- **tmux**: Must be installed on your system.
  - macOS: `brew install tmux`
  - Linux: `sudo apt install tmux` (or equivalent)

## Installation & Setup

### 1. Build the project

```bash
git clone https://github.com/YoongiKim/terminal-mcp.git
cd terminal-mcp
npm install
npm run build
```

### 2. Configure Your MCP Client

Add the following to your MCP configuration (e.g., `mcp_config.json` for RooCode or Claude Desktop):

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

## Architecture

Unlike the previous version, **Terminal MCP 2.0** uses a direct **Stdio** approach with a **tmux** backend. 

- **One Process**: The MCP server and session manager run together.
- **Persistence**: Shell processes live inside tmux sessions, independent of the MCP server's lifecycle.
- **Stability**: Uses standard stdio for communication — no more SSE or network glitches.

## Available Tools

| Tool | Description |
|------|-------------|
| `start_process` | Start a new tmux session with a command and optional alias/ID. |
| `send_input` | Send text or control keys (e.g., `Ctrl+C`, `Enter`) to a session. |
| `read_output` | Capture the current screen of a tmux session. |
| `list_sessions` | List all active tmux sessions managed by this tool. |
| `get_session_info` | Get details (PID, command, state) for a specific session. |
| `stop_process` | Kill a tmux session. |
| `wait_until_complete` | Wait for a process to finish and return its final state. |

## License

MIT
