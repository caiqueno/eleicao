import { describe, expect, it } from "vitest";
import { denunciarChat, lerChat, lerModeracao, MAX_POR_JANELA, moderarChat, publicarChat, validarChat } from "@/lib/chat";

const CFG = { url: "https://exemplo.upstash.io", token: "t" };
const AP = "a".repeat(32);
const AP2 = "b".repeat(32);

/** Redis de mentira, em memória, com os comandos que o chat usa. */
function redisFalso() {
  const kv = new Map<string, unknown>();
  const lista = (k: string) => (kv.get(k) as string[] | undefined) ?? [];
  const conj = (k: string) => (kv.get(k) as Set<string> | undefined) ?? new Set<string>();
  const exec = (c: (string | number)[]): unknown => {
    const [cmd, k, ...a] = c.map(String);
    switch (cmd) {
      case "INCR": {
        const n = Number(kv.get(k) ?? 0) + 1;
        kv.set(k, n);
        return n;
      }
      case "EXPIRE":
        return 1;
      case "DEL":
        return kv.delete(k) ? 1 : 0;
      case "LPUSH":
        kv.set(k, [...a.reverse(), ...lista(k)]);
        return lista(k).length;
      case "LTRIM":
        kv.set(k, lista(k).slice(Number(a[0]), Number(a[1]) + 1));
        return "OK";
      case "LRANGE":
        return lista(k).slice(Number(a[0]), Number(a[1]) + 1);
      case "SADD": {
        const s = conj(k);
        const antes = s.size;
        a.forEach((x) => s.add(x));
        kv.set(k, s);
        return s.size - antes;
      }
      case "SREM":
        return conj(k).delete(a[0]) ? 1 : 0;
      case "SISMEMBER":
        return conj(k).has(a[0]) ? 1 : 0;
      case "SMEMBERS":
        return [...conj(k)];
      case "SCARD":
        return conj(k).size;
      default:
        throw new Error(`comando ${cmd}`);
    }
  };
  const fetchImpl = (async (_u: string | URL | Request, init?: RequestInit) => {
    const cmds = JSON.parse(String(init?.body)) as (string | number)[][];
    return new Response(JSON.stringify(cmds.map((c) => ({ result: exec(c) }))));
  }) as unknown as typeof fetch;
  /** Zera os limites de tempo, como se a janela tivesse passado. */
  const passarTempo = () => [...kv.keys()].filter((k) => k.includes(":lim")).forEach((k) => kv.delete(k));
  return { kv, opcoes: { cfg: CFG, fetchImpl }, passarTempo };
}

describe("validação do chat", () => {
  const ok = (texto: string, apelido: string | undefined = "Ana BA") => validarChat({ texto, apelido, aparelho: AP });
  it("aceita comentário normal e exige o nome", () => {
    expect(ok("  Apuração   bem rápida hoje ", "  Ana   BA ")).toEqual({ ok: true, apelido: "Ana BA", texto: "Apuração bem rápida hoje", aparelho: AP });
    expect(validarChat({ texto: "oi tudo bem", aparelho: AP })).toEqual({ ok: false, erro: "Informe seu nome para conversar" });
    expect(ok("oi tudo bem", "   ")).toEqual({ ok: false, erro: "Informe seu nome para conversar" });
    expect(ok("oi tudo bem", "Visitante").ok).toBe(false);
    expect(ok("oi tudo bem", "x")).toEqual({ ok: false, erro: "Nome: de 2 a 24 letras ou números" });
    expect(ok("Que virada no Nordeste!", "Ana BA")).toMatchObject({ ok: true, apelido: "Ana BA" });
    expect(ok("26.100.000 votos já").ok).toBe(true);
    expect(ok("Computação dos votos está lenta").ok).toBe(true);
  });
  it("barra links, contatos, palavrões e pedido de voto", () => {
    expect(ok("veja https://x.io").ok).toBe(false);
    expect(ok("entra no grupo t.me/abc").ok).toBe(false);
    expect(ok("site fake ponto com: golpe . com").ok).toBe(false);
    expect(ok("me chama 11 98765-4321").ok).toBe(false);
    expect(ok("manda pra a@b.com").ok).toBe(false);
    expect(ok("que P0RRA é essa").ok).toBe(false);
    expect(ok("seu idiota").ok).toBe(false);
    expect(ok("Votem no 13 amanhã").ok).toBe(false);
    expect(ok("vote em fulano").ok).toBe(false);
  });
  it("barra apelido reservado, ofensivo ou inválido e pedido sem aparelho", () => {
    expect(ok("oi tudo bem", "TSE Oficial").ok).toBe(false);
    expect(ok("oi tudo bem", "Moderador").ok).toBe(false);
    expect(ok("oi tudo bem", "<b>x</b>").ok).toBe(false);
    expect(ok("oi tudo bem", "merdinha").ok).toBe(false);
    expect(validarChat({ texto: "oi tudo bem", apelido: "Ana", aparelho: "x" }).ok).toBe(false);
    expect(validarChat({ texto: "oi tudo bem", apelido: "Ana", aparelho: AP, site: "robo" }).ok).toBe(false);
    expect(ok("a".repeat(281)).ok).toBe(false);
  });
});

