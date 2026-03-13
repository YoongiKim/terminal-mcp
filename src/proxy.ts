import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import EventSource from "eventsource";

/**
 * A proxy that connects a Stdio MCP host (IDE) to a remote SSE MCP server.
 * This allows multiple IDEs to share a single persistent terminal-mcp server.
 */
export async function runProxy(port: number) {
  // Use 127.0.0.1 for more predictable connection than 'localhost'
  const sseUrl = new URL(`http://127.0.0.1:${port}/sse`);
  
  // 1. Connect to the remote SSE server
  const sseTransport = new SSEClientTransport(sseUrl, { 
    // @ts-ignore
    eventSourceFactory: (url) => new EventSource(url.href) 
  });
  
  // 2. Setup Stdio transport for the IDE
  const stdioServerTransport = new StdioServerTransport();

  // Handle messages IDE (Stdio) -> Remote Server (SSE)
  stdioServerTransport.onmessage = async (message: JSONRPCMessage) => {
    try {
      // Intercept call_tool for start_process to inject local CWD
      if (
        "method" in message && 
        message.method === "notifications/cancelled" // skip
      ) {
        // Just forward
      } else if (
        "method" in message && 
        message.method === "tools/call" && 
        message.params && 
        (message.params as any).name === "start_process"
      ) {
        const params = message.params as any;
        params.arguments = params.arguments || {};
        if (!params.arguments.cwd) {
          params.arguments.cwd = process.cwd();
        }
      }
      await sseTransport.send(message);
    } catch (e) {
      // console.error("[proxy] Error forwarding to SSE:", e);
    }
  };

  // Handle messages Remote Server (SSE) -> IDE (Stdio)
  sseTransport.onmessage = async (message: JSONRPCMessage) => {
    try {
      await stdioServerTransport.send(message);
    } catch (e) {
      // console.error("[proxy] Error forwarding to Stdio:", e);
    }
  };

  sseTransport.onerror = (e) => {
    console.error(`[terminal-mcp-proxy] Connection lost to server on port ${port}.`);
    console.error(`[terminal-mcp-proxy] Error detail:`, e);
    process.exit(1);
  };

  stdioServerTransport.onerror = (e) => {
    process.exit(1);
  };

  // Start both
  try {
    await sseTransport.start();
    await stdioServerTransport.start();
    // Do not log to stdout as it is used for MCP
  } catch (err) {
    console.error(`[terminal-mcp-proxy] Failed to connect to server on port ${port}.`);
    process.exit(1);
  }
}
