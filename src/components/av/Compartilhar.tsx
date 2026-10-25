"use client";

import { useEffect, useState } from "react";
import type { ResultadoSegundoTurno } from "@/lib/tipos";
import { textoWhatsapp } from "./Exclusivos";
import { IconeApp } from "./IconesApps";
import { coresDe, horaBrasilia, INICIO_DIVULGACAO_MS, nomeCurto, parcelas, pct2, type CandidatoBase } from "./util";

export const SITE = "acompanhevotos.vercel.app";

export type Formato = "stories" | "feed";
const TAMANHOS: Record<Formato, [number, number]> = { stories: [1080, 1920], feed: [1080, 1350] };

export interface DadosCartao {
  cargo: string;
  local: string;
  /** % de seções apuradas, ou null antes dos primeiros números. */
  apurado: number | null;
  candidatos: { nome: string; numero: string; partido: string | null; pct: number | null; cor: string }[];
  /** Hora (Brasília) da atualização do TSE. */
  horaTse: string | null;
  finalizada: boolean;
}

/** Extrai do resultado oficial só o que vai no cartão (ordem fixa por número). */
export function dadosDoCartao(r: ResultadoSegundoTurno): DadosCartao {
  const cands = [...r.candidatos].sort((a, b) => Number(a.numero) - Number(b.numero));
  const t = r.totalizacao;
  const apurando = (t.secoesTotalizadas ?? 0) > 0;
  const p = apurando ? parcelas(Object.fromEntries(cands.map((c) => [c.numero, c.votos ?? 0])), cands.map((c) => c.numero)) : null;
  const base: CandidatoBase[] = cands.map((c) => ({ numero: c.numero, nome: c.nome, partido: c.partido, sqcand: c.sqcand }));
  const cores = coresDe(base);
  return {
    cargo: r.cargo === "presidente" ? "Presidente" : "Governador",
    local: r.abrangenciaNome,
    apurado: apurando ? t.percentualSecoesTotalizadas : null,
    candidatos: cands.map((c, i) => ({ nome: nomeCurto(c.nome), numero: c.numero, partido: c.partido, pct: p ? (c.percentualFonte ?? p[i]) : null, cor: cores[i] })),
    horaTse: t.atualizadoEmFonte ? horaBrasilia(Date.parse(t.atualizadoEmFonte)) : null,
    finalizada: t.finalizada,
  };
}

