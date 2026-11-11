// @ts-nocheck
// ============================================================================
// JAGAT Colony — Browser Engine (Dynamic Agentic Browsing)
// ============================================================================

import puppeteer, { Browser, Page } from 'puppeteer';
import { HybridRouter } from '../services/hybrid-router.js';

export interface BrowserActionResult {
  success: boolean;
  finalUrl: string;
  report: string;
  error?: string;
}

/**
 * Extracts a simplified, LLM-friendly view of the page focusing on text and interactive elements.
 */
async function extractSimplifiedDOM(page: Page): Promise<string> {
  return page.evaluate(() => {
    const elements = Array.from(document.body.querySelectorAll('a, button, input, h1, h2, h3, p'));
    let domText = '';
    
    elements.forEach((el, index) => {
      const isVisible = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      if (!isVisible) return;

      const tag = el.tagName.toLowerCase();
      let text = (el as HTMLElement).innerText?.trim() || '';
      if (!text && tag === 'input') text = (el as HTMLInputElement).placeholder || 'input field';
      if (!text) return;

      if (tag === 'a') domText += `[LINK ID:${index}] ${text}\n`;
      else if (tag === 'button') domText += `[BUTTON ID:${index}] ${text}\n`;
      else if (tag === 'input') domText += `[INPUT ID:${index}] ${text}\n`;
      else domText += `${text}\n`;
    });

    return domText.substring(0, 4000); // Truncate to save context window
  });
}

/**
 * Executes a high-level browsing goal autonomously using an LLM to drive Puppeteer.
 */
export async function executeAgenticBrowsing(startUrl: string, goal: string, maxSteps = 10): Promise<BrowserActionResult> {
  console.log(`[BrowserEngine] Starting agentic session. URL: ${startUrl} | Goal: ${goal}`);
  let browser: Browser | null = null;
  let report = "Laporan Penjelajahan:\n";

  try {
    browser = await puppeteer.launch({
      headless: true, // Use headless=new or true
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log(`[BrowserEngine] Navigating to ${startUrl}`);
    await page.goto(startUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    for (let step = 1; step <= maxSteps; step++) {
      console.log(`\n[BrowserEngine] --- Step ${step}/${maxSteps} ---`);
      
      const currentUrl = page.url();
      const domContext = await extractSimplifiedDOM(page);
      
      const prompt = `
Goal Anda: ${goal}
URL Saat ini: ${currentUrl}

Isi Halaman (Disederhanakan):
${domContext}

Tugas: Tentukan tindakan SATU LANGKAH berikutnya.
Anda HANYA boleh merespons dalam format JSON yang valid, tanpa teks lain.

Format Aksi yang Diizinkan:
1. Klik elemen (gunakan ID dari teks di atas): {"action": "click", "targetId": 12}
2. Selesai dan laporkan hasil: {"action": "done", "report": "Kesimpulan dari apa yang ditemukan..."}
3. Kunjungi URL baru: {"action": "goto", "url": "https://..."}

Berikan JSON aksi Anda sekarang:`;

      const systemContext = "Anda adalah agen browser otonom JAGAT G7. Anda berpikir taktis, mengevaluasi halaman, dan hanya membalas dengan JSON yang ketat.";
      
      console.log(`[BrowserEngine] Meminta keputusan dari Groq (LPU)...`);
      const responseStr = await HybridRouter.callGroqFast(prompt, systemContext, true);

      let actionJson;
      try {
        const jsonMatch = responseStr.match(/\{[\s\S]*\}/);
        actionJson = JSON.parse(jsonMatch ? jsonMatch[0] : responseStr);
        console.log(`[BrowserEngine] LLM Decision:`, actionJson);
      } catch (e) {
        console.error(`[BrowserEngine] Failed to parse LLM response as JSON: ${responseStr}`);
        return { success: false, finalUrl: page.url(), report, error: "LLM gagal merespons dengan JSON valid." };
      }

      if (actionJson.action === 'done') {
        report += `\nMISI SELESAI:\n${actionJson.report}\n`;
        return { success: true, finalUrl: page.url(), report };
      } 
      else if (actionJson.action === 'goto') {
        report += `-> Navigasi ke ${actionJson.url}\n`;
        await page.goto(actionJson.url, { waitUntil: 'networkidle2' });
      }
      else if (actionJson.action === 'click') {
        report += `-> Klik elemen ID ${actionJson.targetId}\n`;
        
        // Inject script to click the exact element by ID index
        await page.evaluate((targetId) => {
          const elements = Array.from(document.body.querySelectorAll('a, button, input, h1, h2, h3, p'));
          const target = elements[targetId] as HTMLElement;
          if (target) {
            target.click();
          }
        }, actionJson.targetId);
        
        // Wait for potential navigation or DOM changes
        await new Promise(r => setTimeout(r, 3000)); 
      }
      else {
        console.log(`[BrowserEngine] Unknown action: ${actionJson.action}`);
      }
    }

    report += `\nMisi dihentikan (Mencapai batas maksimal langkah: ${maxSteps}).`;
    return { success: false, finalUrl: page.url(), report };

  } catch (err: any) {
    console.error(`[BrowserEngine] Error:`, err);
    return { success: false, finalUrl: '', report, error: err.message };
  } finally {
    if (browser) await browser.close();
  }
}
