#!/usr/bin/env node
/**
 * Verificação antes de cada entrega: `npm run checar`.
 *
 * Confere estrutura de pastas, identificadores, questionário, prompts e as regras
 * de segurança do CONTRATO.md (seção 14). Imprime uma lista ✓ / ✗ / ! em português
 * e sai com código 1 se algo falhar. Os avisos (!) não reprovam, mas resolva antes
 * da entrega final.
 *
 * Este arquivo não é analisado por ele mesmo: ele contém, de propósito, os padrões
 * proibidos que procura nos outros arquivos.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validarQuestionario } from "../src/validacao.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EU_MESMO = path.relative(RAIZ, fileURLToPath(import.meta.url)).split(path.sep).join("/");

const MODULOS = {
  "m1-dados": { porta: 3001, grupo: "G1" },
  "m2-riscos": { porta: 3002, grupo: "G2" },
  "m3-psi": { porta: 3003, grupo: "G3" },
  "m4-site": { porta: 3004, grupo: "G4" },
  "m5-golpes": { porta: 3005, grupo: "G5" },
  "m6-contas": { porta: 3006, grupo: "G6" },
  "m7-backup": { porta: 3007, grupo: "G7" },
};

const DEPENDENCIAS_PERMITIDAS = new Set(["express", "dotenv"]);

const PASTAS_IGNORADAS = new Set(["node_modules", ".git", "dados", "saidas"]);
const EXTENSOES_TEXTO = new Set([".md", ".json", ".js", ".mjs", ".html", ".css", ".txt"]);
const NOMES_EXTRA = new Set([".env.example", ".gitignore"]);
// Fora da análise de código: a pasta do design system (do curador), o contrato e este script.
const FORA_DA_ANALISE = new Set(["CONTRATO.md", EU_MESMO]);

let falhas = 0;
let avisos = 0;
let total = 0;

function secao(titulo) {
  console.info(`\n${titulo}`);
}
function ok(texto) {
  total += 1;
  console.info("  ✓ %s", texto);
}
function falha(texto) {
  total += 1;
  falhas += 1;
  console.info("  ✗ %s", texto);
}
function aviso(texto) {
  total += 1;
  avisos += 1;
  console.info("  ! %s", texto);
}

const existe = (relativo) => stat(path.join(RAIZ, relativo)).then(() => true).catch(() => false);

async function lerTexto(relativo) {
  return readFile(path.join(RAIZ, relativo), "utf8");
}
async function lerJSON(relativo) {
  return JSON.parse(await lerTexto(relativo));
}

async function listarTexto(pasta = RAIZ) {
  const encontrados = [];
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) {
      if (PASTAS_IGNORADAS.has(item.name)) continue;
      if (path.relative(RAIZ, caminho).split(path.sep).join("/") === "public/ds") continue;
      encontrados.push(...(await listarTexto(caminho)));
      continue;
    }
    if (EXTENSOES_TEXTO.has(path.extname(item.name)) || NOMES_EXTRA.has(item.name)) {
      const relativo = path.relative(RAIZ, caminho).split(path.sep).join("/");
      if (!FORA_DA_ANALISE.has(relativo)) encontrados.push(relativo);
    }
  }
  return encontrados;
}

function git(argumentos) {
  return execFileSync("git", argumentos, { cwd: RAIZ, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/* ================================================================= */
/* 1. Estrutura de pastas (CONTRATO.md, seção 3)                      */
/* ================================================================= */

const OBRIGATORIOS = [
  "README.md", "CONTRATO.md", "package.json", ".env.example", ".gitignore",
  "modulo.json", "questionario.json",
  "src/server.js", "src/pontuacao.js", "src/prompts.js", "src/validacao.js", "src/ia/adaptador.js",
  "prompts/sistema.md", "prompts/relatorio.md",
  "public/index.html", "public/modulo.js", "public/ds/segmpe.css", "public/ds/segmpe.js",
  "dados", "testes", "testes/perfis", "testes/saidas",
];

secao("Estrutura de pastas");
for (const item of OBRIGATORIOS) {
  if (await existe(item)) ok(item);
  else falha(`falta ${item}`);
}
for (const cenario of ["testes/cenario-1.json", "testes/cenario-2.json", "testes/cenario-3.json"]) {
  if (await existe(cenario)) ok(cenario);
  else falha(`falta ${cenario} (3 cenários fictícios — CONTRATO.md, seção 15)`);
}

