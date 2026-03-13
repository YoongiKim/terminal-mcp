const pty = require("node-pty");
const path = require("path");

const command = "/bin/ls";
const args = ["/Users/yoongi/Projects/terminal-mcp"];
const cwd = "/Users/yoongi/Projects/terminal-mcp";

console.log(`Spawning ${command} in ${cwd}...`);

try {
  const ptyProcess = pty.spawn(command, args, {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: cwd,
    env: {
      PATH: process.env.PATH,
      TERM: "xterm-256color"
    }
  });

  console.log("Spawned pid:", ptyProcess.pid);

  ptyProcess.onData(data => {
    console.log("Data received:", data);
  });

  ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Process exited with code ${exitCode}, signal ${signal}`);
    process.exit(0);
  });

  // Force exit after 5 seconds if nothing happens
  setTimeout(() => {
    console.log("Timeout reached, killing...");
    ptyProcess.kill();
    process.exit(1);
  }, 5000);

} catch (e) {
  console.error("Spawn Catch Error:", e);
  process.exit(1);
}
