# Fonte de dados: TSE — Divulgação de Resultados 2026

Levantamento feito em 25/10/2026 (dia do 2º turno). Cada informação traz fonte e grau de confiança:

- **ALTA**: confirmada em documento oficial do TSE **e** em arquivo real ou código aberto em uso em 2026.
- **MÉDIA**: uma fonte confiável (TSE ou código aberto de 2026), sem confirmação cruzada.
- **BAIXA**: inferência a partir de padrões; precisa ser testada antes de usar.

## 1. Fontes consultadas

| # | Fonte | Tipo |
|---|---|---|
| F1 | https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados (página 2026) | Oficial TSE |
| F2 | https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados-2024 | Oficial TSE (2024) |
| F3 | https://www.tse.jus.br/eleicoes/eleicoes-2022/interessados-na-divulgacao-de-resultados-2022 | Oficial TSE (2022) |
| F4 | `comum/config/ele-c.json` real, baixado no sandbox (gerado em 18/10/2026 12:38:11) | Arquivo real |
| F5 | `ele2026/6258/config/mun-e006258-cm.json` real, baixado no sandbox (15/10/2026 09:38:00) | Arquivo real |
| F6 | github.com/Filadelpho/apuracao-2026 (commit c23f740, 20/10/2026), `coletor/tse.py` e `coletor/coletar.py` | Código aberto 2026 |
| F7 | github.com/akinncar/tse2022 (`src/pages/index.tsx`) e github.com/igords-goncalves/apuracoes-app | Código aberto 2022 |
| F8 | Agência Brasil/Acessa (04/10/2026), InvestNews (05/10, atualizado 08/10/2026), DGABC ("cinco Estados e o DF neste domingo") | Imprensa |

As especificações oficiais EA10/EA11/EA12/EA14/EA15/EA16/EA18/EA20 de 2026 têm links em F1 (por exemplo,
`https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado`).
**Não consegui ler os PDFs:** o WebFetch dá erro e o proxy bloqueia `www.tse.jus.br`. Por isso os significados dos campos
abaixo vêm do uso em código aberto e do nome dos campos, e não da especificação oficial.

## 2. Host, ambiente e ciclo

| Item | Valor | Confiança | Fonte |
|---|---|---|---|
| Host oficial | `https://resultados.tse.jus.br` | ALTA | F1, F6 |
| Ambiente | `oficial` | ALTA | F1 ("O valor de `[ambiente]` será `oficial`"), F6 |
| Ciclo | `ele2026` (campo `pl[].c` do ele-c.json) | ALTA | F4, F6 |
| App oficial | `https://resultados.tse.jus.br/oficial/app/index.html` | ALTA | F1 |
| Simulado (não usar) | `https://resultados-sim.tse.jus.br/simulado/simulado2026/...` | ALTA | F1 |

## 3. Padrões de caminho

Templates oficiais de diretório, publicados no próprio `ele-c.json` (campo `arq`, F4, **ALTA**):

```
tp=ft   <base>/<ambiente>/<ciclo>/<cd_eleicao>/fotos/<uf>
tp=cm   <base>/<ambiente>/<ciclo>/<cd_eleicao>/config
tp=e    <base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>
tp=ab   <base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>
tp=u    <base>/<ambiente>/<ciclo>/<cd_eleicao>/dados/<uf>
tp=cs   <base>/<ambiente>/<ciclo>/arquivo-urna/<cd_pleito>/config/<uf>
tp=aux  <base>/<ambiente>/<ciclo>/arquivo-urna/<cd_pleito>/dados/<uf>/<municipio>/<zona>/<secao>
```

### 3.1 Arquivos concretos

