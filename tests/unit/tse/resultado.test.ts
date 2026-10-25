// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CARGOS } from "@/config/eleicao";
import { normalizarResultado, RespostaInvalida } from "@/lib/tse/resultado";
import { fixture } from "./auxiliares";

const PRES = CARGOS.presidente;
const GOV = CARGOS.governador;
const URL = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.jws";
const norm = (nome: string, cargo = PRES, uf = "br") => normalizarResultado(fixture(nome), cargo, uf, URL);
const soma = (xs: (number | null)[]) => xs.reduce<number>((t, x) => t + (x ?? 0), 0);

describe("normalizarResultado — parcial", () => {
  const r = norm("simulado-parcial.json");

  it("metadados", () => {
    expect(r).toMatchObject({
      cargo: "presidente",
      cargoNome: "Presidente",
      abrangencia: "br",
      abrangenciaNome: "Brasil",
      codigoEleicao: "6258",
      turno: 2,
      fonteUrl: URL,
    });
  });

  it("ordena por votos (decrescente)", () => {
    expect(r.candidatos.map((c) => c.numero)).toEqual(["22", "11"]);
    expect(r.candidatos.map((c) => c.votos)).toEqual([45000, 30000]);
  });

  it("usa nome de urna, partido e percentual da fonte", () => {
    expect(r.candidatos[0]).toMatchObject({ nome: "SIMULADO B", partido: "PSIMB", percentualFonte: 60 });
  });

  it("percentual calculado correto e soma ≈ 100", () => {
    expect(r.candidatos[0].percentualCalculado).toBeCloseTo(60, 10);
    expect(r.candidatos[1].percentualCalculado).toBeCloseTo(40, 10);
    expect(soma(r.candidatos.map((c) => c.percentualCalculado))).toBeCloseTo(100, 10);
  });

  it("ninguém eleito e não finalizada", () => {
    expect(r.candidatos.every((c) => c.eleito === false)).toBe(true);
    expect(r.candidatos.every((c) => c.situacao === null)).toBe(true);
    expect(r.totalizacao.finalizada).toBe(false);
  });

  it("totalização e votos gerais", () => {
    expect(r.totalizacao).toEqual({
      secoesTotal: 1000,
      secoesTotalizadas: 500,
      percentualSecoesTotalizadas: 50,
      atualizadoEmFonte: "2026-10-25T18:30:00-03:00",
      finalizada: false,
    });
    expect(r.votos).toMatchObject({ eleitorado: 150000, comparecimento: 80000, abstencao: 70000, validos: 75000, brancos: 2000, nulos: 3000 });
  });

  it("aceita cdabr em maiúsculas e ele com zeros à esquerda", () => {
    const d = fixture("simulado-parcial.json");
    d.cdabr = "BR";
    d.ele = "006258";
    expect(() => normalizarResultado(d, PRES, "br", URL)).not.toThrow();
  });
});

