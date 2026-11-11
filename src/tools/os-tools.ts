import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Restrict all OS tools to the workspace folder for safety
const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');

/**
 * Enforce workspace boundaries for paths and symlinks. Arbitrary shell execution
 * is disabled by default (agent prompt injection must not become OS execution).
 */
function insideWorkspace(base: string, target: string): boolean {
  const relative = path.relative(base, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function enforceWorkspace(targetPath: string, forWrite = false): Promise<string> {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  const base = await fs.realpath(WORKSPACE_DIR);
  const resolvedPath = path.resolve(base, targetPath);
  if (!insideWorkspace(base, resolvedPath)) throw new Error("Access denied: outside workspace");
  if (forWrite) {
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    const parent = await fs.realpath(path.dirname(resolvedPath));
    if (!insideWorkspace(base, parent)) throw new Error("Access denied: symlink outside workspace");
    try {
      const actual = await fs.realpath(resolvedPath);
      if (!insideWorkspace(base, actual)) throw new Error("Access denied: symlink outside workspace");
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }
  } else {
    const actual = await fs.realpath(resolvedPath);
    if (!insideWorkspace(base, actual)) throw new Error("Access denied: symlink outside workspace");
  }
  return resolvedPath;
}

export async function read_file(filePath: string): Promise<string> {
  try {
    const safePath = await enforceWorkspace(filePath);
    const content = await fs.readFile(safePath, 'utf8');
    return content;
  } catch (e: any) {
    return `Error reading file: ${e.message}`;
  }
}

export async function write_file(filePath: string, content: string): Promise<string> {
  try {
    const safePath = await enforceWorkspace(filePath, true);
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    await fs.writeFile(safePath, content, 'utf8');
    return `File ${filePath} written successfully.`;
  } catch (e: any) {
    return `Error writing file: ${e.message}`;
  }
}

export async function run_command(command: string): Promise<string> {
  try {
    // Commands supplied by an LLM are arbitrary code, NOT safe to filter via strings.
    if (process.env.JAGAT_ALLOW_AGENT_SHELL !== "true") {
      return "Error: AI shell execution is disabled. Explicit administrator opt-in required.";
    }
    // Only enable for isolated disposable worker environments, never general RDP.
    await fs.mkdir(WORKSPACE_DIR, { recursive: true });
    // Execute command within the workspace directory
    const { stdout, stderr } = await execAsync(command, { cwd: WORKSPACE_DIR, timeout: 15000 });
    let output = "";
    if (stdout) output += `STDOUT:\n${stdout}\n`;
    if (stderr) output += `STDERR:\n${stderr}\n`;
    return output || "Command executed successfully with no output.";
  } catch (e: any) {
    return `Error executing command: ${e.message}\nSTDOUT: ${e.stdout}\nSTDERR: ${e.stderr}`;
  }
}