| Arquivo | URL (2º turno) | Confiança | Evidência |
|---|---|---|---|
| Config. de eleições (EA11) | `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json` | ALTA (HTTP 200 real) | F4; F6 cita a variante `comum/config/ele-c.jws` |
| Config. de municípios (EA12) | `.../oficial/ele2026/6258/config/mun-e006258-cm.json` | ALTA (HTTP 200 real, JSON simples) | F5, F1 (simulado `.../21270/config/mun-e021270-cm.json`) |
| Resultado Presidente BR (EA20) | `.../oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json` | MÉDIA (padrão oficial; ainda não testado no oficial) | F1 simulado `.../ele2026/21270/dados/br/br-c0001-e021270-u.json`; F6 usa `.u.jws` no mesmo caminho |
| Resultado Presidente por UF | `.../oficial/ele2026/6258/dados/<uf>/<uf>-c0001-e006258-u.json` | MÉDIA | F6 (`url_resultado(ele, uf)`); mesmo padrão de F1 |
| Resultado Governador UF | `.../oficial/ele2026/6260/dados/<uf>/<uf>-c0003-e006260-u.json` | MÉDIA | F1 simulado `.../21272/dados/ac/ac-c0003-e021272-u.json` ("Resultado de Governador (AC)") |
| Resultado por município | `.../dados/<uf>/<uf><mun5>-c<cargo4>-e<ele6>-u.json` | MÉDIA | F1 (`ac01120-c0005-e021272-u.json`), F6 |
| Acompanhamento Brasil (EA14) | `.../oficial/ele2026/<ele>/dados/br/br-e00<ele>-ab.json` | MÉDIA | F1 (`br-e021270-ab.json`), F6 |
| Acompanhamento UF (EA15) | `.../oficial/ele2026/<ele>/dados/<uf>/<uf>-e00<ele>-ab.json` | MÉDIA | F1 (`ac-e021270-ab.json`), F6 |
| Eleitos (EA10) | `-e.json` em `dados/<uf>` (nome exato não confirmado) | BAIXA | F1: "só traz Governador, Senador, Deputado Federal (BR) e Prefeito (UF)"; Presidente não tem EA10 |
| Fotos | `.../oficial/ele2026/<ele>/fotos/<uf\|br>/<sqcand>.jpeg` | MÉDIA | F2, F4 (`tp=ft`), F6 (`fotos/br/{sqcand}.jpeg`) |

**`.json` ou `.jws`:** a página oficial (F1) e os arquivos reais (F4, F5) usam `.json` com JSON simples. O código de F6, de 2026,
baixa `.jws` (JWS = `header.payload.assinatura` em base64url, assinado com EdDSA) e decodifica a 2ª parte. F1 também traz o link
"Manual de verificação dos arquivos JWS". Conclusão: as duas variantes parecem existir, mas **só o `.json` está confirmado por HTTP 200**
(config). Para resultado `-u`, nenhuma das duas foi testada ainda. Um cliente robusto deve aceitar as duas: se o corpo começa com `{`,
é JSON; se não, separar em `.` e decodificar a parte [1] em base64url.

**Caminho antigo:** `dados-simplificados/.../br-c0001-e000544-r.json` era o padrão de 2022 (F7). Em 2026 ele dá 404
(teste do coordenador com `e006257`). F2 informa que EA01/EA02/EA04/EA09 foram descontinuados e substituídos pelo EA20. **Não usar.**

### 3.2 Significado dos segmentos

| Segmento | Significado | Exemplo | Fonte |
|---|---|---|---|
| `<uf>` | sigla minúscula; `br` = Brasil; `zz` = exterior | `br`, `ac`, `zz` | F1, F2, F6 |
| `<mun5>` | código TSE do município (≠ IBGE), 5 dígitos com zeros à esquerda | `01120` | F1, F5 |
| `c<cargo4>` | código do cargo com 4 dígitos | `c0001` (Presidente), `c0003` (Governador) | F1, F4, F6 |
| `e<ele6>` | código da eleição com 6 dígitos | `e006258` | F1 (simulado `e021270`), F5, F6 (`f"e{int(ele):06d}"`) |
| `-u` | resultado unificado (EA20) | | F1, F4 (`tp=u`) |
| `-ab` | acompanhamento (EA14/EA15) | | F1, F4 |
| `-cm` | config. de municípios (EA12) | | F1, F5 |
| `-e` | eleitos (EA10) | | F1, F4 |

## 4. Códigos das eleições 2026 e identificação do turno

Tabela oficial (F1), confirmada em parte pelo ele-c.json real (F4). **ALTA.**

| Data | Pleito | Código | Descrição |
|---|---|---|---|
| 04/10/2026 | 3220 (1º T) | 6257 | Eleição Ordinária Federal (Presidente) |
| 04/10/2026 | 3220 (1º T) | 6259 | Eleição Ordinária Estadual (Governador, Senador, Deputados) |
| 04/10/2026 | 3220 (1º T) | 6261 | Conselho Distrital |
| **25/10/2026** | **3221 (2º T)** | **6258** | **Eleição Geral Federal → Presidente** |
| **25/10/2026** | **3221 (2º T)** | **6260** | **Eleições Gerais Estaduais → Governador** |
| 25/10/2026 | 3221 | 6282–6286, 6290, 6293 | Suplementares municipais |
| 25/10/2026 | 3221 | 6287; 6288, 6289 | Consulta popular (PR); plebiscitos (MT) |

