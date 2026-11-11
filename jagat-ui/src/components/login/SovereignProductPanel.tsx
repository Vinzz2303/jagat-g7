"use client";

import { useEffect, useMemo, useState } from "react";

const scenes = [
  {
    label: "Riset",
    title: "Riset strategis dari memori lokal",
    prompt: "Ringkas risiko Phase 3 sebelum eksekusi.",
    answer: "3 risiko utama terdeteksi: kualitas ingest, governance memori, dan validasi benchmark. Rekomendasi: kunci pipeline ingest sebelum menambah agen.",
    chips: ["Blueprint", "Roadmap", "Risk Register"],
    accent: "bg-emerald-500",
  },
  {
    label: "Ingest",
    title: "Pengetahuan masuk sebagai bahan bakar",
    prompt: "Masukkan blueprint, milestone, dan catatan rapat.",
    answer: "Dokumen dipecah menjadi fragmen, diberi metadata, lalu siap dipanggil kembali saat konteks relevan.",
    chips: ["PDF", "XLSX", "Markdown"],
    accent: "bg-garuda-500",
  },
  {
    label: "Memori",
    title: "Konteks disaring sebelum menjawab",
    prompt: "Apa status Phase 2D?",
    answer: "Phase 2D sudah masuk mode operational management: risk register, backlog, decision log, dan weekly loop aktif.",
    chips: ["Qdrant", "Audit", "Source Trace"],
    accent: "bg-sky-500",
  },
  {
    label: "Eksekusi",
    title: "Keputusan berubah menjadi rencana kerja",
    prompt: "Susun prioritas minggu ini.",
    answer: "Prioritas: polish ingest, validasi UI research, jalankan benchmark identitas, lalu siapkan Phase 3 memory hardening.",
    chips: ["Backlog", "Owner", "Next Step"],
    accent: "bg-neutral-950",
  },
];

function SparkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.25 7.5 18 8.25l-.25-.75a2.25 2.25 0 0 0-1.5-1.5L15.5 5.75l.75-.25a2.25 2.25 0 0 0 1.5-1.5L18 3.25l.25.75a2.25 2.25 0 0 0 1.5 1.5l.75.25-.75.25a2.25 2.25 0 0 0-1.5 1.5Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.9} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75 9 17.25 19.5 6.75" />
    </svg>
  );
}

export default function SovereignProductPanel() {
  const [active, setActive] = useState(0);
  const scene = scenes[active];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % scenes.length);
    }, 3600);

    return () => window.clearInterval(timer);
  }, []);

  const progressWidth = useMemo(() => `${((active + 1) / scenes.length) * 100}%`, [active]);

  return (
    <div className="relative flex min-h-full w-full overflow-hidden bg-[#f6f2ea] px-8 py-10 xl:px-14">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[10%] top-[12%] h-40 w-40 rounded-full bg-garuda-200/35 blur-3xl" />
        <div className="absolute bottom-[14%] right-[10%] h-48 w-48 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[1120px] items-center gap-10 xl:grid-cols-[0.9fr_1.1fr]">
        <section>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Garuda Core Workspace
          </div>

          <h2 className="max-w-[560px] text-[42px] font-semibold leading-[1.08] tracking-tight text-neutral-950 xl:text-[56px]">
            Bangun, isi, dan operasikan intelijensia berdaulat.
          </h2>

          <p className="mt-6 max-w-[540px] text-[16px] leading-8 text-neutral-600">
            JAGAT G7 bukan sekadar layar chat. Ia adalah ruang kerja untuk mengubah dokumen, riset, keputusan, dan backlog menjadi sistem pengetahuan yang terus bertumbuh.
          </p>

          <div className="mt-8 grid max-w-[520px] gap-3 sm:grid-cols-2">
            {scenes.map((item, index) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setActive(index)}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-[13px] font-semibold transition-all ${
                  active === index
                    ? "border-neutral-950 bg-white text-neutral-950 shadow-md"
                    : "border-neutral-200 bg-white/60 text-neutral-600 hover:border-neutral-300 hover:bg-white"
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${item.accent}`} />
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="relative">
          <div className="rounded-[28px] border border-neutral-200 bg-white/90 p-4 shadow-2xl shadow-neutral-900/10 backdrop-blur">
            <div className="rounded-[22px] border border-neutral-200 bg-[#fbfaf7] p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="mb-2 inline-flex rounded-full bg-neutral-950 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
                    Live Sovereign Demo
                  </div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-garuda-700">JAGAT G7 Console</p>
                  <h3 className="mt-1 text-[20px] font-semibold text-neutral-950">{scene.title}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-garuda-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="relative overflow-hidden rounded-[18px] border border-neutral-200 bg-white">
                <div className="absolute inset-x-0 top-0 h-1 bg-neutral-100">
                  <div className="h-full rounded-r-full bg-neutral-950 transition-all duration-700" style={{ width: progressWidth }} />
                </div>

                <div key={scene.label} className="animate-fade-in-up p-5">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {scene.chips.map((chip) => (
                      <span key={chip} className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] font-medium text-neutral-600">
                        {chip}
                      </span>
                    ))}
                  </div>

                  <div className="ml-auto max-w-[72%] rounded-2xl rounded-tr-sm bg-neutral-950 px-4 py-3 text-[14px] leading-6 text-white shadow-lg xl:max-w-[78%]">
                    {scene.prompt}
                  </div>

                  <div className="mt-5 max-w-[82%] rounded-2xl rounded-tl-sm border border-neutral-200 bg-[#f8f6f1] px-4 py-4 shadow-sm xl:max-w-[86%]">
                    <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-garuda-700">
                      <SparkIcon />
                      Sintesis JAGAT
                    </div>
                    <p className="text-[14px] leading-7 text-neutral-700">{scene.answer}</p>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    {["Konteks", "Validasi", "Rencana"].map((item, index) => (
                      <div key={item} className="min-h-[112px] rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{item}</span>
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <CheckIcon />
                          </span>
                        </div>
                        <div className="space-y-2">
                          <span className="block h-2 rounded-full bg-neutral-200" />
                          <span className={`block h-2 rounded-full ${index === 1 ? "w-4/5 bg-garuda-200" : "w-2/3 bg-neutral-200"}`} />
                          <span className={`block h-2 rounded-full ${index === 2 ? "w-3/5 bg-emerald-200" : "w-1/2 bg-neutral-200"}`} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`h-9 w-9 shrink-0 rounded-full ${scene.accent}`} />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-neutral-950">Mode {scene.label} aktif</p>
                          <p className="truncate text-[11px] text-neutral-500">Pengetahuan masuk, konteks disaring, keputusan dirapikan.</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">Ready</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
