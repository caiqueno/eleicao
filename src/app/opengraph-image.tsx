import { ImageResponse } from "next/og";

export const alt = "acompanhevotos · 2º turno 2026 com dados oficiais do TSE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Pré-visualização do link (WhatsApp, Instagram, redes): fixa, sem números de apuração. */
export default function Imagem() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b1220", color: "#eef2fb", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 96, height: 96, borderRadius: 26, background: "#ffd23f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="64" height="64" viewBox="0 0 26 26">
              <path d="M5 13.5l5 5L21 7.5" fill="none" stroke="#0b1220" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 64 }}>
            <span>acompanhe</span>
            <span style={{ fontWeight: 800 }}>votos</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>2º turno 2026</div>
          <div style={{ fontSize: 40, color: "#9aa8c4", marginTop: 16 }}>Presidente e governadores · mapa por estado e município · dados oficiais do TSE</div>
        </div>
        <div style={{ display: "flex", height: 28, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ flex: 1, background: "#e5302f" }} />
          <div style={{ width: 8, background: "#ffffff" }} />
          <div style={{ flex: 1, background: "#2f6be4" }} />
        </div>
      </div>
    ),
    size,
  );
}
