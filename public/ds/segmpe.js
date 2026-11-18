// SegMPE · Design System · segmpe.js · v1.1.0
// Utilidades comuns a todos os módulos. ES Module, sem dependências externas.
// Não edite dentro dos módulos: peça mudanças ao curador.
// 1.1.0: mesmas funções da 1.0 + movimento do "centro de operações"
//        (animarIndice, criarAnelIndice, iniciarVarredura, pararVarredura,
//         revelarPaineis, ativarInclinacao, movimentoReduzido).

export const VERSAO = "1.1.0";
const CHAVE_PERFIL = "segmpe.perfil";
const CHAVE_SUITE = "segmpe.suite";

/* ------------------------------------------------------------------ */
/* Perfil comum                                                        */
/* ------------------------------------------------------------------ */
const PERFIL_VALORES = {
  P01_ramo: ["comercio_varejista", "alimentacao", "beleza_estetica", "saude", "servicos_profissionais", "educacao", "industria_confeccao", "servicos_tecnicos", "comercio_online", "outro"],
  P02_porte: ["mei", "me", "epp"],
  P03_pessoas: ["1", "2-5", "6-10", "11-20", "21-49"],
  P04_tempo: ["menos_de_1", "1-3", "4-10", "mais_de_10"],
  P06_canais: ["loja_fisica", "whatsapp", "instagram", "site_proprio", "marketplace", "telefone", "apps_delivery"],
  P07_pagamentos: ["dinheiro", "pix", "cartao_maquininha", "boleto", "link_pagamento", "crediario"],
  P08_dados: ["nenhum", "contato", "cpf", "endereco", "saude", "financeiros"],
  P09_equipamentos: ["computador", "notebook", "celular_empresa", "celular_pessoal", "tablet"],
  P10_sistemas: ["sistema_gestao", "planilhas", "email_nuvem", "sistema_contador", "agenda_online", "nenhum"],
  P11_site: ["sim", "nao"],
  P12_ti: ["dono", "funcionario", "terceirizado", "ninguem"],
  P13_incidente: ["sim", "nao", "nao_sei"],
};
const MULTIPLAS = ["P06_canais", "P07_pagamentos", "P08_dados", "P09_equipamentos", "P10_sistemas"];
const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

/** Valida o perfil comum. Devolve a lista de erros (vazia quando está tudo certo). */
export function validarPerfil(p) {
  const erros = [];
  if (!p || typeof p !== "object" || Array.isArray(p)) return ["O perfil precisa ser um objeto JSON."];
  if (!/^EP-\d{2}$/.test(p.codinome ?? "")) erros.push("codinome: use o formato EP-01, EP-02…");
  if (!UFS.includes(p.P05_uf)) erros.push("P05_uf: informe a sigla do estado (ex.: DF).");
  for (const [campo, valores] of Object.entries(PERFIL_VALORES)) {
    const v = p[campo];
    if (MULTIPLAS.includes(campo)) {
      if (!Array.isArray(v) || v.length === 0) { erros.push(`${campo}: escolha pelo menos uma opção.`); continue; }
      const invalidos = v.filter((x) => !valores.includes(x));
      if (invalidos.length) erros.push(`${campo}: valor desconhecido (${invalidos.join(", ")}).`);
      if (v.includes("nenhum") && v.length > 1) erros.push(`${campo}: "nenhum" não combina com outras opções.`);
    } else if (!valores.includes(v)) {
      erros.push(`${campo}: valor ausente ou desconhecido.`);
    }
  }
  if (p.P01_ramo === "outro" && !(typeof p.P01_outro === "string" && p.P01_outro.trim() && p.P01_outro.length <= 60))
    erros.push("P01_outro: descreva o ramo em até 60 caracteres.");
  const permitidos = new Set(["codinome", "P05_uf", "P01_outro", ...Object.keys(PERFIL_VALORES)]);
  const extras = Object.keys(p).filter((k) => !permitidos.has(k));
  if (extras.length) erros.push(`Campos não previstos no perfil: ${extras.join(", ")}.`);
  return erros;
}

