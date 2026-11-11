export interface SiteSectionStat {
  label: string;
  value: string;
  hint: string;
}

export interface SiteSectionBlock {
  title: string;
  body: string;
}

export interface SiteSectionPageContent {
  slug: string;
  category: string;
  title: string;
  intro: string;
  outcome: string;
  bullets: string[];
  blocks: SiteSectionBlock[];
  stats: SiteSectionStat[];
}

export const SITE_SECTION_PAGES: Record<string, SiteSectionPageContent> = {
  "contact-analyst": {
    slug: "contact-analyst",
    category: "Resources / Contact Analyst",
    title: "Hubungi analis JAGAT untuk memetakan node, workflow, dan sovereign rollout yang paling masuk akal.",
    intro:
      "JAGAT paling berguna saat implementasinya dimulai dari konteks nyata: dokumen apa yang sudah ada, keputusan apa yang ingin dipercepat, dan perimeter data seperti apa yang harus dijaga.",
    outcome:
      "Halaman ini menjadi jalur masuk yang lebih jujur daripada placeholder CTA. Tujuannya bukan sekadar mengumpulkan lead, tetapi membantu menentukan langkah awal yang paling realistis untuk riset, memory, public surface, atau Colony internal.",
    bullets: [
      "Percakapan awal sebaiknya berangkat dari workflow dan risiko, bukan dari daftar fitur generik.",
      "Dokumen seperti roadmap, blueprint, SOP, risk register, atau founder note biasanya menjadi input paling bernilai.",
      "JAGAT bisa dimulai dari node riset, lalu bertumbuh ke memory layer, command center, dan orchestration yang lebih matang.",
    ],
    blocks: [
      {
        title: "Kapan perlu bicara dengan analis",
        body:
          "Jika Anda ingin memindahkan knowledge, riset, atau alur keputusan ke sistem yang lebih berdaulat dan dapat diaudit, sesi dengan analis membantu memetakan fase awal yang paling aman dan berdampak.",
      },
      {
        title: "Apa yang sebaiknya dibawa ke percakapan",
        body:
          "Blueprint, milestone, arsip briefing, atau gambaran perimeter data akan mempercepat pemetaan. Dari sana, kita bisa melihat apakah prioritas awalnya public surface, sovereign memory, atau command-and-control core di Colony.",
      },
      {
        title: "Jalur lanjut setelah itu",
        body:
          "Jika Anda sudah siap eksplorasi teknis lebih jauh, gunakan System Login untuk masuk ke workspace. Jika masih mengevaluasi deployment dan skema node, Pricing adalah pintu berikutnya yang lebih tepat.",
      },
    ],
    stats: [
      { label: "Starting Mode", value: "Scoped", hint: "Map the right first phase" },
      { label: "Conversation Lens", value: "Operational", hint: "Not generic sales discovery" },
      { label: "Best Inputs", value: "Docs + Goals", hint: "Blueprint, workflow, deployment intent" },
    ],
  },
  leadership: {
    slug: "leadership",
    category: "Meet G7 / Leadership",
    title: "Kepemimpinan JAGAT dibangun untuk menjaga arah, bukan sekadar mengelola fitur.",
    intro:
      "JAGAT G7 diposisikan sebagai sovereign intelligence system yang mengikuti tujuan founder, dokumen strategis, dan governance yang bisa diaudit. Arah kepemimpinan di sini berarti menjaga disiplin antara visi, risiko, dan eksekusi.",
    outcome:
      "Halaman ini menjelaskan siapa yang memegang arah sistem, bagaimana keputusan dikunci, dan kenapa governance menjadi bagian dari desain produk, bukan lapisan tambahan belakangan.",
    bullets: [
      "Founder menjadi sumber mandat strategis, bukan sekadar admin antarmuka.",
      "Decision log, commissioning checklist, dan colony masterplan dipakai sebagai artefak kepemimpinan yang bisa diperiksa ulang.",
      "Role separation di Colony dirancang agar perencanaan, eksekusi, dan verifikasi tidak bercampur dalam satu suara tunggal.",
    ],
    blocks: [
      {
        title: "Founder sebagai sumber mandat",
        body:
          "JAGAT tidak dibangun untuk mengejar generative output yang acak. Ia diarahkan oleh founder mandate, roadmap, blueprint, dan operational checklist yang menjadi referensi tetap saat sistem tumbuh.",
      },
      {
        title: "Governance lebih dulu daripada otonomi liar",
        body:
          "Leadership di JAGAT berarti setiap jalur kerja punya approval, audit, dan batas akses yang jelas. Sistem boleh menjadi makin otonom, tetapi tidak boleh kehilangan provenance keputusan.",
      },
      {
        title: "Command center sebagai alat kerja pemimpin",
        body:
          "Founder command center bukan dekorasi. Ia adalah permukaan tempat mission, task, approval, bukti, dan status kerja bertemu menjadi satu ruang kendali yang konsisten.",
      },
    ],
    stats: [
      { label: "Founder Core", value: "1", hint: "Single strategic mandate source" },
      { label: "Decision Artifacts", value: "4+", hint: "Plan, audit, trace, checklist" },
      { label: "Governance Style", value: "Auditable", hint: "State, approval, evidence" },
    ],
  },
  "research-papers": {
    slug: "research-papers",
    category: "Meet G7 / Research Papers",
    title: "Publikasi dan metodologi JAGAT diarahkan untuk bisa diuji, bukan hanya terdengar canggih.",
    intro:
      "Research layer JAGAT merangkum bagaimana korpus strategis, retrieval, memori, dan orchestration dibentuk. Fokus utamanya adalah membuat reasoning yang dapat dirunut kembali, bukan sekadar menghasilkan teks meyakinkan.",
    outcome:
      "Dokumen riset di sini menjadi fondasi untuk menjelaskan kenapa JAGAT memilih hybrid retrieval, provenance metadata, controlled worker execution, dan command-center governance.",
    bullets: [
      "Metodologi retrieval dan memory harus kompatibel dengan audit, bukan hanya benchmark sempit.",
      "Operational research di JAGAT selalu dihubungkan ke milestone, wave ingest, dan commissioning trace.",
      "Knowledge paper dipakai untuk menyatukan visi teknis dengan kebutuhan operasional founder.",
    ],
    blocks: [
      {
        title: "Riset sebagai alat kalibrasi sistem",
        body:
          "Paper dan note metodologis membantu tim membedakan mana keputusan arsitektur yang sifatnya permanen, mana yang eksperimental, dan mana yang hanya scaffolding sementara seperti OpenClaw dan MiMo.",
      },
      {
        title: "Dari blueprint ke metodologi",
        body:
          "Roadmap, strategic manifest, dan memory ingestion plan menjadi bahan yang menjelaskan bagaimana JAGAT bergerak dari ide besar menuju sistem yang dapat dipakai founder sehari-hari.",
      },
      {
        title: "Bukti lebih penting daripada jargon",
        body:
          "Semua narasi riset yang baik di JAGAT idealnya bisa menunjuk ke schema, log, commissioning result, atau route nyata di sistem. Ini menjaga paper tidak terpisah dari kenyataan codebase.",
      },
    ],
    stats: [
      { label: "Method Focus", value: "Applied", hint: "Operationally grounded research" },
      { label: "Primary Themes", value: "4", hint: "Memory, retrieval, orchestration, governance" },
      { label: "Proof Style", value: "Traceable", hint: "Docs tied to runtime artifacts" },
    ],
  },
  "data-sovereignty": {
    slug: "data-sovereignty",
    category: "Sovereign Solutions / Data Sovereignty",
    title: "Data sovereignty di JAGAT berarti knowledge tetap tinggal di perimeter yang kita pahami.",
    intro:
      "JAGAT dibangun agar dokumen strategis, metadata, dan state kerja founder tidak harus keluar ke sistem asing tanpa kontrol. Ini dimulai dari skema ingest, local vector memory, dan policy akses yang ketat.",
    outcome:
      "Solusi ini cocok untuk tim yang membutuhkan knowledge layer internal tanpa kehilangan provenance, ownership, dan kemampuan audit saat korpus tumbuh.",
    bullets: [
      "Metadata owner, category, source, dan trust level melekat di setiap memory point.",
      "Hybrid retrieval dipadukan dengan guard agar sistem tidak memakan output model sebagai pengetahuan primer.",
      "Colony stack mengunci akses berdasarkan session, proxy secret, dan role guard, bukan trust implisit.",
    ],
    blocks: [
      {
        title: "Lokalisasi knowledge yang disiplin",
        body:
          "Dokumen tidak hanya disimpan, tetapi diperlakukan sebagai aset pengetahuan yang punya provenance dan lifecycle. Ini mencegah knowledge base tumbuh menjadi tumpukan file yang tidak bisa diaudit.",
      },
      {
        title: "Perimeter akses yang jelas",
        body:
          "Next.js middleware, API proxy, dan Express backend guard membentuk perimeter bertingkat. Bahkan saat UI dibuka publik untuk halaman marketing, route inti tetap dipisahkan secara eksplisit.",
      },
      {
        title: "Kesiapan menuju server berdaulat",
        body:
          "Arsitektur ini disusun dengan asumsi bahwa ke depan JAGAT akan hidup pada infrastruktur Dell dan memory sendiri, sehingga fase SaaS atau model luar tetap diperlakukan sebagai scaffolding sementara.",
      },
    ],
    stats: [
      { label: "Storage Mode", value: "Local-first", hint: "Sovereign memory direction" },
      { label: "Access Layers", value: "3", hint: "Middleware, proxy, backend" },
      { label: "Trust Anchor", value: "Provenance", hint: "Owner + source + category" },
    ],
  },
  "cyber-defense": {
    slug: "cyber-defense",
    category: "Sovereign Solutions / Cyber Defense",
    title: "Cyber defense di JAGAT dimulai dari hardening alur kerja, bukan hanya dashboard alarm.",
    intro:
      "JAGAT memandang pertahanan siber sebagai kombinasi antara memory yang sehat, approval gate, auth berlapis, dan kemampuan menelusuri siapa mengubah apa. Tujuannya bukan sekadar mendeteksi anomali, tetapi menjaga integritas operasi.",
    outcome:
      "Halaman ini merangkum bagaimana discipline security di codebase, colony routes, dan access perimeter menjadi fondasi untuk use case cyber yang lebih luas.",
    bullets: [
      "Auth berlapis mencegah backend dieksploitasi lewat proxy atau client-side spoofing yang longgar.",
      "Audit trail membuat tindakan sensitif dapat dirunut, termasuk bootstrap, mission, task, dan approval.",
      "Patch proposal dan approval gate memberi jalur perubahan yang lebih aman daripada direct write liar.",
    ],
    blocks: [
      {
        title: "Defense-in-depth di lapisan aplikasi",
        body:
          "JAGAT bukan hanya mengandalkan satu lapisan proteksi. Middleware, signed session, internal secret, dan guard backend bekerja sama untuk menutup jalur yang sebelumnya terbuka terlalu lebar.",
      },
      {
        title: "Integrity lebih penting daripada kesan aktif",
        body:
          "Sistem yang terlihat sibuk tapi tidak bisa membuktikan statusnya justru berbahaya. Karena itu cyber posture JAGAT menuntut verifikasi runtime, evidence, dan commissioning trace yang konsisten.",
      },
      {
        title: "Menuju security operations yang dapat dipakai",
        body:
          "Ke depan, layer ini dapat tumbuh menjadi incident knowledge base, threat workflow, dan reviewer loop. Tetapi fondasinya tetap harus berupa auth, provenance, dan state machine yang sehat.",
      },
    ],
    stats: [
      { label: "Security Model", value: "Layered", hint: "Auth + audit + approval" },
      { label: "Critical Focus", value: "Integrity", hint: "Traceable operational control" },
      { label: "Residual Risk", value: "Known", hint: "Tracked through docs and trace" },
    ],
  },
  "maritime-security": {
    slug: "maritime-security",
    category: "Sovereign Solutions / Maritime Security",
    title: "Maritime security membutuhkan konteks, memori, dan keputusan yang bisa dijalankan cepat.",
    intro:
      "Narasi maritime di JAGAT tidak berhenti di visualisasi situasi. Arah yang dituju adalah sistem yang bisa menampung dokumen domain, SOP, risk note, dan briefing operasional ke dalam memori yang berguna untuk pengambilan keputusan.",
    outcome:
      "Dengan memory, retrieval, dan command center yang benar, maritime domain awareness dapat bergerak dari tumpukan dokumen dan laporan menjadi workflow yang benar-benar membantu operator.",
    bullets: [
      "Knowledge domain dapat menyerap peta risiko, note wilayah, dan prosedur operasional sebagai korpus yang terstruktur.",
      "RAG dan vector memory membantu operator kembali ke sumber yang relevan saat membuat keputusan lapangan.",
      "Colony model cocok untuk memecah briefing menjadi task, review, dan evidence yang tidak tercecer.",
    ],
    blocks: [
      {
        title: "Domain awareness yang tidak putus dari sumber",
        body:
          "Banyak sistem maritime gagal karena insight tidak terhubung lagi ke dokumen sumbernya. JAGAT mencoba menutup celah itu dengan provenance memory dan citation-aware retrieval.",
      },
      {
        title: "Briefing menjadi task operasional",
        body:
          "Colony memungkinkan briefing strategis diterjemahkan menjadi queue kerja. Ini penting untuk operasi maritime yang membutuhkan koordinasi, eskalasi, dan bukti yang rapi.",
      },
      {
        title: "Masih solusi yang berkembang, bukan overclaim",
        body:
          "Halaman ini sengaja menjaga narasi tetap realistis. Fokus JAGAT saat ini adalah membangun fondasi memory dan orchestration yang nanti bisa dipakai untuk domain maritime secara lebih matang.",
      },
    ],
    stats: [
      { label: "Domain Fit", value: "Emerging", hint: "Built on memory + workflow core" },
      { label: "Operator Need", value: "High", hint: "Context-rich decision support" },
      { label: "Execution Mode", value: "Taskable", hint: "Briefing to queue transition" },
    ],
  },
  documentation: {
    slug: "documentation",
    category: "Resources / Documentation",
    title: "Dokumentasi JAGAT seharusnya membantu eksekusi, bukan memaksa orang menebak-nebak state sistem.",
    intro:
      "Resource documentation di JAGAT berangkat dari dokumen operasi nyata: masterplan, gap audit, dry run trace, commissioning checklist, dan decision log. Tujuannya adalah menjaga tim tetap bergerak pada sumber yang sama.",
    outcome:
      "Bagian ini merangkum jenis dokumentasi yang membentuk pemahaman teknis dan operasional sistem, serta kenapa sinkronisasi dokumen sama pentingnya dengan perubahan code.",
    bullets: [
      "Masterplan memberi arah target, bukan status aktual.",
      "Dry run trace menyimpan status operasional sementara yang paling dekat ke codebase.",
      "Checklist commissioning mengunci apa yang benar-benar sudah diuji, bukan sekadar direncanakan.",
    ],
    blocks: [
      {
        title: "Dokumen sebagai state operasional",
        body:
          "Di JAGAT, file markdown bukan lampiran pasif. Ia dipakai untuk memegang keputusan, residual gap, dan commissioning evidence. Karena itu sinkronisasi dokumen menjadi bagian dari engineering discipline.",
      },
      {
        title: "Satu dokumen, satu peran",
        body:
          "Agar tidak muter, tiap dokumen harus jelas perannya: historical baseline, source of truth operasional sementara, atau checklist keputusan. Ini mengurangi risiko agent membaca dokumen usang sebagai kebenaran final.",
      },
      {
        title: "Dokumentasi menuju mode tim",
        body:
          "Semakin matang JAGAT, dokumentasi ini akan menjadi onboarding path untuk operator, builder, dan reviewer. Itulah sebabnya resources perlu dibuat usable, bukan hanya lengkap.",
      },
    ],
    stats: [
      { label: "Core Docs", value: "5+", hint: "Plan, audit, trace, checklist, decision log" },
      { label: "Doc Role", value: "Operational", hint: "Not just reference material" },
      { label: "Current Need", value: "Sync", hint: "Reduce narrative drift" },
    ],
  },
  "status-dashboard": {
    slug: "status-dashboard",
    category: "Resources / Status Dashboard",
    title: "Status Dashboard merangkum kesehatan node, worker, dan jalur kerja yang penting bagi founder.",
    intro:
      "Status yang baik tidak hanya menampilkan lampu hijau. Ia harus menunjukkan service apa yang hidup, route apa yang aman, dan workflow apa yang masih menyimpan residual risk. Ini sejalan dengan cara JAGAT memandang operasi sistem.",
    outcome:
      "Halaman ini menjelaskan jenis sinyal status yang penting untuk JAGAT: health backend, memory services, worker state, commissioning proof, dan kualitas akses founder.",
    bullets: [
      "Service health perlu dibedakan dari workflow health; server hidup belum tentu founder flow sehat.",
      "Commissioning result dan runtime proof lebih penting daripada klaim PASS yang tidak punya bukti.",
      "Status dashboard idealnya menghubungkan service, task state, dan approval state dalam satu tempat.",
    ],
    blocks: [
      {
        title: "Health service hanyalah lapisan dasar",
        body:
          "Redis, Qdrant, Ollama, Next.js, dan backend boleh sama-sama hidup, tetapi jika founder flow gagal atau auth redirect salah, sistem tetap belum usable. Karena itu status dashboard perlu lebih kaya daripada sekadar uptime.",
      },
      {
        title: "Workflow health sebagai sinyal utama",
        body:
          "Founder harus bisa melihat apakah bootstrap, mission creation, task lifecycle, approval, dan audit benar-benar jalan. Inilah perbedaan antara sistem yang technically up dan sistem yang operationally ready.",
      },
      {
        title: "Menuju observability yang berguna",
        body:
          "Tahap berikutnya adalah membuat dashboard yang bisa menghubungkan log service dengan task evidence dan commissioning trace. Dengan begitu masalah bisa ditemukan tanpa tebak-tebakan panjang.",
      },
    ],
    stats: [
      { label: "Health Layers", value: "2", hint: "Service + workflow" },
      { label: "Current Priority", value: "Founder Flow", hint: "Operational readiness signal" },
      { label: "Observability Goal", value: "Actionable", hint: "Logs tied to execution proof" },
    ],
  },
  community: {
    slug: "community",
    category: "Resources / Community",
    title: "Community JAGAT diarahkan untuk membentuk operator yang paham konteks, bukan hanya pengguna antarmuka.",
    intro:
      "Ekosistem JAGAT ke depan akan membutuhkan orang yang bisa membaca blueprint, mengerti provenance knowledge, dan menjaga disiplin antara visi, keamanan, dan eksekusi. Community page ini menyiapkan narasi untuk arah itu.",
    outcome:
      "Alih-alih hanya menjadi halaman kontak, resource community menjelaskan siapa yang cocok masuk ke orbit JAGAT dan bagaimana kontribusi mereka nantinya akan dinilai.",
    bullets: [
      "Community yang sehat butuh bahasa operasional yang sama, bukan sekadar antusiasme.",
      "Kontributor ideal memahami bahwa docs, code, dan commissioning proof harus selaras.",
      "Ekosistem JAGAT akan lebih dekat ke operator cell daripada forum marketing generik.",
    ],
    blocks: [
      {
        title: "Kontribusi yang bernilai",
        body:
          "Nilai kontribusi di JAGAT tidak diukur dari banyaknya opini, tetapi dari kemampuan memperjelas state sistem, membuktikan hasil, dan menjaga sovereign direction tetap konsisten.",
      },
      {
        title: "Bahasa bersama untuk tim",
        body:
          "Istilah seperti mission, task, approval, residual gap, dry run, dan provenance bukan jargon kosong. Mereka adalah bahasa kerja yang perlu dipahami bersama oleh ekosistem yang membantu JAGAT tumbuh.",
      },
      {
        title: "Siap untuk fase lebih terbuka",
        body:
          "Saat sistem makin stabil, halaman community ini bisa berkembang menjadi gerbang onboarding, partner program, atau research cell. Untuk sekarang, ia menegaskan budaya kerja yang ingin dibangun lebih dulu.",
      },
    ],
    stats: [
      { label: "Community Type", value: "Operator-first", hint: "Execution-oriented ecosystem" },
      { label: "Contribution Lens", value: "Evidence", hint: "Proof over noise" },
      { label: "Growth Mode", value: "Curated", hint: "Quality before scale" },
    ],
  },
};
