"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

interface MemoryDocument {
  documentId: string;
  title: string;
  source: string;
  category: string;
  docType: string;
  owner: string;
  createdAt: string;
  trustLevel: string;
  provenance: string;
  sha256: string;
  wave: string;
  chunkCount: number;
  totalChars: number;
  totalWords: number;
  firstSection: string;
  lastSection: string;
  sample: string;
}

interface MemoryLibraryResponse {
  success: boolean;
  generatedAt: string;
  stats: {
    documents: number;
    chunks: number;
    words: number;
    categories: Record<string, number>;
    trustLevels: Record<string, number>;
    waves: Record<string, number>;
  };
  documents: MemoryDocument[];
  error?: string;
}

export default function MemoryLibraryPage() {
  const [data, setData] = useState<MemoryLibraryResponse | null>(null);
  const [query, setQuery] = useState("");
  const [wave, setWave] = useState("all");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLibrary() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory/library", { cache: "no-store" });
      const body = await res.json() as MemoryLibraryResponse;
      if (!res.ok || !body.success) throw new Error(body.error ?? "Gagal membaca memory library");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membaca memory library");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLibrary();
  }, []);

  const documents = data?.documents ?? [];
  const waves = useMemo(() => ["all", ...new Set(documents.map((doc) => doc.wave))], [documents]);
  const categories = useMemo(() => ["all", ...new Set(documents.map((doc) => doc.category))], [documents]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return documents.filter((doc) => {
      if (wave !== "all" && doc.wave !== wave) return false;
      if (category !== "all" && doc.category !== category) return false;
      if (!needle) return true;
      return [doc.title, doc.source, doc.category, doc.trustLevel, doc.provenance, doc.sample]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [documents, query, wave, category]);

  return (
    <main className="min-h-screen bg-[#f7f6f1] text-neutral-950">
      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
              <Icon label="S" />
              Founder Memory Surface
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Memory Library</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">
              Inventaris dokumen JAGAT yang sudah dinormalisasi menjadi chunk dan siap dipakai sebagai basis RAG, reporter, dan Colony planning.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/console"
              className="inline-flex h-10 items-center justify-center rounded-md border border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50"
            >
              Console
            </Link>
            <button
              type="button"
              onClick={() => void loadLibrary()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800"
            >
              <Icon label="R" />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-6">
        {error ? (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-4">
          <Metric icon={<Icon label="D" />} label="Documents" value={String(data?.stats.documents ?? 0)} />
          <Metric icon={<Icon label="C" />} label="Chunks" value={String(data?.stats.chunks ?? 0)} />
          <Metric icon={<Icon label="W" />} label="Words" value={(data?.stats.words ?? 0).toLocaleString("id-ID")} />
          <Metric icon={<Icon label="T" />} label="Trust Levels" value={String(Object.keys(data?.stats.trustLevels ?? {}).length)} />
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-400">Q</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari judul, sumber, kategori, provenance..."
              className="h-10 w-full rounded-md border border-neutral-200 bg-white pl-10 pr-3 text-sm outline-none ring-0 focus:border-neutral-500"
            />
          </label>
          <Select label="Wave" value={wave} onChange={setWave} options={waves} />
          <Select label="Category" value={category} onChange={setCategory} options={categories} />
        </div>

        <div className="mt-5 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Icon label="F" />
              {loading ? "Memuat library..." : `${filtered.length} dokumen tampil`}
            </div>
            <div className="text-xs text-neutral-500">
              {data?.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleString("id-ID")}` : ""}
            </div>
          </div>

          <div className="divide-y divide-neutral-100">
            {filtered.map((doc) => (
              <article key={doc.documentId} className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_260px]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-neutral-950">{doc.title}</h2>
                    <Badge>{doc.wave}</Badge>
                    <Badge>{doc.category}</Badge>
                    <Badge>{doc.trustLevel}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{doc.sample}</p>
                  <div className="mt-3 grid gap-2 text-xs text-neutral-500 md:grid-cols-2">
                    <span>Source: {doc.source}</span>
                    <span>Provenance: {doc.provenance}</span>
                    <span>First section: {doc.firstSection}</span>
                    <span>Last section: {doc.lastSection}</span>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs lg:grid-cols-1">
                  <Info label="Document ID" value={doc.documentId} />
                  <Info label="Chunks" value={String(doc.chunkCount)} />
                  <Info label="Words" value={doc.totalWords.toLocaleString("id-ID")} />
                  <Info label="SHA256" value={`${doc.sha256.slice(0, 12)}...`} />
                </dl>
              </article>
            ))}
            {!loading && filtered.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-neutral-500">Tidak ada dokumen yang cocok dengan filter.</div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Icon({ label }: { label: string }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-neutral-900 text-[9px] font-bold text-white">
      {label}
    </span>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-neutral-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-40 rounded-md border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "all" ? "All" : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-medium text-neutral-600">
      {children}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-neutral-50 px-3 py-2">
      <dt className="font-medium text-neutral-500">{label}</dt>
      <dd className="mt-1 break-all font-semibold text-neutral-800">{value}</dd>
    </div>
  );
}
