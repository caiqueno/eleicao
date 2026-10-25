"use client";

import { geoCentroid, geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";
import { useEffect, useMemo, useRef, useState, type PointerEvent as PE } from "react";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { AreaMapa } from "@/lib/tse/mapa";
import { CIDADES_EXTERIOR, PAISES_PT } from "@/data/exterior";
import { capitalizar, IBGE_UF, parcelas, pct1, UF_IBGE, type CandidatoBase } from "./util";

export type Vista = "br" | "uf" | "zz";

interface Props {
  vista: Vista;
  uf: string;
  areas: AreaMapa[] | null;
  candidatos: CandidatoBase[];
  cores: string[];
  selecionado: string | null;
  aoSelecionar: (cd: string) => void;
  /** Visão Brasil de Governador: só estas UFs têm disputa. */
  ufsAtivas?: string[];
  coresPorArea?: Record<string, string[]>;
}

type Props2 = Record<string, string | undefined>;
type Fc = FeatureCollection<Geometry, Props2>;

const cacheTopo = new Map<string, Promise<Fc>>();
function carregarTopo(arquivo: string): Promise<Fc> {
  let p = cacheTopo.get(arquivo);
  if (!p) {
    p = fetch(`/mapas/${arquivo}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<Topology>;
      })
      .then((topo) => {
        const nome = Object.keys(topo.objects)[0];
        return feature(topo, topo.objects[nome]) as unknown as Fc;
      });
    p.catch(() => cacheTopo.delete(arquivo));
    cacheTopo.set(arquivo, p);
  }
  return p;
}

const FUNDO = [30, 30, 30];
function misturar(hex: string, forca: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const m = c.map((v, i) => Math.round(FUNDO[i] + (v - FUNDO[i]) * forca));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

function corDaArea(area: AreaMapa | undefined, numeros: string[], cores: string[]): string {
  if (!area) return "var(--mapa-fora)";
  if (!area.votos) return (area.secoesTotalizadas ?? 0) > 0 ? "var(--mapa-carregando)" : "var(--mapa-vazio)";
  const p = parcelas(area.votos, numeros);
  if (!p) return "var(--mapa-vazio)";
  if (p[0] === p[1]) return "#8a8a8a";
  const i = p[0] > p[1] ? 0 : 1;
  const margem = Math.abs(p[0] - p[1]);
  return misturar(cores[i], 0.4 + 0.6 * Math.min(1, margem / 30));
}

/** Centroide do maior polígono (evita rótulos no meio do mar em países com ilhas). */
function pontoRotulo(f: Feature<Geometry>): [number, number] {
  if (f.geometry.type === "MultiPolygon") {
    const g = f.geometry as MultiPolygon;
    let melhor = g.coordinates[0];
    let maior = -1;
    for (const poli of g.coordinates) {
      const anel = poli[0];
      let a = 0;
      for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) a += (anel[j][0] + anel[i][0]) * (anel[j][1] - anel[i][1]);
      if (Math.abs(a) > maior) {
        maior = Math.abs(a);
        melhor = poli;
      }
    }
    return geoCentroid({ type: "Polygon", coordinates: melhor } as Polygon);
  }
  return geoCentroid(f as GeoPermissibleObjects);
}

interface Zoom {
  k: number;
  x: number;
  y: number;
}

export function Mapa({ vista, uf, areas, candidatos, cores, selecionado, aoSelecionar, ufsAtivas, coresPorArea }: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 900, h: 600 });
  const arquivo = vista === "br" ? "br-ufs.json" : vista === "zz" ? "mundo.json" : `mun-${UF_IBGE[uf]}.json`;
  const [geo, setGeo] = useState<{ arquivo: string; fc: Fc | null } | null>(null);
  const erroGeo = geo?.arquivo === arquivo && geo.fc === null;
  // O zoom pertence a um desenho: ao trocar de mapa, volta ao enquadramento inteiro.
  const [zoomDe, setZoomDe] = useState<Zoom & { arquivo: string }>({ k: 1, x: 0, y: 0, arquivo });
  const zoom: Zoom = zoomDe.arquivo === arquivo ? zoomDe : { k: 1, x: 0, y: 0 };
  const setZoom = (z: Zoom | ((z: Zoom) => Zoom)) =>
    setZoomDe((atual) => {
      const base = atual.arquivo === arquivo ? atual : { k: 1, x: 0, y: 0 };
      return { ...(typeof z === "function" ? z(base) : z), arquivo };
    });
  const [dica, setDica] = useState<{ x: number; y: number; cd: string } | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setTam({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let vivo = true;
    carregarTopo(arquivo)
      .then((fc) => vivo && setGeo({ arquivo, fc }))
      .catch(() => vivo && setGeo({ arquivo, fc: null }));
    return () => {
      vivo = false;
    };
  }, [arquivo]);

  const numeros = candidatos.map((c) => c.numero);
  const porChave = useMemo(() => {
    const m = new Map<string, AreaMapa>();
    for (const a of areas ?? []) m.set(vista === "uf" ? (a.ibge ?? `tse${a.cd}`) : a.cd, a);
    return m;
  }, [areas, vista]);

  const desenho = useMemo(() => {
    if (!geo || geo.arquivo !== arquivo || !geo.fc) return null;
    const feats = geo.fc.features.filter((f) => !(vista === "zz" && f.properties?.name === "Antarctica"));
    const fc = { type: "FeatureCollection", features: feats } as Fc;
    const margem = vista === "zz" ? 8 : 16;
    const proj = geoMercator().fitExtent(
      [
        [margem, margem],
        [tam.w - margem, tam.h - margem],
      ],
      fc as GeoPermissibleObjects,
    );
    const caminho = geoPath(proj);
    return {
      proj,
      itens: feats.map((f, i) => {
        const chave = vista === "br" ? IBGE_UF[f.properties?.uf ?? ""] : vista === "uf" ? (f.properties?.id ?? "") : (f.properties?.name ?? "");
        const [lx, ly] = proj(pontoRotulo(f)) ?? [0, 0];
        return { i, chave, d: caminho(f) ?? "", area: caminho.area(f), lx, ly, nome: f.properties?.nome ?? f.properties?.name ?? "" };
      }),
    };
  }, [geo, arquivo, vista, tam]);

  // Cidades do exterior: pontos por coordenada.
  const cidades = useMemo(() => {
    if (vista !== "zz" || !desenho) return [];
    return (areas ?? []).flatMap((a) => {
      const loc = CIDADES_EXTERIOR[a.cd];
      const p = loc ? desenho.proj([loc[2], loc[1]]) : null;
      return p ? [{ area: a, x: p[0], y: p[1], pais: loc[0] }] : [];
    });
  }, [vista, desenho, areas]);

  // --- zoom e arraste -------------------------------------------------------
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const arrastou = useRef(false);
  const inicio = useRef<{ zoom: Zoom; pts: { x: number; y: number }[] } | null>(null);

  const limitar = (z: Zoom): Zoom => {
    const k = Math.min(12, Math.max(1, z.k));
    const x = Math.min(0, Math.max(tam.w - tam.w * k, z.x));
    const y = Math.min(0, Math.max(tam.h - tam.h * k, z.y));
    return { k, x, y };
  };
  const zoomEm = (fator: number, cx = tam.w / 2, cy = tam.h / 2) =>
    setZoom((z) => {
      const k = Math.min(12, Math.max(1, z.k * fator));
      const f = k / z.k;
      return limitar({ k, x: cx - (cx - z.x) * f, y: cy - (cy - z.y) * f });
    });

  const local = (e: { clientX: number; clientY: number }) => {
    const r = caixa.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const aoBaixar = (e: PE<SVGSVGElement>) => {
    if (e.pointerType === "touch" && ponteiros.current.size === 0) {
      ponteiros.current.set(e.pointerId, local(e));
      return; // um dedo: deixa a página rolar
    }
    ponteiros.current.set(e.pointerId, local(e));
    arrastou.current = false;
    inicio.current = { zoom, pts: [...ponteiros.current.values()] };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const aoMover = (e: PE<SVGSVGElement>) => {
    const ini = inicio.current;
    if (!ponteiros.current.has(e.pointerId)) {
      if (e.pointerType === "mouse") {
        const p = local(e);
        const alvo = (e.target as Element).closest("[data-cd]");
        setDica(alvo ? { x: p.x, y: p.y, cd: alvo.getAttribute("data-cd")! } : null);
      }
      return;
    }
    ponteiros.current.set(e.pointerId, local(e));
    if (!ini) return;
    const pts = [...ponteiros.current.values()];
    if (pts.length >= 2 && ini.pts.length >= 2) {
      const d0 = Math.hypot(ini.pts[0].x - ini.pts[1].x, ini.pts[0].y - ini.pts[1].y);
      const d1 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const c0 = { x: (ini.pts[0].x + ini.pts[1].x) / 2, y: (ini.pts[0].y + ini.pts[1].y) / 2 };
      const c1 = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const k = Math.min(12, Math.max(1, ini.zoom.k * (d1 / Math.max(d0, 1))));
      const f = k / ini.zoom.k;
      arrastou.current = true;
      setZoom(limitar({ k, x: c1.x - (c0.x - ini.zoom.x) * f, y: c1.y - (c0.y - ini.zoom.y) * f }));
    } else if (pts.length === 1 && e.pointerType !== "touch") {
      const dx = pts[0].x - ini.pts[0].x;
      const dy = pts[0].y - ini.pts[0].y;
      if (Math.abs(dx) + Math.abs(dy) > 4) arrastou.current = true;
      if (arrastou.current) setZoom(limitar({ k: ini.zoom.k, x: ini.zoom.x + dx, y: ini.zoom.y + dy }));
    }
  };
  const aoSoltar = (e: PE<SVGSVGElement>) => {
    ponteiros.current.delete(e.pointerId);
    if (ponteiros.current.size === 0) inicio.current = null;
    else inicio.current = { zoom, pts: [...ponteiros.current.values()] };
  };
  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomEm(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  });

  const clicar = (cd: string) => {
    if (arrastou.current) {
      arrastou.current = false;
      return;
    }
    aoSelecionar(cd);
  };

  // --- rótulos --------------------------------------------------------------
  const rotulos = useMemo(() => {
    if (!desenho) return [];
    if (vista === "br") return desenho.itens.map((it) => ({ x: it.lx, y: it.ly, texto: it.chave.toUpperCase(), tam: 11, chave: it.chave }));
    if (vista === "zz") {
      return desenho.itens
        .filter((it) => PAISES_PT[it.nome] && it.area * zoom.k * zoom.k > 900)
        .map((it) => ({
          x: it.lx,
          y: it.ly,
          texto: PAISES_PT[it.nome],
          tam: Math.max(8, Math.min(13, Math.sqrt(it.area) / 9)),
          chave: it.nome,
        }));
    }
    const maiores = [...(areas ?? [])].sort((a, b) => (b.eleitorado ?? 0) - (a.eleitorado ?? 0)).slice(0, zoom.k > 2 ? 14 : 6);
    const sel = (areas ?? []).find((a) => a.cd === selecionado);
    if (sel && !maiores.includes(sel)) maiores.push(sel);
    return maiores.flatMap((a) => {
      const it = desenho.itens.find((x) => x.chave === a.ibge);
      return it ? [{ x: it.lx, y: it.ly, texto: capitalizar(a.nome), tam: 11, chave: a.cd }] : [];
    });
  }, [desenho, vista, areas, selecionado, zoom.k]);

  const maiorEleitorado = Math.max(1, ...cidades.map((c) => c.area.eleitorado ?? 0));
  const cidadesRotuladas = new Set(
    [...cidades].sort((a, b) => (b.area.eleitorado ?? 0) - (a.area.eleitorado ?? 0)).slice(0, zoom.k > 2 ? 20 : 8).map((c) => c.area.cd),
  );

  const areaDica = dica ? (vista === "uf" ? (areas ?? []).find((a) => a.ibge === dica.cd) : vista === "br" ? porChave.get(dica.cd) : (areas ?? []).find((a) => a.cd === dica.cd)) : undefined;

  return (
    <div className="mapa" ref={caixa} data-testid="mapa" onPointerLeave={() => setDica(null)}>
      {erroGeo && <p className="mapa__aviso">Não foi possível carregar o desenho do mapa.</p>}
      <svg
        className="mapa__svg"
        viewBox={`0 0 ${tam.w} ${tam.h}`}
        width={tam.w}
        height={tam.h}
        role="img"
        aria-label={vista === "zz" ? "Mapa-múndi com as cidades de votação no exterior" : vista === "br" ? "Mapa do Brasil por estado" : "Mapa dos municípios"}
        onPointerDown={aoBaixar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
      >
        <g transform={`translate(${zoom.x},${zoom.y}) scale(${zoom.k})`}>
          {desenho?.itens.map((it) => {
            if (vista === "zz") return <path key={it.i} d={it.d} className="mapa__pais" vectorEffect="non-scaling-stroke" />;
            const area = vista === "br" ? porChave.get(it.chave) : porChave.get(it.chave);
            const ativa = vista !== "br" || !ufsAtivas || ufsAtivas.includes(it.chave);
            const coresArea = coresPorArea?.[it.chave] ?? cores;
            const nums = area?.candidatos?.map((c) => c.numero) ?? numeros;
            const cd = vista === "br" ? it.chave : area?.cd;
            const sel = cd !== undefined && cd === selecionado;
            return (
              <path
                key={it.i}
                d={it.d}
                data-cd={vista === "uf" ? it.chave : it.chave}
                className={`mapa__area${sel ? " mapa__area--sel" : ""}${ativa ? "" : " mapa__area--inativa"}`}
                fill={ativa ? corDaArea(area, nums, coresArea) : "var(--mapa-fora)"}
                vectorEffect="non-scaling-stroke"
                onClick={ativa && cd ? () => clicar(cd) : undefined}
                aria-label={area ? `${capitalizar(area.nome)}` : undefined}
              />
            );
          })}
          {cidades.map(({ area, x, y }) => {
            const r = (3 + 11 * Math.sqrt((area.eleitorado ?? 0) / maiorEleitorado)) / Math.sqrt(zoom.k);
            const sel = area.cd === selecionado;
            return (
              <circle
                key={area.cd}
                cx={x}
                cy={y}
                r={r}
                data-cd={area.cd}
                className={`mapa__cidade${sel ? " mapa__cidade--sel" : ""}`}
                fill={corDaArea(area, numeros, cores)}
                vectorEffect="non-scaling-stroke"
                onClick={() => clicar(area.cd)}
              />
            );
          })}
          <g className="mapa__rotulos" aria-hidden="true">
            {rotulos.map((r) => (
              <text
                key={r.chave}
                x={r.x}
                y={r.y}
                fontSize={r.tam / zoom.k}
                className={vista === "zz" ? "mapa__rotulo mapa__rotulo--pais" : "mapa__rotulo"}
              >
                {r.texto}
              </text>
            ))}
            {cidades
              .filter((c) => cidadesRotuladas.has(c.area.cd) || c.area.cd === selecionado)
              .map(({ area, x, y }) => (
                <text key={`c${area.cd}`} x={x + 9 / zoom.k} y={y + 4 / zoom.k} fontSize={11 / zoom.k} className="mapa__rotulo mapa__rotulo--cidade">
                  {capitalizar(area.nome)}
                </text>
              ))}
          </g>
        </g>
      </svg>
      {dica && areaDica && (
        <div className="mapa__dica" style={{ left: dica.x + 14, top: dica.y + 14 }}>
          <strong>{vista === "br" ? areaDica.nome : capitalizar(areaDica.nome)}</strong>
          <span>{textoDica(areaDica, areaDica.candidatos ?? candidatos)}</span>
        </div>
      )}
      <div className="mapa__zoom">
        <button type="button" aria-label="Aproximar" onClick={() => zoomEm(1.5)}>
          +
        </button>
        <button type="button" aria-label="Afastar" onClick={() => zoomEm(1 / 1.5)}>
          −
        </button>
      </div>
    </div>
  );
}

function textoDica(a: AreaMapa, cands: CandidatoBase[]): string {
  const p = parcelas(a.votos, cands.map((c) => c.numero));
  if (!p) return (a.secoesTotalizadas ?? 0) > 0 ? "carregando votos…" : "aguardando apuração";
  return `${cands.map((c, i) => `${c.nome.split(" ")[0]} ${pct1(p[i])}`).join(" · ")} · ${pct1(a.percentualSecoes)} apurado`;
}
