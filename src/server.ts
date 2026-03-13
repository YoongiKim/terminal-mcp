#!/usr/bin/env node
import { SessionManager } from "./session-manager.js";
import { startWebServer } from "./web-server.js";

const manager = new SessionManager();

async function main() {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 30722;
  console.error(`[terminal-mcp-server] Starting Shared Server on port ${port}...`);
  startWebServer(manager, port);
  console.error(`[terminal-mcp-server] Ready. IDEs should connect via client.js`);
}

main().catch((err) => {
  console.error("[terminal-mcp-server] Fatal error:", err);
  process.exit(1);
});
