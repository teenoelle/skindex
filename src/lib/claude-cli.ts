import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function callClaude(prompt: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("claude", ["--print", prompt], {
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
