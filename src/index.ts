#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as tmux from "./tmux.js";

console.error("[terminal-mcp] Server process starting...");

const server = new McpServer({
  name: "terminal-mcp",
  version: "2.0.0",
});

// --- Tools ---

server.tool(
  "start_process",
  "Start a new terminal process in a tmux session.",
  {
    command: z.string().describe("The command to run"),
    args: z.array(z.string()).optional().describe("Command arguments"),
    cwd: z.string().optional().describe("Working directory"),
    id: z.string().optional().describe("Custom session name/alias"),
  },
  async ({ command, args, cwd, id }) => {
    const sessionId = id || `s-${Date.now()}`;
    const fullCommand = args && args.length > 0 ? `${command} ${args.join(" ")}` : command;
    try {
      tmux.startSession(sessionId, fullCommand, cwd);
      return { content: [{ type: "text", text: JSON.stringify({ session_id: sessionId, message: `Process started: ${fullCommand}` }) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true };
    }
  }
);

server.tool(
  "send_input",
  "Send text input to a running tmux session.",
  {
    session_id: z.string(),
    text: z.string(),
  },
  async ({ session_id, text }) => {
    try {
      // Handle special control characters
      if (text === "\u0003") {
        tmux.sendSpecialKey(session_id, "C-c");
      } else if (text === "\u0004") {
        tmux.sendSpecialKey(session_id, "C-d");
      } else if (text === "\r" || text === "\n") {
        tmux.sendSpecialKey(session_id, "Enter");
      } else {
        tmux.sendKeys(session_id, text);
      }
      return { content: [{ type: "text", text: JSON.stringify({ success: true }) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true };
    }
  }
);

server.tool(
  "read_output",
  "Read the current terminal output from a tmux session.",
  {
    session_id: z.string(),
    lines: z.number().optional().describe("Number of lines from the top to capture (default: entire scrollback)"),
  },
  async ({ session_id, lines }) => {
    try {
      const output = tmux.capturePane(session_id, lines !== undefined ? -lines : undefined);
      const info = tmux.getSessionInfo(session_id);
      const isRunning = info.paneDead !== "1";
      return { content: [{ type: "text", text: JSON.stringify({ output, is_running: isRunning }) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true };
    }
  }
);

server.tool(
  "list_sessions",
  "List all tmux sessions.",
  {},
  async () => {
    const sessions = tmux.listSessions();
    const details: Record<string, any> = {};
    for (const s of sessions) {
      try {
        details[s] = tmux.getSessionInfo(s);
      } catch {
        details[s] = { error: "could not get info" };
      }
    }
    return { content: [{ type: "text", text: JSON.stringify(details) }] };
  }
);

server.tool(
  "get_session_info",
  "Get details about a specific tmux session.",
  {
    session_id: z.string(),
  },
  async ({ session_id }) => {
    try {
      const info = tmux.getSessionInfo(session_id);
      return { content: [{ type: "text", text: JSON.stringify(info) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true };
    }
  }
);

server.tool(
  "wait_until_complete",
  "Wait until a tmux session's process finishes.",
  {
    session_id: z.string(),
    timeout_ms: z.number().optional().describe("Max wait time in ms (default: 30000)"),
  },
  async ({ session_id, timeout_ms }) => {
    try {
      const result = await tmux.waitForExit(session_id, timeout_ms ?? 30000);
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true };
    }
  }
);

server.tool(
  "wait_for_seconds",
  "Wait for a specified duration then capture output.",
  {
    session_id: z.string(),
    seconds: z.number(),
  },
  async ({ session_id, seconds }) => {
    await new Promise((r) => setTimeout(r, seconds * 1000));
    try {
      const output = tmux.capturePane(session_id);
      const info = tmux.getSessionInfo(session_id);
      const isRunning = info.paneDead !== "1";
      return { content: [{ type: "text", text: JSON.stringify({ output, is_running: isRunning }) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true };
    }
  }
);

server.tool(
  "stop_process",
  "Kill a tmux session.",
  {
    session_id: z.string(),
    signal: z.enum(["SIGTERM", "SIGKILL", "SIGINT"]).optional().default("SIGTERM"),
  },
  async ({ session_id, signal }) => {
    try {
      if (signal === "SIGINT") {
        tmux.sendSpecialKey(session_id, "C-c");
      } else {
        tmux.killSession(session_id);
      }
      return { content: [{ type: "text", text: JSON.stringify({ success: true }) }] };
    } catch (e: any) {
      return { content: [{ type: "text", text: JSON.stringify({ error: e.message }) }], isError: true };
    }
  }
);

// --- Prompts ---

server.prompt(
  "how-to-attach",
  "Tell the user how to attach to a tmux session.",
  { session_id: z.string().optional().describe("Session ID to attach to") },
  ({ session_id }) => {
    const id = session_id || "<session-id>";
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Tell the user they can view this session live by running: tmux attach -t ${id}`,
          },
        },
      ],
    };
  }
);

// --- Start ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[terminal-mcp] MCP server running on stdio (tmux backend)");
}

main().catch((err) => {
  console.error("[terminal-mcp] Fatal error:", err);
  process.exit(1);
});
