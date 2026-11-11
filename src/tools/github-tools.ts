import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);
const WORKSPACE_DIR = path.join(process.cwd(), 'workspace');

export async function search_github_bounties(query: string): Promise<string> {
  // Using GitHub Search API to find issues with specific labels
  const token = process.env.GITHUB_PAT;
  if (!token) return "Error: GITHUB_PAT not configured.";

  try {
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query + ' state:open label:bounty')}&sort=created&order=desc&per_page=5`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'JAGAT-JARVIS-Agent'
      }
    });

    if (!response.ok) {
      return `Failed to fetch from GitHub API: ${response.statusText}`;
    }

    const data: any = await response.json();
    if (!data.items || data.items.length === 0) {
      return "No bounties found for this query.";
    }

    let result = "Top 5 Bounties Found:\n";
    for (const item of data.items) {
      result += `- Title: ${item.title}\n  URL: ${item.html_url}\n  Repo: ${item.repository_url.split('/').slice(-2).join('/')}\n\n`;
    }
    return result;
  } catch (e: any) {
    return `Error searching bounties: ${e.message}`;
  }
}

export async function clone_github_repo(repoName: string): Promise<string> {
  const token = process.env.GITHUB_PAT;
  if (!token) return "Error: GITHUB_PAT not configured.";

  try {
    const cloneUrl = `https://${token}@github.com/${repoName}.git`;
    const targetDir = path.join(WORKSPACE_DIR, repoName.split('/')[1] || repoName);

    // Cleanup if already exists
    try {
      await fs.rm(targetDir, { recursive: true, force: true });
    } catch(e) {}

    const { stdout, stderr } = await execAsync(`git clone ${cloneUrl} ${targetDir}`, { cwd: WORKSPACE_DIR });
    return `Repository ${repoName} cloned successfully into workspace/${repoName.split('/')[1] || repoName}.\n${stdout}\n${stderr}`;
  } catch (e: any) {
    return `Failed to clone repository: ${e.message}`;
  }
}

export async function submit_pull_request(repoName: string, title: string, body: string, headBranch: string): Promise<string> {
  const token = process.env.GITHUB_PAT;
  const payoutWallet = process.env.PAYOUT_WALLET || '0x967bE62001c48EadFeF8787b42494f59406D55b5';
  if (!token) return "Error: GITHUB_PAT not configured.";

  try {
    const prBody = `${body}\n\n---\n*Fix implemented by JAGAT Autonomous Agent.*\n**Bounty Payout Address:** \`${payoutWallet}\` (USDT - ERC20)`;
    
    const url = `https://api.github.com/repos/${repoName}/pulls`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'JAGAT-JARVIS-Agent',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        body: prBody,
        head: headBranch,
        base: 'main' // assuming main, might need to be dynamic in a real scenario
      })
    });

    const data: any = await response.json();
    if (response.ok) {
      return `Pull Request created successfully! URL: ${data.html_url}`;
    } else {
      return `Failed to create PR: ${JSON.stringify(data)}`;
    }
  } catch (e: any) {
    return `Error submitting Pull Request: ${e.message}`;
  }
}

export async function comment_on_github_issue(repoName: string, issueNumber: number, body: string): Promise<string> {
  const token = process.env.GITHUB_PAT;
  if (!token) return "Error: GITHUB_PAT not configured.";

  try {
    const url = `https://api.github.com/repos/${repoName}/issues/${issueNumber}/comments`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'JAGAT-JARVIS-Agent',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ body })
    });

    const data: any = await response.json();
    if (response.ok) {
      return `Comment posted successfully! URL: ${data.html_url}`;
    } else {
      return `Failed to post comment: ${JSON.stringify(data)}`;
    }
  } catch (e: any) {
    return `Error posting comment: ${e.message}`;
  }
}

export async function fork_github_repo(repoName: string): Promise<string> {
  const token = process.env.GITHUB_PAT;
  if (!token) return "Error: GITHUB_PAT not configured.";

  try {
    const url = `https://api.github.com/repos/${repoName}/forks`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'JAGAT-JARVIS-Agent',
        'Content-Type': 'application/json'
      }
    });

    const data: any = await response.json();
    if (response.ok || response.status === 202) {
      return `Repository forked successfully! Your new fork is at: ${data.full_name}. You should clone THIS repository (${data.full_name}) to make your changes, and then submit a PR from your fork's branch to the original repo.`;
    } else {
      return `Failed to fork repository: ${JSON.stringify(data)}`;
    }
  } catch (e: any) {
    return `Error forking repository: ${e.message}`;
  }
}