/** Desenha o cartão do placar (Stories 1080×1920 ou feed 1080×1350) e devolve um PNG. */
export async function gerarCartao(d: DadosCartao, formato: Formato, agora: number): Promise<Blob> {
  const [w, h] = TAMANHOS[formato];
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  if (!g) throw new Error("Canvas indisponível");
  const sans = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  const mono = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  const st = formato === "stories";

  g.fillStyle = "#0b1220";
  g.fillRect(0, 0, w, h);
  // Faixas diagonais discretas no fundo.
  g.save();
  g.globalAlpha = 0.06;
  g.fillStyle = "#ffd23f";
  for (let x = -h; x < w; x += 140) {
    g.beginPath();
    g.moveTo(x, h);
    g.lineTo(x + 40, h);
    g.lineTo(x + 40 + h, 0);
    g.lineTo(x + h, 0);
    g.fill();
  }
  g.restore();

  // Logo.
  const topo = st ? 150 : 90;
  g.fillStyle = "#ffd23f";
  g.beginPath();
  g.roundRect(80, topo, 76, 76, 20);
  g.fill();
  g.strokeStyle = "#0b1220";
  g.lineWidth = 10;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(102, topo + 40);
  g.lineTo(114, topo + 52);
  g.lineTo(136, topo + 26);
  g.stroke();
  g.fillStyle = "#eef2fb";
  g.textBaseline = "middle";
  g.font = `400 54px ${sans}`;
  g.fillText("acompanhe", 180, topo + 40);
  const largura = g.measureText("acompanhe").width;
  g.font = `800 54px ${sans}`;
  g.fillText("votos", 180 + largura, topo + 40);

  // Título.
  let y = topo + (st ? 220 : 170);
  g.fillStyle = "#9aa8c4";
  g.font = `600 40px ${sans}`;
  g.fillText(`2º turno · ${d.cargo}${d.local && d.cargo !== "Presidente" ? ` · ${d.local}` : ""}`, 80, y);
  y += st ? 90 : 75;
  g.fillStyle = "#eef2fb";
  g.font = `700 64px ${mono}`;
  let titulo: string;
  if (d.finalizada) titulo = "Totalização encerrada";
  else if (d.apurado !== null) titulo = `${pct2(d.apurado)} apurado`;
  else if (agora && agora < INICIO_DIVULGACAO_MS) titulo = `Apuração às ${horaBrasilia(INICIO_DIVULGACAO_MS)}`;
  else titulo = "Aguardando o TSE";
  g.fillText(titulo, 80, y);

  // Candidatos.
  y += st ? 180 : 130;
  const col = (w - 160) / 2;
  d.candidatos.slice(0, 2).forEach((c, i) => {
    const x = 80 + i * col;
    const dir = i === 1;
    g.textAlign = dir ? "right" : "left";
    const xt = dir ? w - 80 : x;
    g.fillStyle = c.cor;
    g.font = `800 ${st ? 66 : 58}px ${sans}`;
    g.fillText(c.nome, xt, y);
    g.fillStyle = "#9aa8c4";
    g.font = `700 34px ${sans}`;
    g.fillText(`${c.partido ? `${c.partido} ` : ""}${c.numero}`, xt, y + 58);
    g.fillStyle = c.cor;
    g.font = `800 ${st ? 110 : 96}px ${mono}`;
    g.fillText(c.pct === null ? "—" : pct2(c.pct), xt, y + (st ? 170 : 150));
  });
  g.textAlign = "left";

  // Barra com marca de 50%.
  y += st ? 290 : 240;
  const bh = 46;
  const a = d.candidatos[0]?.pct ?? 50;
  g.fillStyle = "#26334f";
  g.beginPath();
  g.roundRect(80, y, w - 160, bh, 23);
  g.fill();
  if (d.candidatos[0]?.pct !== null && d.candidatos[0]?.pct !== undefined) {
    g.save();
    g.beginPath();
    g.roundRect(80, y, w - 160, bh, 23);
    g.clip();
    g.fillStyle = d.candidatos[0].cor;
    g.fillRect(80, y, ((w - 160) * a) / 100, bh);
    g.fillStyle = d.candidatos[1]?.cor ?? "#2f6be4";
    g.fillRect(80 + ((w - 160) * a) / 100, y, w, bh);
    g.restore();
  }
  g.fillStyle = "#ffffff";
  g.fillRect(w / 2 - 3, y - 14, 6, bh + 28);
  g.font = `700 28px ${mono}`;
  g.textAlign = "center";
  g.fillText("50%", w / 2, y + bh + 44);
  g.textAlign = "left";

  // Rodapé.
  g.fillStyle = "#9aa8c4";
  g.font = `500 32px ${sans}`;
  const aviso = d.finalizada ? "Fonte: TSE" : `Resultado parcial${d.horaTse ? ` · TSE ${d.horaTse}` : ""} · não é resultado final`;
  g.fillText(aviso, 80, h - (st ? 300 : 170));
  g.fillStyle = "#ffd23f";
  g.beginPath();
  g.roundRect(80, h - (st ? 240 : 130), w - 160, 96, 48);
  g.fill();
  g.fillStyle = "#0b1220";
  g.font = `800 44px ${sans}`;
  g.textAlign = "center";
  g.fillText(SITE, w / 2, h - (st ? 192 : 82));
  g.textAlign = "left";

  return new Promise((ok, erro) => cv.toBlob((b) => (b ? ok(b) : erro(new Error("Falha ao gerar a imagem"))), "image/png"));
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

interface Props {
  aberta: boolean;
  aoFechar: () => void;
  resultado: ResultadoSegundoTurno | null;
}

/** Janela de compartilhar: imagem para Instagram (Stories/feed), WhatsApp e copiar link. */
export function Compartilhar({ aberta, aoFechar, resultado }: Props) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberta, aoFechar]);

  if (!aberta) return null;

  const link = () => window.location.href;

  const imagem = async (formato: Formato) => {
    if (!resultado) {
      setAviso("Aguarde os dados do TSE carregarem.");
      return;
    }
    setOcupado(true);
    setAviso(null);
    try {
      const blob = await gerarCartao(dadosDoCartao(resultado), formato, Date.now());
      const nome = `acompanhevotos-${formato}.png`;
      const arquivo = new File([blob], nome, { type: "image/png" });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: "acompanhevotos", text: `Acompanhe o 2º turno: ${link()}` });
      } else {
        baixar(blob, nome);
        setAviso("Imagem salva. Abra o Instagram e poste nos Stories ou no feed; o endereço do site já está na imagem.");
      }
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setAviso("Não deu para gerar a imagem neste navegador.");
    } finally {
      setOcupado(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link());
      setAviso("Link copiado. No Instagram, cole no adesivo “Link” dos Stories ou na bio.");
    } catch {
      setAviso(link());
    }
  };

  const nativo = async () => {
    try {
      await navigator.share({ title: "acompanhevotos · 2º turno", url: link() });
    } catch {
      /* cancelado */
    }
  };

  return (
    <div className="busca" role="dialog" aria-modal="true" aria-label="Compartilhar" onClick={aoFechar} data-testid="compartilhar">
      <div className="busca__caixa compartilhar" onClick={(e) => e.stopPropagation()}>
        <header className="compartilhar__cab">
          <h2>Compartilhar</h2>
          <button type="button" className="icone" onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </header>
        <p className="compartilhar__sub">Imagem do placar com o endereço do site, pronta para o Instagram.</p>
        <div className="compartilhar__grade">
          <button type="button" className="compartilhar__botao compartilhar__botao--insta" disabled={ocupado} onClick={() => imagem("stories")} data-testid="cartao-stories">
            <IconeApp app="instagram" tam={28} />
            <b>Instagram Stories</b>
            <span>Imagem vertical</span>
          </button>
          <button type="button" className="compartilhar__botao compartilhar__botao--insta" disabled={ocupado} onClick={() => imagem("feed")} data-testid="cartao-feed">
            <IconeApp app="instagram" tam={28} />
            <b>Instagram Feed</b>
            <span>Imagem 4:5</span>
          </button>
          <button
            type="button"
            className="compartilhar__botao compartilhar__botao--whats"
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(textoWhatsapp(resultado, Date.now(), link()))}`, "_blank", "noopener,noreferrer")}
          >
            <IconeApp app="whatsapp" tam={28} />
            <b>WhatsApp</b>
            <span>Mensagem com o placar</span>
          </button>
          <button type="button" className="compartilhar__botao" onClick={copiar} data-testid="copiar-link">
            <IconeApp app="link" tam={28} />
            <b>Copiar link</b>
            <span>Para o adesivo “Link” ou a bio</span>
          </button>
        </div>
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button type="button" className="compartilhar__mais" onClick={nativo}>
            <IconeApp app="mais" tam={18} /> Outros apps…
          </button>
        )}
        {aviso && (
          <p className="compartilhar__aviso" role="status">
            {aviso}
          </p>
        )}
        <p className="compartilhar__nota">A imagem mostra só números oficiais do TSE e diz que o resultado é parcial.</p>
      </div>
    </div>
  );
}
