# Terminal MCP

A persistent terminal session manager for AI coding tools, built as an MCP server.

## Why?

AI coding tools (Cursor, Windsurf, RooCode, etc.) can run simple commands, but they can't handle long-running processes.

For example, if you run `flutter run -d macos`:
- The process keeps running in the background, but the AI can't read its output.
- If a runtime error occurs, the AI has no way of knowing — you have to manually copy-paste the error log.
- Interactive inputs like pressing `r` for Hot Reload or `Ctrl+C` to quit are impossible.

With **Terminal MCP**, the AI can directly:
1. Start a process (`start_process`)
2. Read its output in real-time (`read_output`)
3. Send keystrokes (`send_input`)
4. Detect errors and continue fixing code without any manual copy-pasting.

**No more copy-pasting error messages back and forth.**

## Usage

### 1. Install & Build

```bash
git clone https://github.com/YoongiKim/terminal-mcp.git
cd terminal-mcp
npm install
npm run build
```

### 2. Start the Server

You can start the server manually. It manages all terminal sessions and allows multiple MCP clients to connect simultaneously.

```bash
npm run server
```

> If the server is not running, the MCP client will automatically start it in the background when first connected.

Once running, a web terminal UI is available at `http://localhost:30722`.

### 3. Configure Your MCP Client

Register the MCP client in your AI coding tool. The client connects to the server to create and control processes.

```json
{
  "mcpServers": {
    "terminal-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/terminal-mcp/dist/client.js"],
      "env": {
        "PORT": "30722"
      }
    }
  }
}
```

## Architecture

```
┌──────────┐    ┌──────────┐
│  IDE 1   │    │  IDE 2   │
│ (Client) │    │ (Client) │
└────┬─────┘    └────┬─────┘
     │               │
     └───────┬───────┘
             │ SSE/HTTP
     ┌───────┴───────┐
     │    Server     │ ← npm run server
     │ (Port 30722)  │
     └───┬───────┬───┘
         │       │
    ┌────┴──┐ ┌──┴────┐
    │ bash  │ │flutter │
    │session│ │session │
    └───────┘ └───────┘
```

The server manages all terminal sessions. Each IDE's MCP client connects to the server to create and interact with processes.

## Tools

| Tool | Description |
|------|-------------|
| `start_process` | Start a new process. Supports custom session aliases. |
| `send_input` | Send text or key input to a running process. |
| `read_output` | Read process output. Tracks a cursor internally so repeated calls return only new output. |
| `list_sessions` | List all sessions. |
| `get_session_info` | Get details for a specific session. |
| `stop_process` | Terminate a process. |
| `wait_until_complete` | Wait for a process to finish and return its output. |
| `wait_for_seconds` | Wait for a specified duration while collecting output. |

## License

MIT
