// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dataHoraTse, inteiroOuNulo, percentualOuNulo } from "@/lib/tse/numeros";

describe("inteiroOuNulo", () => {
  it.each([
    ["123", 123],
    [" 42 ", 42],
    ["0", 0],
    [0, 0],
    [7, 7],
  ])("%j → %j", (entrada, esperado) => {
    expect(inteiroOuNulo(entrada)).toBe(esperado);
  });

  it.each([[""], [null], [undefined], ["  "], ["1.234"], ["1,5"], ["-1"], [-1], [3.5], ["12a"], ["abc"], [NaN], [{}], [[]], [true], ["99999999999999999999"]])(
    "%j → null (nunca 0)",
    (entrada) => {
      expect(inteiroOuNulo(entrada)).toBeNull();
    },
  );
});

describe("percentualOuNulo", () => {
  it.each([
    ["47,027772356", 47.027772356],
    ["100,00", 100],
    ["0,00", 0],
    ["50.5", 50.5],
    ["33", 33],
    [12.5, 12.5],
  ])("%j → %j", (entrada, esperado) => {
    expect(percentualOuNulo(entrada)).toBeCloseTo(esperado as number, 9);
  });

  it.each([[""], [null], [undefined], ["abc"], ["100,01"], ["150,00"], [-1], [101], ["1.234,5"], ["-5,0"], [NaN], [Infinity]])(
    "%j → null (nunca 0)",
    (entrada) => {
      expect(percentualOuNulo(entrada)).toBeNull();
    },
  );
});

describe("dataHoraTse", () => {
  it("converte para ISO 8601 em horário de Brasília (UTC−3)", () => {
    const iso = dataHoraTse("25/10/2026", "20:15:32");
    expect(iso).toBe("2026-10-25T20:15:32-03:00");
    expect(new Date(iso!).toISOString()).toBe("2026-10-25T23:15:32.000Z");
  });

  it("tolera espaços", () => {
    expect(dataHoraTse(" 25/10/2026 ", " 08:00:00 ")).toBe("2026-10-25T08:00:00-03:00");
  });

  it.each([
    [undefined, undefined],
    ["", ""],
    ["25/10/2026", undefined],
    [undefined, "20:15:32"],
    ["2026-10-25", "20:15:32"],
    ["25/10/26", "20:15:32"],
    ["25/10/2026", "20:15"],
    ["25/10/2026", "25:00:00"],
    ["32/13/2026", "10:00:00"],
    [20261025, 201532],
  ])("(%j, %j) → null", (d, h) => {
    expect(dataHoraTse(d, h)).toBeNull();
  });

  // BUG: Date.parse do V8 aceita "2026-02-31" (vira 03/03), então uma data inexistente passa.
  it("rejeita data inexistente como 31/02/2026 (bug corrigido)", () => {
    expect(dataHoraTse("31/02/2026", "10:00:00")).toBeNull();
  });
});
