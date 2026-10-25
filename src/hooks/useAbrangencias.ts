"use client";

import { useEffect, useState } from "react";
import { UFS, UFS_GOVERNADOR_SEGUNDO_TURNO, type CargoId } from "@/config/eleicao";
import type { OpcaoAbrangencia } from "@/lib/tipos";

export interface OpcoesPorCargo {
  presidente: OpcaoAbrangencia[];
  governador: OpcaoAbrangencia[];
}

/** Valor inicial a partir da configuração; substituído pela lista do TSE. */
function opcoesIniciais(): OpcoesPorCargo {
  return {
    presidente: [{ cargo: "presidente", uf: "br", nome: UFS.br }],
    governador: UFS_GOVERNADOR_SEGUNDO_TURNO.map((uf) => ({ cargo: "governador", uf, nome: UFS[uf] ?? uf.toUpperCase() })),
  };
}

function ordenar(lista: OpcaoAbrangencia[]): OpcaoAbrangencia[] {
  return [...lista].sort((a, b) => {
    if (a.uf === "br") return -1;
    if (b.uf === "br") return 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

function agrupar(opcoes: OpcaoAbrangencia[]): OpcoesPorCargo {
  const porCargo: Record<CargoId, OpcaoAbrangencia[]> = { presidente: [], governador: [] };
  const vistos = new Set<string>();
  for (const o of opcoes) {
    if (o.cargo !== "presidente" && o.cargo !== "governador") continue;
    const uf = o.uf.toLowerCase();
    const chave = `${o.cargo}:${uf}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    porCargo[o.cargo].push({ ...o, uf, nome: o.nome || UFS[uf] || uf.toUpperCase() });
  }
  if (!porCargo.presidente.some((o) => o.uf === "br")) {
    porCargo.presidente.push({ cargo: "presidente", uf: "br", nome: UFS.br });
  }
  return { presidente: ordenar(porCargo.presidente), governador: ordenar(porCargo.governador) };
}

/** Combinações cargo/UF com 2º turno segundo /api/abrangencias. */
export function useAbrangencias(): { opcoes: OpcoesPorCargo; confirmadas: boolean } {
  const [estado, setEstado] = useState<{ opcoes: OpcoesPorCargo; confirmadas: boolean }>(() => ({
    opcoes: opcoesIniciais(),
    confirmadas: false,
  }));

  useEffect(() => {
    const controle = new AbortController();
    fetch("/api/abrangencias", { cache: "no-store", signal: controle.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((corpo: unknown) => {
        if (!corpo || typeof corpo !== "object") return;
        const lista = (corpo as { opcoes?: unknown }).opcoes;
        if (!Array.isArray(lista) || lista.length === 0) return;
        const validas = lista.filter(
          (o): o is OpcaoAbrangencia =>
            !!o && typeof o === "object" && typeof o.uf === "string" && typeof o.cargo === "string",
        );
        setEstado({ opcoes: agrupar(validas), confirmadas: true });
      })
      .catch(() => {
        /* mantém o valor inicial da configuração */
      });
    return () => controle.abort();
  }, []);

  return estado;
}
