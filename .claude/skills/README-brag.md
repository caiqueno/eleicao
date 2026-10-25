# Vídeo de lançamento (brag)

As pastas `brag/` e `brag-slim/` são uma cópia sem alterações das skills de
[latent-spaces/brag](https://github.com/latent-spaces/brag), de Shunit Haviv
Hakimi, na versão 0.5.0 (commit `669ab92`). O código e os textos são MIT; a
licença está em [LICENSE-brag](LICENSE-brag).

Créditos dos arquivos de mídia incluídos em `brag/assets/`:

- Música: "Happy Beats / Business Moves" (Vol. 1, 9, 10, 11 e 12), de Sascha
  Ende, [ende.app](https://ende.app/en), licença CC BY 4.0. Ao publicar um vídeo
  com essas faixas, dê o crédito "Music: Sascha Ende, ende.app (CC BY 4.0)".
- Efeitos sonoros: [Kenney](https://kenney.nl/) e unicae_games, CC0.

Ficaram de fora o site de demonstração (`docs/`), os exemplos e os manifestos de
plugin do repositório original.

Para usar, peça ao Claude no repositório: `/brag`. Na Opus 5.5 ele usa a
`/brag-slim`, que não precisa de nada instalado além do que já existe na
máquina. A `/brag` completa (`/brag --full`) usa o Hyperframes por `npx`,
FFmpeg e, para análise de músicas novas, Python com `uv`; esses programas são
baixados só na hora do uso, e a skill pede antes de instalar algo. O vídeo e os
arquivos gerados vão para `brag-output/`, que está no `.gitignore`.
