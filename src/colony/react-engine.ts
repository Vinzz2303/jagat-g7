import { GoogleGenerativeAI, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import * as osTools from '../tools/os-tools.js';
import * as githubTools from '../tools/github-tools.js';
import * as ollamaTools from '../tools/ollama-tools.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Tool Definitions for Gemini
const fileSystemTools = {
  read_file: {
    name: "read_file",
    description: "Read the content of a file from the local workspace.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filePath: { type: SchemaType.STRING, description: "Path to the file relative to workspace." },
      },
      required: ["filePath"],
    },
  },
  write_file: {
    name: "write_file",
    description: "Write content to a file in the local workspace.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        filePath: { type: SchemaType.STRING, description: "Path to the file relative to workspace." },
        content: { type: SchemaType.STRING, description: "Content to write into the file." },
      },
      required: ["filePath", "content"],
    },
  },
  run_command: {
    name: "run_command",
    description: "Run a shell command (e.g., git, npm, node, python) in the workspace directory.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        command: { type: SchemaType.STRING, description: "The shell command to execute." },
      },
      required: ["command"],
    },
  },
  browse_web: {
    name: "browse_web",
    description: "Navigate to a URL and complete a goal using an autonomous browser agent. Returns a report of what was found.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        url: { type: SchemaType.STRING, description: "The starting URL." },
        goal: { type: SchemaType.STRING, description: "What to look for or do on the website." }
      },
      required: ["url", "goal"],
    }
  },
  search_github_bounties: {
    name: "search_github_bounties",
    description: "Search GitHub for open issues with the 'bounty' label based on a query.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { query: { type: SchemaType.STRING, description: "Search query, e.g., 'react', 'nextjs'" } },
      required: ["query"],
    }
  },
  clone_github_repo: {
    name: "clone_github_repo",
    description: "Clone a GitHub repository into the local workspace.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { repoName: { type: SchemaType.STRING, description: "Format: owner/repo" } },
      required: ["repoName"],
    }
  },
  submit_pull_request: {
    name: "submit_pull_request",
    description: "Submit a Pull Request to a GitHub repository.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { 
        repoName: { type: SchemaType.STRING },
        title: { type: SchemaType.STRING },
        body: { type: SchemaType.STRING },
        headBranch: { type: SchemaType.STRING }
      },
      required: ["repoName", "title", "body", "headBranch"],
    }
  },
  comment_on_github_issue: {
    name: "comment_on_github_issue",
    description: "Post a comment on a GitHub issue. Useful for claiming bounties (e.g., commenting '/attempt').",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { 
        repoName: { type: SchemaType.STRING, description: "Format: owner/repo" },
        issueNumber: { type: SchemaType.NUMBER },
        body: { type: SchemaType.STRING, description: "The comment text." }
      },
      required: ["repoName", "issueNumber", "body"],
    }
  },
  delegate_to_ollama: {
    name: "delegate_to_ollama",
    description: "Delegate heavy code reading, analysis, or generation to a local Ollama worker model. Use this instead of reading long files yourself to save tokens.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { 
        filePath: { type: SchemaType.STRING, description: "Path to the file to analyze, relative to workspace." },
        instruction: { type: SchemaType.STRING, description: "Specific instruction for the local model (e.g. 'find the bug and output the patched code snippet')." }
      },
      required: ["filePath", "instruction"],
    }
  },
  fork_github_repo: {
    name: "fork_github_repo",
    description: "Fork a GitHub repository to your own account. ALWAYS do this BEFORE cloning if you intend to submit a Pull Request to a third-party repo.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: { 
        repoName: { type: SchemaType.STRING, description: "Format: owner/repo" }
      },
      required: ["repoName"],
    }
  }
};

const SYSTEM_INSTRUCTION = `Anda adalah "JAGAT JARVIS", sebuah AI Agent otonom level tinggi.
Anda memiliki akses ke komputer (VPS) melalui Tools. Workspace Anda adalah folder \`workspace/\`.
Tugas Anda adalah menyelesaikan tujuan yang diberikan oleh user.
Langkah yang harus Anda ikuti:
1. Pikirkan apa yang harus dilakukan.
2. Gunakan Tool jika perlu.
3. JIKA Anda perlu membaca, menganalisis, atau memperbaiki file kode yang panjang, **SELALU gunakan tool \`delegate_to_ollama\`**.
4. JIKA Anda ingin berkontribusi (submit PR) ke repositori pihak ketiga, **SELALU jalankan \`fork_github_repo\` terlebih dahulu**, lalu clone repositori hasil fork tersebut, BUKAN repositori aslinya.
5. Lakukan langkah selanjutnya sampai tujuan tercapai.
JANGAN MENGASUMSIKAN SESUATU. Jika butuh test, jalankan command.`;

