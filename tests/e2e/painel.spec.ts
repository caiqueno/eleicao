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

test("contador de pessoas: aparece com número e some quando indisponível", async ({ page }) => {
  await page.clock.setFixedTime(new Date(DURANTE));
  await simularApi(page, true, 1234);
  await page.goto("/#presidente");
  await expect(page.getByTestId("presenca")).toContainText("1.234 pessoas acompanhando");
});

test("contador de pessoas indisponível não mostra número inventado", async ({ page }) => {
  await page.clock.setFixedTime(new Date(DURANTE));
  await simularApi(page, true, null);
  await page.goto("/#presidente");
  await expect(page.getByTestId("placar")).toBeVisible();
  await expect(page.getByTestId("presenca")).toHaveCount(0);
});

test("boletim: diferença, viradas e texto para o WhatsApp com resultado parcial", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { abertos: string[] }).abertos = [];
    window.open = (u?: string | URL) => {
      (window as unknown as { abertos: string[] }).abertos.push(String(u));
      return null;
    };
  });
  await abrir(page, DURANTE, true);
  const boletim = page.getByTestId("boletim");
  await expect(boletim).toContainText("Diferença");
  await expect(boletim).toContainText("votos");
  await expect(boletim).toContainText("Viradas desde o 1º turno");
  await page.getByTestId("mandar-whatsapp").click();
  const abertos = await page.evaluate(() => (window as unknown as { abertos: string[] }).abertos);
  const alvo = new URL(abertos[0]);
  expect(alvo.hostname).toBe("wa.me");
  const texto = alvo.searchParams.get("text") ?? "";
  expect(texto).toContain("Resultado parcial");
  expect(texto).toContain("41,37%");
});

test("compartilhar: gera a imagem para Stories e feed com o placar parcial", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "geração da imagem testada uma vez");
  await abrir(page, DURANTE, true);
  await expect(page.getByTestId("candidato").first()).toContainText("50,62%");
  await page.getByTestId("botao-compartilhar").click();
  await expect(page.getByTestId("compartilhar")).toBeVisible();
  for (const [formato, w, h] of [["stories", 1080, 1920], ["feed", 1080, 1350]] as const) {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId(`cartao-${formato}`).click()]);
    expect(download.suggestedFilename()).toBe(`acompanhevotos-${formato}.png`);
    const caminho = info.outputPath(`${formato}.png`);
    await download.saveAs(caminho);
    const png = (await import("node:fs")).readFileSync(caminho);
    expect(png.readUInt32BE(16)).toBe(w);
    expect(png.readUInt32BE(20)).toBe(h);
    if (process.env.CAPTURAS) (await import("node:fs")).copyFileSync(caminho, `${process.env.CAPTURAS}/cartao-${formato}.png`);
  }
  await expect(page.getByTestId("compartilhar")).toContainText("Imagem salva");
});

test("compartilhar: opções com os ícones dos aplicativos", async ({ page }, info) => {
  await abrir(page, DURANTE, true);
  await page.getByTestId("botao-compartilhar").click();
  const janela = page.getByTestId("compartilhar");
  await expect(janela).toBeVisible();
  await expect(janela.locator("svg.icone-app")).toHaveCount(await janela.locator("button").count() - 1);
  await expect(janela).toContainText("Instagram Stories");
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/${info.project.name}-compartilhar.png` });
});
