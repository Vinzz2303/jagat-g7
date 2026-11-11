"use client";

import { useState } from "react";
import Navbar from "@/components/login/Navbar";

interface Tier {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "PRO",
    name: "G7 PRO Node",
    price: "Rp 150.000",
    period: "/bulan",
    features: ["50 riset / hari", "Research + Kiting mode", "RAG pipeline", "Aktivasi token manual"],
  },
  {
    id: "ULTRA",
    name: "G7 ULTRA Node",
    price: "Rp 500.000",
    period: "/bulan",
    highlight: true,
    features: [
      "250 riset / hari",
      "Research, Kiting, Ting",
      "Motherbox preview",
      "Priority manual support",
      "Aktivasi token manual",
    ],
  },
];

function Chk() {
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

export default function PricingPage() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Tier | null>(null);
  const [clientName, setClientName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestResult, setRequestResult] = useState<{ id: string; invoiceCode: string } | null>(null);
  const [requestError, setRequestError] = useState("");

  const pick = (t: Tier) => {
    setSel(t);
    setOpen(true);
    setRequestResult(null);
    setRequestError("");
  };

  const submitInvoiceRequest = async () => {
    if (!sel || submitting || !clientName.trim() || !contact.trim()) return;
    setSubmitting(true);
    setRequestError("");

    try {
      const res = await fetch("/api/commercial/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: sel.id,
          clientName: clientName.trim(),
          contact: contact.trim(),
          channel: "whatsapp",
          notes: notes.trim(),
          source: "pricing_page",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Request invoice gagal.");
      setRequestResult({ id: data.request.id, invoiceCode: data.request.invoiceCode });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Request invoice gagal.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-primary">
      <Navbar />
      <main className="flex-1">
        <section className="px-6 pb-4 pt-16 text-center sm:pt-20 lg:pb-8">
          <div className="mx-auto max-w-2xl">
            <p className="mb-3 text-[12px] font-semibold uppercase tracking-widest text-garuda-500">Sovereign Intelligence Plans</p>
            <h1 className="text-[36px] font-extrabold leading-tight tracking-tight text-neutral-900 sm:text-[44px]">
              Plans that grow
              <br className="hidden sm:block" /> with you
            </h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-neutral-500">
              Akses awal ke JAGAT G7 diproses manual oleh admin. Pilih tier, kirim request invoice, lalu token akan diaktifkan setelah review dan konfirmasi pembayaran manual.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-20 pt-4 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-2">
            {TIERS.map((t) => (
              <div
                key={t.id}
                className={`relative flex flex-col rounded-2xl border p-7 transition-all duration-300 hover:shadow-xl ${
                  t.highlight
                    ? "border-garuda-400/50 bg-white shadow-lg shadow-garuda-500/[0.06] ring-1 ring-garuda-400/20"
                    : "border-neutral-200 bg-white shadow-sm"
                }`}
              >
                {t.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-garuda-500 px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-garuda-500/30">
                    Popular
                  </div>
                )}
                <p className="text-[13px] font-semibold uppercase tracking-wider text-neutral-500">{t.name}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-[36px] font-extrabold tracking-tight text-neutral-900">{t.price}</span>
                  <span className="text-[14px] font-medium text-neutral-400">{t.period}</span>
                </div>
                <div className="my-6 h-px bg-neutral-100" />
                <ul className="flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13.5px] text-neutral-600">
                      <Chk />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => pick(t)}
                  className={`mt-8 w-full rounded-xl py-3 text-[14px] font-semibold transition-all active:scale-[0.97] ${
                    t.highlight
                      ? "bg-neutral-900 text-white shadow-lg shadow-neutral-900/20 hover:bg-neutral-800"
                      : "border border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100"
                  }`}
                >
                  Request Invoice
                </button>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-[12px] leading-relaxed text-neutral-400">
            Halaman ini hanya membuat request invoice manual.
            <br />
            Tidak ada checkout otomatis, payment gateway, atau penyimpanan data pembayaran.
          </p>
        </section>
      </main>

      {open && sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-neutral-700/60 bg-neutral-900 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-garuda-500 to-garuda-600 shadow-lg shadow-garuda-500/20">
                  <span className="text-base font-black text-white">J</span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-white">Request Manual Invoice</p>
                  <p className="font-mono text-[10px] text-neutral-500">Admin-reviewed activation</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-5 flex items-center justify-between rounded-xl border border-garuda-500/30 bg-garuda-500/10 px-4 py-3">
              <span className="text-[12px] font-semibold text-garuda-300">{sel.name}</span>
              <span className="text-[16px] font-extrabold text-garuda-400">
                {sel.price}
                <span className="text-[10px] font-normal text-garuda-300/60"> {sel.period}</span>
              </span>
            </div>

            <div className="mb-5 space-y-3">
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Nama / Bisnis</label>
                <input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700/50 bg-neutral-800/50 px-4 py-3 text-[13px] text-white outline-none transition-all placeholder:text-neutral-600 focus:border-garuda-500/60"
                  placeholder="Nama Anda atau bisnis"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Kontak WhatsApp / Email</label>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700/50 bg-neutral-800/50 px-4 py-3 text-[13px] text-white outline-none transition-all placeholder:text-neutral-600 focus:border-garuda-500/60"
                  placeholder="08xx atau email aktif"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Catatan Opsional</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-neutral-700/50 bg-neutral-800/50 px-4 py-3 text-[13px] text-white outline-none transition-all placeholder:text-neutral-600 focus:border-garuda-500/60"
                  placeholder="Kebutuhan singkat. Jangan tulis password, API key, atau data rahasia."
                />
              </div>
            </div>

            {requestResult && (
              <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-[12px] font-bold text-emerald-300">Request invoice diterima.</p>
                <p className="mt-1 font-mono text-[11px] text-emerald-200">
                  ID: {requestResult.id} | Invoice draft: {requestResult.invoiceCode}
                </p>
                <p className="mt-1 text-[11px] text-neutral-400">Admin akan review scope dan mengirim instruksi pembayaran manual.</p>
              </div>
            )}

            {requestError && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[12px] text-red-300">{requestError}</p>}

            <button
              onClick={submitInvoiceRequest}
              disabled={!clientName.trim() || !contact.trim() || submitting || Boolean(requestResult)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-[13px] font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.97]"
            >
              {submitting ? "Submitting..." : requestResult ? "Request Terkirim" : "Submit Manual Invoice Request"}
            </button>
            <button onClick={() => setOpen(false)} className="mt-2.5 w-full rounded-xl border border-neutral-700/50 px-4 py-2.5 text-[12px] font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white">
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