describe("chat no Redis", () => {
  it("publica, lê sem dados internos e respeita os limites por IP", async () => {
    const r = redisFalso();
    const m = await publicarChat({ apelido: "Ana", texto: "oi gente", aparelho: AP, ip: "1.2.3.4" }, r.opcoes);
    expect(m.ok).toBe(true);
    expect(await publicarChat({ apelido: "Ana", texto: "de novo", aparelho: AP, ip: "1.2.3.4" }, r.opcoes)).toEqual({ ok: false, motivo: "espere" });
    // A tentativa barrada também conta na janela de 5 minutos.
    for (let i = 2; i < MAX_POR_JANELA; i++) {
      r.kv.forEach((_v, k) => k.includes(":lim1:") && r.kv.delete(k));
      expect((await publicarChat({ apelido: "Ana", texto: `msg ${i}`, aparelho: AP, ip: "1.2.3.4" }, r.opcoes)).ok).toBe(true);
    }
    r.kv.forEach((_v, k) => k.includes(":lim1:") && r.kv.delete(k));
    expect(await publicarChat({ apelido: "Ana", texto: "mais uma", aparelho: AP, ip: "1.2.3.4" }, r.opcoes)).toEqual({ ok: false, motivo: "limite" });
    const lida = await lerChat(r.opcoes);
    expect(lida).toHaveLength(MAX_POR_JANELA - 1);
    expect(Object.keys(lida![0]).sort()).toEqual(["apelido", "em", "id", "texto"]);
    expect(JSON.stringify([...r.kv.entries()].map(([k, v]) => [k, v instanceof Set ? [...v] : v]))).not.toContain("1.2.3.4");
  });

  it("três denúncias de IPs diferentes ocultam; uma pessoa só não", async () => {
    const r = redisFalso();
    const m = await publicarChat({ apelido: "X", texto: "comentário", aparelho: AP, ip: "9.9.9.9" }, r.opcoes);
    if (!m.ok) throw new Error();
    const id = m.mensagem.id;
    for (let i = 0; i < 5; i++) expect(await denunciarChat(id, "5.5.5.5", r.opcoes)).toBe("ok");
    expect(await lerChat(r.opcoes)).toHaveLength(1);
    await denunciarChat(id, "6.6.6.6", r.opcoes);
    await denunciarChat(id, "7.7.7.7", r.opcoes);
    expect(await lerChat(r.opcoes)).toHaveLength(0);
    const mod = await lerModeracao(r.opcoes);
    expect(mod![0]).toMatchObject({ id, oculta: true, denuncias: 3 });
    expect(await moderarChat("mostrar", id, r.opcoes)).toBe("ok");
    expect(await lerChat(r.opcoes)).toHaveLength(1);
    expect(await denunciarChat("nao-e-id", "1.1.1.1", r.opcoes)).toBe("invalido");
  });

  it("banir oculta tudo de quem escreveu e impede novos comentários", async () => {
    const r = redisFalso();
    const a = await publicarChat({ apelido: "A", texto: "um", aparelho: AP, ip: "1.1.1.1" }, r.opcoes);
    r.passarTempo();
    await publicarChat({ apelido: "A", texto: "dois", aparelho: AP, ip: "1.1.1.1" }, r.opcoes);
    await publicarChat({ apelido: "B", texto: "outro", aparelho: AP2, ip: "2.2.2.2" }, r.opcoes);
    if (!a.ok) throw new Error();
    expect(await moderarChat("banir", a.mensagem.id, r.opcoes)).toBe("ok");
    expect((await lerChat(r.opcoes))!.map((m) => m.texto)).toEqual(["outro"]);
    r.passarTempo();
    expect(await publicarChat({ apelido: "A", texto: "voltei", aparelho: AP, ip: "3.3.3.3" }, r.opcoes)).toEqual({ ok: false, motivo: "banido" });
    expect(await publicarChat({ apelido: "A", texto: "voltei", aparelho: AP2.replace(/b/g, "c"), ip: "1.1.1.1" }, r.opcoes)).toEqual({ ok: false, motivo: "banido" });
    expect(await moderarChat("apagar-tudo", a.mensagem.id, r.opcoes)).toBe("invalido");
  });

  it("resposta: o trecho citado vem do servidor e some se a original for ocultada", async () => {
    const r = redisFalso();
    const longo = "a apuração está andando bem rápido hoje ".repeat(4).trim();
    const a = await publicarChat({ apelido: "Ana", texto: longo, aparelho: AP, ip: "1.1.1.1" }, r.opcoes);
    if (!a.ok) throw new Error();
    const b = await publicarChat({ apelido: "Rui", texto: "concordo", aparelho: AP2, ip: "2.2.2.2", resposta: a.mensagem.id }, r.opcoes);
    if (!b.ok) throw new Error();
    expect(b.mensagem.resp).toMatchObject({ id: a.mensagem.id, apelido: "Ana" });
    expect(b.mensagem.resp!.texto.length).toBeLessThanOrEqual(80);
    expect(b.mensagem.resp!.texto.endsWith("…")).toBe(true);
    expect((await lerChat(r.opcoes))![0].resp).toMatchObject({ id: a.mensagem.id, apelido: "Ana" });

    expect(await moderarChat("ocultar", a.mensagem.id, r.opcoes)).toBe("ok");
    expect((await lerChat(r.opcoes))![0].resp).toEqual({ id: a.mensagem.id, apelido: "", texto: "", removida: true });
    r.passarTempo();
    expect(await publicarChat({ apelido: "Rui", texto: "e agora", aparelho: AP2, ip: "2.2.2.2", resposta: a.mensagem.id }, r.opcoes)).toEqual({ ok: false, motivo: "resposta" });
    r.passarTempo();
    const inexistente = "00000000-0000-4000-8000-000000000009";
    expect(await publicarChat({ apelido: "Rui", texto: "e agora", aparelho: AP2, ip: "2.2.2.2", resposta: inexistente }, r.opcoes)).toEqual({ ok: false, motivo: "resposta" });
  });

  it("validarChat aceita só id de mensagem como resposta", () => {
    const base = { apelido: "Ana BA", texto: "oi gente", aparelho: AP };
    expect(validarChat({ ...base, resposta: "00000000-0000-4000-8000-000000000001" })).toMatchObject({ ok: true, resposta: "00000000-0000-4000-8000-000000000001" });
    expect(validarChat({ ...base, resposta: "<script>" })).toEqual({ ok: false, erro: "Pedido inválido" });
    expect(validarChat({ ...base, resposta: { id: "x" } })).toEqual({ ok: false, erro: "Pedido inválido" });
    expect(validarChat(base)).not.toHaveProperty("resposta");
  });

  it("sem Redis fica indisponível", async () => {
    expect(await lerChat({ cfg: null })).toBeNull();
    expect((await publicarChat({ apelido: "A", texto: "oi", aparelho: AP, ip: "x" }, { cfg: null })).ok).toBe(false);
  });

  it("rota de moderação recusa sem senha", async () => {
    const { GET, POST } = await import("@/app/api/chat/moderar/route");
    const { NextRequest } = await import("next/server");
    expect((await GET(new NextRequest("http://localhost/api/chat/moderar"))).status).toBe(401);
    const p = await POST(new NextRequest("http://localhost/api/chat/moderar", { method: "POST", headers: { authorization: "Bearer x" }, body: "{}" }));
    expect(p.status).toBe(401);
  });
});
