/**
 * Testes de ponta a ponta com respostas SIMULADAS da API interna.
 * Nenhum dado aqui é resultado real: as rotas /api/* são interceptadas.
 */
import { expect, test, type Page } from "@playwright/test";

const ABRANGENCIAS = {
  consultadoEm: "2026-10-25T21:00:00.000Z",
  opcoes: [
    { cargo: "presidente", uf: "br", nome: "Brasil" },
    { cargo: "presidente", uf: "sp", nome: "São Paulo" },
    { cargo: "governador", uf: "am", nome: "Amazonas" },
    { cargo: "governador", uf: "df", nome: "Distrito Federal" },
  ],
};

function resultado(parcial: Record<string, unknown> = {}) {
  return {
    estado: "ok",
    mensagem: null,
    consultadoEm: "2026-10-25T21:00:00.000Z",
    resultado: {
      cargo: "presidente",
      cargoNome: "Presidente",
      abrangencia: "br",
      abrangenciaNome: "Brasil",
      codigoEleicao: "6258",
      turno: 2,
      candidatos: [
        { numero: "98", nome: "CANDIDATO SIMULADO B", partido: "PSIM", votos: 4000, percentualFonte: 40, percentualCalculado: 40, situacao: null, eleito: false },
        { numero: "99", nome: "CANDIDATO SIMULADO A", partido: "PTST", votos: 6000, percentualFonte: 60, percentualCalculado: 60, situacao: null, eleito: false },
      ],
      totalizacao: { secoesTotal: 1000, secoesTotalizadas: 250, percentualSecoesTotalizadas: 25, atualizadoEmFonte: "2026-10-25T17:45:10-03:00", finalizada: false },
      votos: { eleitorado: 20000, comparecimento: 11000, abstencao: 9000, validos: 10000, brancos: 400, nulos: 600 },
      fonteUrl: "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.jws",
      ...parcial,
    },
  };
}

async function simular(page: Page, corpo: unknown, status = 200) {
  const chamadas: string[] = [];
  await page.route("**/api/abrangencias", (r) => r.fulfill({ json: ABRANGENCIAS }));
  await page.route("**/api/resultados**", (r) => {
    chamadas.push(r.request().url());
    return r.fulfill({ status, json: corpo });
  });
  return chamadas;
}

test("mostra candidatos ordenados por votos, totalização e horários separados", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  await simular(page, resultado());
  await page.goto("/");
  const cartoes = page.getByTestId("candidato");
  await expect(cartoes).toHaveCount(2);
  await expect(cartoes.first()).toContainText("CANDIDATO SIMULADO A");
  await expect(cartoes.first()).toContainText("6.000");
  await expect(cartoes.first()).toContainText("60,00");
  await expect(page.getByTestId("secoes-totalizadas")).toContainText("250 de 1.000");
  await expect(page.getByRole("progressbar", { name: "Seções totalizadas" })).toHaveAttribute("aria-valuenow", "25");
  await expect(page.getByTestId("atualizado-fonte")).toContainText("17:45");
  await expect(page.getByTestId("consultado-em")).toBeVisible();
  await expect(page.getByTestId("selo-eleito")).toHaveCount(0);
  await expect(page.getByText(/tempo real/i)).toHaveCount(0);
  expect(erros).toEqual([]);
});

test("não tem rolagem horizontal", async ({ page }) => {
  await simular(page, resultado());
  await page.goto("/");
  await expect(page.getByTestId("candidato")).toHaveCount(2);
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

test("botão atualizar faz nova consulta", async ({ page }) => {
  const chamadas = await simular(page, resultado());
  await page.goto("/");
  await expect(page.getByTestId("candidato")).toHaveCount(2);
  const antes = chamadas.length;
  await page.getByTestId("botao-atualizar").click();
  await expect.poll(() => chamadas.length).toBeGreaterThan(antes);
});

test("estado sem dados mostra aviso e nenhum candidato", async ({ page }) => {
  await simular(page, { estado: "sem-dados", mensagem: "O TSE ainda não divulgou resultados do 2º turno para esta seleção.", consultadoEm: "2026-10-25T13:00:00.000Z", resultado: null });
  await page.goto("/");
  await expect(page.getByTestId("estado")).toHaveAttribute("data-estado", "sem-dados");
  await expect(page.getByTestId("candidato")).toHaveCount(0);
});

test("erro da fonte é informado", async ({ page }) => {
  await simular(page, { estado: "erro-fonte", mensagem: "Falha de conexão com o TSE (resultado).", consultadoEm: "2026-10-25T13:00:00.000Z", resultado: null }, 502);
  await page.goto("/");
  await expect(page.getByTestId("estado")).toHaveAttribute("data-estado", "erro-fonte");
  await expect(page.getByRole("alert").first()).toBeVisible();
});

test("selo de eleito só aparece quando a fonte informa", async ({ page }) => {
  const r = resultado({
    candidatos: [
      { numero: "99", nome: "CANDIDATO SIMULADO A", partido: "PTST", votos: 6000, percentualFonte: 60, percentualCalculado: 60, situacao: "Eleito", eleito: true },
      { numero: "98", nome: "CANDIDATO SIMULADO B", partido: "PSIM", votos: 4000, percentualFonte: 40, percentualCalculado: 40, situacao: null, eleito: false },
    ],
    totalizacao: { secoesTotal: 1000, secoesTotalizadas: 1000, percentualSecoesTotalizadas: 100, atualizadoEmFonte: "2026-10-25T21:10:00-03:00", finalizada: true },
  });
  await simular(page, r);
  await page.goto("/");
  await expect(page.getByTestId("selo-eleito")).toHaveCount(1);
  await expect(page.getByTestId("totalizacao-encerrada")).toBeVisible();
});

test("trocar para governador usa só UFs com 2º turno e atualiza a URL", async ({ page }) => {
  const chamadas = await simular(page, resultado());
  await page.goto("/");
  await page.getByTestId("seletor-cargo").getByRole("button", { name: /governador/i }).click();
  await expect(page).toHaveURL(/cargo=governador/);
  const opcoes = await page.getByTestId("seletor-uf").locator("option").allTextContents();
  expect(opcoes.join("|")).toMatch(/Amazonas/);
  expect(opcoes.join("|")).not.toMatch(/São Paulo/);
  await expect.poll(() => chamadas.some((u) => u.includes("cargo=governador"))).toBe(true);
});

test("anúncio do WhatsApp aponta para o número do Caique", async ({ page }) => {
  await simular(page, resultado());
  await page.goto("/");
  const link = page.getByTestId("anuncio-whatsapp").getByRole("link");
  await expect(link).toHaveAttribute("href", "https://wa.me/5511944650268");
  await expect(link).toHaveAttribute("target", "_blank");
});

test("navegação por teclado alcança o botão atualizar", async ({ page, isMobile }) => {
  test.skip(isMobile, "teclado só no desktop");
  await simular(page, resultado());
  await page.goto("/");
  await expect(page.getByTestId("candidato")).toHaveCount(2);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const id = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
    if (id === "botao-atualizar") return;
  }
  throw new Error("botão atualizar não recebeu foco por Tab");
});
