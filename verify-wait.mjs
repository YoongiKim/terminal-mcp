import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function verify() {
  const t = new StdioClientTransport({
    command: "node",
    args: ["/Users/yoongi/Projects/terminal-mcp/dist/client.js"],
    env: { ...process.env, PORT: "30722" }
  });
  const c = new Client({ name: "v", version: "1" }, { capabilities: {} });
  await c.connect(t);
  
  console.log("--- Testing exit code in read_output ---");
  const s1 = await c.callTool({ name: "start_process", arguments: { command: "ls", args: ["-F"] } });
  const sid1 = JSON.parse(s1.content[0].text).session_id;
  await new Promise(r => setTimeout(r, 1000));
  const r1 = await c.callTool({ name: "read_output", arguments: { session_id: sid1 } });
  console.log(JSON.parse(r1.content[0].text).output);

  console.log("\n--- Testing wait_for_seconds ---");
  const s2 = await c.callTool({ name: "start_process", arguments: { command: "bash", args: ["-c", "for i in {1..5}; do echo $i; sleep 1; done"] } });
  const sid2 = JSON.parse(s2.content[0].text).session_id;
  const w2 = await c.callTool({ name: "wait_for_seconds", arguments: { session_id: sid2, seconds: 2 } });
  console.log("Output after 2s:", JSON.parse(w2.content[0].text).output);

  console.log("\n--- Testing wait_until_complete ---");
  const w3 = await c.callTool({ name: "wait_until_complete", arguments: { session_id: sid2, timeout_ms: 10000 } });
  console.log("Final output:", JSON.parse(w3.content[0].text).output);

  process.exit(0);
}
verify().catch(console.error);
