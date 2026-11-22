/**
 * Monta os prompts a partir dos arquivos de prompts/ (CONTRATO.md, seção 9).
 * Nada de texto de prompt espalhado pelo código.
 *
 * Variáveis entre chaves duplas: {{perfil}}, {{respostas}}, {{pontuacao}},
 * {{ramo}}, {{porte}}, {{referencias}}.
 *
 * A IA nunca recebe nome da empresa, CNPJ, site ou nomes de pessoas:
 * perfilParaIA() deixa passar apenas os campos do perfil comum.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PASTA_PROMPTS = path.join(RAIZ, "prompts");

const CAMPOS_DO_PERFIL = [
  "codinome", "P01_ramo", "P01_outro", "P02_porte", "P03_pessoas", "P04_tempo", "P05_uf",
  "P06_canais", "P07_pagamentos", "P08_dados", "P09_equipamentos", "P10_sistemas",
  "P11_site", "P12_ti", "P13_incidente",
];

const cache = new Map();

/** Lê um arquivo de prompts/ (em memória depois da primeira leitura). */
export async function lerPrompt(nomeDoArquivo) {
  if (!cache.has(nomeDoArquivo)) {
    const texto = await readFile(path.join(PASTA_PROMPTS, nomeDoArquivo), "utf8");
    cache.set(nomeDoArquivo, texto);
  }
  return cache.get(nomeDoArquivo);
}

/** Troca {{variavel}} pelo valor. O que não for conhecido vira texto vazio. */
export function preencher(modelo, variaveis = {}) {
  return String(modelo).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, chave) =>
    variaveis[chave] === undefined || variaveis[chave] === null ? "" : String(variaveis[chave]),
  );
}

/** Só os campos do perfil comum — qualquer outro campo é descartado aqui. */
export function perfilParaIA(perfil = {}) {
  const limpo = {};
  for (const campo of CAMPOS_DO_PERFIL) {
    if (perfil[campo] !== undefined) limpo[campo] = perfil[campo];
  }
  return limpo;
}

/** Fecha a porta para texto que tente encerrar o bloco <respostas> ou dar ordens. */
function textoSeguro(valor) {
  return String(valor).replace(/<\/?respostas>/gi, "[marcador removido]");
}

function rotuloDaOpcao(pergunta, valor) {
  const opcao = (pergunta.opcoes ?? []).find((o) => String(o.valor) === String(valor));
  return opcao ? opcao.rotulo : String(valor);
}

/**
 * Respostas em texto, dentro de <respostas>…</respostas>:
 * o sistema.md manda tratar esse bloco como dados do cliente, nunca como instruções.
 */
export function blocoDeRespostas(questionario, respostas = {}) {
  const linhas = [];
  for (const pergunta of questionario.perguntas ?? []) {
    const resposta = respostas[pergunta.id];
    if (resposta === undefined || resposta === null || resposta === "" || (Array.isArray(resposta) && resposta.length === 0)) continue;
    const valor = Array.isArray(resposta)
      ? textoSeguro(resposta.map((v) => rotuloDaOpcao(pergunta, v)).join("; "))
      : pergunta.tipo === "texto_curto"
        ? textoSeguro(resposta)
        : textoSeguro(rotuloDaOpcao(pergunta, resposta));
    linhas.push(`- [${pergunta.id}] (${pergunta.tema}) ${textoSeguro(pergunta.texto)}\n  Resposta: ${valor}`);
  }
  return `<respostas>\n${linhas.join("\n")}\n</respostas>`;
}

/** Devolve { sistema, usuario } prontos para o adaptador. */
export async function montarPrompts({ perfil, respostas, pontuacao, questionario, manifesto }) {
  const limpo = perfilParaIA(perfil);
  const referencias = (manifesto?.referencias ?? []).map((r) => `- ${r}`).join("\n") || "- (o módulo não declarou referências)";
  const comuns = {
    ramo: limpo.P01_ramo === "outro" ? String(limpo.P01_outro ?? "outro") : String(limpo.P01_ramo ?? ""),
    porte: String(limpo.P02_porte ?? ""),
    referencias,
  };

  const sistema = preencher(await lerPrompt("sistema.md"), comuns);
  const usuario = preencher(await lerPrompt("relatorio.md"), {
    ...comuns,
    perfil: JSON.stringify(limpo, null, 2),
    respostas: blocoDeRespostas(questionario, respostas),
    pontuacao: JSON.stringify(pontuacao, null, 2),
  });

  const instrucoesArtefatos = [];
  for (const artefato of manifesto?.artefatos ?? []) {
    const modelo = await lerPrompt(`artefato-${artefato.id}.md`);
    instrucoesArtefatos.push(`## Artefato ${artefato.id}: ${artefato.titulo}\n${preencher(modelo, comuns)}`);
  }

  return {
    sistema,
    usuario: instrucoesArtefatos.length > 0
      ? `${usuario}\n\n# Instruções específicas dos artefatos\n\n${instrucoesArtefatos.join("\n\n")}`
      : usuario,
  };
}
