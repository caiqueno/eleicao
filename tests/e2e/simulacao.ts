/**
 * Respostas SIMULADAS da API interna para os testes de tela.
 * Nenhum número aqui é resultado real; os candidatos se chamam "CANDIDATO SIMULADO".
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

const UFS = "ac al am ap ba ce df es go ma mg ms mt pa pb pe pi pr rj rn ro rr rs sc se sp to zz".split(" ");
const NOMES: Record<string, string> = { sp: "São Paulo", ba: "Bahia", zz: "Exterior", df: "Distrito Federal", am: "Amazonas" };

export const CANDIDATOS = [
  { numero: "13", nome: "CANDIDATO SIMULADO A", partido: "PSA", sqcand: "111" },
  { numero: "22", nome: "CANDIDATO SIMULADO B", partido: "PSB", sqcand: "222" },
];

/** Pseudoaleatório determinístico. */
function rnd(semente: number) {
  const x = Math.sin(semente * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function area(cd: string, nome: string, ibge: string | null, i: number, apurando: boolean) {
  const eleitorado = Math.round(20000 + rnd(i) * 900000);
  const pct = apurando ? Math.min(100, Math.round(rnd(i + 7) * 1000) / 10) : 0;
  const total = Math.round((eleitorado * 0.8 * pct) / 100);
  const a = Math.round(total * (0.3 + rnd(i + 3) * 0.4));
  return {
    cd,
    nome,
    ibge,
    secoesTotal: Math.round(eleitorado / 300),
    secoesTotalizadas: Math.round((eleitorado / 300) * (pct / 100)),
    percentualSecoes: pct,
    eleitorado,
    eleitoradoFaltando: Math.round(eleitorado * (1 - pct / 100)),
    votos: apurando && total > 0 ? { "13": a, "22": total - a } : null,
    validos: apurando ? total : 0,
    atualizadoEmFonte: apurando ? "2026-10-25T19:28:00-03:00" : null,
    finalizada: false,
  };
}

export function resultadoBr(apurando: boolean, extra: Record<string, unknown> = {}) {
  const pct = apurando ? 41.37 : 0;
  return {
    estado: "ok",
    mensagem: null,
    consultadoEm: "2026-10-25T22:30:00.000Z",
    resultado: {
      cargo: "presidente",
      cargoNome: "Presidente",
      abrangencia: "br",
      abrangenciaNome: "Brasil",
      codigoEleicao: "6258",
      turno: 2,
      candidatos: [
        { ...CANDIDATOS[0], votos: apurando ? 26_100_000 : 0, percentualFonte: apurando ? 50.62 : 0, percentualCalculado: null, situacao: null, eleito: false },
        { ...CANDIDATOS[1], votos: apurando ? 25_460_000 : 0, percentualFonte: apurando ? 49.38 : 0, percentualCalculado: null, situacao: null, eleito: false },
      ],
      totalizacao: {
        secoesTotal: 499248,
        secoesTotalizadas: apurando ? 206539 : 0,
        percentualSecoesTotalizadas: pct,
        atualizadoEmFonte: apurando ? "2026-10-25T19:28:00-03:00" : null,
        finalizada: false,
      },
      votos: {
        eleitorado: 158745502,
        eleitoradoApurado: apurando ? 65_670_000 : 0,
        eleitoradoFaltando: apurando ? 93_075_502 : 158745502,
        comparecimento: null,
        abstencao: null,
        validos: apurando ? 51_560_000 : 0,
        brancos: null,
        nulos: null,
      },
      fonteUrl: "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.jws",
      ...extra,
    },
  };
}

export function mapaBr(apurando: boolean) {
  return {
    estado: "ok",
    mensagem: null,
    consultadoEm: "2026-10-25T22:30:00.000Z",
    cargo: "presidente",
    uf: "br",
    candidatos: CANDIDATOS,
    areas: UFS.map((u, i) => area(u, NOMES[u] ?? u.toUpperCase(), null, i + 1, apurando)),
    pendentes: 0,
  };
}

export function mapaGovernadores(apurando: boolean) {
  return {
    ...mapaBr(apurando),
    cargo: "governador",
    candidatos: [],
    areas: ["ac", "am", "df", "es", "rn", "to"].map((u, i) => ({
      ...area(u, NOMES[u] ?? u.toUpperCase(), null, i + 1, apurando),
      candidatos: [
        { numero: "10", nome: "CANDIDATO SIMULADO C", partido: "PSC", sqcand: "333" },
        { numero: "13", nome: "CANDIDATO SIMULADO D", partido: "PSD", sqcand: "444" },
      ],
    })),
  };
}

export function mapaUf(uf: string, ibge2: string, apurando: boolean) {
  const topo = JSON.parse(readFileSync(path.join(__dirname, "../../public/mapas", `mun-${ibge2}.json`), "utf8"));
  const geoms = topo.objects[Object.keys(topo.objects)[0]].geometries as { properties: { id: string; nome: string } }[];
  return {
    estado: "ok",
    mensagem: null,
    consultadoEm: "2026-10-25T22:30:00.000Z",
    cargo: "presidente",
    uf,
    candidatos: CANDIDATOS,
    areas: geoms.map((g, i) => area(String(10000 + i), g.properties.nome.toUpperCase(), g.properties.id, i + 11, apurando)),
    pendentes: 0,
  };
}

export function mapaExterior(apurando: boolean) {
  const fonte = readFileSync(path.join(__dirname, "../../src/data/exterior.ts"), "utf8");
  const cods = [...fonte.matchAll(/"(\d{5})": \["([^"]+)"/g)].map((m) => [m[1], m[2]]);
  return {
    estado: "ok",
    mensagem: null,
    consultadoEm: "2026-10-25T22:30:00.000Z",
    cargo: "presidente",
    uf: "zz",
    candidatos: CANDIDATOS,
    areas: cods.map(([cd, pais], i) => area(cd, `CIDADE ${pais.toUpperCase()} ${i}`, null, i + 101, apurando)),
    pendentes: 0,
  };
}

export function primeiroTurno() {
  return {
    estado: "ok",
    mensagem: null,
    areas: ["br", ...UFS].map((u, i) => ({ cd: u, votos: { "13": 1000 + Math.round(rnd(i + 50) * 1000), "22": 1000 + Math.round(rnd(i + 60) * 1000) }, validos: 2500 + i * 100 })),
  };
}

/** Intercepta todas as rotas /api/* com a simulação. */
export async function simularApi(page: Page, apurando: boolean, pessoas: number | null = 1234) {
  const chamadas: string[] = [];
  await page.route("**/api/**", (rota) => {
    const url = new URL(rota.request().url());
    chamadas.push(url.pathname + url.search);
    const uf = url.searchParams.get("uf") ?? "br";
    if (url.pathname === "/api/resultados") return rota.fulfill({ json: resultadoBr(apurando) });
    if (url.pathname === "/api/mapa") {
      if (uf === "br" && url.searchParams.get("cargo") === "governador") return rota.fulfill({ json: mapaGovernadores(apurando) });
      if (uf === "br") return rota.fulfill({ json: mapaBr(apurando) });
      if (uf === "zz") return rota.fulfill({ json: mapaExterior(apurando) });
      const ibge2 = { sp: "35", ba: "29", df: "53", am: "13" }[uf] ?? "35";
      return rota.fulfill({ json: mapaUf(uf, ibge2, apurando) });
    }
    if (url.pathname === "/api/primeiro-turno") return rota.fulfill({ json: primeiroTurno() });
    if (url.pathname === "/api/municipios") return rota.fulfill({ json: { municipios: [["sp", "10000", "3500105", "ADAMANTINA"], ["ba", "10001", "2900108", "ABAÍRA"]] } });
    if (url.pathname === "/api/presenca") return rota.fulfill({ json: { agora: pessoas } });
    if (url.pathname === "/api/foto") return rota.fulfill({ status: 404, body: "" });
    return rota.fulfill({ status: 404, json: { erro: "não simulado" } });
  });
  return chamadas;
}
