// @vitest-environment node
import { describe, expect, it } from "vitest";
import { UFS, UFS_GOVERNADOR_SEGUNDO_TURNO } from "@/config/eleicao";
import { eleicoesSegundoTurno, lerPleitos, opcoesAbrangencia } from "@/lib/tse/configuracao";
import { fixture } from "./auxiliares";

const real = () => fixture("ele-c.trecho-real.json");

describe("lerPleitos", () => {
  it("lê os pleitos do trecho real", () => {
    const pl = lerPleitos(real());
    expect(pl.map((p) => p.cd)).toEqual(["3220", "3221"]);
    expect(pl[1].e.map((e) => [e.cd, e.t])).toEqual([["6260", "2"], ["6258", "2"]]);
  });

  it.each([[null], ["texto"], [[]], [{}], [{ pl: "x" }]])("rejeita estrutura sem pl: %j", (dados) => {
    expect(() => lerPleitos(dados)).toThrow(/pleitos/);
  });

  it("normaliza UF para minúsculas", () => {
    const dados = real();
    dados.pl[1].e[0].abr[0].cd = "AM";
    expect(lerPleitos(dados)[1].e[0].abr[0].cd).toBe("am");
  });
});

describe("eleicoesSegundoTurno", () => {
  it("encontra Presidente (6258) e Governador (6260) no pleito 3221 / ele2026", () => {
    const eleicoes = eleicoesSegundoTurno(real());
    expect(eleicoes).toEqual([
      { cargo: "presidente", codigoEleicao: "6258", nome: "Eleição Ordinária Federal - 2026 2º Turno", abrangencias: ["br"] },
      {
        cargo: "governador",
        codigoEleicao: "6260",
        nome: "Eleição Ordinária Estadual - 2026 2º Turno",
        abrangencias: ["am", "rn", "df", "es", "ac", "to"],
      },
    ]);
  });

  it("UFs de governador batem com a lista de config/eleicao.ts", () => {
    const gov = eleicoesSegundoTurno(real()).find((e) => e.cargo === "governador")!;
    expect([...gov.abrangencias].sort()).toEqual([...UFS_GOVERNADOR_SEGUNDO_TURNO].sort());
    expect(gov.abrangencias).not.toContain("sp");
    expect(gov.abrangencias).not.toContain("rj");
  });

  it("exige turno 2: eleição com t='1' é ignorada", () => {
    const dados = real();
    dados.pl[1].e[1].t = "1"; // 6258 marcada como 1º turno
    expect(eleicoesSegundoTurno(dados).map((e) => e.cargo)).toEqual(["governador"]);
  });

  it("ignora eleição de 1º turno (6257) mesmo se estiver no pleito 3221", () => {
    const dados = real();
    dados.pl[1].e = [dados.pl[0].e[0]]; // só a 6257
    expect(eleicoesSegundoTurno(dados)).toEqual([]);
  });

  it("não usa o pleito 3220 (1º turno)", () => {
    const dados = real();
    dados.pl = [dados.pl[0]];
    expect(eleicoesSegundoTurno(dados)).toEqual([]);
  });

  it("exige pleito e ciclo corretos", () => {
    const outroCiclo = real();
    outroCiclo.pl[1].c = "ele2022";
    expect(eleicoesSegundoTurno(outroCiclo)).toEqual([]);

    const outroPleito = real();
    outroPleito.pl[1].cd = "9999";
    expect(eleicoesSegundoTurno(outroPleito)).toEqual([]);
  });

  it("exige o cargo esperado na abrangência", () => {
    const dados = real();
    dados.pl[1].e[1].abr[0].cp = [{ cd: "5", ds: "Senador", tp: "1" }];
    expect(eleicoesSegundoTurno(dados).map((e) => e.cargo)).toEqual(["governador"]);
  });

  it("descarta abrangência desconhecida", () => {
    const dados = real();
    dados.pl[1].e[0].abr.push({ cd: "../x", cp: [{ cd: "3", ds: "Governador", tp: "1" }] });
    dados.pl[1].e[0].abr.push({ cd: "xx", cp: [{ cd: "3", ds: "Governador", tp: "1" }] });
    const gov = eleicoesSegundoTurno(dados).find((e) => e.cargo === "governador")!;
    expect(gov.abrangencias).toHaveLength(6);
  });
});

describe("opcoesAbrangencia", () => {
  const opcoes = () => opcoesAbrangencia(eleicoesSegundoTurno(real()));

  it("presidente: br + todas as UFs + exterior", () => {
    const pres = opcoes().filter((o) => o.cargo === "presidente").map((o) => o.uf);
    expect(pres[0]).toBe("br");
    expect(pres).toContain("zz");
    expect(new Set(pres)).toEqual(new Set(Object.keys(UFS)));
    expect(pres).toHaveLength(Object.keys(UFS).length);
  });

  it("governador: só as UFs do arquivo, com nome", () => {
    const gov = opcoes().filter((o) => o.cargo === "governador");
    expect(gov.map((o) => o.uf)).toEqual(["am", "rn", "df", "es", "ac", "to"]);
    expect(gov.find((o) => o.uf === "df")?.nome).toBe("Distrito Federal");
  });

  it("lista vazia quando não há eleições", () => {
    expect(opcoesAbrangencia([])).toEqual([]);
  });
});