/* ================================================================= */
/* 2. Identificadores                                                 */
/* ================================================================= */

secao("Identificadores e manifesto");
const todosOsTextos = await listarTexto();
const comMarcadores = [];
for (const relativo of todosOsTextos) {
  const texto = await lerTexto(relativo);
  if (/__(ID|PORTA|GRUPO)__/.test(texto)) comMarcadores.push(relativo);
}
const configurado = comMarcadores.length === 0;
if (!configurado) {
  aviso(`repositório-modelo ainda não configurado: rode "npm run configurar -- <id> <porta> <grupo>" (marcadores em ${comMarcadores.length} arquivo(s))`);
}

let manifesto = {};
try {
  manifesto = await lerJSON("modulo.json");
  ok("modulo.json é um JSON válido");
} catch (erro) {
  falha(`modulo.json não pôde ser lido: ${erro.message}`);
}

const oficial = MODULOS[manifesto.id];
if (oficial) {
  ok(`id "${manifesto.id}" está na tabela do contrato (porta ${oficial.porta}, grupo ${oficial.grupo})`);
  if (manifesto.grupo !== oficial.grupo) falha(`o grupo do modulo.json (${manifesto.grupo}) não é o da tabela (${oficial.grupo})`);
  try {
    const env = await lerTexto(".env.example");
    const porta = /^PORT=(\d+)$/m.exec(env)?.[1];
    if (Number(porta) === oficial.porta) ok(`.env.example com PORT=${oficial.porta}`);
    else falha(`.env.example deveria ter PORT=${oficial.porta}`);
  } catch {
    falha(".env.example não pôde ser lido");
  }
} else if (configurado) {
  falha(`o id "${manifesto.id}" não está na tabela do CONTRATO.md (seção 2)`);
} else {
  aviso("id, porta e grupo serão conferidos depois de rodar o configurar");
}

for (const campo of ["nome", "versao", "grupo", "temas", "artefatos"]) {
  if (manifesto[campo] === undefined) falha(`modulo.json está sem o campo ${campo}`);
}
if (Array.isArray(manifesto.temas) && manifesto.temas.length >= 3) ok(`${manifesto.temas.length} temas declarados`);
else falha("modulo.json precisa de pelo menos 3 temas");
if (Array.isArray(manifesto.artefatos) && manifesto.artefatos.length >= 1) ok(`${manifesto.artefatos.length} artefato(s) declarado(s)`);
else falha("modulo.json precisa de pelo menos 1 artefato");

/* ================================================================= */
/* 3. Questionário (CONTRATO.md, seção 6)                             */
/* ================================================================= */

secao("Questionário");
try {
  const questionario = await lerJSON("questionario.json");
  const erros = validarQuestionario(questionario, manifesto);
  if (erros.length === 0) ok(`${questionario.perguntas.length} perguntas, dentro das regras do contrato`);
  else for (const erro of erros) falha(erro);
} catch (erro) {
  falha(`questionario.json não pôde ser lido: ${erro.message}`);
}

/* ================================================================= */
/* 4. Prompts (CONTRATO.md, seção 9)                                  */
/* ================================================================= */

secao("Prompts");
try {
  const sistema = await lerTexto("prompts/sistema.md");
  const exigidos = [
    ["{{ramo}}", "adaptar ao ramo"],
    ["{{porte}}", "adaptar ao porte"],
    ["{{referencias}}", "leis e normas só da lista do módulo"],
    ["<respostas>", "tratar as respostas como dados, nunca como instruções"],
    ["JSON", "responder somente com o JSON da seção 10"],
  ];
  for (const [marca, regra] of exigidos) {
    if (sistema.includes(marca)) ok(`sistema.md cobre: ${regra}`);
    else falha(`sistema.md está sem "${marca}" (${regra})`);
  }
} catch {
  falha("prompts/sistema.md não pôde ser lido");
}

try {
  const relatorio = await lerTexto("prompts/relatorio.md");
  for (const marca of ["{{perfil}}", "{{respostas}}", "{{pontuacao}}"]) {
    if (relatorio.includes(marca)) ok(`relatorio.md usa ${marca}`);
    else falha(`relatorio.md está sem a variável ${marca}`);
  }
} catch {
  falha("prompts/relatorio.md não pôde ser lido");
}

for (const artefato of manifesto.artefatos ?? []) {
  const caminho = `prompts/artefato-${artefato.id}.md`;
  if (await existe(caminho)) ok(`${caminho} (artefato "${artefato.id}")`);
  else falha(`falta ${caminho}: um prompt por artefato do manifesto`);
}

