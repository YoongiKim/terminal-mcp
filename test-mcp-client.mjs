import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function run() {
  console.log("Starting client...");
  const transport = new StdioClientTransport({
    command: "node",
    args: ["/Users/yoongi/Projects/terminal-mcp/dist/index.js"],
    env: { ...process.env, PORT: process.env.PORT || "3007" },
  });

  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });

  await client.connect(transport);
  console.log("Connected to MCP server!");

  const tools = await client.listTools();
  console.log("Available tools:", tools.tools.map(t => t.name));

  const result = await client.callTool({
    name: "start_process",
    arguments: {
      command: "/bin/bash",
      args: ["-c", "echo hello from terminal-mcp"],
      id: "test-alias",
    }
  });

  console.log("Process started:", result);
  const startResult = JSON.parse(result.content[0].text);
  const sessionId = startResult.session_id;

  // Wait a bit to let it run
  await new Promise(r => setTimeout(r, 1000));

  const output = await client.callTool({ name: "read_output", arguments: { session_id: sessionId } });
  console.log("Output:", JSON.parse(output.content[0].text).output);

  const sessions = await client.callTool({ name: "list_sessions", arguments: {} });
  console.log("Sessions:", sessions);

  process.exit(0);
  console.log("Sessions:", sessions);

  process.exit(0);
}

run().catch(console.error);