describe("normalizarResultado — cenários", () => {
  it("0% totalizado: votos 0 (reais) e percentual calculado nulo (divisão por zero)", () => {
    const r = norm("simulado-zero.json");
    expect(r.candidatos.map((c) => c.votos)).toEqual([0, 0]);
    expect(r.candidatos.map((c) => c.percentualCalculado)).toEqual([null, null]);
    expect(r.candidatos.map((c) => c.numero)).toEqual(["11", "22"]); // desempate por número
    expect(r.totalizacao.percentualSecoesTotalizadas).toBe(0);
    expect(r.totalizacao.finalizada).toBe(false);
  });

  it("finalizado: and='f' e 100% → finalizada; eleito só com e='s'", () => {
    const r = norm("simulado-finalizado.json");
    expect(r.totalizacao.finalizada).toBe(true);
    expect(r.totalizacao.percentualSecoesTotalizadas).toBe(100);
    const [primeiro, segundo] = r.candidatos;
    expect(primeiro).toMatchObject({ numero: "22", eleito: true, situacao: "Eleito" });
    expect(segundo).toMatchObject({ numero: "11", eleito: false, situacao: null });
  });

  it("and='f' com menos de 100% NÃO é finalizada", () => {
    const d = fixture("simulado-finalizado.json");
    d.s.pstn = "99,99";
    expect(normalizarResultado(d, PRES, "br", URL).totalizacao.finalizada).toBe(false);
  });

  it("100% sem and='f' NÃO é finalizada", () => {
    const d = fixture("simulado-finalizado.json");
    d.and = "p";
    expect(normalizarResultado(d, PRES, "br", URL).totalizacao.finalizada).toBe(false);
  });

  it.each([["n"], ["N"], [""], [true], ["sim"], [undefined]])("e=%j não marca eleito", (valor) => {
    const d = fixture("simulado-parcial.json");
    d.carg[0].agr[0].par[0].cand[0].e = valor;
    const r = normalizarResultado(d, PRES, "br", URL);
    expect(r.candidatos.find((c) => c.numero === "11")!.eleito).toBe(false);
  });

  it("sem dt/ht → atualizadoEmFonte nulo", () => {
    expect(norm("simulado-sem-data.json").totalizacao.atualizadoEmFonte).toBeNull();
  });

  it("numéricos inválidos viram null, nunca 0", () => {
    const r = norm("simulado-numerico-invalido.json");
    expect(r.totalizacao).toMatchObject({ secoesTotal: null, secoesTotalizadas: null, percentualSecoesTotalizadas: null, finalizada: false });
    expect(r.votos).toMatchObject({ eleitorado: null, comparecimento: null, abstencao: null, validos: null, brancos: null, nulos: null });
    const a = r.candidatos.find((c) => c.numero === "11")!;
    const b = r.candidatos.find((c) => c.numero === "22")!;
    expect(a.votos).toBeNull();
    expect(a.percentualFonte).toBeNull();
    expect(b.percentualFonte).toBeNull(); // "150,00" fora da faixa
    // Com um voto desconhecido, nenhum percentual calculado é inventado.
    expect(r.candidatos.map((c) => c.percentualCalculado)).toEqual([null, null]);
    // Candidato com votos nulos vai para o fim.
    expect(r.candidatos.map((c) => c.numero)).toEqual(["22", "11"]);
  });

  it("carg sem candidatos → inválido (2º turno exige 2)", () => {
    expect(() => norm("simulado-sem-candidatos.json")).toThrow(RespostaInvalida);
  });

  it("carg vazio → inválido", () => {
    const d = fixture("simulado-parcial.json");
    d.carg = [];
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(/2 candidatos/);
  });

  it("4 candidatos → inválido (não é 2º turno)", () => {
    expect(() => norm("simulado-tres-candidatos.json")).toThrow(/2 candidatos; o arquivo tem 4/);
  });

  it("sem cdabr → inválido", () => {
    const d = fixture("simulado-parcial.json");
    delete d.cdabr;
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(/cdabr/);
  });

  it("empate em votos → ordem alfabética do nome", () => {
    const d = fixture("simulado-parcial.json");
    for (const p of d.carg[0].agr.flatMap((a: { par: unknown[] }) => a.par)) {
      for (const c of (p as { cand: { vap: string }[] }).cand) c.vap = "0";
    }
    const nomes = normalizarResultado(d, PRES, "br", URL).candidatos.map((c) => c.nome);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("governador em UF válida", () => {
    const d = fixture("simulado-parcial.json");
    d.cdabr = "am";
    d.ele = "6260";
    d.carg[0].cd = "3";
    const r = normalizarResultado(d, GOV, "am", URL);
    expect(r).toMatchObject({ cargo: "governador", abrangencia: "am", abrangenciaNome: "Amazonas", codigoEleicao: "6260" });
  });
});

describe("normalizarResultado — rejeições", () => {
  it.each([[null], ["texto"], [[1, 2]], [42]])("conteúdo não-objeto: %j", (dados) => {
    expect(() => normalizarResultado(dados, PRES, "br", URL)).toThrow(RespostaInvalida);
  });

  it("abrangência divergente (cdabr = sp pedido br)", () => {
    expect(() => norm("simulado-cdabr-divergente.json")).toThrow(/Abrangência divergente/);
  });

  it("arquivo de 1º turno (ele = 6257)", () => {
    expect(() => norm("simulado-primeiro-turno.json")).toThrow(RespostaInvalida);
  });

  it("eleição divergente (arquivo de governador pedido como presidente)", () => {
    const d = fixture("simulado-parcial.json");
    d.ele = "6260";
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(/Eleição divergente/);
  });

  it("ele não numérico", () => {
    const d = fixture("simulado-parcial.json");
    d.ele = "abc";
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(RespostaInvalida);
  });

  it("cargo divergente (Senador no lugar de Presidente)", () => {
    const d = fixture("simulado-parcial.json");
    d.carg[0].cd = "5";
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(/Cargo 1 não encontrado/);
  });

  it("sem carg", () => {
    const d = fixture("simulado-parcial.json");
    delete d.carg;
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(/carg/);
  });

  it("candidato sem número ou nome", () => {
    const d = fixture("simulado-parcial.json");
    delete d.carg[0].agr[0].par[0].cand[0].nm;
    delete d.carg[0].agr[0].par[0].cand[0].nmu;
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(/sem número ou nome/);
  });

  it("seções totalizadas > total", () => {
    const d = fixture("simulado-parcial.json");
    d.s.st = "1001";
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(/Seções totalizadas/);
  });

  // BUG: `texto()` só aceita string; com `ele` numérico a verificação de eleição é pulada.
  it("rejeita ele numérico de 1º turno (6257) (bug corrigido)", () => {
    const d = fixture("simulado-parcial.json");
    d.ele = 6257;
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(RespostaInvalida);
  });

  // BUG: cargo com `cd` numérico é tratado como "sem código" e aceito para qualquer cargo.
  it("rejeita carg com cd numérico de outro cargo (5 = Senador) (bug corrigido)", () => {
    const d = fixture("simulado-parcial.json");
    d.carg[0].cd = 5;
    expect(() => normalizarResultado(d, PRES, "br", URL)).toThrow(RespostaInvalida);
  });
});
