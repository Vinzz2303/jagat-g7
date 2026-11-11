import { delegate_to_ollama } from './tools/ollama-tools.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function run() {
  console.log("Testing Ollama delegation...");
  const result = await delegate_to_ollama(
    'dummy.txt', 
    'Analyze this file and tell me what it does in one sentence.'
  );
  console.log("Response from Ollama:");
  console.log(result);
}

run();
