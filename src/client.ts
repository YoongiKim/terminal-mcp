#!/usr/bin/env node
import { runProxy } from "./proxy.js";
import { spawn } from "child_process";
import { connect } from "net";
import path from "path";
const __dirname_dist = __dirname;

async function isServerRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => {
      resolve(false);
    });
  });
}

async function startServer() {
  const serverPath = path.join(__dirname_dist, "server.js");
  console.error(`[terminal-mcp] Server not found. Starting server: node ${serverPath}...`);
  
  const server = spawn("node", [serverPath], {
    detached: true,
    stdio: "inherit",
  });

  server.unref();

  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function main() {
  const port = process.env.PORT ? parseInt(process.env.PORT) : 30722;
  
  if (!(await isServerRunning(port))) {
    await startServer();
  }

  console.error(`[terminal-mcp] Connecting to Shared Server at http://localhost:${port}`);
  await runProxy(port);
}

main().catch((err) => {
  console.error("[terminal-mcp-client] Connection error:", err);
  process.exit(1);
});
