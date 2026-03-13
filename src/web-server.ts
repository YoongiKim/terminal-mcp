import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import http from 'http';
import { SessionManager } from './session-manager.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createMcpServer } from './mcp-server.js';

export function startWebServer(sessionManager: SessionManager, port: number = 3000) {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  // Serve static files from the 'public' directory
  // In dist/web-server.js, __dirname is dist/
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // Explicitly serve index.html for the root route
  app.get('/', (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  // ONLY use express.json() for /api routes to avoid breaking SSE stream parsing
  const apiRouter = express.Router();
  apiRouter.use(express.json());
  app.use('/api', apiRouter);

  // API to list sessions
  apiRouter.get('/sessions', (req, res) => {
    res.json(sessionManager.listSessions());
  });

  // MCP SSE sessions
  const sseTransports = new Map<string, SSEServerTransport>();

  app.get("/sse", async (req, res) => {
    const sessionId = Math.random().toString(36).substring(2);
    console.error(`[terminal-mcp] New SSE connection: ${sessionId}`);
    
    // The second argument to SSEServerTransport is the URL for POSTing messages
    const transport = new SSEServerTransport(`/messages/${sessionId}`, res);
    sseTransports.set(sessionId, transport);
    
    res.on('close', () => {
      sseTransports.delete(sessionId);
    });

    // Create a NEW MCP Server instance for EACH connection
    const mcpServerForConnection = createMcpServer(sessionManager);
    
    try {
      await mcpServerForConnection.connect(transport);
    } catch (error) {
      console.error(`[terminal-mcp] Error connecting to MCP server via SSE session ${sessionId}:`, error);
      if (!res.headersSent) {
        res.status(500).send(`Internal Server Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

  app.post("/messages/:sessionId", async (req, res) => {
    const { sessionId } = req.params;
    const transport = sseTransports.get(sessionId);
    if (transport) {
      // We must NOT use express.json() middleware for this route,
      // as the SDK's handlePostMessage needs to read the raw request stream.
      await transport.handlePostMessage(req, res);
    } else {
      res.status(404).send("SSE session not found");
    }
  });

  // WebSocket connection handler
  wss.on('connection', (ws: WebSocket, req) => {
    const url = req.url || '';
    
    // Meta channel for session list and status updates
    if (url === '/ws/meta' || url === '/ws' || url === '/') {
      const sendSessions = () => {
        ws.send(JSON.stringify({ type: 'sessions', data: sessionManager.listSessions() }));
      };

      sendSessions();
      sessionManager.on('update', sendSessions);

      ws.on('close', () => {
        sessionManager.off('update', sendSessions);
      });
      return;
    }

    // Individual session channel
    // Expected URL format: /ws/SESSION_ID
    const urlParts = url.split('/') || [];
    const sessionId = urlParts[urlParts.length - 1];

    if (!sessionId) {
      ws.close(1008, 'Session ID required');
      return;
    }

    try {
      // Validate session exists
      const info = sessionManager.getSessionInfo(sessionId);
      
      // Update metadata on connection
      ws.send(JSON.stringify({ type: 'metadata', data: info }));

      // Send historical buffer
      const history = sessionManager.readOutput(sessionId);
      for (const entry of history.entries) {
        ws.send(JSON.stringify({ type: 'output', data: entry.text }));
      }

      // Listen for new data from this specific session
      const onData = (data: { sessionId: string; text: string }) => {
        if (data.sessionId === sessionId) {
          ws.send(JSON.stringify({ type: 'output', data: data.text }));
        }
      };

      sessionManager.on('data', onData);

      // Listen for data from the web client (user typing)
      ws.on('message', (message) => {
        try {
          sessionManager.sendInput(sessionId, message.toString());
        } catch (e) {
          console.error(`Error sending input to session ${sessionId}:`, e);
        }
      });

      ws.on('close', () => {
        sessionManager.off('data', onData);
      });

    } catch (e) {
      ws.close(1011, 'Session not found or error');
    }
  });

  wss.on('error', (e) => {
    console.error(`[terminal-mcp] WebSocket server error:`, e);
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`[terminal-mcp] Warning: Port ${port} is already in use. Web terminal will not be available for this instance.`);
    } else {
      console.error(`[terminal-mcp] Web server error:`, e);
    }
  });

  server.listen(port, () => {
    console.error(`[terminal-mcp] Web terminal running at http://localhost:${port}`);
  });

  return server;
}