export class ReActEngine {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set in environment.");
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // We use gemini-2.5-flash as it is extremely cost-effective for paid API while supporting full multi-turn function calling
    this.model = this.genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{
        functionDeclarations: [
          fileSystemTools.read_file as FunctionDeclaration,
          fileSystemTools.write_file as FunctionDeclaration,
          ...(process.env.JAGAT_ALLOW_AGENT_SHELL === "true"
            ? [fileSystemTools.run_command as FunctionDeclaration] : []),
          fileSystemTools.browse_web as FunctionDeclaration,
          fileSystemTools.search_github_bounties as FunctionDeclaration,
          fileSystemTools.clone_github_repo as FunctionDeclaration,
          fileSystemTools.submit_pull_request as FunctionDeclaration,
          fileSystemTools.comment_on_github_issue as FunctionDeclaration,
          fileSystemTools.delegate_to_ollama as FunctionDeclaration,
          fileSystemTools.fork_github_repo as FunctionDeclaration,
        ]
      }]
    });
  }

  async runGoal(goal: string, callback?: (msg: string) => void): Promise<string> {
    if (callback) callback(`🧠 JAGAT JARVIS memulai misi: "${goal}"`);
    
    const chat = this.model.startChat({ history: [] });
    let prompt = goal;
    let iteration = 0;
    const MAX_ITERATIONS = 60;

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      try {
        const result = await chat.sendMessage(prompt);
        const response = result.response;
        
        // Cek jika AI memanggil fungsi (Tool Use)
        const functionCalls = response.functionCalls();
        if (functionCalls && functionCalls.length > 0) {
          const call = functionCalls[0];
          if (callback) callback(`🛠️ JARVIS menggunakan tool: \`${call.name}\``);
          
          let toolResult = "";
          
          if (call.name === "read_file") {
            const args = call.args as any;
            toolResult = await osTools.read_file(args.filePath);
          } 
          else if (call.name === "write_file") {
            const args = call.args as any;
            toolResult = await osTools.write_file(args.filePath, args.content);
          } 
          else if (call.name === "run_command") {
            const args = call.args as any;
            toolResult = await osTools.run_command(args.command);
          }
          else if (call.name === "browse_web") {
            const args = call.args as any;
            const { executeAgenticBrowsing } = await import('./browser-engine.js');
            const res = await executeAgenticBrowsing(args.url, args.goal, 5);
            toolResult = res.report;
          }
          else if (call.name === "search_github_bounties") {
            const args = call.args as any;
            toolResult = await githubTools.search_github_bounties(args.query);
          }
          else if (call.name === "clone_github_repo") {
            const args = call.args as any;
            toolResult = await githubTools.clone_github_repo(args.repoName);
          }
          else if (call.name === "submit_pull_request") {
            const args = call.args as any;
            toolResult = await githubTools.submit_pull_request(args.repoName, args.title, args.body, args.headBranch);
          }
          else if (call.name === "comment_on_github_issue") {
            const args = call.args as any;
            toolResult = await githubTools.comment_on_github_issue(args.repoName, args.issueNumber, args.body);
          }
          else if (call.name === "delegate_to_ollama") {
            const args = call.args as any;
            toolResult = await ollamaTools.delegate_to_ollama(args.filePath, args.instruction);
          }
          else if (call.name === "fork_github_repo") {
            const args = call.args as any;
            toolResult = await githubTools.fork_github_repo(args.repoName);
          }

          // Truncate tool result if too long to save context window
          if (toolResult.length > 10000) {
            toolResult = toolResult.substring(0, 10000) + "...[TRUNCATED]";
          }

          // Lempar kembali hasil ke AI
          prompt = [{
            functionResponse: {
              name: call.name,
              response: { result: toolResult }
            }
          }] as any;
          
        } else {
          // AI tidak memanggil fungsi, berarti dia menjawab text / selesai
          const finalAnswer = response.text();
          if (callback) callback(`✅ JARVIS Selesai:\n${finalAnswer}`);
          return finalAnswer;
        }
        
      } catch (e: any) {
        console.error("ReAct Loop Error:", e);
        if (callback) callback(`❌ JARVIS Error: ${e.message}`);
        return `Failed: ${e.message}`;
      }
    }

    const abortMsg = `⚠️ JARVIS dihentikan karena mencapai batas maksimal ${MAX_ITERATIONS} langkah.`;
    if (callback) callback(abortMsg);
    return abortMsg;
  }
}
