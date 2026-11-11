import type { Metadata } from "next";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAGAT G7 - Sovereign AI & Enterprise Intelligence Indonesia",
  description: "Platform AI Berdaulat untuk Pemerintah & Enterprise. Infrastruktur inteligensia lokal on-premise yang aman, rahasia, dan tanpa kebocoran data.",
  keywords: "AI Indonesia, Sovereign AI, Bapenda AI, Enterprise AI Lokal, Server AI On-Premise, Keamanan Data Pemerintah, JAGAT G7",
  authors: [{ name: "Faturachman Al Kahfi" }],
  openGraph: {
    title: "JAGAT G7 - Sovereign AI & Enterprise Intelligence",
    description: "Platform AI Berdaulat untuk Pemerintah & Enterprise.",
    url: "https://jagatg7.id",
    siteName: "JAGAT G7",
    locale: "id_ID",
    type: "website",
  }
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "JAGAT G7 Sovereign AI",
  "operatingSystem": "Linux/Windows (On-Premise)",
  "applicationCategory": "BusinessApplication",
  "description": "Enterprise AI platform for Indonesian government and businesses, featuring secure local Llama 3 models.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "IDR"
  },
  "provider": {
    "@type": "Organization",
    "name": "JAGAT G7"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className="h-full antialiased">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-full flex-col text-neutral-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
