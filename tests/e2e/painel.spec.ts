/**
 * Testes de ponta a ponta com respostas SIMULADAS da API interna (ver simulacao.ts).
 * Nenhum dado aqui é resultado real.
 */
import { expect, test, type Page } from "@playwright/test";
import { simularApi } from "./simulacao";

const ANTES = "2026-10-25T11:30:00-03:00";
const DURANTE = "2026-10-25T19:30:00-03:00";

async function abrir(page: Page, hora: string, apurando: boolean, hash = "#presidente") {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.clock.setFixedTime(new Date(hora));
  const chamadas = await simularApi(page, apurando);
  await page.goto(`/${hash}`);
  return { erros, chamadas };
}

test("antes das 17h: contagem regressiva, sem vencedor e sem 'tempo real'", async ({ page }) => {
  const { erros } = await abrir(page, ANTES, false);
  await expect(page.getByTestId("estado")).toContainText("A apuração começa em 5:30:00");
  await expect(page.getByTestId("candidato")).toHaveCount(2);
  await expect(page.getByTestId("selo-eleito")).toHaveCount(0);
  await expect(page.getByText(/tempo real/i)).toHaveCount(0);
  await expect(page.locator(".mapa__area")).toHaveCount(27);
  expect(erros).toEqual([]);
});

test("durante a apuração: percentuais, mapa colorido e horário do TSE", async ({ page }) => {
  const { erros } = await abrir(page, DURANTE, true);
  await expect(page.getByTestId("estado")).toContainText("41,37% das seções apuradas");
  await expect(page.getByTestId("candidato").first()).toContainText("50,62%");
  await expect(page.getByTestId("atualizado-fonte")).toContainText("19:28");
  await expect(page.getByTestId("consultado-em")).toBeVisible();
  const cores = await page.locator(".mapa__area").evaluateAll((els) => new Set(els.map((e) => e.getAttribute("fill"))).size);
  expect(cores).toBeGreaterThan(3);
  expect(erros).toEqual([]);
});

test("não tem rolagem horizontal", async ({ page }) => {
  await abrir(page, DURANTE, true);
  await expect(page.locator(".mapa__area").first()).toBeVisible();
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(sobra).toBeLessThanOrEqual(0);
});

test("lista de estados leva ao mapa de municípios e ao município", async ({ page }) => {
  await abrir(page, DURANTE, true);
  await page.getByTestId("linha-area").filter({ hasText: "São Paulo" }).click();
  await expect(page).toHaveURL(/#presidente-sp$/);
  await expect(page.getByTestId("painel-detalhe")).toContainText("Por município");
  await expect(page.locator(".mapa__area")).toHaveCount(645);
  await page.getByTestId("linha-area").first().click();
  await expect(page).toHaveURL(/#presidente-sp-\d{7}$/);
  await page.getByRole("button", { name: "Voltar um nível" }).click();
  await expect(page).toHaveURL(/#presidente-sp$/);
});

test("link com código IBGE abre o município", async ({ page }) => {
  await abrir(page, DURANTE, true, "#presidente-sp-3500105");
  await expect(page.getByTestId("painel-detalhe")).toContainText("Adamantina");
});

test("exterior: mapa-múndi com nomes de países e lista por país", async ({ page }) => {
  await abrir(page, DURANTE, true);
  await page.getByTestId("botao-exterior").click();
  await expect(page).toHaveURL(/#presidente-zz$/);
  await expect(page.locator(".mapa__rotulo--pais").filter({ hasText: "Canadá" })).toHaveCount(1);
  await expect(page.locator(".mapa__cidade")).toHaveCount(186);
  await expect(page.getByTestId("painel-detalhe")).toContainText("Por país");
});

test("governadores: só as UFs com 2º turno", async ({ page }) => {
  await abrir(page, ANTES, false);
  await page.getByTestId("aba-governador").click();
  await expect(page).toHaveURL(/#governador$/);
  await expect(page.locator(".multi__item")).toHaveCount(6);
});

test("anúncio abre o WhatsApp em nova aba", async ({ page }) => {
  await abrir(page, ANTES, false);
  const link = page.getByTestId("anuncio-whatsapp").first();
  await expect(link).toHaveAttribute("href", "https://wa.me/5511944650268");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
});

test("busca de município", async ({ page }) => {
  await abrir(page, DURANTE, true);
  await page.getByTestId("botao-busca").click();
  await page.getByRole("searchbox", { name: "Nome do município" }).fill("adaman");
  await page.getByRole("button", { name: /Adamantina/ }).click();
  await expect(page).toHaveURL(/#presidente-sp-/);
});

test("consulta a API periodicamente sem duplicar", async ({ page }) => {
  const { chamadas } = await abrir(page, DURANTE, true);
  await expect(page.locator(".mapa__area").first()).toBeVisible();
  const res = chamadas.filter((c) => c.startsWith("/api/resultados"));
  expect(res.length).toBeLessThanOrEqual(2);
});
