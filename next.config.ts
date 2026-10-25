import type { NextConfig } from "next";

/** Next.js injeta scripts inline de hidratação, por isso 'unsafe-inline' em script-src. */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://media.giphy.com",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/** Endereços antigos da Vercel que passam a levar ao domínio oficial (mantendo caminho e parâmetros). */
// Desligado enquanto o DNS do acompanhevotos.com.br está fora (25/10, 18h): o endereço da Vercel
// precisa funcionar sozinho. Para religar, voltar a lista com "acompanhevotos.vercel.app" e
// "wwwacompanhevotos.vercel.app".
const HOSTS_ANTIGOS: string[] = [];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return HOSTS_ANTIGOS.map((host) => ({
      source: "/:caminho*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://www.acompanhevotos.com.br/:caminho*",
      permanent: true,
    }));
  },
  async headers() {
    return [
      // Páginas sem cache no navegador nem em proxies: quem abre o site sempre recebe a versão
      // mais nova. Os arquivos em /_next/static têm nome com hash e continuam em cache; as APIs
      // definem o próprio Cache-Control.
      {
        source: "/((?!_next/static|_next/image|api/|mapas/).*)",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CSP }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