/** Lê o perfil gravado pela suíte (sessionStorage). Devolve o objeto ou null. */
export function obterPerfil() {
  try {
    const bruto = globalThis.sessionStorage?.getItem(CHAVE_PERFIL);
    if (!bruto) return null;
    const p = JSON.parse(bruto);
    return validarPerfil(p).length ? null : p;
  } catch { return null; }
}

/** Grava o perfil na sessão (usado pela suíte e pela importação). Lança Error se for inválido. */
export function gravarPerfil(p) {
  const erros = validarPerfil(p);
  if (erros.length) throw new Error("Perfil inválido: " + erros.join(" "));
  globalThis.sessionStorage?.setItem(CHAVE_PERFIL, JSON.stringify(p));
  return p;
}

/** Importa um arquivo perfil.json escolhido num <input type="file">. */
export async function importarPerfil(arquivo) {
  if (!arquivo) throw new Error("Nenhum arquivo escolhido.");
  if (arquivo.size > 20 * 1024) throw new Error("Arquivo grande demais para um perfil.");
  let p;
  try { p = JSON.parse(await arquivo.text()); } catch { throw new Error("O arquivo não é um JSON válido."); }
  return gravarPerfil(p);
}

/* ------------------------------------------------------------------ */
/* Markdown seguro                                                     */
/* Subconjunto: títulos, parágrafos, listas (inclui [ ] e [x]),        */
/* negrito, itálico, código, blocos de código, citações, tabelas GFM,  */
/* linha horizontal. Links viram texto com o endereço entre parênteses.*/
/* Nada de HTML: o texto só entra no DOM por textContent.              */
/* ------------------------------------------------------------------ */

/** Converte texto inline em uma lista de nós { t: "texto"|"forte"|"enfase"|"codigo", v }. */
export function interpretarInline(texto) {
  const nos = [];
  const s = String(texto).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)");
  const re = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let ultimo = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > ultimo) nos.push({ t: "texto", v: s.slice(ultimo, m.index) });
    const tok = m[0];
    if (tok.startsWith("`")) nos.push({ t: "codigo", v: tok.slice(1, -1) });
    else if (tok.startsWith("**") || tok.startsWith("__")) nos.push({ t: "forte", v: tok.slice(2, -2) });
    else nos.push({ t: "enfase", v: tok.slice(1, -1) });
    ultimo = m.index + tok.length;
  }
  if (ultimo < s.length) nos.push({ t: "texto", v: s.slice(ultimo) });
  return nos;
}

const celulas = (linha) => linha.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

