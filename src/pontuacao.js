/**
 * Pontuação do módulo — calculada pelo CÓDIGO, nunca pela IA (CONTRATO.md, seção 7).
 *
 * Cada opção vale 0 (ausente ou arriscado), 1 (parcial) ou 2 (adequado).
 * Índice = soma dos pontos ÷ máximo possível das perguntas aplicáveis × 100.
 * Semáforo: verde ≥ 70 · amarelo 40–69 · vermelho < 40 (no geral e por tema).
 *
 * Determinístico: a mesma entrada gera sempre o mesmo resultado.
 */

const LIMITE_VERDE = 70;
const LIMITE_AMARELO = 40;
const NAO_SE_APLICA = "nao_se_aplica";

export function semaforoDoIndice(indice) {
  if (indice >= LIMITE_VERDE) return "verde";
  if (indice >= LIMITE_AMARELO) return "amarelo";
  return "vermelho";
}

/**
 * A pergunta aparece para este perfil e estas respostas?
 * Formato da condição: { "perfil": "P11_site", "igual": "sim" }
 *                   ou { "pergunta": "M6_Q01", "em": ["sim", "nao_sei"] }
 */
export function perguntaAplicavel(pergunta, { perfil = {}, respostas = {} } = {}) {
  const condicao = pergunta.condicao;
  if (!condicao) return true;
  const valor = condicao.perfil ? perfil?.[condicao.perfil] : respostas?.[condicao.pergunta];
  const alvos = Array.isArray(condicao.em)
    ? condicao.em
    : condicao.igual === undefined
      ? []
      : [condicao.igual];
  if (alvos.length === 0) return true;
  if (Array.isArray(valor)) return valor.some((v) => alvos.includes(v));
  return alvos.includes(valor);
}

function pontosDaOpcao(pergunta, valor) {
  const opcao = (pergunta.opcoes ?? []).find((o) => o.valor === valor);
  return opcao ? Number(opcao.pontos) || 0 : 0;
}

/** Máximo que a pergunta pode valer: o campo "maximo" ou a melhor opção (2, em múltipla). */
export function maximoDaPergunta(pergunta) {
  if (Number.isFinite(pergunta.maximo)) return pergunta.maximo;
  if (pergunta.tipo === "multipla") return 2;
  return Math.max(0, ...(pergunta.opcoes ?? []).map((o) => Number(o.pontos) || 0));
}

function naoSeAplica(resposta) {
  return resposta === NAO_SE_APLICA || (Array.isArray(resposta) && resposta.includes(NAO_SE_APLICA));
}

function semResposta(resposta) {
  if (resposta === undefined || resposta === null || resposta === "") return true;
  return Array.isArray(resposta) && resposta.length === 0;
}

/**
 * Pontos de uma pergunta, ou null quando ela não entra no cálculo:
 * texto_curto, "pontua": false, resposta "nao_se_aplica" e opcional sem resposta.
 * Obrigatória sem resposta vale 0 (a validação já recusa a entrada antes disso).
 */
export function pontosDaPergunta(pergunta, resposta) {
  if (pergunta.tipo === "texto_curto" || pergunta.pontua === false) return null;
  if (naoSeAplica(resposta)) return null;
  if (semResposta(resposta)) return pergunta.obrigatoria === false ? null : 0;

  const maximo = maximoDaPergunta(pergunta);
  if (pergunta.tipo === "multipla") {
    const marcadas = Array.isArray(resposta) ? resposta : [resposta];
    if (pergunta.regraMultipla === "pior_pratica") {
      const praticas = marcadas.filter((valor) => valor !== "nao_sei");
      if (praticas.length === 0) return 0;
      const pior = Math.min(...praticas.map((valor) => pontosDaOpcao(pergunta, valor)));
      return Math.min(pior, maximo);
    }
    const soma = marcadas.reduce((total, valor) => total + pontosDaOpcao(pergunta, valor), 0);
    return Math.min(soma, maximo);
  }
  const valor = Array.isArray(resposta) ? resposta[0] : resposta;
  return Math.min(pontosDaOpcao(pergunta, valor), maximo);
}

/** Índice geral e por tema. A IA recebe isto pronto e não pode alterar. */
export function calcular(questionario, { perfil = {}, respostas = {} } = {}) {
  const temas = new Map();
  let soma = 0;
  let maximo = 0;

  for (const pergunta of questionario.perguntas ?? []) {
    if (!perguntaAplicavel(pergunta, { perfil, respostas })) continue;
    const pontos = pontosDaPergunta(pergunta, respostas[pergunta.id]);
    if (pontos === null) continue;
    const maximoPergunta = maximoDaPergunta(pergunta);
    if (maximoPergunta <= 0) continue;

    soma += pontos;
    maximo += maximoPergunta;
    const tema = temas.get(pergunta.tema) ?? { soma: 0, maximo: 0 };
    tema.soma += pontos;
    tema.maximo += maximoPergunta;
    temas.set(pergunta.tema, tema);
  }

  const indice = maximo > 0 ? Math.round((soma / maximo) * 100) : 0;
  return {
    indice,
    semaforo: semaforoDoIndice(indice),
    porTema: [...temas].map(([tema, dados]) => {
      const indiceTema = dados.maximo > 0 ? Math.round((dados.soma / dados.maximo) * 100) : 0;
      return { tema, indice: indiceTema, semaforo: semaforoDoIndice(indiceTema) };
    }),
  };
}
