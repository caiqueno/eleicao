import { NextResponse, type NextRequest } from "next/server";
import { guardarMensagem, validarMensagem } from "@/lib/mensagens";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };

/** "Fale com a gente": guarda a mensagem na caixa de entrada privada. */
export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") ?? 0) > 4096) {
    return NextResponse.json({ erro: "Mensagem grande demais" }, { status: 413, headers: SEM_CACHE });
  }
  let corpo: unknown = null;
  try {
    corpo = await req.json();
  } catch {
    /* corpo inválido */
  }
  const v = validarMensagem(corpo);
  if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 400, headers: SEM_CACHE });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const r = await guardarMensagem({ email: v.email, texto: v.texto, ip });
  if (r === "limite") return NextResponse.json({ erro: "Muitas mensagens. Tente de novo em alguns minutos." }, { status: 429, headers: SEM_CACHE });
  if (r === "indisponivel") return NextResponse.json({ erro: "Não foi possível enviar agora" }, { status: 503, headers: SEM_CACHE });
  return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
}
