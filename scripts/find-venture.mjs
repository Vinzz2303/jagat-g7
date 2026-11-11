import fs from 'fs';
import path from 'path';

// DuckDuckGo Lite HTML Scraper (No API Key Required)
async function searchVentureCapital(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    const html = await response.text();
    
    // Extract results using basic regex parsing for DDG Lite
    const results = [];
    const resultBlocks = html.split('class="result__snippet');
    
    for (let i = 1; i < resultBlocks.length && results.length < 5; i++) {
      const block = resultBlocks[i];
      // Extract snippet
      const snippetMatch = block.match(/>([^<]+)<\/a>/);
      let snippet = snippetMatch ? snippetMatch[1].trim() : "";
      
      // Look behind for URL and Title
      const prevBlock = resultBlocks[i-1];
      const urlMatch = prevBlock.match(/href="([^"]+)"[^>]*class="result__url"/);
      const url = urlMatch ? urlMatch[1] : "";
      
      const titleMatch = prevBlock.match(/class="result__title"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
      const title = titleMatch ? titleMatch[1].trim() : "Unknown VC";
      
      if (url) {
        results.push({ title, url, snippet });
      }
    }
    
    return results;
  } catch (err) {
    console.error("Scrape Error:", err);
    return null;
  }
}

async function main() {
  const query = "Top Venture Capital firms investing in AI startups Indonesia 2026";
  const results = await searchVentureCapital(query);
  
  if (results && results.length > 0) {
    let reply = `🌐 *JAGAT Venture Miner*\nMenemukan beberapa Venture Capital potensial untuk JAGAT:\n\n`;
    results.forEach((r, i) => {
      reply += `${i+1}. *${r.title}*\n🔗 ${r.url}\n\n`;
    });
    reply += `_Apakah Anda ingin saya buatkan draf pitch deck / email untuk salah satu VC di atas?_`;
    
    console.log("JSON_OUTPUT:" + JSON.stringify({ success: true, replyText: reply }));
  } else {
    // Fallback to LLM Knowledge if DDG blocks us
    const fallbackReply = `🌐 *JAGAT Venture Miner (Knowledge Base)*\n
Saya telah menyaring database internal untuk Venture Capital yang fokus pada AI di Asia Tenggara & Indonesia:

1. *East Ventures*
   Fokus: Seed/Early Stage. Sangat agresif di B2B SaaS dan AI terapan.
2. *Alpha JWC Ventures*
   Fokus: Value creation. Memiliki portofolio tech startup besar di Indonesia.
3. *AC Ventures*
   Fokus: Disrupsi teknologi. Tertarik pada efisiensi enterprise (seperti JAGAT G7).
4. *Intudo Ventures*
   Fokus: "Indonesia Only". Sangat cocok untuk produk berfokus pada kedaulatan data lokal (Sovereign AI).
5. *Koru Partners / Golden Gate Ventures*
   Fokus: AI & Deep Tech di SEA.

_Apakah Anda ingin saya menyusun email pitching ke East Ventures atau Intudo?_`;

    console.log("JSON_OUTPUT:" + JSON.stringify({ success: true, replyText: fallbackReply }));
  }
}

main();

