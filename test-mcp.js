const { spawn } = require('child_process');

const server = spawn('node', ['dist/index.js']);

server.stdout.on('data', (data) => {
  console.log(`STDOUT: ${data.toString()}`);
  server.kill();
});

server.stderr.on('data', (data) => {
  console.error(`STDERR: ${data.toString()}`);
});

server.on('close', (code) => {
  console.log(`child process exited with code ${code}`);
});

// Send JSON-RPC initialize request
const initReq = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" }
  }
};

const msg = JSON.stringify(initReq) + '\n';
server.stdin.write(msg);
