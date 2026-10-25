import { describe, expect, it, vi } from "vitest";
import { guardarMensagem, lerMensagens, MAX_ENVIOS, senhaConfere, validarMensagem } from "@/lib/mensagens";

const CFG = { url: "https://exemplo.upstash.io", token: "t" };
const base = { email: "Pessoa@Exemplo.com ", texto: " Olá, gostei do site ", aceite: true };

describe("validação do Fale com a gente", () => {
  it("aceita e normaliza", () => {
    expect(validarMensagem(base)).toEqual({ ok: true, email: "pessoa@exemplo.com", texto: "Olá, gostei do site" });
  });
  it("recusa e-mail inválido, texto vazio ou longo, sem aceite e robô", () => {
    expect(validarMensagem({ ...base, email: "x@y" }).ok).toBe(false);
    expect(validarMensagem({ ...base, email: "<script>@a.com" }).ok).toBe(false);
    expect(validarMensagem({ ...base, texto: " " }).ok).toBe(false);
    expect(validarMensagem({ ...base, texto: "a".repeat(1001) }).ok).toBe(false);
    expect(validarMensagem({ ...base, aceite: false }).ok).toBe(false);
    expect(validarMensagem({ ...base, site: "http://spam" }).ok).toBe(false);
    expect(validarMensagem(null).ok).toBe(false);
  });
});

describe("caixa de entrada no Redis", () => {
  it("guarda só data, e-mail e texto e respeita o limite por IP", async () => {
    let contador = 0;
    const corpos: unknown[][][] = [];
    const fetchImpl = vi.fn(async (_u: string | URL | Request, init?: RequestInit) => {
      const cmds = JSON.parse(String(init?.body)) as unknown[][];
      corpos.push(cmds);
      return new Response(JSON.stringify(cmds.map((c) => ({ result: c[0] === "INCR" ? ++contador : 1 }))));
    });
    const f = fetchImpl as unknown as typeof fetch;
    for (let i = 0; i < MAX_ENVIOS; i++) expect(await guardarMensagem({ email: "a@b.com", texto: "oi", ip: "1.2.3.4" }, { cfg: CFG, fetchImpl: f })).toBe("ok");
    expect(await guardarMensagem({ email: "a@b.com", texto: "oi", ip: "1.2.3.4" }, { cfg: CFG, fetchImpl: f })).toBe("limite");
    const gravado = corpos.find((c) => c[0][0] === "LPUSH")!;
    const m = JSON.parse(String(gravado[0][2]));
    expect(Object.keys(m).sort()).toEqual(["em", "email", "id", "texto"]);
    expect(JSON.stringify(corpos)).not.toContain("1.2.3.4");
  });
  it("sem Redis fica indisponível", async () => {
    expect(await guardarMensagem({ email: "a@b.com", texto: "oi", ip: "x" }, { cfg: null })).toBe("indisponivel");
    expect(await lerMensagens({ cfg: null })).toBeNull();
  });
});

describe("senha da caixa de entrada", () => {
  it("só confere com a senha configurada e longa", () => {
    const s = "abcdefghijklmnop1234";
    expect(senhaConfere(s, s)).toBe(true);
    expect(senhaConfere("errada", s)).toBe(false);
    expect(senhaConfere(null, s)).toBe(false);
    expect(senhaConfere("curta", "curta")).toBe(false);
    expect(senhaConfere("qualquer", undefined)).toBe(false);
  });
  it("rota /api/inbox recusa sem senha", async () => {
    const { GET } = await import("@/app/api/inbox/route");
    const { NextRequest } = await import("next/server");
    const r = await GET(new NextRequest("http://localhost/api/inbox", { headers: { authorization: "Bearer x" } }));
    expect(r.status).toBe(401);
  });
});
