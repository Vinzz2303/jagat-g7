// ============================================================================
// JAGAT Colony — Voice Engine
// Menghasilkan Voice Note MP3 berbahasa Indonesia menggunakan Google TTS
// ============================================================================

import * as googleTTS from 'google-tts-api';
import fs from 'fs/promises';
import path from 'path';
import { HybridRouter } from '../services/hybrid-router.js';

/**
 * Menggunakan LLM untuk menulis ulang teks kaku menjadi naskah suara yang luwes,
 * santai, dan sangat manusiawi (menghindari singkatan aneh dan gaya robotik).
 */
export async function formatForSpeech(rawText: string): Promise<string> {
  const prompt = `Ubah laporan teknis berikut menjadi naskah pesan suara WhatsApp yang sangat luwes, natural, dan manusiawi untuk Bos (Mas Fatur).
  
Aturan Ketat:
1. JANGAN gunakan kata-kata teknis seperti "ID elemen", "Klik", "Navigasi", "Misi dihentikan", atau "Browser Agent".
2. Bicara layaknya asisten pribadi manusia yang pintar dan santai. 
3. Jangan pakai simbol (*, #, ->). 
4. Jika laporannya error atau kosong, katakan dengan sopan bahwa Anda tidak menemukan banyak hal atau terjadi kendala.
5. Gunakan bahasa Indonesia sehari-hari profesional (contoh: "Halo Mas Fatur, lapor...", "Tadi saya cek...").
6. HANYA keluarkan teks yang akan diucapkan, tanpa embel-embel teks lain.

Laporan Mentah:
${rawText}

Tulis naskah suaranya sekarang:`;

  try {
    const response = await HybridRouter.callGeminiSmart(
      prompt,
      "Anda adalah asisten suara pribadi. Anda menyusun naskah yang hangat dan sangat manusiawi."
    );
    return response;
  } catch (err) {
    console.error("[VoiceEngine] Gagal memformat untuk speech, menggunakan teks asli.", err);
    return rawText;
  }
}

/**
 * Generate Voice Note in MP3 format.
 * Returns the absolute path to the generated MP3 file.
 */
export async function generateVoiceNote(text: string, filename: string): Promise<string> {
  const outputDir = path.resolve(process.cwd(), 'ops/revenue/voice_notes');
  await fs.mkdir(outputDir, { recursive: true });
  
  const outputPath = path.join(outputDir, filename);

  // Clean text from markdown or special characters before speaking
  const cleanText = text
    .replace(/\*/g, '')
    .replace(/_/g, '')
    .replace(/#/g, '')
    .replace(/-/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .substring(0, 5000); // safety limit

  console.log(`[VoiceEngine] Generating audio for: ${filename} (${cleanText.length} chars)`);

  const results = await googleTTS.getAllAudioBase64(cleanText, {
    lang: 'id',
    slow: false,
    host: 'https://translate.google.com',
    timeout: 15000,
  });

  const buffers = results.map(res => Buffer.from(res.base64, 'base64'));
  const finalBuffer = Buffer.concat(buffers);
  
  await fs.writeFile(outputPath, finalBuffer);
  console.log(`[VoiceEngine] Audio saved to: ${outputPath}`);

  return outputPath;
}
