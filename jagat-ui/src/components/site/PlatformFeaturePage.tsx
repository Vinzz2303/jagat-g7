import Link from "next/link";
import Navbar from "@/components/login/Navbar";
import type { PlatformFeaturePageContent } from "@/lib/platform-features";

export default function PlatformFeaturePage({ content }: { content: PlatformFeaturePageContent }) {
  return (
    <div className="min-h-screen bg-[#F7F6F2] text-stone-900">
      <Navbar />
      <main>
        <section className="border-b border-stone-200/80 px-6 py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1.2fr)_360px] lg:items-end">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-garuda-500">
                {content.eyebrow}
              </p>
              <h1 className="mt-5 max-w-4xl text-4xl font-extrabold tracking-tight text-stone-900 sm:text-5xl">
                {content.title}
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-stone-700">
                {content.intro}
              </p>
              <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
                {content.outcome}
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                Feature Signals
              </p>
              {content.metrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-[12px] font-medium text-stone-500">{metric.label}</span>
                    <span className="text-2xl font-black tracking-tight text-stone-900">{metric.value}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-stone-500">{metric.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-4 md:grid-cols-3">
              {content.highlights.map((highlight, index) => (
                <article key={highlight} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-garuda-500/10 text-sm font-bold text-garuda-600">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-stone-700">{highlight}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 pb-20">
          <div className="mx-auto max-w-5xl space-y-10">
            {content.sections.map((section) => (
              <article key={section.title} className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
                <h2 className="text-2xl font-bold tracking-tight text-stone-900">{section.title}</h2>
                <p className="mt-4 text-[15px] leading-8 text-stone-700">{section.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-stone-200/80 bg-white px-6 py-14">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-garuda-500">Next Move</p>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-stone-900">Lihat bagaimana capability ini terhubung ke command center JAGAT.</h3>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/about"
                className="inline-flex items-center justify-center rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50"
              >
                Meet G7
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-stone-800"
              >
                Deploy Node
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
