import { readFileSync } from "node:fs";
import path from "node:path";
import type { Feature, FeatureCollection, Geometry, Position } from "geojson";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import { describe, expect, it } from "vitest";

const PASTA = path.resolve(__dirname, "../../../public/mapas");
const UFS = ["11", "12", "13", "14", "15", "16", "17", "21", "22", "23", "24", "25", "26", "27", "28", "29", "31", "32", "33", "35", "41", "42", "43", "50", "51", "52", "53"];

function ler(arquivo: string): Feature<Geometry, Record<string, string>>[] {
  const topo = JSON.parse(readFileSync(path.join(PASTA, arquivo), "utf8")) as Topology;
  const fc = feature(topo, topo.objects[Object.keys(topo.objects)[0]]) as unknown as FeatureCollection<Geometry, Record<string, string>>;
  return fc.features;
}

const anel = (r: Position[]) => Math.abs(r.slice(1).reduce((s, p, i) => s + r[i][0] * p[1] - p[0] * r[i][1], 0)) / 2;

/** Área plana em graus² (o mapa usa projeção plana, que não depende do sentido dos anéis). */
function area(f: Feature<Geometry>): number {
  const g = f.geometry;
  const polis = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
  return polis.reduce((s, [fora, ...buracos]) => s + (fora ? anel(fora) : 0) - buracos.reduce((t, b) => t + anel(b), 0), 0);
}

describe("desenhos dos mapas", () => {
  const estados = new Map(ler("br-ufs.json").map((f) => [f.properties.uf, f]));

  it("tem os 27 estados", () => {
    expect([...estados.keys()].sort()).toEqual(UFS);
  });

  it.each(UFS)("UF %s: todo município tem desenho e eles cobrem o estado", (uf) => {
    const muns = ler(`mun-${uf}.json`);
    for (const m of muns) expect(area(m), m.properties.nome).toBeGreaterThan(1e-5);
    const soma = muns.reduce((s, m) => s + area(m), 0);
    const estado = area(estados.get(uf)!);
    // Simplificações diferentes mudam um pouco as bordas; um município faltando ou vazado passa disso.
    expect(Math.abs(soma - estado) / estado).toBeLessThan(0.01);
  });

  it("Mineiros (GO), que vinha vazado, tem o tamanho real (cerca de 9 mil km²)", () => {
    const mineiros = ler("mun-52.json").find((m) => m.properties.id === "5213103")!;
    expect(area(mineiros)).toBeGreaterThan(0.7);
  });
});
