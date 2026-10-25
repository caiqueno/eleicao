import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "acompanhevotos · 2º turno 2026",
  description:
    "Acompanhe o 2º turno das Eleições Gerais 2026 para Presidente e Governador com dados oficiais do Tribunal Superior Eleitoral (TSE).",
  applicationName: "acompanhevotos",
  appleWebApp: { capable: true, title: "acompanhevotos", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: "#0b1220",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-theme="dark">
      <body>
        <a className="pular" href="#conteudo">
          Pular para o conteúdo
        </a>
        {children}
        {/* Vercel Web Analytics: contagem de visitas sem cookies nem dados pessoais. Só é carregado na Vercel. */}
        {process.env.VERCEL === "1" && (
          <>
            <Script id="va-init" strategy="afterInteractive">
              {"window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };"}
            </Script>
            <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
          </>
        )}
      </body>
    </html>
  );
}
