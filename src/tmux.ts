import { execSync, exec } from "child_process";

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
}

export function startSession(id: string, command: string, cwd?: string): void {
  const cwdOpt = cwd ? `-c ${JSON.stringify(cwd)}` : "";
  const exists = hasSession(id);
  if (exists) throw new Error(`Session already exists: ${id}`);
  execSync(`tmux new-session -d -s ${quote(id)} ${cwdOpt} ${JSON.stringify(command)}`, {
    encoding: "utf-8",
    cwd: cwd || process.cwd(),
  });
}

export function sendKeys(id: string, text: string): void {
  assertSession(id);
  // Use send-keys -l for literal text (no key name interpretation)
  execSync(`tmux send-keys -t ${quote(id)} -l ${JSON.stringify(text)}`, { encoding: "utf-8" });
}

export function sendSpecialKey(id: string, key: string): void {
  assertSession(id);
  execSync(`tmux send-keys -t ${quote(id)} ${key}`, { encoding: "utf-8" });
}

export function capturePane(id: string, start?: number): string {
  assertSession(id);
  const startOpt = start !== undefined ? `-S ${start}` : "-S -";
  try {
    return run(`tmux capture-pane -t ${quote(id)} -p ${startOpt}`);
  } catch {
    return "";
  }
}

export function listSessions(): string[] {
  try {
    const output = run("tmux list-sessions -F '#{session_name}'");
    return output.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

export function hasSession(id: string): boolean {
  try {
    execSync(`tmux has-session -t ${quote(id)} 2>/dev/null`, { encoding: "utf-8" });
    return true;
  } catch {
    return false;
  }
}

export function killSession(id: string): void {
  assertSession(id);
  execSync(`tmux kill-session -t ${quote(id)}`, { encoding: "utf-8" });
}

export function getSessionInfo(id: string): Record<string, string> {
  assertSession(id);
  const format = "#{session_name}|#{session_created}|#{pane_pid}|#{pane_current_command}|#{pane_dead}|#{pane_dead_status}";
  const output = run(`tmux display-message -t ${quote(id)} -p '${format}'`);
  const [name, created, pid, currentCommand, paneDead, deadStatus] = output.split("|");
  return { name, created, pid, currentCommand, paneDead, deadStatus };
}

export function waitForExit(id: string, timeoutMs: number = 30000): Promise<{ exited: boolean; output: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (!hasSession(id)) {
        resolve({ exited: true, output: "" });
        return;
      }
      const info = getSessionInfo(id);
      if (info.paneDead === "1") {
        const output = capturePane(id);
        resolve({ exited: true, output });
        return;
      }
      if (Date.now() - start > timeoutMs) {
        const output = capturePane(id);
        resolve({ exited: false, output });
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}

function assertSession(id: string): void {
  if (!hasSession(id)) throw new Error(`Session not found: ${id}`);
}

function quote(s: string): string {
  // tmux session names: escape for shell safety
  return JSON.stringify(s);
}
