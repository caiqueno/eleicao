import { NextResponse, type NextRequest } from "next/server";
import { lerModeracao, moderarChat } from "@/lib/chat";
import { senhaConfere } from "@/lib/mensagens";

export const dynamic = "force-dynamic";

const CABECALHOS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

const autorizado = (req: NextRequest) => {
  const auth = req.headers.get("authorization") ?? "";
  return senhaConfere(auth.startsWith("Bearer ") ? auth.slice(7) : null);
};

/** Moderação do chat (mesma senha do /inbox): lista tudo, com ocultas e denúncias. */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ erro: "Senha incorreta" }, { status: 401, headers: CABECALHOS });
  const mensagens = await lerModeracao();
  if (mensagens === null) return NextResponse.json({ erro: "Chat indisponível" }, { status: 503, headers: CABECALHOS });
  return NextResponse.json({ mensagens }, { headers: CABECALHOS });
}

/** { acao: "ocultar" | "mostrar" | "banir", id } */
export async function POST(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ erro: "Senha incorreta" }, { status: 401, headers: CABECALHOS });
  let corpo: { acao?: unknown; id?: unknown } = {};
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    /* corpo inválido */
  }
  const r = await moderarChat(corpo?.acao, corpo?.id);
  if (r === "invalido") return NextResponse.json({ erro: "Pedido inválido" }, { status: 400, headers: CABECALHOS });
  if (r === "nao-encontrada") return NextResponse.json({ erro: "Comentário não encontrado" }, { status: 404, headers: CABECALHOS });
  if (r === "indisponivel") return NextResponse.json({ erro: "Chat indisponível" }, { status: 503, headers: CABECALHOS });
  return NextResponse.json({ ok: true }, { headers: CABECALHOS });
}
