import * as fs from 'fs/promises';
import * as path from 'path';

const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');

export async function delegate_to_ollama(filePath: string, instruction: string): Promise<string> {
  const localHost = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  const localModel = process.env.INFERENCE_MODEL || 'llama3.2:1b';

  let primaryHost = localHost;
  let primaryModel = localModel;
  
  if (process.env.OLLAMA_REMOTE_ENABLED === 'true' && process.env.REMOTE_OLLAMA_HOST) {
    primaryHost = process.env.REMOTE_OLLAMA_HOST;
    if (process.env.REMOTE_INFERENCE_MODEL) {
       primaryModel = process.env.REMOTE_INFERENCE_MODEL;
    }
  }

  let fileContent = '';
  try {
    const fullPath = path.resolve(WORKSPACE_DIR, filePath);
    if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return `Error: Access denied. Cannot read files outside of workspace.`;
    }
    fileContent = await fs.readFile(fullPath, 'utf-8');
  } catch (e: any) {
    return `Error reading file ${filePath}: ${e.message}`;
  }

  const prompt = `Instruction: ${instruction}\n\nFile Content:\n\`\`\`\n${fileContent}\n\`\`\`\n`;

  async function tryFetch(host: string, modelName: string) {
    return fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt: prompt, stream: false })
    });
  }

  try {
    let response;
    try {
      response = await tryFetch(primaryHost, primaryModel);
    } catch (err) {
      if (primaryHost !== localHost) {
        console.warn(`Remote Ollama failed, falling back to local ${localHost}`);
        response = await tryFetch(localHost, localModel);
      } else {
        throw err;
      }
    }

    if (!response.ok) {
      return `Failed to fetch from Ollama: ${response.statusText}`;
    }

    const data: any = await response.json();
    return data.response;
  } catch (e: any) {
    return `Error connecting to Ollama: ${e.message}`;
  }
}
