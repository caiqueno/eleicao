# Fixtures de teste

**Atenção: os arquivos `simulado-*.json` são SIMULADOS. Não são resultados reais do TSE.**

- Nomes de candidatos (`CANDIDATO SIMULADO A`, `B`...), partidos (`PSIMA`...), coligações e
  números de votos são inventados.
- A estrutura usa os nomes de campos documentados em `docs/FONTE_TSE.md` (§7, arquivo de
  resultado `-u` / EA20): `cdabr`, `ele`, `dg`/`hg`, `dt`/`ht`, `and`, `s{ts,st,pstn}`,
  `e{te,est,c,a}`, `v{vv,vb,tvn}`, `carg[].agr[].par[].cand[]{n,nm,nmu,sqcand,vap,pvapn,e,st}`.
  Até hoje nenhum arquivo `-u` real foi baixado (ver §11 do documento), então a estrutura pode
  ter diferenças em relação ao arquivo oficial.
- Cada arquivo simulado traz o campo `_aviso` para que nunca seja confundido com dado real.

| Arquivo | Cenário |
|---|---|
| `simulado-parcial.json` | Presidente/BR, 50% das seções, 2 candidatos |
| `simulado-zero.json` | 0% totalizado, todos com 0 votos |
| `simulado-finalizado.json` | `and = "f"`, `pstn = "100,00"`, um candidato com `e = "s"` |
| `simulado-sem-data.json` | sem `dt`/`ht` |
| `simulado-numerico-invalido.json` | números e percentuais malformados ou fora da faixa |
| `simulado-cdabr-divergente.json` | `cdabr = "sp"` (arquivo de outra abrangência) |
| `simulado-primeiro-turno.json` | `ele = "6257"` (eleição de 1º turno) |
| `simulado-sem-candidatos.json` | `carg` com cargo mas sem candidatos |
| `simulado-tres-candidatos.json` | 4 candidatos (ordenação e soma de percentuais) |

## `ele-c.trecho-real.json`

É um **TRECHO** do arquivo real `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json`
(gerado em 18/10/2026 12:38:11). Foi mantida só a estrutura mínima: o pleito 3220 com a eleição
6257 (1º turno, Presidente) e o pleito 3221 com as eleições de 2º turno 6260 (Governador: AM, RN,
DF, ES, AC, TO) e 6258 (Presidente, BR). O campo `arq` foi esvaziado e as demais eleições
foram removidas.
