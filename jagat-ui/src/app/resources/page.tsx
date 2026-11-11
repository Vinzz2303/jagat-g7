import Link from "next/link";
import Navbar from "@/components/login/Navbar";

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar />
      <div className="pt-32 px-5 lg:px-8 pb-24">
        <div className="mx-auto max-w-[800px]">
          <h1 className="text-[40px] font-semibold tracking-tight mb-6">Pusat Pengetahuan Sovereign AI</h1>
          <p className="text-[18px] text-neutral-600 mb-12 leading-relaxed">Arsitektur, dokumentasi teknis, dan whitepapers tentang implementasi kecerdasan buatan on-premise untuk instansi pemerintah dan Enterprise B2B.</p>
          
          <div className="space-y-6">
            <Link href="/resources" className="block group p-8 border border-neutral-200 rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all">
              <h2 className="text-[22px] font-medium mb-3 group-hover:text-garuda-600 transition-colors">Keamanan Data dalam LLM Lokal vs Cloud</h2>
              <p className="text-neutral-600 mb-6 leading-relaxed">Mengapa Bapenda dan instansi pemerintah wajib menggunakan arsitektur Sovereign AI on-premise untuk mengelola data operasional dan keputusan strategis.</p>
              <span className="text-[14px] font-medium text-neutral-900 group-hover:text-garuda-600">Baca Selengkapnya &rarr;</span>
            </Link>
            
            <Link href="/resources" className="block group p-8 border border-neutral-200 rounded-2xl hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-all">
              <h2 className="text-[22px] font-medium mb-3 group-hover:text-garuda-600 transition-colors">Arsitektur JAGAT G7 (Garuda 7)</h2>
              <p className="text-neutral-600 mb-6 leading-relaxed">Penyelarasan keamanan 4 layer, enkripsi HMAC-SHA256, dan integrasi Llama 3 via Ollama dalam satu pipeline Qdrant terisolasi untuk enterprise intelligence.</p>
              <span className="text-[14px] font-medium text-neutral-900 group-hover:text-garuda-600">Baca Selengkapnya &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