**Como o turno aparece nos dados (F4, ALTA):** no `ele-c.json`, cada eleição em `pl[].e[]` tem `t` (turno: `"1"`/`"2"`). As eleições
de 1º turno trazem `cdt2`, o código da eleição de 2º turno correspondente (6257→6258, 6259→6260). O turno também está no código do
pleito (`pl[].cd`: 3220 = 1º T, 3221 = 2º T) e no nome (`nm`: "... 2026 1º Turno"). O bloco do pleito 3221 está depois do ponto de
truncamento do fixture, então ainda não vi o `t="2"` e o `abr` de 6258/6260.

## 5. Estrutura do `ele-c.json` (EA11). Campos reais (F4)

```
dg, hg        data/hora de geração ("18/10/2026", "12:38:11")
f             "o" (provavelmente "oficial" — NÃO VERIFICADO)
idg           identificador do arquivo gerado (F1: único por arquivo, NÃO monotônico)
arq[]         {tp, dir}: templates de diretório por tipo de arquivo (ver §3)
pl[]          pleitos: {cd, cdpr, c (ciclo), dt, dtlim, e[]}
  e[]         eleições: {cd, cdt2, sqele, nm, t (turno), tp, abr[]}
    abr[]     abrangências: {cd ("br"...), cp[]}
      cp[]    cargos: {cd, ds, tp}
```

Cargos vistos em F4 (ALTA): `1` Presidente, `3` Governador, `5` Senador, `6` Deputado Federal, `7` Deputado Estadual,
`8` Deputado Distrital. `cp[].tp`: `1` = majoritário, `2` = proporcional (inferido dos valores; MÉDIA).

## 6. Estrutura do `mun-e<ele>-cm.json` (EA12). Campos reais (F5)

```
dg, hg, idg, f
abr[]  {cd (uf), ds (nome da UF), mu[]}
  mu[] {cd (cód. TSE 5 díg.), cdi (cód. IBGE 7 díg.), nm, c ("n"/"s": capital? NÃO VERIFICADO), z[] (zonas)}
```

## 7. Estrutura do resultado `-u` (EA20)

Campos usados pelo código aberto de 2026 (F6) e por F1/F2. **MÉDIA**: ainda sem fixture real e sem a especificação EA20 lida.

| Campo | Significado (como F6 usa) | Fonte |
|---|---|---|
| `cdabr` | abrangência do arquivo (br/uf/município) | F6 |
| `dg`, `hg` | data/hora de geração do arquivo | F6 |
| `dt`, `ht` | data/hora da última totalização | F6 |
| `and` | andamento; `"f"` = totalização final (regras em F1) | F1, F6 |
| `s.ts`, `s.st`, `s.pstn` | seções: total, totalizadas, % totalizadas (texto com vírgula) | F6 |
| `e.te`, `e.est`, `e.c`, `e.a` | eleitorado: total, eleitores das seções totalizadas, comparecimento, abstenção | F6 |
| `v.vv`, `v.vb`, `v.tvn` | votos válidos, brancos, total de nulos | F6 |
| `carg[].agr[]` | agremiação (coligação/federação/partido isolado); `agr.vag` = vagas | F2, F6 |
| `agr[].par[].sg` | sigla do partido | F6 |
| `par[].cand[].n` | número do candidato | F6 |
| `cand.nm` / `cand.nmu` | nome / nome de urna | F6 |
| `cand.vap` | votos apurados | F6 |
| `cand.pvapn` | % de votos válidos (texto com vírgula, ex. `"47,027772356"`) | F6 |
| `cand.sqcand` | sequencial do candidato (usado na URL da foto) | F2 |
| `cand.e` | eleito / vai ao 2º turno: `"n"` → `"s"` na totalização final | F2 |
| `subs` | só aparece quando há substituição de candidato | F2 |

Percentuais vêm como **string com vírgula decimal** (F6, F7). Em 2022 (F7) o formato `-r.json` era plano (`cand[]`, `nm`, `n`,
`cc`, `vap`, `pvap`, `psi`, `ht`, `dt`). **Isso não vale para 2026.**

