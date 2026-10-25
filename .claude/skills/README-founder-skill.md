# Skills de negócio (founder-skill)

As pastas `founder-*` desta pasta são uma cópia sem alterações da skill
[founder-skill](https://github.com/Jakeschincariol/founder-skill), de Jake
Schincariol, no commit `fd9385b` ("The Founder skill: 11 Claude skills, v1.0").
A licença é MIT e está em [LICENSE-founder-skill](LICENSE-founder-skill).

Ficaram de fora os testes e os arquivos de plugin (`.claude-plugin/`) do
repositório original, porque não são necessários para usar as skills aqui.

Os scripts em Python (`unit_economics.py`, `panel.py`, `compile.py`,
`van_westendorp.py`) foram revisados antes da cópia: usam só a biblioteca
padrão, não acessam a rede e só leem e gravam arquivos na pasta de trabalho
`founder/`.

Para usar, peça ao Claude no repositório, por exemplo: `/founder-board` com a
ideia. As anotações geradas vão para `founder/`, que está no `.gitignore` para
não serem publicadas por engano.
