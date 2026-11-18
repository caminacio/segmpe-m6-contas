/**
 * Telas do módulo (CONTRATO.md, seção 12): perfil, questionário, revisão,
 * gerando, relatório e exportar.
 *
 * Regras que valem para todos os módulos:
 * - só classes e utilidades do design system (ds/), sem CSS próprio;
 * - o Markdown da IA entra na tela por renderizarMarkdown(), nunca por innerHTML;
 * - arquivos estáticos com caminho relativo; chamadas à API em /api/<id>/…;
 * - nada de nome de empresa, CNPJ, site ou nome de pessoa: só o codinome.
 */

import {
  obterPerfil,
  importarPerfil,
  renderizarMarkdown,
  semaforoDoIndice,
  criarSeloSemaforo,
  baixarJSON,
  imprimir,
  anunciar,
  animarIndice,
  iniciarVarredura,
  pararVarredura,
} from "./ds/segmpe.js";

const ID = document.body.dataset.modulo;
const API = `/api/${ID}`;

const estado = { perfil: null, questionario: null, respostas: {}, saida: null };

/* ---------------------------------------------------------------- */
/* Pequenos ajudantes                                                */
/* ---------------------------------------------------------------- */

const $ = (seletor) => document.querySelector(seletor);

function el(tag, { classe, texto, atributos } = {}, filhos = []) {
  const no = document.createElement(tag);
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  for (const [chave, valor] of Object.entries(atributos ?? {})) {
    if (valor === true) no.setAttribute(chave, "");
    else if (valor !== false && valor !== null && valor !== undefined) no.setAttribute(chave, String(valor));
  }
  for (const filho of filhos) if (filho) no.appendChild(filho);
  return no;
}

function limpar(no) {
  while (no.firstChild) no.removeChild(no.firstChild);
}

const TELAS = ["tela-perfil", "tela-questionario", "tela-revisao", "tela-gerando", "tela-relatorio", "tela-exportar"];

