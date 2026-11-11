import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/login/Navbar";

export const metadata: Metadata = {
  title: "About JAGAT G7 — Sistem Inteligensia Berdaulat",
  description:
    "Manifesto dan arsitektur JAGAT G7: platform intelijen berdaulat berbasis Llama 3, Qdrant, dan RAG Pipeline yang berjalan sepenuhnya di infrastruktur Anda sendiri.",
};

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FDFCF8] text-stone-900 font-sans">
      <Navbar />
      <main>

        {/* ── Hero: 2-column grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto px-6 py-24">

          {/* Left: Copy */}
          <div className="text-left">
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-garuda-600">
              JAGAT G7 Manifesto
            </p>
            <h1 className="font-serif text-5xl font-bold tracking-tight text-stone-900">
              Sistem Inteligensia Berdaulat
            </h1>
            <p className="mt-6 text-xl leading-relaxed text-stone-700">
              Membongkar asimetri informasi. Menghadirkan infrastruktur
              intelijen finansial dan analisis risiko pasar setara institusi ke
              tangan para pengambil keputusan.
            </p>
          </div>

          {/* Right: Animated visual */}
          <div className="relative flex h-96 w-full items-center justify-center">
            <div
              className="absolute w-72 h-72 bg-amber-100 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-pulse"
              style={{ animationDuration: "4s" }}
            />
            <div
              className="absolute w-80 h-80 bg-stone-200 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-pulse translate-x-12 translate-y-8"
              style={{ animationDuration: "5s", animationDelay: "1s" }}
            />
            <div
              className="absolute w-64 h-64 bg-orange-100 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-pulse -translate-x-8 -translate-y-12"
              style={{ animationDuration: "6s", animationDelay: "2s" }}
            />
            <div className="relative z-10 w-32 h-32 rounded-full border border-stone-200/50 bg-white/40 shadow-2xl backdrop-blur-md flex items-center justify-center">
              <div
                className="w-12 h-12 rounded-full bg-stone-800/10 animate-ping"
                style={{ animationDuration: "3s" }}
              />
            </div>
          </div>
        </div>

        {/* ── Body: single-column readable ── */}
        <div className="max-w-3xl mx-auto space-y-16 py-12 px-6 lg:px-0">

          <section className="space-y-6">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Mengapa Berdaulat?
            </h2>
            <div className="space-y-4 text-lg leading-8 text-stone-700">
              <p>
                Dalam era perang informasi modern, data adalah aset paling
                strategis. Mengirimkan intelijen mentah, data finansial
                sensitif, dan analisis risiko ke server asing membuka celah
                keamanan yang tidak perlu ada.
              </p>
              <p>
                <strong className="font-semibold text-stone-900">JAGAT G7</strong>{" "}
                dibangun dengan prinsip Sovereign Localized Computing. Seluruh
                proses pengolahan data, mulai dari ekstraksi informasi hingga
                inferensi model bahasa, berlangsung di dalam perimeter
                infrastruktur yang sepenuhnya Anda kendalikan.
              </p>
            </div>
          </section>

          <section className="space-y-8">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
              Arsitektur Intelijen
            </h2>
            <div className="space-y-8">
              {[
                {
                  title: "Llama 3 LLM",
                  body: "Otak kognitif lokal yang dioptimalkan untuk memahami konteks finansial, strategis, dan geopolitik tanpa ketergantungan inferensi cloud.",
                },
                {
                  title: "Qdrant Vector Memory",
                  body: "Memori semantik untuk memetakan entitas data berstruktur dan tidak berstruktur ke dalam ruang vektor yang dapat ditelusuri.",
                },
                {
                  title: "RAG Pipeline",
                  body: "Retrieval-Augmented Generation yang menghubungkan dokumen, memori, dan model lokal agar jawaban selalu bertumpu pada konteks operasional Anda.",
                },
                {
                  title: "Sovereign Control",
                  body: "Arsitektur deployment yang menjaga data, token, dan alur kerja analisis berada dalam batas kendali organisasi.",
                },
              ].map((item) => (
                <article key={item.title} className="border-t border-stone-300 pt-4">
                  <h3 className="text-xl font-bold text-stone-900">{item.title}</h3>
                  <p className="mt-2 text-stone-700 leading-relaxed">{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <div className="pt-4 pb-16">
            <Link
              href="/pricing"
              id="about-cta-deploy"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-900 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
            >
              Deploy Node Sekarang
              <ArrowIcon />
            </Link>
          </div>
        </div>

      </main>

      {/* ── CTA Footer Band ── */}
      <section className="border-t border-neutral-200/70 bg-white px-6 py-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-garuda-600">Next Move</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">
              Lihat bagaimana capability ini terhubung ke infrastruktur JAGAT.
            </h3>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
            >
              Kembali ke Beranda
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 justify-center rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
            >
              Deploy Node
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
