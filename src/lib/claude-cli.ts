import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// Strip Claude Code session vars so the child process starts as a fresh
// non-interactive invocation rather than detecting it's inside a session.
const childEnv = { ...process.env };
for (const key of ["CLAUDECODE", "CLAUDE_CODE_SESSION_ID", "CLAUDE_CODE_ENTRYPOINT", "AI_AGENT", "CLAUDE_EFFORT"]) {
  delete childEnv[key];
}

export async function callClaude(prompt: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("claude", ["--print", prompt], {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
      env: childEnv,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
