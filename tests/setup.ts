import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";
import { limparCacheTse } from "@/lib/tse/cache";
import { reiniciarExtensao } from "@/lib/tse/servico";
import { limparMunicipais } from "@/lib/tse/mapa";

// O cache do TSE e a extensão confirmada são estado de módulo: cada teste começa do zero.
beforeEach(() => {
  limparCacheTse();
  reiniciarExtensao();
  limparMunicipais();
});
