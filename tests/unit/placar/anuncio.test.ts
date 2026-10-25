import { describe, expect, it } from "vitest";

import { anuncioDoPlacar } from "@/components/av/Placar";
import type { ResultadoSegundoTurno } from "@/lib/tipos";

function resultado(votos: [number, number], st: number, eleito: [boolean, boolean] = [false, false]): ResultadoSegundoTurno {
  return {
    cargoNome: "Presidente",
    abrangenciaNome: "Bahia",
    totalizacao: { secoesTotalizadas: st, percentualSecoesTotalizadas: st ? 42.5 : 0, finalizada: false },
    candidatos: [
      { numero: "22", nome: "BETA SILVA", votos: votos[1], eleito: eleito[1] },
      { numero: "13", nome: "ALFA SOUZA", votos: votos[0], eleito: eleito[0] },
    ],
  } as unknown as ResultadoSegundoTurno;
}

describe("anuncioDoPlacar", () => {
  it("nada antes dos primeiros votos", () => {
    expect(anuncioDoPlacar(resultado([0, 0], 0), "br")).toBeNull();
  });

  it("à frente é sempre parcial e nunca diz que venceu", () => {
    const a = anuncioDoPlacar(resultado([1000, 900], 10), "br")!;
    expect(a).toMatchObject({ tipo: "frente", indice: 0 });
    expect(a.texto).toContain("está à frente por 100 votos");
    expect(a.texto).toContain("resultado parcial");
    expect(a.texto).not.toMatch(/venc|eleit/i);
  });

  it("à frente na UF cita o estado", () => {
    const a = anuncioDoPlacar(resultado([900, 1000], 10), "ba")!;
    expect(a).toMatchObject({ tipo: "frente", indice: 1 });
    expect(a.texto).toContain("votos · Bahia");
  });

  it("empate", () => {
    expect(anuncioDoPlacar(resultado([500, 500], 10), "br")).toMatchObject({ tipo: "empate" });
  });

  it("venceu só quando o TSE marca eleito, mesmo com o outro à frente nos votos parciais", () => {
    expect(anuncioDoPlacar(resultado([1000, 900], 10, [false, true]), "br")).toMatchObject({ tipo: "eleito", indice: 1 });
  });
});
