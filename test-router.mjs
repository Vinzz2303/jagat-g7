import { HybridRouter } from './src/colony/hybrid-router.js';

const JAGAT_ROUTER_PROMPT = `Anda adalah "JAGAT Cognitive Router" untuk JAGAT Bot.
Tugas Anda: Membaca pesan user dan mengklasifikasikan intent (niat) utama ke dalam salah satu kategori berikut:
- "CASUAL_CHAT": Obrolan santai, pertanyaan umum, perkenalan diri (siapa anda/saya), diskusi, atau pernyataan untuk istirahat/jeda. WAJIB pilih ini jika user hanya bertanya.
- "FIND_PROSPECT": Perintah EKSPLISIT untuk mencarikan kontak/prospek WhatsApp saat ini (misal: "cari prospek", "cari nomor baru"). JANGAN pilih ini jika user hanya bertanya.
- "START_SWARM": Perintah EKSPLISIT untuk menjalankan/menembakkan swarm revenue (email masal, massal, dll).
- "IT_COMMAND": Perintah teknis IT (cek RAM, hapus file, baca log, jalankan script selain swarm).
- "FIND_VENTURE": Perintah EKSPLISIT untuk mencari, meriset, atau menghubungi Venture Capital saat ini.

PENTING:
- Jika pesan berupa pertanyaan perkenalan seperti "siapa anda" atau "siapa fatur", MUTLAK pilih "CASUAL_CHAT".
- Jika pesan berisi rencana masa depan seperti "sebelum kita nyari venture", maka itu BUKAN FIND_VENTURE atau FIND_PROSPECT saat ini, melainkan CASUAL_CHAT.

HANYA BERIKAN OUTPUT JSON murni:
{
  "intent": "CASUAL_CHAT" | "FIND_PROSPECT" | "START_SWARM" | "IT_COMMAND" | "FIND_VENTURE",
  "reasoning": "alasan singkat"
}`;

async function test() {
  const text = "siapa anda dan siapakah faturachman al kahfi";
  const prompt = `Konteks obrolan sebelumnya:\n\n\nPesan User saat ini:\n"${text}"\n\nTentukan intent dari pesan di atas!`;
  try {
    console.log("Calling Groq...");
    const res = await HybridRouter.callGroqFast(prompt, JAGAT_ROUTER_PROMPT, false);
    console.log("RAW RESP:", res);
    const cleaned = res.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log("PARSED:", parsed);
  } catch(e) {
    console.error(e);
  }
}
test();
