import pptxgen from "pptxgenjs";

const pptx = new pptxgen();

pptx.layout = "LAYOUT_16x9";

// Define Master Slide
pptx.defineSlideMaster({
  title: "MASTER_SLIDE",
  background: { color: "111827" }, // Dark background
  objects: [
    { rect: { x: 0, y: 0, w: "100%", h: "0.2", fill: { color: "38BDF8" } } } // Top accent line
  ],
});

// Helper for generic slide
function addSlide(title, bulletPoints, presenterNotes) {
  let slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });
  
  // Title
  slide.addText(title, {
    x: 0.5, y: 0.5, w: "90%", h: 1, 
    color: "38BDF8", fontSize: 32, bold: true, fontFace: "Arial"
  });
  
  // Content
  slide.addText(bulletPoints.map(t => ({ text: t, options: { bullet: true, breakLine: true } })), {
    x: 0.5, y: 1.8, w: "90%", h: 3.5, 
    color: "FFFFFF", fontSize: 24, fontFace: "Arial", lineSpacing: 36
  });

  // Notes
  if (presenterNotes) {
    slide.addNotes(presenterNotes);
  }
}

// Slide 1
let slide1 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide1.addText("JAGAT G7", { x: "10%", y: "40%", w: "80%", h: 1, color: "38BDF8", fontSize: 54, bold: true, align: "center", fontFace: "Arial" });
slide1.addText("Sovereign Super Intelligence Core\nMembangun Otak Buatan Berdaulat untuk Kemandirian Digital", { x: "10%", y: "55%", w: "80%", h: 1.5, color: "9CA3AF", fontSize: 24, align: "center", fontFace: "Arial" });
slide1.addNotes("Selamat pagi/siang. Kami adalah JAGAT G7. Kami tidak sekadar membangun aplikasi AI, kami sedang membangun otak buatan yang berdaulat, yang dapat diandalkan oleh korporasi dan institusi tanpa kompromi pada keamanan data.");

// Slide 2
addSlide(
  "The Problem: AI Dependency & Data Vulnerability",
  [
    "Korporasi terlalu bergantung pada AI Cloud asing (OpenAI/ChatGPT).",
    "Data sensitif perusahaan, rahasia negara, dan memori institusi mengalir ke luar negeri.",
    "Perusahaan tidak memiliki kendali penuh atas 'otak' sistem operasional mereka."
  ],
  "Saat ini, hampir setiap institusi ingin menggunakan AI. Tapi sayangnya, mereka menggunakan API dari luar negeri. Artinya, setiap rahasia perusahaan, setiap data klien, dikirim keluar. Dan ketika server luar negeri mati, operasional bisnis ikut lumpuh."
);

// Slide 3
addSlide(
  "The Solution: Sovereign Intelligence",
  [
    "JAGAT G7 berjalan sepenuhnya di infrastruktur lokal (On-Premise).",
    "In-House Memory: Basis data memori vektor (Qdrant) milik sendiri.",
    "Autonomous Protocol: Berpikir dan bertindak tanpa API asing.",
    "Zero Data Leakage: 100% data menetap di server Anda."
  ],
  "Solusinya adalah JAGAT G7. Kami membangun kecerdasan buatan berdaulat. Data Anda, memori sistem Anda, dan proses berpikir AI semuanya terkunci rapat di dalam infrastruktur lokal yang Anda kendalikan secara penuh."
);

// Slide 4
addSlide(
  "4 Pilar Ekosistem JAGAT G7",
  [
    "Infrastruktur Berdaulat: Server Bare-Metal (Ryzen/Dell PowerEdge).",
    "Memori Berdaulat: Hybrid Vector Search & RAG.",
    "Penalaran Berdaulat: Protokol Logika Kognitif Mandiri.",
    "Eksekusi Berdaulat: Aksi otonom oleh agen AI (Swarm Agent)."
  ],
  "Inilah rahasia dapur kami. Berbeda dengan startup lain yang hanya merakit 'kulit' dari ChatGPT, JAGAT membangun mesinnya dari nol. Kami memiliki sistem memori, penalaran logika, dan agen otonom yang bisa melakukan tugas secara paralel."
);