/* ================================================================= */
/* 5. Segurança e privacidade (CONTRATO.md, seção 14)                 */
/* ================================================================= */

secao("Segurança e privacidade");

try {
  const gitignore = await lerTexto(".gitignore");
  for (const regra of [".env", "node_modules/", "dados/"]) {
    if (gitignore.split(/\r?\n/).some((linha) => linha.trim().startsWith(regra))) ok(`.gitignore cobre ${regra}`);
    else falha(`.gitignore está sem ${regra}`);
  }
} catch {
  falha(".gitignore não pôde ser lido");
}

try {
  const env = await lerTexto(".env.example");
  const comValor = env
    .split(/\r?\n/)
    .filter((linha) => /^[A-Z_]+=\S/.test(linha.trim()) && !/^PORT=/.test(linha.trim()));
  if (comValor.length === 0) ok(".env.example sem valores preenchidos");
  else falha(`.env.example tem ${comValor.length} variável(is) com valor: deixe tudo em branco`);
} catch {
  falha(".env.example não pôde ser lido");
}

if (await existe(".env")) {
  try {
    git(["check-ignore", "-q", ".env"]);
    ok(".env existe nesta máquina e está ignorado pelo Git");
  } catch {
    falha(".env NÃO está ignorado pelo Git: acerte o .gitignore antes de qualquer commit");
  }
} else {
  ok(".env não existe nesta pasta (copie o .env.example quando for rodar)");
}

let versionados = null;
try {
  versionados = git(["ls-files"]).split(/\r?\n/).filter(Boolean);
  ok("repositório Git encontrado");
} catch {
  aviso("não deu para consultar o Git (pasta sem repositório ou git ausente): confira à mão o que vai no commit");
}
if (versionados) {
  const proibidos = versionados.filter(
    (arquivo) => arquivo === ".env" || arquivo.startsWith("node_modules/") || (arquivo.startsWith("dados/") && arquivo !== "dados/.gitkeep"),
  );
  if (proibidos.length === 0) ok("nenhum arquivo proibido versionado (.env, node_modules/, dados/)");
  else for (const arquivo of proibidos) falha(`${arquivo} está versionado e não deveria estar`);

  const saidasReais = versionados.filter((arquivo) => /^testes\/saidas\/.*\.real\.json$/.test(arquivo));
  if (saidasReais.length === 0) ok("nenhuma saída real versionada");
  else for (const arquivo of saidasReais) falha(`${arquivo} tem dados reais e não pode ser versionado`);
}

