/**
 * Gera os desenhos dos mapas (public/mapas/mun-XX.json e br-ufs.json) a partir
 * das malhas municipais do IBGE publicadas em https://github.com/tbrugz/geodata-br
 * (CC0), arquivos geojson/geojs-XX-mun.json.
 *
 *   node scripts/mapas/gerar.mjs <pasta com os geojs-XX-mun.json>
 *
 * Os arquivos de origem guardam ilhas e partes separadas de um município como
 * anéis extras de um único polígono, às vezes com a parte principal fora da
 * primeira posição. Lidos como estão, esses anéis viram buracos (ou somem na
 * simplificação) e deixam o mapa vazado. Aqui cada anel é reclassificado pela
 * contenção: anel dentro de um número par de outros é contorno, ímpar é buraco.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { topology } from "topojson-server";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { merge, quantize } from "topojson-client";

const UFS = ["11", "12", "13", "14", "15", "16", "17", "21", "22", "23", "24", "25", "26", "27", "28", "29", "31", "32", "33", "35", "41", "42", "43", "50", "51", "52", "53"];
const OBJETO = "geojs-100-mun";
/** Fração dos pontos mantida na simplificação (municípios e Brasil). */
const MANTER_MUN = 0.12;
const MANTER_BR = 0.1;

const area = (r) => {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return s / 2;
};

function dentro([x, y], anel) {
  let d = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

/** Um anel está dentro de outro quando a maioria dos seus vértices está. */
function contido(a, b) {
  const passo = Math.max(1, Math.floor(a.length / 25));
  let sim = 0;
  let total = 0;
  for (let i = 0; i < a.length - 1; i += passo, total++) if (dentro(a[i], b)) sim++;
  return sim * 2 > total;
}

/** Reorganiza os anéis em polígonos (contorno anti-horário, buracos horários). */
function reparar(geom) {
  const aneis = (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates).flat().filter((r) => r.length >= 4 && area(r) !== 0);
  aneis.sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  const poligonos = [];
  const contornoDe = new Map();
  aneis.forEach((r, i) => {
    const pais = aneis.slice(0, i).filter((o) => Math.abs(area(o)) > Math.abs(area(r)) && contido(r, o));
    const sentido = (anel, antiHorario) => ((area(anel) > 0) === antiHorario ? anel : [...anel].reverse());
    if (pais.length % 2 === 0) {
      const p = [sentido(r, true)];
      poligonos.push(p);
      contornoDe.set(r, p);
    } else {
      // O pai imediato é o menor anel que o contém; ele é um contorno.
      contornoDe.get(pais[pais.length - 1])?.push(sentido(r, false));
    }
  });
  return poligonos.length === 1 ? { type: "Polygon", coordinates: poligonos[0] } : { type: "MultiPolygon", coordinates: poligonos };
}

/** Municípios menores que isto (largura e altura, em graus) não são simplificados, para não sumirem. */
const AREA_PEQUENA = 0.1;

function simplificar(topo, manter) {
  const pre = presimplify(topo);
  const limite = quantile(pre, manter);
  for (const g of pre.objects[OBJETO].geometries) {
    const arcos = [g.arcs].flat(3).map((i) => (i < 0 ? ~i : i));
    const pts = arcos.flatMap((i) => pre.arcs[i]);
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    if (Math.max(...xs) - Math.min(...xs) < AREA_PEQUENA && Math.max(...ys) - Math.min(...ys) < AREA_PEQUENA) {
      for (const i of arcos) for (const p of pre.arcs[i]) p[2] = Infinity;
    }
  }
  return simplify(pre, limite);
}

const origem = process.argv[2];
if (!origem) {
  console.error("uso: node scripts/mapas/gerar.mjs <pasta com geojs-XX-mun.json>");
  process.exit(1);
}
const destino = path.join(path.dirname(new URL(import.meta.url).pathname), "../../public/mapas");
const todos = [];

for (const uf of UFS) {
  const fc = JSON.parse(readFileSync(path.join(origem, `geojs-${uf}-mun.json`), "utf8"));
  const feats = fc.features.map((f) => ({
    type: "Feature",
    properties: { id: String(f.properties.id), uf, nome: f.properties.name },
    geometry: reparar(f.geometry),
  }));
  todos.push(...feats);
  const topo = simplificar(topology({ [OBJETO]: { type: "FeatureCollection", features: feats } }), MANTER_MUN);
  writeFileSync(path.join(destino, `mun-${uf}.json`), JSON.stringify(quantize(topo, 2e4)));
}

const brasil = simplificar(topology({ [OBJETO]: { type: "FeatureCollection", features: todos } }), MANTER_BR);
const geoms = brasil.objects[OBJETO].geometries;
const estados = UFS.map((uf) => ({
  type: "Feature",
  properties: { uf },
  geometry: merge(brasil, geoms.filter((g) => g.properties.uf === uf)),
}));
const br = quantize(topology({ [OBJETO]: { type: "FeatureCollection", features: estados } }), 1e4);
writeFileSync(path.join(destino, "br-ufs.json"), JSON.stringify(br));
console.log(`${todos.length} municípios, ${estados.length} estados`);
