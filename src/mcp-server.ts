import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { SessionManager } from "./session-manager.js";

const TOOLS: Tool[] = [
  {
    name: "start_process",
    description: "Start a new terminal process.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
        args: { type: "array", items: { type: "string" } },
        cwd: { 
          type: "string", 
          description: "Working directory for the process. If omitted, the proxy (client) will automatically inject its current path." 
        },
        env: { type: "object", additionalProperties: { type: "string" } },
        id: { type: "string", description: "Optional custom ID (alias) for the session, like 'screen'." },
      },
      required: ["command"],
    },
  },
  {
    name: "send_input",
    description: "Send input to a process.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        text: { type: "string" },
      },
      required: ["session_id", "text"],
    },
  },
  {
    name: "read_output",
    description: "Read process output. Tracks a cursor per session by default.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        since_timestamp: { type: "number", description: "Read output since this timestamp." },
        since_index: { type: "number", description: "Read output since this index (cursor)." },
        strip_ansi: { type: "boolean", default: true },
      },
      required: ["session_id"],
    },
  },
  {
    name: "list_sessions",
    description: "List all sessions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_session_info",
    description: "Get session details.",
    inputSchema: {
      type: "object",
      properties: { session_id: { type: "string" } },
      required: ["session_id"],
    },
  },
  {
    name: "wait_until_complete",
    description: "Wait for a process to finish and return its final output.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        timeout_ms: { type: "number", description: "Maximum time to wait in milliseconds (default: 30000)" },
      },
      required: ["session_id"],
    },
  },
  {
    name: "wait_for_seconds",
    description: "Wait for a specific duration while capturing output.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        seconds: { type: "number" },
      },
      required: ["session_id", "seconds"],
    },
  },
  {
    name: "stop_process",
    description: "Stop a process.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        signal: { type: "string", enum: ["SIGTERM", "SIGKILL", "SIGINT"], default: "SIGTERM" },
      },
      required: ["session_id"],
    },
  },
];

const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]/g;
function stripAnsi(text: string): string { return text.replace(ANSI_REGEX, ""); }

export function createMcpServer(manager: SessionManager): Server {
  const server = new Server(
    {
      name: "terminal-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      switch (name) {
        case "start_process": {
          const input = z.object({
            command: z.string(),
            args: z.array(z.string()).optional().default([]),
            cwd: z.string().optional(),
            env: z.record(z.string()).optional(),
            id: z.string().optional(),
          }).parse(args);
          const sessionId = manager.startProcess(input.command, input.args, input.cwd, input.env, input.id);
          return { content: [{ type: "text", text: JSON.stringify({ session_id: sessionId, message: `Process started: ${input.command}` }) }] };
        }
        case "send_input": {
          const input = z.object({ session_id: z.string(), text: z.string() }).parse(args);
          manager.sendInput(input.session_id, input.text);
          return { content: [{ type: "text", text: JSON.stringify({ success: true }) }] };
        }
        case "read_output": {
          const input = z.object({ 
            session_id: z.string(), 
            since_timestamp: z.number().optional(), 
            since_index: z.number().optional(),
            strip_ansi: z.boolean().optional().default(true) 
          }).parse(args);
          
          const result = manager.readOutput(input.session_id, input.since_timestamp, input.since_index);
          let combined = result.entries.map((e) => e.text).join("");
          if (input.strip_ansi) combined = stripAnsi(combined);
          
          if (!result.isRunning && result.exitCode !== null) {
            combined += `\nProcess finished with exit code: ${result.exitCode}\n`;
          }
          
          return { content: [{ type: "text", text: JSON.stringify({ 
            output: combined, 
            is_running: result.isRunning, 
            exit_code: result.exitCode, 
            last_timestamp: result.entries.length > 0 ? result.entries[result.entries.length - 1].timestamp : (input.since_timestamp ?? Date.now()),
            last_index: result.lastIndex
          }) }] };
        }
        case "wait_until_complete": {
          const input = z.object({
            session_id: z.string(),
            timeout_ms: z.number().optional().default(30000),
          }).parse(args);

          const startTimestamp = Date.now();
          const info = manager.getSessionInfo(input.session_id);
          
          if (info.isRunning) {
            await new Promise<void>((resolve) => {
              const onUpdate = () => {
                const updated = manager.getSessionInfo(input.session_id);
                if (!updated.isRunning) {
                  manager.off('update', onUpdate);
                  clearTimeout(timer);
                  resolve();
                }
              };
              const timer = setTimeout(() => {
                manager.off('update', onUpdate);
                resolve();
              }, input.timeout_ms);
              manager.on('update', onUpdate);
            });
          }

          const result = manager.readOutput(input.session_id, startTimestamp);
          let combined = result.entries.map((e) => e.text).join("");
          combined = stripAnsi(combined); 
          
          const finalInfo = manager.getSessionInfo(input.session_id);
          if (!finalInfo.isRunning && finalInfo.exitCode !== null) {
            combined += `\nProcess finished with exit code: ${finalInfo.exitCode}\n`;
          }
          
          return { content: [{ type: "text", text: JSON.stringify({ output: combined, is_running: finalInfo.isRunning, exit_code: finalInfo.exitCode }) }] };
        }
        case "wait_for_seconds": {
          const input = z.object({
            session_id: z.string(),
            seconds: z.number(),
          }).parse(args);

          const startTimestamp = Date.now();
          await new Promise(resolve => setTimeout(resolve, input.seconds * 1000));

          const result = manager.readOutput(input.session_id, startTimestamp);
          let combined = result.entries.map((e) => e.text).join("");
          combined = stripAnsi(combined);
          
          const finalInfo = manager.getSessionInfo(input.session_id);
          if (!finalInfo.isRunning && finalInfo.exitCode !== null) {
            combined += `\nProcess finished with exit code: ${finalInfo.exitCode}\n`;
          }

          return { content: [{ type: "text", text: JSON.stringify({ output: combined, is_running: finalInfo.isRunning, exit_code: finalInfo.exitCode }) }] };
        }
        case "list_sessions": {
          const sessions = manager.listSessions();
          const simplified = sessions.reduce((acc, s) => {
            acc[s.id] = s.command + (s.args.length > 0 ? " " + s.args.join(" ") : "");
            return acc;
          }, {} as Record<string, string>);
          return { content: [{ type: "text", text: JSON.stringify(simplified) }] };
        }
        case "get_session_info": {
          const input = z.object({ session_id: z.string() }).parse(args);
          const info = manager.getSessionInfo(input.session_id);
          return { content: [{ type: "text", text: JSON.stringify(info) }] };
        }
        case "stop_process": {
          const input = z.object({ session_id: z.string(), signal: z.enum(["SIGTERM", "SIGKILL", "SIGINT"]).optional().default("SIGTERM") }).parse(args);
          manager.stopProcess(input.session_id, input.signal);
          return { content: [{ type: "text", text: JSON.stringify({ success: true, message: `Signal ${input.signal} sent` }) }] };
        }
        default: return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }
    } catch (error) {
      return { content: [{ type: "text", text: JSON.stringify({ error: String(error) }) }], isError: true };
    }
  });

  return server;
}
