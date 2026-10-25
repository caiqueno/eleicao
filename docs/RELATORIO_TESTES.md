# Relatório de testes

Data: 25/10/2026. Ambiente local: Node 22.22, npm 10.9, Chromium do Playwright 1.63.
Os comandos abaixo foram executados de fato; os números são a saída real.

## Resumo

| Verificação | Comando | Resultado |
|---|---|---|
| Lint | `npm run lint` | sem erros nem avisos |
| Tipos | `npm run typecheck` | sem erros |
| Unitários e integração | `npm test` | **217 passaram**, 0 falharam (8 arquivos) |
| Build de produção | `npm run build` | concluído; rotas `/`, `/api/resultados`, `/api/abrangencias`, `/manifest.webmanifest`, `/icon.svg` |
| Ponta a ponta | `npm run test:e2e` | **28 passaram**, 2 pulados (teste de teclado só roda no desktop), em celular (Pixel 7), tablet (820×1180) e desktop (1366×900) |
| Dependências de produção | `npm audit --omit=dev` | 0 vulnerabilidades |
| Dependências de desenvolvimento | `npm audit` | 3 (2 críticas, 1 moderada) em `vitest`/`tinypool`/`@vitest/mocker`, só no ambiente de teste. A atualização para o Vitest 4 falhou por um erro do npm 10 (`Cannot read properties of null (reading 'edgesOut')`); fica como pendência |
| Produção (dados reais) | rota `/api/resultados` no deploy da Vercel | ver seção "Validação com o TSE real" |

## Testes unitários e de integração (Vitest, sem rede)

Todos os testes trocam o `fetch` global por um que falha, para garantir que nenhum toca a rede.
Os dados de `tests/fixtures/simulado-*.json` são **simulados** (candidatos "CANDIDATO SIMULADO"); só
`ele-c.trecho-real.json` é um trecho do arquivo real do TSE.

| Arquivo | Cobre |
|---|---|
| `decodificar.test.ts` | JSON, BOM, JWS (com acentos e base64url), JWS malformado, conteúdo que não é JSON |
| `numeros.test.ts` | inteiros e percentuais do TSE (vírgula decimal), vazio/inválido → `null` (nunca 0), datas e horas inválidas (inclusive 31/02) |
| `configuracao.test.ts` | turno 2 obrigatório, pleito e ciclo corretos, eleições de 1º turno ignoradas, 6 UFs de governador, presidente BR + UFs + exterior |
| `resultado.test.ts` | ordenação por votos (empate alfabético), percentual calculado e soma ≈ 100, eleito só com `e="s"`, encerrada só com `and="f"` e 100%, rejeição de abrangência/eleição/cargo divergentes, 1º turno, `cdabr` ausente, quantidade de candidatos ≠ 2, seções totalizadas > total, valores numéricos inválidos |
| `http.test.ts` | montagem de URL só para o host do TSE (rejeita `..`, `/`, host externo, `http://`), tempo limite, erro de conexão, 404, 403/429/500/503, arquivo > 5 MB |
| `cache.test.ts` | hora real do download, TTL, nenhum dado vencido servido como novo, deduplicação, cache de 404, pausa de 10 min após 403/429, extensão `.jws` memorizada |
| `servico.test.ts` | estados `ok` (JWS e JSON), `sem-dados`, `nao-suportado`, `erro-fonte` (config, tempo limite, rede), `invalido`, fallback `.jws` → `.json` |
| `rotas.test.ts` | 400 para parâmetros inválidos, maliciosos (`../x`, `br?x`, `__proto__`, `%00`), em maiúsculas ou desconhecidos, sem chamar a rede; 200/502 e cabeçalho de cache |

### Defeitos encontrados pelos testes e corrigidos

1. `ele` numérico do 1º turno passava pela validação (corrigido: códigos aceitam número ou texto).
2. `carg[].cd` numérico de outro cargo era aceito (corrigido).
3. Data inexistente (31/02) era aceita (corrigido: validação de calendário).
4. `buscarTexto` aceitava `http://` no host do TSE (corrigido: exige `https:`).

### Defeitos apontados pela revisão independente e corrigidos

1. O Data Cache do Next podia servir resultado vencido como atual se o TSE falhasse; trocado por cache próprio com a
   hora real do download.
2. Sem cache de 404, sem deduplicação e sem pausa após bloqueio do TSE; implementados.
3. Validação aceitava arquivo sem `cdabr` e com número de candidatos diferente de 2; agora rejeita.
4. Um 404 passageiro apagava os dados da tela; agora os dados ficam com aviso.
5. Horário do TSE sem data e sem fuso; agora "25/10/2026, 17:45 (horário de Brasília)".
6. Faltavam CSP, `Permissions-Policy` e HSTS; adicionados.

## Ponta a ponta (Playwright)

Com respostas **simuladas** da API interna (interceptadas), em três tamanhos de tela:

- página carrega sem erros no console (inclui violações de CSP), candidatos ordenados, votos e percentuais formatados,
  % de seções na barra de progresso, horário do TSE e da consulta separados, sem selo de eleito, sem "tempo real";
- sem rolagem horizontal;
- botão Atualizar dispara nova consulta;
- estados "sem dados" e "erro na fonte";
- selo de eleito e "totalização encerrada" só quando a fonte informa;
- troca para Governador mostra só UFs com 2º turno e atualiza a URL;
- anúncio do WhatsApp aponta para `https://wa.me/5511944650268` em nova aba;
- antes da apuração (0 seções) mostra "Apuração ainda não começou";
- navegação por teclado chega ao botão Atualizar (desktop).

Validação visual: capturas em celular (claro e escuro) e desktop foram conferidas manualmente.

## Validação com o TSE real

Este ambiente de desenvolvimento não alcança `resultados.tse.jus.br` (bloqueio do proxy). A validação com dados reais
foi feita pela rota `/api/resultados` publicada na Vercel (funções em gru1), em 25/10/2026 ~13:52 UTC:

| Consulta | Resultado |
|---|---|
| `/api/abrangencias` | Presidente: BR, 27 UFs e exterior; Governador: AM, RN, DF, ES, AC, TO |
| `?cargo=presidente&uf=br` | `ok`: 2 candidatos, 0 de 499.248 seções totalizadas (antes do fim da votação) |
| `?cargo=presidente&uf=sp` | `ok`: 0 de 103.656 seções |
| `?cargo=governador&uf=df` | `ok`: 2 candidatos, 0 de 6.969 seções |
| `?cargo=governador&uf=sp` | `nao-suportado` ("Não há 2º turno para Governador em São Paulo") |

O comportamento com apuração em andamento só poderá ser observado após o encerramento da votação (17h de Brasília).

## Lacunas conhecidas

- O monitor de atualização do navegador (`useResultados`: recuo, aba oculta, troca de seleção no meio da consulta) é
  coberto só indiretamente pelos testes E2E.
- A assinatura EdDSA dos arquivos JWS do TSE não é verificada; a confiança está no TLS do domínio oficial.
- Vulnerabilidades em dependências de desenvolvimento (Vitest 3), ver tabela.