// Slide 5
addSlide(
  "Traction & Milestones: JAGAT IS LIVE!",
  [
    "Phase 1-3 Selesai: Cognitive Core & Sovereign Memory telah online.",
    "Autonomous Revenue Swarm: Beroperasi mandiri 24/7.",
    "100% Local Inference: Tidak bergantung pada koneksi cloud eksternal."
  ],
  "JAGAT G7 bukan sekadar ide di atas kertas. Saat kita berbicara di ruangan ini, armada AI JAGAT sedang bekerja secara otonom di latar belakang, memetakan prospek dan merangkai penawaran komersial."
);

// Slide 6
addSlide(
  "Use Case Implementation",
  [
    "Kiting AI & Ting AI: Agen untuk Customer Service dan mitigasi risiko.",
    "B2B / Kampus: Pengelolaan data institusi yang ketat privasi.",
    "Enterprise On-Premise: Otak AI internal untuk BUMN / Perusahaan Tbk."
  ],
  "Sistem ini siap diadopsi oleh berbagai sektor yang memiliki aturan kerahasiaan ketat."
);

// Slide 7
addSlide(
  "How We Make Money",
  [
    "B2B SaaS (Subscription): Langganan bulanan untuk pemakaian agen.",
    "Enterprise Licensing: Lisensi pemasangan on-premise di server perusahaan.",
    "API Gateway (Pay-per-use): Skema komersial berjenjang."
  ],
  "Model bisnis kami sangat terukur, dari SaaS untuk bisnis kecil hingga lisensi Enterprise untuk korporasi besar."
);

// Slide 8
addSlide(
  "The Future of JAGAT G7",
  [
    "Q3 2026: Finalisasi Downstream Agents (Fase 4).",
    "Q4 2026: Rilis Commercial Gateway (Fase 5) untuk Monetisasi Publik.",
    "2027: Skala multi-node server & GPU Inference Acceleration."
  ],
  "Tahun depan, kami siap berekspansi ke arsitektur jaringan multi-node bertenaga GPU tinggi yang menjadikan JAGAT pusat kekuatan AGI."
);

// Slide 9
addSlide(
  "The Core Architect",
  [
    "Faturachman Al Kahfi (Founder & Chief Architect)",
    "Didukung oleh JAGAT AI Armada - Pasukan AI Otonom.",
    "Menggantikan ratusan staf dengan efisiensi mesin."
  ],
  "Saya menciptakan armada AI pribadi yang bekerja sebagai karyawan saya 24 jam sehari untuk membantu coding dan eksekusi."
);

// Slide 10
let slide10 = pptx.addSlide({ masterName: "MASTER_SLIDE" });
slide10.addText("Join The Future of Sovereign Intelligence", { x: "10%", y: "25%", w: "80%", h: 1, color: "38BDF8", fontSize: 36, bold: true, align: "center", fontFace: "Arial" });
slide10.addText("Mencari Seed Funding / Strategic Partnership\n\nAlokasi Dana:\n• Pengadaan Infrastruktur Server & GPU (Dell PowerEdge)\n• Akselerasi Go-To-Market Commercial Gateway", { x: "10%", y: "45%", w: "80%", h: 2, color: "FFFFFF", fontSize: 24, align: "center", fontFace: "Arial" });
slide10.addNotes("Visi kami sudah terbukti berjalan sebagai MVP. Hari ini, kami mengundang Anda untuk mendanai lompatan besar berikutnya: membangun infrastruktur fisik yang akan menghidupkan AGI berdaulat pertama di ekosistem ini.");


pptx.writeFile({ fileName: "JAGAT_G7_PITCH_DECK.pptx" })
  .then(fileName => {
    console.log(`created file: ${fileName}`);
  });
