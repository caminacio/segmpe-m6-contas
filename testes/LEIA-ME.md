# Testes do módulo

Tudo aqui é **fictício**. Respostas reais de empresas nunca entram nesta pasta: elas ficam
só em `dados/`, fora do Git (`CONTRATO.md`, seções 3 e 14.9).

| Arquivo | Para quê |
|---|---|
| `perfis/EP-91.json` | Padaria, MEI, sem site |
| `perfis/EP-92.json` | Clínica odontológica, ME, guarda dados de saúde, tem site |
| `perfis/EP-93.json` | Loja de roupas, ME, vende pelo Instagram |
| `cenario-1.json` a `cenario-3.json` | Um conjunto de respostas por perfil, com o resultado esperado |
| `dubles/ia.mjs` | Dublê da IA: devolve uma saída pronta, sem chamar o provedor |
| `exemplo.test.mjs` | Testes de exemplo (`npm test`) |
| `saidas/` | Saídas geradas nos testes. Arquivos `*.real.json` nunca são versionados |

Ao trocar as perguntas do `questionario.json`, atualize as respostas e o campo
`esperado` dos três cenários — é isso que prova que a pontuação é determinística.
