import { NextResponse, type NextRequest } from "next/server";
import { lerChat, publicarChat, validarChat } from "@/lib/chat";

export const dynamic = "force-dynamic";

const SEM_CACHE = { "Cache-Control": "no-store" };
/** A CDN guarda a lista por 5 s: no pico, o Redis recebe poucas leituras, não uma por visitante. */
const CACHE_LISTA = { "Cache-Control": "public, max-age=0, s-maxage=5, stale-while-revalidate=10" };

const ERROS = {
  espere: [429, "Espere alguns segundos antes de mandar outro comentário."],
  limite: [429, "Muitos comentários seguidos. Tente de novo em alguns minutos."],
  banido: [403, "Você não pode mais comentar aqui."],
  indisponivel: [503, "Não foi possível enviar agora"],
} as const;

export async function GET() {
  const mensagens = await lerChat();
  if (mensagens === null) return NextResponse.json({ erro: "Chat indisponível" }, { status: 503, headers: SEM_CACHE });
  return NextResponse.json({ mensagens }, { headers: CACHE_LISTA });
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") ?? 0) > 2048) {
    return NextResponse.json({ erro: "Comentário grande demais" }, { status: 413, headers: SEM_CACHE });
  }
  let corpo: unknown = null;
  try {
    corpo = await req.json();
  } catch {
    /* corpo inválido */
  }
  const v = validarChat(corpo);
  if (!v.ok) return NextResponse.json({ erro: v.erro }, { status: 400, headers: SEM_CACHE });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "?";
  const r = await publicarChat({ apelido: v.apelido, texto: v.texto, aparelho: v.aparelho, ip });
  if (!r.ok) {
    const [status, erro] = ERROS[r.motivo];
    return NextResponse.json({ erro }, { status, headers: SEM_CACHE });
  }
  return NextResponse.json({ mensagem: r.mensagem }, { headers: SEM_CACHE });
}
