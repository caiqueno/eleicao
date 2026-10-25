import { NextResponse, type NextRequest } from "next/server";
import { CARGOS, ELEICAO_CONFIG, TSE_AMBIENTE } from "@/config/eleicao";
import { buscarBytes, urlTse } from "@/lib/tse/http";
import { consultarResultado, eCargoValido, eUfValida } from "@/lib/tse/servico";

export const dynamic = "force-dynamic";

/** Fotos oficiais publicadas pelo TSE no feed de resultados, servidas pelo próprio site (CSP só mesma origem). */
const fotos = new Map<string, ArrayBuffer>();

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const desconhecidos = [...params.keys()].some((k) => !["cargo", "uf", "sq"].includes(k));
  const cargo = params.get("cargo") ?? "";
  const uf = params.get("uf") ?? "";
  const sq = params.get("sq") ?? "";
  if (desconhecidos || !eCargoValido(cargo) || !eUfValida(uf) || !/^\d{6,15}$/.test(sq)) {
    return NextResponse.json({ erro: "Parâmetros inválidos" }, { status: 400 });
  }
  const ufFoto = cargo === "presidente" ? "br" : uf;
  // Só candidatos do 2º turno daquela seleção: a rota não serve como proxy genérico.
  const base = await consultarResultado(cargo, ufFoto);
  if (!base.resultado?.candidatos.some((c) => c.sqcand === sq)) {
    return NextResponse.json({ erro: "Candidato não encontrado" }, { status: 404 });
  }
  const chave = `${cargo}:${ufFoto}:${sq}`;
  let bytes = fotos.get(chave);
  if (!bytes) {
    try {
      const ele = CARGOS[cargo].codigoEleicao;
      bytes = await buscarBytes(urlTse(TSE_AMBIENTE, ELEICAO_CONFIG.ciclo, ele, "fotos", ufFoto, `${sq}.jpeg`));
      const b = new Uint8Array(bytes, 0, 3);
      if (b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) throw new Error("não é JPEG");
      if (fotos.size < 50) fotos.set(chave, bytes);
    } catch {
      return NextResponse.json({ erro: "Foto indisponível" }, { status: 502 });
    }
  }
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
    },
  });
}
