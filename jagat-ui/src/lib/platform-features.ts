export interface PlatformFeatureSection {
  title: string;
  body: string;
}

export interface PlatformFeatureCard {
  label: string;
  value: string;
  hint: string;
}

export interface PlatformFeaturePageContent {
  slug: "rag-pipeline" | "vector-memory" | "multi-agent-orchestration";
  eyebrow: string;
  title: string;
  intro: string;
  outcome: string;
  highlights: string[];
  sections: PlatformFeatureSection[];
  metrics: PlatformFeatureCard[];
}

export const PLATFORM_FEATURE_PAGES: Record<string, PlatformFeaturePageContent> = {
  "rag-pipeline": {
    slug: "rag-pipeline",
    eyebrow: "Platform Feature / Retrieval-Augmented Generation",
    title: "RAG Pipeline yang bisa diaudit, bukan sekadar pencarian tempelan.",
    intro:
      "JAGAT G7 memakai retrieval yang dibangun dari korpus strategis founder, bukan konteks acak yang datang dari luar perimeter. Setiap jawaban penting diarahkan kembali ke sumber yang benar-benar dipakai.",
    outcome:
      "Fitur ini menjaga agar jawaban proyek, roadmap, risiko, dan keputusan tetap bertumpu pada memori berdaulat yang terkurasi.",
    highlights: [
      "Schema ingest formal mengunci metadata, provenance, dan trust level sebelum dokumen masuk ke memori.",
      "Hybrid retrieval dense + sparse menjaga pertanyaan teknis tetap relevan untuk istilah spesifik dan konteks konseptual sekaligus.",
      "Citation UI hanya muncul dari sumber yang benar-benar dipakai oleh backend, bukan hiasan palsu.",
    ],
    sections: [
      {
        title: "Ingest yang ketat sebelum retrieval dimulai",
        body:
          "Phase 3A dan 3B menolak ingest liar. Dokumen harus punya title, source, category, owner, created_at, trust_level, dan provenance. Tujuannya sederhana: JAGAT tidak boleh pintar dari sampah yang tidak jelas asal-usulnya.",
      },
      {
        title: "Chunking semantik yang tetap membawa konteks",
        body:
          "Dokumen roadmap, blueprint, milestone, dan dokumen operasional dipecah menjadi fragmen yang tetap bisa dibaca manusia. Tiap chunk membawa metadata induk agar retrieval dapat dilacak kembali saat audit.",
      },
      {
        title: "Retrieval yang relevan dan bisa ditunjukkan buktinya",
        body:
          "Hybrid search menggabungkan dense dan sparse signal agar pertanyaan strategis dan teknis tidak jatuh ke fragmen yang salah. Jawaban kemudian menampilkan sumber memori yang benar-benar ikut membentuk respons.",
      },
    ],
    metrics: [
      { label: "Strategic Docs", value: "13", hint: "Wave 1 + Wave 2 curated corpus" },
      { label: "Qdrant Points", value: "183", hint: "Memory points already indexed" },
      { label: "Benchmarks", value: "10/10", hint: "Cognitive benchmark pass" },
    ],
  },
  "vector-memory": {
    slug: "vector-memory",
    eyebrow: "Platform Feature / Sovereign Memory",
    title: "Vector memory yang menjaga provenance, bukan sekadar menumpuk embedding.",
    intro:
      "Memori JAGAT G7 dibangun agar setiap fragmen pengetahuan punya identitas, owner, kategori, dan tingkat kepercayaan yang jelas. Ini membuat retrieval tetap bisa dipertanggungjawabkan saat sistem tumbuh.",
    outcome:
      "Founder dapat memperluas korpus strategis tanpa merusak kualitas reasoning dan tanpa membuka pintu untuk prompt pollution.",
    highlights: [
      "Deterministic point ID membuat re-ingest tetap idempotent dan tidak menggandakan memori.",
      "Metadata category, source, trust level, dan provenance ikut tersimpan di setiap point.",
      "Forbidden knowledge guard mencegah output model dan debug transcript menjadi makanan memori.",
    ],
    sections: [
      {
        title: "Schema memori yang disiplin",
        body:
          "Memory layer tidak menerima file tanpa metadata minimal. Ini membuat JAGAT bisa membedakan blueprint, roadmap, risk register, founder note, dan referensi eksternal tanpa menebak-nebak saat retrieval.",
      },
      {
        title: "Qdrant dipakai sebagai memori audit-ready",
        body:
          "Point di Qdrant tidak berdiri sendirian. Setiap point mewakili chunk yang punya source manusiawi, local path, hash, kategori, dan provenance. Dengan begitu memory search tetap bisa dijelaskan saat dibutuhkan.",
      },
      {
        title: "Ekspansi korpus dilakukan bertahap",
        body:
          "Wave 1 dan Wave 2 sudah aktif. Langkah berikutnya adalah Wave 3 untuk regulasi, finance, dan founder notes tambahan. Pendekatan bertahap ini menjaga kualitas memori lebih penting daripada kecepatan ingest massal.",
      },
    ],
    metrics: [
      { label: "Active Categories", value: "8", hint: "Blueprint to founder note" },
      { label: "Wave Status", value: "W1 + W2", hint: "Curated and indexed" },
      { label: "Target Corpus", value: "20+", hint: "Strategic documents minimum" },
    ],
  },
  "multi-agent-orchestration": {
    slug: "multi-agent-orchestration",
    eyebrow: "Platform Feature / Colony Orchestration",
    title: "Multi-agent orchestration yang task-driven, bukan percakapan liar tanpa state.",
    intro:
      "JAGAT Colony dirancang sebagai tenaga kerja internal dengan role yang jelas: director, planner, researcher, builder, reviewer, dan reporter. Fokusnya adalah eksekusi yang bisa diaudit, bukan sekadar respons cepat.",
    outcome:
      "Founder mendapat command center yang bisa memecah arahan menjadi mission, task queue, approval, evidence, dan audit trail yang utuh.",
    highlights: [
      "Task state machine mengunci alur `queued -> planning -> approved -> running -> review -> done`.",
      "Controlled worker execution, sandbox, approval gate, dan patch proposal menjaga agar otomatisasi tidak bergerak liar.",
      "Founder command center menjadi sumber state utama, bukan chat yang mudah hilang konteks.",
    ],
    sections: [
      {
        title: "Role separation yang jelas",
        body:
          "Planner tidak sama dengan builder, dan reviewer tidak sama dengan reporter. Pemisahan peran ini penting agar sistem tidak mengklaim selesai hanya karena satu agent merasa yakin.",
      },
      {
        title: "Governance lebih penting dari kecepatan semu",
        body:
          "Approval request, evidence, audit log, dan worker log membuat setiap langkah bisa diperiksa ulang. Ini yang membedakan Colony dari agent yang terlihat aktif tetapi tidak bisa dibuktikan hasilnya.",
      },
      {
        title: "Jalur menuju otonomi yang sehat",
        body:
          "OpenClaw dan MiMo boleh dipakai sementara sebagai scaffolding. Tetapi target akhirnya adalah Colony yang bisa menjalankan loop kerja sendiri dengan verifier, reviewer, dan reporter yang matang.",
      },
    ],
    metrics: [
      { label: "Core Roles", value: "6", hint: "Director to reporter" },
      { label: "Task States", value: "8", hint: "Queued to archived" },
      { label: "Worker Mode", value: "Controlled", hint: "Read-only and patch-gated" },
    ],
  },
};