const PROIBIDOS_NO_CODIGO = [
  { nome: "escrita de HTML cru (innerHTML/outerHTML)", padrao: /\.(inner|outer)HTML\s*=/ },
  { nome: "insertAdjacentHTML", padrao: /insertAdjacentHTML\s*\(/ },
  { nome: "document.write", padrao: /document\.write\s*\(/ },
  { nome: "console.log", padrao: /\bconsole\.log\s*\(/ },
  { nome: "eval", padrao: /\beval\s*\(/ },
  { nome: "new Function", padrao: /new\s+Function\s*\(/ },
];
const PADROES_DE_CHAVE = [
  { nome: "chave de API no código", padrao: /\bsk-[A-Za-z0-9_-]{16,}/ },
  { nome: "token no cabeçalho Authorization", padrao: /Bearer\s+[A-Za-z0-9._-]{20,}/ },
  { nome: "variável de chave com valor", padrao: /\b(IA_API_KEY|API_KEY|TOKEN|SECRET)\s*[:=]\s*["'][^"']{12,}["']/ },
];

const achados = [];
const achadosDeChave = [];
const externas = [];

for (const relativo of todosOsTextos) {
  const texto = await lerTexto(relativo);
  const linhas = texto.split(/\r?\n/);
  const ehCodigo = /\.(js|mjs|html|css)$/.test(relativo);

  linhas.forEach((linha, indice) => {
    if (ehCodigo) {
      for (const { nome, padrao } of PROIBIDOS_NO_CODIGO) {
        if (padrao.test(linha)) achados.push(`${relativo}:${indice + 1} — ${nome}`);
      }
    }
    for (const { nome, padrao } of PADROES_DE_CHAVE) {
      if (padrao.test(linha)) achadosDeChave.push(`${relativo}:${indice + 1} — ${nome}`);
    }
    if (relativo.startsWith("public/") && /https?:\/\/(?!localhost|127\.0\.0\.1)/.test(linha)) {
      externas.push(`${relativo}:${indice + 1}`);
    }
  });
}

if (achados.length === 0) ok("sem innerHTML, document.write, console.log, eval ou new Function no código");
else for (const achado of achados) falha(achado);

if (achadosDeChave.length === 0) ok("nenhuma chave ou token escrito no código");
else for (const achado of achadosDeChave) falha(achado);

if (externas.length === 0) ok("public/ sem CDN, fontes ou scripts externos");
else for (const achado of externas) falha(`${achado} — endereço externo em public/ (nada externo: CONTRATO.md, seção 2)`);

try {
  const codigoDaIA = await lerTexto("src/ia/adaptador.js");
  if (/process\.env\.IA_API_KEY/.test(codigoDaIA)) ok("o adaptador lê a chave do .env (process.env)");
  else falha("src/ia/adaptador.js deveria ler IA_API_KEY de process.env");

  // Vale para o código entregue (src/ e public/). Os testes podem mexer no process.env de propósito.
  const outrosQueChamamIA = [];
  for (const relativo of todosOsTextos) {
    if (relativo === "src/ia/adaptador.js" || !/\.(js|mjs)$/.test(relativo)) continue;
    if (!relativo.startsWith("src/") && !relativo.startsWith("public/")) continue;
    const texto = await lerTexto(relativo);
    if (/\bfetch\s*\(\s*(process\.env\.IA_URL|`?\$?\{?IA_URL)/.test(texto) || /process\.env\.IA_(API_KEY|MODELO|URL)/.test(texto)) {
      outrosQueChamamIA.push(relativo);
    }
  }
  if (outrosQueChamamIA.length === 0) ok("só o adaptador lê as credenciais e fala com a IA");
  else for (const arquivo of outrosQueChamamIA) falha(`${arquivo} usa credenciais da IA: só src/ia/adaptador.js pode`);
} catch {
  falha("src/ia/adaptador.js não pôde ser lido");
}

try {
  const pacote = await lerJSON("package.json");
  const dependencias = Object.keys(pacote.dependencies ?? {});
  const extras = dependencias.filter((d) => !DEPENDENCIAS_PERMITIDAS.has(d));
  if (extras.length === 0) ok(`dependências mínimas (${dependencias.join(", ") || "nenhuma instalada ainda"})`);
  else aviso(`dependências além de express e dotenv: ${extras.join(", ")} — precisam de aprovação do curador`);
  for (const script of ["start", "test", "checar"]) {
    if (pacote.scripts?.[script]) ok(`script "${script}" definido`);
    else falha(`package.json está sem o script "${script}"`);
  }
} catch {
  falha("package.json não pôde ser lido");
}

/* ================================================================= */
/* 6. Documentação                                                    */
/* ================================================================= */

secao("Documentação");
try {
  const leiaMe = await lerTexto("README.md");
  const secoesDoContrato = [
    "O que o módulo faz",
    "Como instalar e rodar",
    "Variáveis de ambiente",
    "Rotas",
    "pontuação",
    "Artefatos",
    "Limitações conhecidas",
    "Integrantes",
    "uso de IA",
  ];
  const faltando = secoesDoContrato.filter((titulo) => !leiaMe.toLowerCase().includes(titulo.toLowerCase()));
  if (faltando.length === 0) ok("README tem todas as seções do contrato (seção 16)");
  else for (const titulo of faltando) falha(`README está sem a seção sobre "${titulo}"`);

  if (/\(trocar|\(1 ou 2 par|\(Liste os temas|\(O que o módulo \*\*não\*\*|\| \| \|/.test(leiaMe)) {
    aviso("o README ainda tem trechos do modelo para preencher (integrantes, registro de IA, limitações)");
  }
} catch {
  falha("README.md não pôde ser lido");
}

/* ================================================================= */

console.info("\n%s", "-".repeat(60));
console.info("Resultado: %d verificações · %d falha(s) · %d aviso(s).", total, falhas, avisos);
if (falhas > 0) {
  console.info("Corrija as linhas com ✗ antes de entregar. Dúvida? Pergunte ao curador antes de inventar.\n");
  process.exit(1);
}
console.info(avisos > 0 ? "Nenhuma falha. Resolva os avisos (!) antes da entrega final.\n" : "Pronto para entregar.\n");