`and=f` (F1): municipal → quando `snt=0`; estadual → quando há totalização final; federal → quando há totalização final em todas as UFs.

## 8. Como detectar atualização

- F1: "Os arquivos são atualizados conforme a evolução do processo de totalização"; os arquivos são sobrescritos e não guardam histórico (F2).
- A CDN suporta **ETag e Last-Modified**; pedidos condicionais podem receber **HTTP 304**, que **também conta no limite** (F1). ALTA.
- F6 manda `?nocache=<epoch ms>` em cada GET e diz que é "como o app oficial faz". Isso não está confirmado no JS oficial (BAIXA).
- Estratégia sugerida: consultar `-ab` (ou `-u` do BR) a cada 15–30 s e comparar `dg`/`hg`/`idg`, `s.st` ou `dt`/`ht`. Lembrar que o `idg` não é monotônico, então comparar por diferença e não por "maior que".

## 9. Limites e condições de acesso

| Regra | Fonte | Confiança |
|---|---|---|
| 100 requisições/s por IP; acima disso, bloqueio de 10 min (nova tentativa durante o bloqueio reinicia a contagem) | F1, F2 | ALTA |
| Muitos 404 podem bloquear o IP temporariamente (sem limiar divulgado) | F1 | ALTA |
| Não é possível listar diretórios; não há whitelist nem cadastro | F1 | ALTA |
| Antes da totalização, os arquivos existem com zero votos; o EA10 dá 404 até a 1ª totalização final da UF | F1 | ALTA |
| Desta máquina, o proxy bloqueia resultados.tse.jus.br (403 no CONNECT). O acesso funcionou num sandbox Vercel em gru1 (Brasil). Há possível restrição geográfica | observação | MÉDIA |
| Horário de 2022/2024: divulgação a partir das 17h (Brasília) | F2 | MÉDIA para 2026 |

## 10. UFs com 2º turno para Governador (eleição 6260)

AC, AM, DF, ES, RN, TO (6 UFs). O RJ saiu da lista em 08/10/2026: após a anulação dos votos de Garotinho, Douglas Ruas (PL) venceu
no 1º turno. Fonte: F8 (InvestNews atualizado; DGABC "cinco Estados e no DF"). **MÉDIA.** **Confirmado pelo coordenador em 25/10/2026 ~13:38 UTC** lendo o
`ele-c.json` real (sandbox Vercel gru1): `pl[cd=3221].e[cd=6260]` tem `t="2"` e `abr` = am, rn, df, es, ac, to, todos com cargo 3.
A eleição `6258` tem `t="2"` e `abr` = br, cargo 1. **ALTA.**

## 11. VERIFICADO x NÃO VERIFICADO

**VERIFICADO (arquivo real ou TSE + código 2026):**
- Host, ambiente `oficial`, ciclo `ele2026`; `comum/config/ele-c.json` (200, JSON simples); `ele2026/6258/config/mun-e006258-cm.json` (200).
- Códigos 6257/6259 (1º T), 6258/6260 (2º T), pleitos 3220/3221; ligação `cdt2`; códigos de cargo 1 e 3.
- Templates de diretório (`arq`) e convenção de nome (`<uf>[mun]-c<4>-e<6>-u`, `-ab`, `-cm`).
- Regras de limite, ETag/Last-Modified/304, ausência de listagem.
- `dados-simplificados/*-r.json` não existe em 2026 (404).
- Lista de UFs no `abr` da eleição 6260 (am, rn, df, es, ac, to) e `t="2"` em 6258/6260, lidas no ele-c.json real.

**NÃO VERIFICADO (testar antes de usar):**
- HTTP 200 e conteúdo real de `br-c0001-e006258-u.json`, `<uf>-c0003-e006260-u.json` e `-ab.json` no ambiente oficial.
- Se o resultado é servido em `.json`, em `.jws` ou nos dois, e com qual Content-Type.
- Definições oficiais dos campos do EA20 (PDF não lido); significado de `f`, `mu.c`, `cp.tp`, `e.est`.
- Nome exato do arquivo de eleitos `-e`.
- Headers reais (`cache-control`, `last-modified`, `etag`) dos arquivos de resultado.
- Uso de `nocache` pelo app oficial.
