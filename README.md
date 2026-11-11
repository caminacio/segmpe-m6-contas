# m6-contas — Nome do módulo (trocar) · Suíte SegMPE

> Módulo do grupo G6 · porta 3006 · Projeto acadêmico CEUB — Segurança Cibernética, 2º/2026.
> Preencha todas as seções deste README. O que fica em branco conta como pendência na entrega (`CONTRATO.md`, seção 16).

## Primeiro passo (uma única vez, logo após clonar)

```bash
npm install
npm run configurar -- m6-contas 3006 G6
```

O comando troca os marcadores `m6-contas`, `3006` e `G6` em todos os arquivos e depois se apaga.
Use o identificador, a porta e o grupo da tabela do `CONTRATO.md` (seção 2) — por exemplo: `npm run configurar -- m3-psi 3003 G3`.

## O que o módulo faz

(1 ou 2 parágrafos, em linguagem simples: o que a empresa responde, o que recebe de volta e para que serve.)

## Como instalar e rodar

```bash
npm install
cp .env.example .env     # no PowerShell: Copy-Item .env.example .env
# preencha o .env com os valores que o curador passar
npm start
```

Depois abra `http://localhost:3006`. O catálogo do design system fica em `http://localhost:3006/ds/exemplos.html`.

| Comando | Para quê |
|---|---|
| `npm start` | Sobe o módulo na porta do `.env` |
| `npm test` | Roda os testes (`node --test`), com a IA substituída por um dublê — não gasta chamadas |
| `npm run checar` | Verificação obrigatória antes de cada entrega: estrutura, segurança e questionário |

## Variáveis de ambiente (`.env`)

| Variável | O que é | Observação |
|---|---|---|
| `IA_API_KEY` | Chave de acesso à IA | Só no `.env`, nunca no código, nos logs ou no Git |
| `IA_MODELO` | Nome do modelo | Definido pelo curador |
| `IA_URL` | Endereço do provedor (formato *Chat Completions*) | Na suíte, aponta para o gateway central |
| `PORT` | Porta do módulo | `3006` |

Sem `IA_API_KEY`, o módulo sobe e mostra uma mensagem clara — não quebra.

## Rotas

| Rota | O que faz | Respostas |
|---|---|---|
| `GET /api/m6-contas/saude` | Diz se o módulo está no ar | 200 `{ ok, modulo, versao }` |
| `GET /api/m6-contas/questionario` | Devolve o `questionario.json` | 200 |
| `POST /api/m6-contas/gerar` | Recebe `{ perfil, respostas }`, pontua, chama a IA e devolve o relatório | 200 · 400 entrada inválida · 502 falha da IA |
| `/` | Serve as telas de `public/` | — |

Corpo da requisição limitado a 100 KB.

## Perguntas e regra de pontuação

(Liste os temas e as perguntas, e explique a regra. As perguntas que vêm no modelo são **exemplos** e devem ser trocadas.)

Regra implementada em `src/pontuacao.js` (vale para todos os módulos, `CONTRATO.md` seção 7):

- Cada opção vale **0** (ausente ou arriscado), **1** (parcial) ou **2** (adequado).
- Índice = soma dos pontos ÷ máximo possível das perguntas aplicáveis × 100, arredondado.
- Semáforo: **verde** ≥ 70 · **amarelo** 40–69 · **vermelho** < 40 — no geral e por tema.
- Ficam fora do cálculo: perguntas de `texto_curto`, perguntas com `"pontua": false`, condicionais que não apareceram e respostas `nao_se_aplica`.
- `nao_sei` vale 0 e **entra** no cálculo.
- **Múltipla escolha:** os pontos das opções marcadas são somados e limitados ao campo `maximo` da pergunta (padrão 2). A opção `nenhum` não combina com outras.

## Artefatos entregues à empresa

| id (no `modulo.json`) | Título | Prompt |
|---|---|---|
| `exemplo` | Artefato de exemplo (trocar) | `prompts/artefato-exemplo.md` |

## Limitações conhecidas

- (O que o módulo **não** faz; o que depende de confirmação da empresa; o que ficou para depois.)

## Integrantes e papéis

| Nome | Papel |
|---|---|
| | |

## Registro de uso de IA

| Ferramenta | Para quê usamos | O que revisamos à mão |
|---|---|---|
| | | |

## Privacidade (obrigatório)

Este módulo **não** recebe nem guarda nome da empresa, CNPJ, endereço de site ou nomes de pessoas: só o **codinome** (EP-01, EP-02…), o perfil e as respostas. Respostas reais ficam apenas em `dados/`, fora do Git, e são apagadas no encerramento do projeto.
