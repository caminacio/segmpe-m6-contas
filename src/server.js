/**
 * Rotas do módulo (CONTRATO.md, seção 11).
 *
 *   GET  /api/<id>/saude         diz se o módulo está no ar
 *   GET  /api/<id>/questionario  devolve o questionario.json
 *   POST /api/<id>/gerar         valida, pontua, chama a IA e devolve o relatório
 *   /                            serve as telas de public/
 *
 * O <id> vem do modulo.json (vale "__ID__" até você rodar `npm run configurar`).
 * Mensagens de serviço usam console.info/console.error; nunca registre respostas,
 * prompts ou saídas nos logs (CONTRATO.md, seção 14.4).
 */

import "dotenv/config";
import express from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { calcular, perguntaAplicavel } from "./pontuacao.js";
import { validarEntrada } from "./validacao.js";
import { iaConfigurada } from "./ia/adaptador.js";
// Para implementar o POST /gerar, descomente estas duas linhas:
// import { montarPrompts } from "./prompts.js";
// import { gerar as gerarComIA } from "./ia/adaptador.js";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORTA_RESERVA = 3099;

async function lerJSON(nomeDoArquivo) {
  return JSON.parse(await readFile(path.join(RAIZ, nomeDoArquivo), "utf8"));
}

const manifesto = await lerJSON("modulo.json");
const questionario = await lerJSON("questionario.json");
const ID = manifesto.id;

const porta = Number.parseInt(process.env.PORT ?? "", 10);
const PORTA = Number.isInteger(porta) && porta > 0 ? porta : PORTA_RESERVA;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(RAIZ, "public"), { index: "index.html" }));

app.get(`/api/${ID}/saude`, (_pedido, resposta) => {
  resposta.json({ ok: true, modulo: ID, versao: manifesto.versao });
});

app.get(`/api/${ID}/questionario`, (_pedido, resposta) => {
  resposta.json(questionario);
});

app.post(`/api/${ID}/gerar`, async (pedido, resposta) => {
  const erros = validarEntrada(pedido.body, questionario, { perguntaAplicavel });
  if (erros.length > 0) {
    return resposta.status(400).json({ erro: "Não foi possível usar os dados enviados.", detalhes: erros });
  }

  // A pontuação é do código e já funciona: determinística, sem IA.
  const pontuacao = calcular(questionario, { perfil: pedido.body.perfil, respostas: pedido.body.respostas });

  // PENDÊNCIA DO GRUPO — monte os prompts, chame a IA e valide a saída:
  //
  //   const { sistema, usuario } = await montarPrompts({
  //     perfil: pedido.body.perfil, respostas: pedido.body.respostas,
  //     pontuacao, questionario, manifesto,
  //   });
  //   const texto = await gerarComIA({ sistema, usuario });
  //   const saida = { ...JSON.parse(texto), modulo: ID, versao: manifesto.versao,
  //                   codinome: pedido.body.perfil.codinome, geradoEm: new Date().toISOString(), pontuacao };
  //   const problemas = validarSaida(saida, manifesto);   // de ./validacao.js
  //   if (problemas.length > 0) { /* uma nova tentativa pedindo correção; depois, erro 502 */ }
  //   return resposta.json(saida);
  //
  // JSON inválido da IA: uma nova tentativa; se falhar de novo, 502 com mensagem amigável.
  return resposta.status(501).json({
    erro: "A geração do relatório ainda não foi implementada neste módulo.",
    pontuacao,
    proximosPassos: "Implemente o POST /gerar em src/server.js seguindo o CONTRATO.md (seções 9 e 10).",
  });
});

// Corpo grande ou JSON malformado
app.use((erro, _pedido, resposta, proximo) => {
  if (erro?.type === "entity.too.large") {
    return resposta.status(413).json({ erro: "O pedido é grande demais (o limite é 100 KB)." });
  }
  if (erro instanceof SyntaxError && "body" in erro) {
    return resposta.status(400).json({ erro: "O pedido não chegou como JSON válido." });
  }
  if (erro) {
    console.error("[%s] falha inesperada: %s", ID, erro?.message ?? "sem mensagem");
    return resposta.status(500).json({ erro: "Algo deu errado no módulo. Tente de novo em alguns instantes." });
  }
  return proximo();
});

app.use((_pedido, resposta) => {
  resposta.status(404).json({ erro: "Endereço não encontrado neste módulo." });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORTA, () => {
    console.info("Módulo %s (versão %s) no ar em http://localhost:%d", ID, manifesto.versao, PORTA);
    if (PORTA === PORTA_RESERVA) {
      console.info("Atenção: PORT não está definido no .env — usando a porta de reserva %d.", PORTA_RESERVA);
    }
    if (!iaConfigurada()) {
      console.info("Atenção: a IA não está configurada (confira IA_API_KEY, IA_MODELO e IA_URL no .env). As telas funcionam; o relatório, não.");
    }
  });
}

export { app, manifesto, questionario, ID };
