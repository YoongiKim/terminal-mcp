import * as pty from "node-pty";
import { randomUUID } from "crypto";
import { EventEmitter } from "events";

export interface OutputEntry {
  text: string;
  timestamp: number;
  index: number;
}

export interface TerminalSession {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  pid: number;
  exitCode: number | null;
  isRunning: boolean;
  createdAt: number;
  outputBuffer: OutputEntry[];
  pty: pty.IPty;
  nextIndex: number;
  readCursor: number;
}

export interface SessionInfo {
  id: string;
  command: string;
  args: string[];
  cwd: string;
  pid: number;
  exitCode: number | null;
  isRunning: boolean;
  createdAt: number;
  outputLineCount: number;
}

export class SessionManager extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private readonly MAX_BUFFER_SIZE = 10000; // max output entries per session

  startProcess(
    command: string,
    args: string[] = [],
    cwd: string = process.cwd(),
    env?: Record<string, string>,
    customId?: string
  ): string {
    const id = customId || randomUUID();
    if (this.sessions.has(id)) {
      throw new Error(`Session ID already exists: ${id}`);
    }

    const mergedEnv: Record<string, string> = {
      ...Object.fromEntries(
        Object.entries(process.env).filter(
          ([, v]) => v !== undefined
        ) as [string, string][]
      ),
      TERM: "xterm-256color",
      ...env,
    };

    const ptyProcess = pty.spawn(command, args, {
      name: "xterm-256color",
      cols: 220,
      rows: 50,
      cwd,
      env: mergedEnv,
    });

    const session: TerminalSession = {
      id,
      command,
      args,
      cwd,
      pid: ptyProcess.pid,
      exitCode: null,
      isRunning: true,
      createdAt: Date.now(),
      outputBuffer: [],
      pty: ptyProcess,
      nextIndex: 0,
      readCursor: 0,
    };

    ptyProcess.onData((data: string) => {
      const entry: OutputEntry = { text: data, timestamp: Date.now(), index: session.nextIndex++ };
      session.outputBuffer.push(entry);
      this.emit('data', { sessionId: id, text: data });
      // Trim buffer if too large
      if (session.outputBuffer.length > this.MAX_BUFFER_SIZE) {
        session.outputBuffer.splice(
          0,
          session.outputBuffer.length - this.MAX_BUFFER_SIZE
        );
      }
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      session.isRunning = false;
      session.exitCode = exitCode;
      this.emit('update');
    });

    this.sessions.set(id, session);
    this.emit('update');
    return id;
  }

  sendInput(sessionId: string, text: string): void {
    const session = this.getSession(sessionId);
    if (!session.isRunning) {
      throw new Error(`Session ${sessionId} is not running (exit code: ${session.exitCode})`);
    }
    session.pty.write(text);
  }

  readOutput(
    sessionId: string,
    sinceMs?: number,
    sinceIndex?: number
  ): { entries: OutputEntry[]; isRunning: boolean; exitCode: number | null; lastIndex: number } {
    const session = this.getSession(sessionId);

    let entries: OutputEntry[];
    if (sinceIndex !== undefined) {
      entries = session.outputBuffer.filter((e) => e.index >= sinceIndex);
    } else if (sinceMs !== undefined) {
      entries = session.outputBuffer.filter((e) => e.timestamp > sinceMs);
    } else {
      // Use internal cursor if no criteria provided
      entries = session.outputBuffer.filter((e) => e.index >= session.readCursor);
    }

    if (entries.length > 0) {
      session.readCursor = entries[entries.length - 1].index + 1;
    }

    return {
      entries,
      isRunning: session.isRunning,
      exitCode: session.exitCode,
      lastIndex: session.nextIndex,
    };
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      command: s.command,
      args: s.args,
      cwd: s.cwd,
      pid: s.pid,
      exitCode: s.exitCode,
      isRunning: s.isRunning,
      createdAt: s.createdAt,
      outputLineCount: s.outputBuffer.length,
    }));
  }

  getSessionInfo(sessionId: string): SessionInfo {
    const s = this.getSession(sessionId);
    return {
      id: s.id,
      command: s.command,
      args: s.args,
      cwd: s.cwd,
      pid: s.pid,
      exitCode: s.exitCode,
      isRunning: s.isRunning,
      createdAt: s.createdAt,
      outputLineCount: s.outputBuffer.length,
    };
  }

  stopProcess(sessionId: string, signal: string = "SIGTERM"): void {
    const session = this.getSession(sessionId);
    if (!session.isRunning) {
      throw new Error(`Session ${sessionId} is already stopped`);
    }
    session.pty.kill(signal);
  }

  private getSession(sessionId: string): TerminalSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }
}