/** Converte Markdown em uma árvore de blocos (função pura, testável sem navegador). */
export function interpretarMarkdown(texto) {
  const linhas = String(texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocos = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    if (/^```/.test(l)) {
      const corpo = []; i++;
      while (i < linhas.length && !/^```/.test(linhas[i])) corpo.push(linhas[i++]);
      i++; blocos.push({ t: "codigo", v: corpo.join("\n") }); continue;
    }
    const h = l.match(/^(#{1,4})\s+(.*)$/);
    if (h) { blocos.push({ t: "titulo", nivel: h[1].length, v: interpretarInline(h[2]) }); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { blocos.push({ t: "linha" }); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < linhas.length && /^\s*\|?\s*:?-{3,}/.test(linhas[i + 1])) {
      const cab = celulas(l); i += 2; const corpo = [];
      while (i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i])) corpo.push(celulas(linhas[i++]));
      blocos.push({ t: "tabela", cabecalho: cab.map(interpretarInline), linhas: corpo.map((r) => r.map(interpretarInline)) });
      continue;
    }
    if (/^>\s?/.test(l)) {
      const corpo = [];
      while (i < linhas.length && /^>\s?/.test(linhas[i])) corpo.push(linhas[i++].replace(/^>\s?/, ""));
      blocos.push({ t: "citacao", v: interpretarInline(corpo.join(" ")) }); continue;
    }
    const lista = l.match(/^\s*([-*+]|\d+[.)])\s+/);
    if (lista) {
      const ordenada = /\d/.test(lista[1]); const itens = [];
      while (i < linhas.length) {
        const m = linhas[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (!m) { if (linhas[i].trim() && itens.length && /^\s{2,}\S/.test(linhas[i])) { itens[itens.length - 1].texto += " " + linhas[i].trim(); i++; continue; } break; }
        let txt = m[2], marca = null;
        const c = txt.match(/^\[( |x|X)\]\s+(.*)$/);
        if (c) { marca = c[1].toLowerCase() === "x"; txt = c[2]; }
        itens.push({ texto: txt, marca }); i++;
      }
      blocos.push({ t: ordenada ? "lista-numerada" : "lista", itens: itens.map((it) => ({ marca: it.marca, v: interpretarInline(it.texto) })) });
      continue;
    }
    const par = [];
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,4}\s|```|>|\s*([-*+]|\d+[.)])\s)/.test(linhas[i]) && !/^\s*\|.*\|\s*$/.test(linhas[i])) par.push(linhas[i++].trim());
    if (par.length) blocos.push({ t: "paragrafo", v: interpretarInline(par.join(" ")) });
    else { blocos.push({ t: "paragrafo", v: interpretarInline(l.trim()) }); i++; }
  }
  return blocos;
}

function preencherInline(doc, pai, nos) {
  for (const n of nos) {
    if (n.t === "texto") { pai.appendChild(doc.createTextNode(n.v)); continue; }
    const el = doc.createElement(n.t === "forte" ? "strong" : n.t === "enfase" ? "em" : "code");
    el.textContent = n.v; pai.appendChild(el);
  }
}

/** Renderiza Markdown no elemento, de forma segura (sem innerHTML). */
export function renderizarMarkdown(elemento, texto) {
  const doc = elemento.ownerDocument;
  elemento.replaceChildren();
  for (const b of interpretarMarkdown(texto)) {
    let el;
    if (b.t === "titulo") { el = doc.createElement("h" + Math.min(b.nivel + 1, 4)); preencherInline(doc, el, b.v); }
    else if (b.t === "paragrafo") { el = doc.createElement("p"); preencherInline(doc, el, b.v); }
    else if (b.t === "codigo") { el = doc.createElement("pre"); const c = doc.createElement("code"); c.textContent = b.v; el.appendChild(c); }
    else if (b.t === "citacao") { el = doc.createElement("blockquote"); preencherInline(doc, el, b.v); }
    else if (b.t === "linha") { el = doc.createElement("hr"); }
    else if (b.t === "lista" || b.t === "lista-numerada") {
      el = doc.createElement(b.t === "lista" ? "ul" : "ol");
      for (const it of b.itens) {
        const li = doc.createElement("li");
        if (it.marca !== null) li.appendChild(doc.createTextNode(it.marca ? "☑ " : "☐ "));
        preencherInline(doc, li, it.v); el.appendChild(li);
      }
    } else if (b.t === "tabela") {
      el = doc.createElement("table");
      const thead = doc.createElement("thead"), tr = doc.createElement("tr");
      for (const c of b.cabecalho) { const th = doc.createElement("th"); th.scope = "col"; preencherInline(doc, th, c); tr.appendChild(th); }
      thead.appendChild(tr); el.appendChild(thead);
      const tbody = doc.createElement("tbody");
      for (const linha of b.linhas) {
        const r = doc.createElement("tr");
        for (const c of linha) { const td = doc.createElement("td"); preencherInline(doc, td, c); r.appendChild(td); }
        tbody.appendChild(r);
      }
      el.appendChild(tbody);
    }
    if (el) elemento.appendChild(el);
  }
  return elemento;
}

/* ------------------------------------------------------------------ */
/* Semáforo, arquivos, impressão, acessibilidade                       */
/* ------------------------------------------------------------------ */
const ROTULOS = { verde: "Verde · adequado", amarelo: "Amarelo · atenção", vermelho: "Vermelho · prioridade" };

export function classeSemaforo(semaforo) {
  return ["verde", "amarelo", "vermelho"].includes(semaforo) ? `seg-semaforo seg-semaforo--${semaforo}` : "seg-semaforo";
}

/** Semáforo a partir do índice (mesma regra do contrato: ≥70 verde, 40–69 amarelo, <40 vermelho). */
export function semaforoDoIndice(indice) {
  return indice >= 70 ? "verde" : indice >= 40 ? "amarelo" : "vermelho";
}

/** Cria o selo do semáforo, sempre com texto (não depende só da cor). */
export function criarSeloSemaforo(doc, semaforo, texto) {
  const s = doc.createElement("span");
  s.className = classeSemaforo(semaforo);
  s.textContent = texto ?? ROTULOS[semaforo] ?? semaforo;
  return s;
}

export function baixarJSON(nomeArquivo, objeto) {
  const blob = new Blob([JSON.stringify(objeto, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomeArquivo; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function imprimir() { window.print(); }

/** Anuncia uma mensagem para leitores de tela (ex.: "Gerando o relatório…"). */
export function anunciar(mensagem) {
  let r = document.getElementById("seg-anuncio");
  if (!r) {
    r = document.createElement("div");
    r.id = "seg-anuncio"; r.className = "seg-visualmente-oculto";
    r.setAttribute("role", "status"); r.setAttribute("aria-live", "polite");
    document.body.appendChild(r);
  }
  r.textContent = ""; setTimeout(() => { r.textContent = mensagem; }, 50);
}

/* ------------------------------------------------------------------ */
/* Movimento (1.1) — sempre comunica um estado; respeita quem pede     */
/* menos movimento (prefers-reduced-motion) e nunca esconde conteúdo.  */
/* ------------------------------------------------------------------ */

/** true quando o sistema pede menos movimento (ou fora do navegador). */
export function movimentoReduzido() {
  try { return !globalThis.matchMedia || globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return true; }
}

const limitar = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const suavizar = (t) => 1 - Math.pow(2, -10 * t);   // expo-out, igual a --seg-ease

/**
 * Anima um índice de 0 até `valor` (0–100): o número sobe e, se o elemento for
 * um .seg-anel, o anel enche e ganha a cor do semáforo. Devolve uma Promise.
 * Aceita o .seg-anel, o .seg-indice__numero ou qualquer elemento com texto.
 */
export function animarIndice(elemento, valor, { duracao = 900 } = {}) {
  const alvo = limitar(valor);
  const anel = elemento?.classList?.contains("seg-anel") ? elemento : null;
  const saida = anel?.querySelector?.(".seg-anel__num") ?? elemento?.querySelector?.(".seg-anel__num") ?? elemento;
  const pintar = (v) => {
    if (saida) saida.textContent = String(v);
    if (anel) anel.style.setProperty("--seg-p", String(v));
  };
  if (anel) {
    for (const c of ["verde", "amarelo", "vermelho"]) anel.classList.remove(`seg-anel--${c}`);
    anel.classList.add(`seg-anel--${semaforoDoIndice(alvo)}`);
    anel.setAttribute("role", "img");
    anel.setAttribute("aria-label", `Índice ${alvo} de 100 — ${ROTULOS[semaforoDoIndice(alvo)]}`);
  }
  if (movimentoReduzido() || typeof requestAnimationFrame !== "function" || duracao <= 0) { pintar(alvo); return Promise.resolve(alvo); }
  return new Promise((resolve) => {
    const inicio = performance.now();
    const passo = (agora) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      pintar(Math.round(alvo * suavizar(t)));
      if (t < 1) requestAnimationFrame(passo); else { pintar(alvo); resolve(alvo); }
    };
    requestAnimationFrame(passo);
  });
}

/** Cria um anel do índice pronto para inserir: <div class="seg-anel"><span class="seg-anel__valor">…</span></div>. */
export function criarAnelIndice(doc, valor, { rotulo = "índice", pequeno = false } = {}) {
  const anel = doc.createElement("div");
  anel.className = "seg-anel" + (pequeno ? " seg-anel--pequeno" : "");
  const v = doc.createElement("span"); v.className = "seg-anel__valor";
  const n = doc.createElement("span"); n.className = "seg-anel__num"; n.textContent = "0";
  const s = doc.createElement("small"); s.textContent = rotulo;
  v.appendChild(n); v.appendChild(s); anel.appendChild(v);
  if (valor !== undefined) { const a = limitar(valor); n.textContent = String(a); anel.style?.setProperty?.("--seg-p", String(a)); anel.classList.add(`seg-anel--${semaforoDoIndice(a)}`); }
  return anel;
}

/** Liga a varredura (ex.: enquanto a IA gera o relatório) e marca aria-busy. */
export function iniciarVarredura(elemento, mensagem) {
  if (!elemento) return;
  elemento.classList.add("seg-varredura");
  elemento.setAttribute("aria-busy", "true");
  if (mensagem) anunciar(mensagem);
}

/** Desliga a varredura. */
export function pararVarredura(elemento, mensagem) {
  if (!elemento) return;
  elemento.classList.remove("seg-varredura");
  elemento.setAttribute("aria-busy", "false");
  if (mensagem) anunciar(mensagem);
}

/**
 * Painéis com a classe .seg-revelar "abrem" quando entram na tela.
 * O conteúdo já está visível antes disso; a animação só marca a chegada.
 * Para escalonar uma lista, use style="--i: 0", "--i: 1"… Devolve uma função para desligar.
 */
export function revelarPaineis(raiz = globalThis.document) {
  if (!raiz?.querySelectorAll) return () => {};
  const itens = [...raiz.querySelectorAll(".seg-revelar:not(.seg-revelado)")];
  if (movimentoReduzido() || typeof IntersectionObserver !== "function") { itens.forEach((el) => el.classList.add("seg-revelado")); return () => {}; }
  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) if (e.isIntersecting) { e.target.classList.add("seg-revelado"); obs.unobserve(e.target); }
  }, { threshold: 0.15 });
  itens.forEach((el) => obs.observe(el));
  return () => obs.disconnect();
}

/**
 * Inclinação holográfica: o painel acompanha o mouse (até `maximo` graus) e ganha
 * um reflexo de luz. Só com mouse de verdade e sem pedido de menos movimento.
 * Pensado para a casca da suíte — não use em formulários. Devolve uma função para desligar.
 */
export function ativarInclinacao(elemento, { maximo = 5 } = {}) {
  if (!elemento || movimentoReduzido() || !globalThis.matchMedia?.("(pointer: fine)").matches) return () => {};
  elemento.classList.add("seg-inclinavel");
  if (getComputedStyle(elemento).position === "static") elemento.style.position = "relative";
  let quadro = 0;
  const mover = (ev) => {
    const r = elemento.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(() => {
      elemento.style.setProperty("--seg-ry", `${((x - 0.5) * 2 * maximo).toFixed(2)}deg`);
      elemento.style.setProperty("--seg-rx", `${((0.5 - y) * 2 * maximo).toFixed(2)}deg`);
      elemento.style.setProperty("--seg-mx", `${(x * 100).toFixed(1)}%`);
      elemento.style.setProperty("--seg-my", `${(y * 100).toFixed(1)}%`);
      elemento.style.setProperty("--seg-luz", "1");
    });
  };
  const sair = () => { cancelAnimationFrame(quadro); for (const p of ["--seg-rx", "--seg-ry"]) elemento.style.setProperty(p, "0deg"); elemento.style.setProperty("--seg-luz", "0"); };
  elemento.addEventListener("pointermove", mover);
  elemento.addEventListener("pointerleave", sair);
  return () => { elemento.removeEventListener("pointermove", mover); elemento.removeEventListener("pointerleave", sair); sair(); elemento.classList.remove("seg-inclinavel"); };
}

/** Dentro da suíte, insere no topo a barra "Voltar à Suíte". Fora dela, não faz nada. */
export function montarBarraDaSuite() {
  if (typeof document === "undefined" || globalThis.sessionStorage?.getItem(CHAVE_SUITE) !== "1") return;
  if (document.querySelector(".seg-suite-barra")) return;
  const nav = document.createElement("nav");
  nav.className = "seg-suite-barra"; nav.setAttribute("aria-label", "Suíte SegMPE");
  const a = document.createElement("a"); a.href = "/"; a.textContent = "← Voltar à Suíte SegMPE";
  nav.appendChild(a); document.body.prepend(nav);
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarBarraDaSuite);
  else montarBarraDaSuite();
}
