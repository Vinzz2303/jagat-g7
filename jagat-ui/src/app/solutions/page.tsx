"use client";

import { useState } from "react";
import Navbar from "@/components/login/Navbar";

export default function SolutionsPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate API call to whatsapp-adapter endpoint
    setTimeout(() => setSubmitted(true), 800);
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar />
      <div className="pt-32 px-5 lg:px-8 pb-24">
        <div className="mx-auto max-w-[600px]">
          <h1 className="text-[36px] font-semibold tracking-tight mb-4 text-center">Jadwalkan Enterprise Demo</h1>
          <p className="text-[16px] text-neutral-600 mb-10 text-center leading-relaxed">
            Konsultasikan kebutuhan infrastruktur Sovereign AI untuk instansi atau perusahaan Anda. Implementasi on-premise dijamin aman 100%.
          </p>
          
          {submitted ? (
            <div className="p-8 bg-emerald-50 border border-emerald-200 rounded-2xl text-center shadow-sm">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-[20px] font-medium text-emerald-900 mb-2">Permintaan Diterima</h3>
              <p className="text-[15px] text-emerald-700">Tim instalasi kami akan segera menghubungi Anda melalui WhatsApp dalam 1x24 jam kerja.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 bg-white p-8 border border-neutral-200 rounded-2xl shadow-sm">
              <div>
                <label className="block text-[14px] font-medium text-neutral-700 mb-2">Nama Lengkap</label>
                <input required type="text" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition-all text-[15px]" placeholder="Dr. Budi Santoso" />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-neutral-700 mb-2">Instansi / Perusahaan</label>
                <input required type="text" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition-all text-[15px]" placeholder="Bapenda Provinsi..." />
              </div>
              <div>
                <label className="block text-[14px] font-medium text-neutral-700 mb-2">Nomor WhatsApp Pimpinan / PIC</label>
                <input required type="tel" className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 focus:bg-white focus:ring-2 focus:ring-neutral-900 focus:border-neutral-900 outline-none transition-all text-[15px]" placeholder="08123456789" />
              </div>
              <button type="submit" className="w-full py-4 mt-2 bg-neutral-900 text-white rounded-xl font-medium text-[15px] hover:bg-neutral-800 shadow-[0_4px_14px_0_rgb(0,0,0,15%)] transition-all">
                Minta Akses Demo
              </button>
              <p className="text-center text-[12px] text-neutral-500 mt-4">
                Data Anda dilindungi oleh standar enkripsi Enterprise JAGAT G7.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