function mostrar(idDaTela) {
  for (const tela of TELAS) $(`#${tela}`).hidden = tela !== idDaTela;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function aviso(destino, tipo, mensagem) {
  const papel = tipo === "erro" ? "alert" : tipo === "sucesso" ? "status" : "note";
  limpar(destino);
  destino.appendChild(el("div", { classe: `seg-aviso seg-aviso--${tipo}`, texto: mensagem, atributos: { role: papel } }));
}

/** Mesma regra de src/pontuacao.js: a pergunta aparece para este perfil/respostas? */
function aplicavel(pergunta) {
  const condicao = pergunta.condicao;
  if (!condicao) return true;
  const valor = condicao.perfil ? estado.perfil?.[condicao.perfil] : estado.respostas?.[condicao.pergunta];
  const alvos = Array.isArray(condicao.em) ? condicao.em : condicao.igual === undefined ? [] : [condicao.igual];
  if (alvos.length === 0) return true;
  if (Array.isArray(valor)) return valor.some((v) => alvos.includes(v));
  return alvos.includes(valor);
}

function respondida(pergunta) {
  const r = estado.respostas[pergunta.id];
  if (r === undefined || r === null || r === "") return false;
  return !(Array.isArray(r) && r.length === 0);
}

function rotuloDaResposta(pergunta, resposta) {
  if (resposta === undefined || resposta === null || resposta === "" || (Array.isArray(resposta) && resposta.length === 0)) {
    return "(sem resposta)";
  }
  if (pergunta.tipo === "texto_curto") return String(resposta);
  const valores = Array.isArray(resposta) ? resposta : [resposta];
  return valores
    .map((v) => (pergunta.opcoes ?? []).find((o) => String(o.valor) === String(v))?.rotulo ?? String(v))
    .join("; ");
}

/* ---------------------------------------------------------------- */
/* 1. Perfil                                                         */
/* ---------------------------------------------------------------- */

const RAMOS = {
  comercio_varejista: "Comércio varejista",
  alimentacao: "Alimentação",
  beleza_estetica: "Beleza e estética",
  saude: "Saúde",
  servicos_profissionais: "Serviços profissionais",
  educacao: "Educação",
  industria_confeccao: "Indústria ou confecção",
  servicos_tecnicos: "Serviços técnicos",
  comercio_online: "Comércio on-line",
  outro: "Outro",
};
const PORTES = { mei: "MEI", me: "Microempresa", epp: "Empresa de pequeno porte" };

function mostrarPerfil() {
  const estadoPerfil = $("#perfil-estado");
  const resumo = $("#perfil-resumo");
  const botao = $("#btn-comecar");

  if (!estado.perfil) {
    aviso(estadoPerfil, "alerta", "Nenhum perfil encontrado nesta sessão. Abra o módulo pela suíte ou importe o arquivo perfil.json abaixo.");
    resumo.hidden = true;
    botao.disabled = true;
    return;
  }

  aviso(estadoPerfil, "sucesso", `Perfil carregado: ${estado.perfil.codinome}. As perguntas do perfil não serão repetidas.`);
  limpar(resumo);
  const linhas = [
    ["Codinome", estado.perfil.codinome],
    ["Ramo", estado.perfil.P01_ramo === "outro" ? String(estado.perfil.P01_outro ?? "Outro") : (RAMOS[estado.perfil.P01_ramo] ?? estado.perfil.P01_ramo)],
    ["Porte", PORTES[estado.perfil.P02_porte] ?? estado.perfil.P02_porte],
    ["Estado", estado.perfil.P05_uf],
  ];
  for (const [rotulo, valor] of linhas) {
    resumo.appendChild(el("dt", { texto: rotulo }));
    resumo.appendChild(el("dd", { texto: String(valor ?? "") }));
  }
  resumo.hidden = false;
  botao.disabled = false;
}

async function aoEscolherArquivo(evento) {
  const arquivo = evento.target.files?.[0];
  if (!arquivo) return;
  try {
    estado.perfil = await importarPerfil(arquivo);
    atualizarVisibilidade();
    mostrarPerfil();
    anunciar(`Perfil ${estado.perfil.codinome} importado.`);
  } catch (erro) {
    aviso($("#perfil-estado"), "erro", `Não foi possível importar o perfil: ${erro.message}`);
  }
}

/* ---------------------------------------------------------------- */
/* 2. Questionário                                                   */
/* ---------------------------------------------------------------- */

function campoDeTexto(pergunta) {
  const idCampo = `campo-${pergunta.id}`;
  const ajuda = el("span", { classe: "seg-ajuda-texto", texto: pergunta.ajuda ?? "", atributos: { id: `${idCampo}-ajuda` } });
  const area = el("textarea", {
    classe: "seg-entrada",
    atributos: { id: idCampo, maxlength: 280, rows: 3, "aria-describedby": `${idCampo}-ajuda` },
  });
  const contador = el("span", { classe: "seg-contador", texto: "0 / 280" });
  area.addEventListener("input", () => {
    estado.respostas[pergunta.id] = area.value;
    contador.textContent = `${area.value.length} / 280`;
    atualizarProgresso();
  });
  return el("div", { classe: "seg-campo", atributos: { "data-pergunta": pergunta.id } }, [
    el("label", { classe: "seg-rotulo", texto: pergunta.texto, atributos: { for: idCampo } }),
    ajuda,
    area,
    contador,
  ]);
}

function perguntaFechada(pergunta, numero, total) {
  const multipla = pergunta.tipo === "multipla";
  const escala = pergunta.tipo === "escala_1_5";
  const opcoes = el("div", { classe: escala ? "seg-escala" : "seg-opcoes" });

  for (const opcao of pergunta.opcoes ?? []) {
    const entrada = el("input", {
      atributos: {
        type: multipla ? "checkbox" : "radio",
        name: pergunta.id,
        value: opcao.valor,
      },
    });
    entrada.addEventListener("change", () => {
      if (multipla) {
        const marcadas = [...opcoes.querySelectorAll("input:checked")].map((e) => e.value);
        // "nenhum" não combina com outras opções (CONTRATO.md, seção 6).
        const soAgoraNenhum = entrada.checked && entrada.value === "nenhum";
        const finais = soAgoraNenhum ? ["nenhum"] : marcadas.filter((v) => v !== "nenhum" || marcadas.length === 1);
        for (const caixa of opcoes.querySelectorAll("input")) caixa.checked = finais.includes(caixa.value);
        estado.respostas[pergunta.id] = finais;
      } else {
        estado.respostas[pergunta.id] = entrada.value;
      }
      atualizarVisibilidade();
    });

    const classe = ["seg-opcao", opcao.valor === "nao_sei" ? "seg-opcao--nao-sei" : ""].filter(Boolean).join(" ");
    const rotulo = el("label", { classe }, [entrada]);
    rotulo.appendChild(document.createTextNode(` ${opcao.rotulo}`));
    opcoes.appendChild(rotulo);
  }

  const partes = [
    el("span", { classe: "seg-pergunta__numero", texto: `Pergunta ${numero} de ${total}` }),
    el("legend", { classe: "seg-pergunta__texto", texto: pergunta.texto }),
    opcoes,
  ];

  if (escala && pergunta.legenda) {
    partes.push(
      el("div", { classe: "seg-escala__legenda" }, [
        el("span", { texto: String(pergunta.legenda.minimo ?? "1") }),
        el("span", { texto: String(pergunta.legenda.maximo ?? "5") }),
      ]),
    );
  }
  if (multipla) {
    partes.push(el("span", { classe: "seg-ajuda-texto", texto: "Pode marcar mais de uma." }));
  }
  if (pergunta.ajuda) {
    partes.push(
      el("details", { classe: "seg-ajuda" }, [
        el("summary", { texto: "O que isso quer dizer?" }),
        el("div", { classe: "seg-ajuda__corpo", texto: pergunta.ajuda }),
      ]),
    );
  }

  return el("fieldset", { classe: "seg-pergunta", atributos: { "data-pergunta": pergunta.id } }, partes);
}

function montarQuestionario() {
  const destino = $("#blocos-perguntas");
  limpar(destino);
  const perguntas = estado.questionario.perguntas ?? [];
  const porTema = new Map();
  for (const pergunta of perguntas) {
    if (!porTema.has(pergunta.tema)) porTema.set(pergunta.tema, []);
    porTema.get(pergunta.tema).push(pergunta);
  }

  let numero = 0;
  for (const [tema, doTema] of porTema) {
    const cartao = el("div", { classe: "seg-cartao" }, [
      el("span", { classe: "seg-cartao__rotulo", texto: tema }),
    ]);
    for (const pergunta of doTema) {
      numero += 1;
      cartao.appendChild(
        pergunta.tipo === "texto_curto" ? campoDeTexto(pergunta) : perguntaFechada(pergunta, numero, perguntas.length),
      );
    }
    destino.appendChild(cartao);
  }
  atualizarVisibilidade();
}

/** Esconde as perguntas que não se aplicam a este perfil e apaga as respostas delas. */
function atualizarVisibilidade() {
  if (!estado.questionario) return;
  for (const pergunta of estado.questionario.perguntas ?? []) {
    const bloco = document.querySelector(`[data-pergunta="${pergunta.id}"]`);
    if (!bloco) continue;
    const visivel = aplicavel(pergunta);
    bloco.hidden = !visivel;
    if (!visivel && pergunta.id in estado.respostas) {
      delete estado.respostas[pergunta.id];
      for (const entrada of bloco.querySelectorAll("input")) entrada.checked = false;
      const area = bloco.querySelector("textarea");
      if (area) area.value = "";
    }
  }
  atualizarProgresso();
}

function atualizarProgresso() {
  const aplicaveis = (estado.questionario?.perguntas ?? []).filter(aplicavel);
  const obrigatorias = aplicaveis.filter((p) => p.obrigatoria);
  const feitas = aplicaveis.filter(respondida);
  const faltando = obrigatorias.filter((p) => !respondida(p));

  $("#progresso").max = Math.max(aplicaveis.length, 1);
  $("#progresso").value = feitas.length;
  $("#progresso-texto").textContent = `${feitas.length} de ${aplicaveis.length}`;
  $("#info-questionario").textContent =
    faltando.length === 0
      ? "Todas as perguntas obrigatórias estão respondidas."
      : `Faltam ${faltando.length} ${faltando.length === 1 ? "pergunta obrigatória" : "perguntas obrigatórias"}.`;
  $("#btn-revisar").disabled = faltando.length > 0;
}

/* ---------------------------------------------------------------- */
/* 3. Revisão                                                        */
/* ---------------------------------------------------------------- */

function montarRevisao() {
  const corpo = $("#revisao-corpo");
  limpar(corpo);
  for (const pergunta of (estado.questionario.perguntas ?? []).filter(aplicavel)) {
    corpo.appendChild(
      el("tr", {}, [
        el("td", { texto: pergunta.texto }),
        el("td", { texto: rotuloDaResposta(pergunta, estado.respostas[pergunta.id]) }),
      ]),
    );
  }
  mostrar("tela-revisao");
}

/* ---------------------------------------------------------------- */
/* 4 e 5. Gerar e mostrar o relatório                                */
/* ---------------------------------------------------------------- */

async function gerar() {
  limpar($("#mensagem-revisao"));
  limpar($("#mensagem-relatorio"));
  mostrar("tela-gerando");
  // Varredura no cartão enquanto a IA trabalha (desliga sozinha com "reduzir movimento").
  iniciarVarredura($("#cartao-gerando"), "Gerando o relatório. Isso leva alguns segundos.");
  let resposta;
  let dados;
  try {
    resposta = await fetch(`${API}/gerar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perfil: estado.perfil, respostas: estado.respostas }),
    });
    dados = await resposta.json();
  } catch {
    pararVarredura($("#cartao-gerando"));
    mostrar("tela-revisao");
    aviso($("#mensagem-revisao"), "erro", "Não foi possível falar com o módulo. Confirme se ele está no ar e tente de novo.");
    return;
  }
  pararVarredura($("#cartao-gerando"));

  if (resposta.ok) {
    estado.saida = dados;
    montarRelatorio(dados);
    $("#btn-baixar-saida").disabled = false;
    mostrar("tela-relatorio");
    anunciar("Relatório pronto.");
    return;
  }

  // 501: o módulo ainda não implementou a geração — a pontuação do código já funciona.
  if (resposta.status === 501 && dados?.pontuacao) {
    mostrarBlocosDaIA(false);
    montarPontuacao(dados.pontuacao);
    $("#relatorio-titulo").textContent = `${ID} · pontuação`;
    $("#relatorio-codinome").textContent = estado.perfil.codinome;
    $("#relatorio-data").textContent = new Date().toLocaleDateString("pt-BR");
    aviso($("#mensagem-relatorio"), "alerta", `${dados.erro} A pontuação abaixo foi calculada pelo código, sem IA.`);
    mostrar("tela-relatorio");
    return;
  }

  mostrar("tela-revisao");
  const detalhes = Array.isArray(dados?.detalhes) && dados.detalhes.length > 0 ? ` ${dados.detalhes[0]}` : "";
  aviso($("#mensagem-revisao"), "erro", `${dados?.erro ?? "Não foi possível gerar o relatório."}${detalhes}`);
}

/** Esconde as partes que só existem quando a IA responde (útil enquanto /gerar devolve 501). */
function mostrarBlocosDaIA(visivel) {
  for (const id of ["bloco-resumo", "bloco-fortes", "bloco-atencao", "bloco-plano", "relatorio-artefatos"]) {
    $(`#${id}`).hidden = !visivel;
  }
  $("#relatorio-aviso").hidden = !visivel;
}

function montarPontuacao(pontuacao) {
  const indice = Number(pontuacao?.indice ?? 0);
  const semaforo = pontuacao?.semaforo ?? semaforoDoIndice(indice);
  // O anel enche até o índice, com a cor do semáforo (o número final fica no aria-label).
  animarIndice($("#indice-anel"), indice);

  const selo = $("#indice-selo");
  limpar(selo);
  selo.appendChild(criarSeloSemaforo(document, semaforo));
  selo.appendChild(el("p", { classe: "seg-ajuda-texto", texto: "Índice geral do módulo, calculado pelo código." }));

  const temas = $("#relatorio-temas");
  limpar(temas);
  for (const tema of pontuacao?.porTema ?? []) {
    temas.appendChild(
      el("li", {}, [
        el("span", { texto: tema.tema }),
        criarSeloSemaforo(document, tema.semaforo, String(tema.indice)),
      ]),
    );
  }
}

function montarRelatorio(saida) {
  mostrarBlocosDaIA(true);
  $("#relatorio-titulo").textContent = String(saida.modulo ?? ID);
  $("#relatorio-codinome").textContent = String(saida.codinome ?? estado.perfil.codinome);
  $("#relatorio-data").textContent = saida.geradoEm
    ? new Date(saida.geradoEm).toLocaleString("pt-BR")
    : new Date().toLocaleString("pt-BR");

  // Texto da IA: sempre por renderizarMarkdown (nunca innerHTML).
  renderizarMarkdown($("#relatorio-resumo"), String(saida.resumoParaODono ?? ""));
  montarPontuacao(saida.pontuacao);

  const fortes = $("#relatorio-fortes");
  limpar(fortes);
  for (const item of saida.pontosFortes ?? []) fortes.appendChild(el("li", { texto: String(item) }));

  const atencao = $("#relatorio-atencao");
  limpar(atencao);
  for (const item of saida.pontosDeAtencao ?? []) {
    atencao.appendChild(
      el("div", { classe: "seg-pilha" }, [
        el("h4", {}, [
          el("span", { texto: `${item.titulo} ` }),
          criarSeloSemaforo(
            document,
            item.risco === "alto" ? "vermelho" : item.risco === "medio" ? "amarelo" : "verde",
            `risco ${item.risco}`,
          ),
        ]),
        el("p", { texto: String(item.explicacao ?? "") }),
      ]),
    );
  }

  const plano = $("#relatorio-plano");
  limpar(plano);
  for (const item of saida.planoDeAcao ?? []) {
    plano.appendChild(
      el("tr", {}, [
        el("td", { texto: String(item.prioridade ?? "") }),
        el("td", { texto: String(item.acao ?? "") }),
        el("td", { texto: String(item.porque ?? "") }),
        el("td", { texto: String(item.esforco ?? "") }),
        el("td", { texto: String(item.custo ?? "") }),
        el("td", { texto: String(item.prazo ?? "") }),
      ]),
    );
  }

  const artefatos = $("#relatorio-artefatos");
  limpar(artefatos);
  for (const artefato of saida.artefatos ?? []) {
    const corpo = el("div");
    renderizarMarkdown(corpo, String(artefato.conteudoMarkdown ?? ""));
    artefatos.appendChild(
      el("section", { classe: "seg-artefato" }, [
        el("h3", { texto: String(artefato.titulo ?? artefato.id) }),
        corpo,
      ]),
    );
  }

  if (saida.avisoLegal) $("#relatorio-aviso").textContent = String(saida.avisoLegal);
}

/* ---------------------------------------------------------------- */
/* 6. Exportar                                                       */
/* ---------------------------------------------------------------- */

function baixarRespostas() {
  baixarJSON(`${ID}-respostas-${estado.perfil.codinome}.json`, {
    modulo: ID,
    codinome: estado.perfil.codinome,
    perfil: estado.perfil,
    respostas: estado.respostas,
    exportadoEm: new Date().toISOString(),
  });
}

/* ---------------------------------------------------------------- */
/* Início                                                            */
/* ---------------------------------------------------------------- */

async function iniciar() {
  $("#topo-modulo").textContent = ID;
  $("#rodape-modulo").textContent = ID;

  estado.perfil = obterPerfil();
  mostrarPerfil();

  $("#arquivo-perfil").addEventListener("change", aoEscolherArquivo);
  $("#btn-comecar").addEventListener("click", () => mostrar("tela-questionario"));
  $("#btn-voltar-perfil").addEventListener("click", () => mostrar("tela-perfil"));
  $("#btn-revisar").addEventListener("click", montarRevisao);
  $("#btn-voltar-questionario").addEventListener("click", () => mostrar("tela-questionario"));
  $("#btn-gerar").addEventListener("click", gerar);
  $("#btn-imprimir").addEventListener("click", imprimir);
  $("#btn-ir-exportar").addEventListener("click", () => mostrar("tela-exportar"));
  $("#btn-voltar-relatorio").addEventListener("click", () => mostrar("tela-relatorio"));
  $("#btn-baixar-respostas").addEventListener("click", baixarRespostas);
  $("#btn-baixar-saida").addEventListener("click", () => {
    if (estado.saida) baixarJSON(`${ID}-relatorio-${estado.perfil.codinome}.json`, estado.saida);
  });

  try {
    const resposta = await fetch(`${API}/questionario`);
    if (!resposta.ok) throw new Error("resposta inesperada");
    estado.questionario = await resposta.json();
    montarQuestionario();
  } catch {
    aviso($("#perfil-estado"), "erro", "Não foi possível carregar o questionário. Confirme se o módulo está no ar (npm start).");
    $("#btn-comecar").disabled = true;
  }
}

iniciar();
