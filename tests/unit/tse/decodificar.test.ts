// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decodificarArquivoTse } from "@/lib/tse/decodificar";
import { fixture, gerarJws, textoFixture } from "./auxiliares";

describe("decodificarArquivoTse", () => {
  it("decodifica JSON simples (ele-c.json real)", () => {
    const dados = decodificarArquivoTse(textoFixture("ele-c.trecho-real.json")) as { pl: unknown[]; idg: string };
    expect(dados.idg).toBe("3715499");
    expect(dados.pl).toHaveLength(2);
  });

  it("aceita espaços, quebras de linha e BOM antes do JSON", () => {
    expect(decodificarArquivoTse('﻿\n  {"a":"1"}\n')).toEqual({ a: "1" });
  });

  it("aceita JSON que começa com lista", () => {
    expect(decodificarArquivoTse("[1,2]")).toEqual([1, 2]);
  });

  it("decodifica a 2ª parte de um JWS (base64url) e ignora a assinatura", () => {
    const payload = fixture("simulado-parcial.json");
    expect(decodificarArquivoTse(gerarJws(payload))).toEqual(payload);
  });

  it("decodifica JWS com caracteres acentuados e '-'/'_' do base64url", () => {
    const payload = { nm: "Eleição — São João ~~~ ???>>>", x: "ÿÿÿ" };
    const jws = gerarJws(payload);
    expect(jws.split(".")[1]).toMatch(/[-_]/);
    expect(decodificarArquivoTse(jws)).toEqual(payload);
  });

  it("aceita JWS com quebra de linha no fim", () => {
    expect(decodificarArquivoTse(gerarJws({ ok: true }) + "\n")).toEqual({ ok: true });
  });

  describe("rejeita entradas malformadas", () => {
    it.each([
      ["só duas partes", "aaa.bbb"],
      ["quatro partes", "a.b.c.d"],
      ["caracteres fora do base64url", "abc.d+e/f=.ghi"],
      ["texto HTML de erro", "<html>erro</html>"],
      ["vazio", ""],
    ])("%s", (_, entrada) => {
      expect(() => decodificarArquivoTse(entrada)).toThrow();
    });

    it("payload do JWS que não é JSON", () => {
      const lixo = Buffer.from("isto não é json").toString("base64url");
      expect(() => decodificarArquivoTse(`eyJhbGciOiJFZERTQSJ9.${lixo}.sig`)).toThrow(SyntaxError);
    });

    it("JSON truncado", () => {
      expect(() => decodificarArquivoTse('{"pl":[')).toThrow(SyntaxError);
    });
  });
});
