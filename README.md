# m6-contas — Contas e Senhas · Suíte SegMPE

> Módulo do grupo G6 · porta 3006 · Projeto acadêmico CEUB — Segurança Cibernética, 2º/2026.

## O que o módulo faz

O M6 responde a 15 perguntas sobre contas digitais críticas, senhas, verificação em duas etapas, desligamentos, recuperação, certificado digital e equipamentos da equipe. Protege contas que podem interromper o negócio, como banco, e-mail, redes sociais, vendas e armazenamento em nuvem.

O código calcula o índice e o semáforo sem alterar os dados da empresa. A IA recebe o perfil sem identificação e a pontuação já pronta para explicar os resultados e montar um relatório com plano de ação e dois artefatos.

## Como instalar e rodar

Requisitos: Node.js 22 ou 24 LTS.

```bash
npm install
Copy-Item .env.example .env
npm start
```

Preencha o `.env` apenas com os valores fornecidos pelo curador. Depois abra `http://localhost:3006`. O catálogo do design system fica em `http://localhost:3006/ds/exemplos.html`.

| Comando | Para quê |
|---|---|
| `npm start` | Sobe o módulo na porta do `.env` |
| `npm test` | Roda os testes nativos; a IA é substituída por um dublê |
| `npm run checar` | Verifica estrutura, segurança, questionário e documentação |

## Variáveis de ambiente (`.env`)

| Variável | O que é | Observação |
|---|---|---|
| `IA_API_KEY` | Chave de acesso à IA | Só no `.env`, nunca no código, logs ou Git |
| `IA_MODELO` | Nome do modelo | Fornecido pelo curador |
| `IA_URL` | Endpoint Chat Completions | Na suíte, aponta para o gateway central |
| `PORT` | Porta do módulo | `3006` |

Sem chave configurada, o módulo informa claramente que o relatório não pode ser gerado e continua permitindo usar as telas.

## Rotas

| Rota | O que faz | Respostas |
|---|---|---|
| `GET /api/m6-contas/saude` | Verifica se o módulo está ativo | 200 |
| `GET /api/m6-contas/questionario` | Devolve o questionário | 200 |
| `POST /api/m6-contas/gerar` | Recebe perfil e respostas, calcula a nota e gera o relatório | 200 · 400 · 502 |
| `/` | Serve os arquivos de `public/` | — |

O corpo da requisição é limitado a 100 KB.

## Perguntas e regra de pontuação

Os temas são: Contas e responsáveis, Senhas, Verificação em duas etapas, Desligamentos e recuperação, Certificado digital e Aparelhos e equipe.

As perguntas cobrem: tipos de contas; inventário de acessos; responsáveis; repetição de senhas; verificação em duas etapas; desligamentos; formas de guardar senhas; proteção do certificado digital; recuperação; aparelhos usados; orientação da equipe; troca de acessos; usuários individuais; bloqueio de tela; e substituição das senhas de fábrica.

- Cada opção vale 0, 1 ou 2 pontos.
- Índice = soma dos pontos obtidos ÷ máximo possível das perguntas aplicáveis × 100, arredondado.
- Verde: índice ≥ 70. Amarelo: de 40 a 69. Vermelho: menor que 40.
- O semáforo é calculado no geral e por tema.
- M6_Q01 é contextual e não pontua.
- M6_Q06 aceita `nao_se_aplica` quando ninguém saiu da empresa; M6_Q08 aceita `nao_se_aplica` quando não usam certificado.
- M6_Q07 usa múltipla escolha. Quando várias práticas são marcadas, vale a pior prática; por exemplo, papel ou mensagens valem 0, navegador vale 1 e práticas protegidas podem valer 2.
- `nao_sei` vale 0 e entra no cálculo, exceto quando a pergunta estiver fora da aplicação.

## Artefatos entregues à empresa

| id no manifesto | Título | Prompt |
|---|---|---|
| `inventario-contas` | Inventário de contas críticas | `prompts/artefato-inventario-contas.md` |
| `guia-duas-etapas` | Guia de verificação em duas etapas | `prompts/artefato-guia-duas-etapas.md` |

Os artefatos não pedem ou registram senhas. O inventário usa cargo ou função, nunca nomes pessoais.

## Limitações conhecidas

- O módulo não faz testes técnicos contra contas ou equipamentos.
- O questionário não usa dados reais durante o desenvolvimento.
- Respostas reais ficam apenas em `dados/` e não podem ser versionadas.
- Recomendações dependem da revisão humana antes de serem entregues à empresa.
- A disponibilidade da IA depende da configuração segura fornecida pelo curador.
- Não há integração com o Kit final da suíte; o nome real da empresa entra somente nesse material externo.

## Integrantes e papéis

| Nome | Papel |
|---|---|
| Anna Nicolly da Silva (RA: 22500860) | Contato com o curador, gestão do cronograma e acompanhamento das entregas. |
| Anne Caroline Gonçalves (RA: 22500825) | Elaboração do questionário, regras de pontuação e definição do escopo. |
| Camila Inácio Martins (RA: 22509696) | Validação de privacidade/LGPD, revisão dos relatórios, testes e documentação. |
| Júlia Liriel Albuquerque (RA: 22501844) | Implementação do back-end/telas, revisão de segurança e integração com o adaptador de IA. |
| Paulo Sergio da Silva Rocha (RA: 22510330) | Criação, ajuste e teste dos prompts do relatório e dos artefatos. |

## Registro de uso de IA

| Ferramenta | Para quê usamos | O que revisamos à mão |
|---|---|---|
| GitHub Copilot (VS Code) | Apoio na geração do questionário, prompts, telas, testes e documentação | Conformidade com `CONTRATO.md`, regras de pontuação, ausência de `innerHTML` e privacidade |
| Dublê de testes local | Validar JSON, artefatos e fluxo sem chamadas reais | Pontuação, segurança e formato da saída |
| Gateway da suíte, se configurado | Gerar relatório e documentos adaptados | Pontuação, conteúdo, privacidade e referências |

## Privacidade

Este módulo não recebe nem guarda nome da empresa, CNPJ, endereço, site ou nomes de pessoas: usa somente o codinome, o perfil comum e as respostas. Senhas, PINs e códigos não são perguntados. Respostas reais devem ficar somente em `dados/`, fora do Git, e serem removidas ao encerrar o projeto.
