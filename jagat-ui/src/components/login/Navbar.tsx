"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

function ChevronDown({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface DropdownItem { label: string; desc: string; href?: string }

const NAV_MENUS: Record<string, DropdownItem[]> = {
  "Meet G7": [
    { label: "About JAGAT G7", desc: "The GARUDA framework and 7 Core Intelligence Powers", href: "/about" },
    { label: "Leadership", desc: "Sovereign intelligence advisory council", href: "/meet-g7/leadership" },
    { label: "Research Papers", desc: "Published intelligence methodology", href: "/meet-g7/research-papers" },
  ],
  "Platform Features": [
    { label: "RAG Pipeline", desc: "Retrieval-Augmented Generation engine", href: "/platform/rag-pipeline" },
    { label: "Vector Memory", desc: "Qdrant-backed sovereign knowledge store", href: "/platform/vector-memory" },
    { label: "Multi-Agent Orchestration", desc: "Autonomous agent coordination", href: "/platform/multi-agent-orchestration" },
  ],
  "Sovereign Solutions": [
    { label: "Data Sovereignty", desc: "National data localization framework", href: "/solutions/data-sovereignty" },
    { label: "Cyber Defense", desc: "Threat intelligence and SIBER analytics", href: "/solutions/cyber-defense" },
    { label: "Maritime Security", desc: "Maritime domain awareness systems", href: "/solutions/maritime-security" },
  ],
  Resources: [
    { label: "Documentation", desc: "API references and integration guides", href: "/resources/documentation" },
    { label: "Status Dashboard", desc: "Real-time infrastructure health", href: "/resources/status-dashboard" },
    { label: "Community", desc: "Developer and analyst ecosystem", href: "/resources/community" },
  ],
};

function isMenuActive(pathname: string, items: DropdownItem[]): boolean {
  return items.some((item) => item.href && pathname.startsWith(item.href));
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b transition-all duration-300 ${
        isLanding
          ? "border-neutral-800/80 bg-neutral-950/75 backdrop-blur-xl text-white"
          : "border-b border-neutral-200/60 bg-white/75 backdrop-blur-xl text-neutral-900"
      }`}
    >
      <div className="mx-auto flex h-[60px] max-w-[1440px] items-center justify-between px-5 lg:px-8">

        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 font-bold text-[17px] tracking-tight cursor-pointer">
            <span className={isLanding ? "text-white" : "text-neutral-900"}>JAGAT</span>
            <span className="text-garuda-500">G7</span>
          </Link>
        </div>

        {/* Center: Nav Links */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {Object.entries(NAV_MENUS).map(([label, items]) => {
            const active = isMenuActive(pathname, items);
            return (
              <div key={label} className="nav-dropdown-trigger relative group">
                <button
                  className={`flex items-center gap-1 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
                    isLanding
                      ? active
                        ? "text-white font-semibold"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                      : active
                        ? "text-neutral-900 font-semibold"
                        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                  }`}
                >
                  {label}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
                <div
                  className={`nav-dropdown-panel invisible group-hover:visible absolute left-1/2 top-full z-50 w-[280px] -translate-x-1/2 translate-y-1 rounded-xl border p-1.5 opacity-0 group-hover:opacity-100 shadow-xl transition-all duration-200 ${
                    isLanding
                      ? "border-neutral-800 bg-neutral-900 shadow-black/40"
                      : "border-neutral-200/80 bg-white shadow-neutral-900/[0.06]"
                  }`}
                >
                  {items.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href || "#"}
                      className={`block rounded-lg px-3 py-2.5 transition-colors ${
                        isLanding
                          ? pathname === item.href
                            ? "bg-neutral-800 text-garuda-400"
                            : "hover:bg-neutral-800/60"
                          : pathname === item.href
                            ? "bg-garuda-50/60"
                            : "hover:bg-neutral-50"
                      }`}
                    >
                      <div
                        className={`text-[13px] font-medium ${
                          pathname === item.href
                            ? isLanding
                              ? "text-garuda-400"
                              : "text-garuda-700"
                            : isLanding
                              ? "text-neutral-200"
                              : "text-neutral-800"
                        }`}
                      >
                        {item.label}
                      </div>
                      <div
                        className={`mt-0.5 text-[12px] ${
                          isLanding ? "text-neutral-500" : "text-neutral-400"
                        }`}
                      >
                        {item.desc}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Pricing */}
          <Link
            href="/pricing"
            className={`rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors ${
              pathname === "/pricing"
                ? "text-neutral-900 font-semibold"
                : isLanding
                  ? "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            }`}
          >
            Pricing
          </Link>
        </div>

        {/* Right: CTA */}
        <div className="flex items-center gap-2">
          <Link
            href="/contact-analyst"
            className={`hidden text-[13px] font-medium transition-colors md:inline-block ${
              isLanding ? "text-neutral-400 hover:text-white" : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Contact Analyst
          </Link>
          <Link
            href="/login"
            className={`hidden rounded-lg border px-3.5 py-[7px] text-[13px] font-medium transition-all md:inline-block ${
              isLanding
                ? "border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800"
                : "border-neutral-200 px-3.5 py-[7px] text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
            }`}
          >
            System Login
          </Link>
          <Link
            href="/pricing"
            className={`rounded-lg px-4 py-[7px] text-[13px] font-semibold transition-all active:scale-[0.97] ${
              isLanding
                ? "bg-white text-neutral-950 hover:bg-neutral-200"
                : "bg-neutral-900 text-white hover:bg-neutral-800"
            }`}
          >
            Deploy Node
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`ml-1 rounded-md p-1.5 transition-colors lg:hidden ${
              isLanding ? "text-neutral-400 hover:bg-neutral-900" : "text-neutral-500 hover:bg-neutral-100"
            }`}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className={`animate-slide-down border-t px-5 pb-5 pt-3 lg:hidden ${
            isLanding ? "border-neutral-800 bg-neutral-950 text-white" : "border-neutral-100 bg-white"
          }`}
        >
          {Object.entries(NAV_MENUS).map(([label, items]) => (
            <div key={label} className="mb-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                {label}
              </div>
              {items.map((item) => (
                <Link
                  key={item.label}
                  href={item.href || "#"}
                  onClick={() => setMobileOpen(false)}
                  className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                    isLanding
                      ? pathname === item.href
                        ? "text-garuda-400 font-medium bg-neutral-900"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                      : pathname === item.href
                        ? "text-garuda-700 font-medium bg-garuda-50/60"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          <div className={`mt-4 flex flex-col gap-2 border-t pt-4 ${isLanding ? "border-neutral-800" : "border-neutral-100"}`}>
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className={`text-[13px] font-medium ${
                pathname === "/pricing"
                  ? "text-garuda-700"
                  : "text-garuda-500"
              }`}
            >
              Pricing
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className={`rounded-lg border px-3.5 py-2 text-center text-[13px] font-medium ${
                isLanding
                  ? "border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              System Login
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
