#!/usr/bin/env node
/**
 * Configura o repositório-modelo para o módulo do grupo e depois se apaga.
 *
 *   npm run configurar -- m3-psi 3003 G3
 *
 * Troca os marcadores __ID__, __PORTA__ e __GRUPO__ em todos os arquivos de texto,
 * acerta o nome no package.json, remove este script da lista de scripts e apaga
 * o próprio arquivo. Rode uma única vez, logo depois de clonar.
 */

import { readdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Tabela oficial do CONTRATO.md (seção 2). */
const MODULOS = {
  "m1-dados": { porta: 3001, grupo: "G1", prefixo: "M1" },
  "m2-riscos": { porta: 3002, grupo: "G2", prefixo: "M2" },
  "m3-psi": { porta: 3003, grupo: "G3", prefixo: "M3" },
  "m4-site": { porta: 3004, grupo: "G4", prefixo: "M4" },
  "m5-golpes": { porta: 3005, grupo: "G5", prefixo: "M5" },
  "m6-contas": { porta: 3006, grupo: "G6", prefixo: "M6" },
  "m7-backup": { porta: 3007, grupo: "G7", prefixo: "M7" },
};

const EXTENSOES = new Set([".md", ".json", ".js", ".mjs", ".html", ".css", ".txt", ".yml", ".yaml"]);
const NOMES_EXTRA = new Set([".env.example", ".gitignore", ".gitkeep"]);
const PASTAS_IGNORADAS = new Set(["node_modules", ".git", "dados", "ds"]);

function erro(mensagem) {
  console.error(`\n✗ ${mensagem}\n`);
  process.exit(1);
}

function ajuda() {
  const linhas = Object.entries(MODULOS).map(([id, m]) => `    npm run configurar -- ${id} ${m.porta} ${m.grupo}`);
  return `Use: npm run configurar -- <id> <porta> <grupo>\n\n  Valores oficiais (CONTRATO.md, seção 2):\n${linhas.join("\n")}`;
}

const [id, portaTexto, grupo] = process.argv.slice(2);
if (!id || !portaTexto || !grupo) erro(`Faltam argumentos.\n\n${ajuda()}`);

const oficial = MODULOS[id];
if (!oficial) erro(`Identificador desconhecido: "${id}".\n\n${ajuda()}`);
if (Number(portaTexto) !== oficial.porta) erro(`O módulo ${id} usa a porta ${oficial.porta}, não ${portaTexto}.\n\n${ajuda()}`);
if (grupo.toUpperCase() !== oficial.grupo) erro(`O módulo ${id} é do grupo ${oficial.grupo}, não ${grupo}.\n\n${ajuda()}`);

const trocas = [
  ["__ID__", id],
  ["__PORTA__", String(oficial.porta)],
  ["__GRUPO__", oficial.grupo],
  ["MX_Q", `${oficial.prefixo}_Q`],
];

async function arquivosDeTexto(pasta) {
  const encontrados = [];
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    if (item.isDirectory()) {
      if (PASTAS_IGNORADAS.has(item.name)) continue;
      encontrados.push(...(await arquivosDeTexto(path.join(pasta, item.name))));
      continue;
    }
    const caminho = path.join(pasta, item.name);
    if (EXTENSOES.has(path.extname(item.name)) || NOMES_EXTRA.has(item.name)) encontrados.push(caminho);
  }
  return encontrados;
}

const arquivos = await arquivosDeTexto(RAIZ);
const alterados = [];

for (const caminho of arquivos) {
  if (caminho === fileURLToPath(import.meta.url)) continue;
  const original = await readFile(caminho, "utf8");
  let texto = original;
  for (const [de, para] of trocas) texto = texto.split(de).join(para);
  if (texto !== original) {
    await writeFile(caminho, texto, "utf8");
    alterados.push(path.relative(RAIZ, caminho));
  }
}

// package.json: nome do pacote e remoção deste script.
const caminhoPacote = path.join(RAIZ, "package.json");
const pacote = JSON.parse(await readFile(caminhoPacote, "utf8"));
pacote.name = `segmpe-modulo-${id}`;
pacote.description = `Módulo ${id} da Suíte SegMPE (grupo ${oficial.grupo}).`;
delete pacote.scripts.configurar;
await writeFile(caminhoPacote, `${JSON.stringify(pacote, null, 2)}\n`, "utf8");

console.info("\n✓ Módulo configurado:");
console.info("    identificador: %s", id);
console.info("    porta:         %d", oficial.porta);
console.info("    grupo:         %s", oficial.grupo);
console.info("    prefixo dos ids das perguntas: %s_Q01, %s_Q02…", oficial.prefixo, oficial.prefixo);
console.info("\n  Arquivos alterados (%d):", alterados.length);
for (const relativo of alterados) console.info("    %s", relativo);

// Por último, este script se apaga.
const euMesmo = fileURLToPath(import.meta.url);
await rm(euMesmo, { force: true });
const aindaExiste = await stat(euMesmo).then(() => true).catch(() => false);
console.info(
  aindaExiste
    ? "\n  Atenção: não consegui apagar scripts/configurar.mjs. Apague o arquivo à mão."
    : "\n✓ scripts/configurar.mjs foi apagado (ele só serve uma vez).",
);
console.info("\n  Próximos passos:");
console.info("    1. cp .env.example .env   (no PowerShell: Copy-Item .env.example .env)");
console.info("    2. preencha o .env com os valores do curador");
console.info("    3. npm start   e abra http://localhost:%d", oficial.porta);
console.info("    4. npm run checar\n");
