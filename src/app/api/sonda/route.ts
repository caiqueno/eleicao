// TEMPORÁRIO: sonda de estrutura dos arquivos do TSE. Só responde em preview; será removida antes do merge.
import { NextResponse } from "next/server";
import { obterArquivo } from "@/lib/tse/cache";
import { decodificarArquivoTse } from "@/lib/tse/decodificar";
import { urlTse } from "@/lib/tse/http";

export const dynamic = "force-dynamic";

const SEG = /^[a-z0-9]{1,8}$/;

function resumo(v: unknown, prof = 0): unknown {
  if (Array.isArray(v)) return prof > 4 ? `[${v.length}]` : { _n: v.length, _0: resumo(v[0], prof + 1), _1: resumo(v[1], prof + 1) };
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) o[k] = prof > 5 ? typeof x : resumo(x, prof + 1);
    return o;
  }
  return v;
}

export async function GET(req: Request) {
  if (process.env.VERCEL_ENV !== "preview") return NextResponse.json({ erro: "indisponível" }, { status: 404 });
  const p = new URL(req.url).searchParams;
  const tipo = p.get("tipo") ?? "";
  const ele = p.get("ele") ?? "6258";
  const uf = p.get("uf") ?? "br";
  const mun = p.get("mun") ?? "";
  const cargo = (p.get("cargo") ?? "1").padStart(4, "0");
  const arq = p.get("arq") ?? "";
  if (![ele, uf, cargo].every((s) => SEG.test(s)) || (mun && !SEG.test(mun)) || (arq && !/^[0-9]{1,15}$/.test(arq)))
    return NextResponse.json({ erro: "param" }, { status: 400 });
  if (!["6257", "6258", "6259", "6260"].includes(ele)) return NextResponse.json({ erro: "ele" }, { status: 400 });
  const e6 = `e${ele.padStart(6, "0")}`;
  let url: string;
  if (tipo === "cm") url = urlTse("oficial", "ele2026", ele, "config", `mun-${e6}-cm.json`);
  else if (tipo === "ab") url = urlTse("oficial", "ele2026", ele, "dados", uf, `${uf}-${e6}-ab.jws`);
  else if (tipo === "u") url = urlTse("oficial", "ele2026", ele, "dados", uf, `${uf}${mun}-c${cargo}-${e6}-u.jws`);
  else if (tipo === "foto") url = urlTse("oficial", "ele2026", ele, "fotos", uf, `${arq}.jpeg`);
  else return NextResponse.json({ erro: "tipo" }, { status: 400 });
  try {
    if (tipo === "foto") {
      const r = await fetch(url, { cache: "no-store" });
      const b = await r.arrayBuffer();
      return NextResponse.json({ url, status: r.status, tipo: r.headers.get("content-type"), bytes: b.byteLength });
    }
    const { texto } = await obterArquivo(url, 60_000);
    const dados = decodificarArquivoTse(texto) as Record<string, unknown>;
    const filtro = p.get("filtro");
    if (filtro && Array.isArray(dados.abr)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return NextResponse.json({ url, abr: (dados.abr as any[]).filter((a) => a.cd === filtro || a.cdabr === filtro) });
    }
    return NextResponse.json({ url, bytes: texto.length, completo: p.get("completo") ? dados : undefined, resumo: resumo(dados) });
  } catch (e) {
    return NextResponse.json({ url, erro: String(e) }, { status: 502 });
  }
}
