/**
 * Validação da entrada e da saída (CONTRATO.md, seções 5, 6, 10 e 14.5).
 * Todas as funções devolvem uma LISTA DE ERROS em português (vazia = tudo certo).
 * Nenhuma mensagem repete o conteúdo das respostas da empresa.
 */

const LIMITE_TEXTO = 280;
const PADRAO_CODINOME = /^EP-\d{2}$/;

/** Valores permitidos do perfil comum — não invente outros (CONTRATO.md, seção 5). */
const PERFIL_UNICO = {
  P01_ramo: ["comercio_varejista", "alimentacao", "beleza_estetica", "saude", "servicos_profissionais", "educacao", "industria_confeccao", "servicos_tecnicos", "comercio_online", "outro"],
  P02_porte: ["mei", "me", "epp"],
  P03_pessoas: ["1", "2-5", "6-10", "11-20", "21-49"],
  P04_tempo: ["menos_de_1", "1-3", "4-10", "mais_de_10"],
  P11_site: ["sim", "nao"],
  P12_ti: ["dono", "funcionario", "terceirizado", "ninguem"],
  P13_incidente: ["sim", "nao", "nao_sei"],
};

const PERFIL_MULTIPLO = {
  P06_canais: ["loja_fisica", "whatsapp", "instagram", "site_proprio", "marketplace", "telefone", "apps_delivery"],
  P07_pagamentos: ["dinheiro", "pix", "cartao_maquininha", "boleto", "link_pagamento", "crediario"],
  P08_dados: ["nenhum", "contato", "cpf", "endereco", "saude", "financeiros"],
  P09_equipamentos: ["computador", "notebook", "celular_empresa", "celular_pessoal", "tablet"],
  P10_sistemas: ["sistema_gestao", "planilhas", "email_nuvem", "sistema_contador", "agenda_online", "nenhum"],
};

const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

const TIPOS_VALIDOS = ["sim_nao", "escolha_unica", "multipla", "escala_1_5", "texto_curto"];

/** Perfil comum: só leitura, nunca alterado pelo módulo. */
export function validarPerfil(perfil) {
  const erros = [];
  if (!perfil || typeof perfil !== "object" || Array.isArray(perfil)) {
    return ["O perfil da empresa não foi enviado."];
  }
  if (!PADRAO_CODINOME.test(String(perfil.codinome ?? ""))) {
    erros.push("O codinome deve estar no formato EP-01. Nunca envie o nome real da empresa.");
  }
  for (const [campo, valores] of Object.entries(PERFIL_UNICO)) {
    const valor = perfil[campo];
    if (valor === undefined || valor === "") erros.push(`O perfil está sem o campo ${campo}.`);
    else if (!valores.includes(String(valor))) erros.push(`O campo ${campo} do perfil tem um valor desconhecido.`);
  }
  if (perfil.P01_ramo === "outro" && !String(perfil.P01_outro ?? "").trim()) {
    erros.push("Quando o ramo é \"outro\", o perfil precisa do campo P01_outro.");
  }
  if (perfil.P01_outro !== undefined && String(perfil.P01_outro).length > 60) {
    erros.push("O campo P01_outro do perfil passa de 60 caracteres.");
  }
  if (!UFS.includes(String(perfil.P05_uf ?? "").toUpperCase())) {
    erros.push("O campo P05_uf do perfil deve ser a sigla do estado (ex.: DF).");
  }
  for (const [campo, valores] of Object.entries(PERFIL_MULTIPLO)) {
    const valor = perfil[campo];
    if (!Array.isArray(valor) || valor.length === 0) {
      erros.push(`O campo ${campo} do perfil precisa de ao menos uma opção.`);
      continue;
    }
    if (valor.some((v) => !valores.includes(String(v)))) erros.push(`O campo ${campo} do perfil tem uma opção desconhecida.`);
    if (valor.includes("nenhum") && valor.length > 1) erros.push(`No campo ${campo} do perfil, "nenhum" não combina com outras opções.`);
  }
  // O módulo não recebe nem guarda identificação da empresa (CONTRATO.md, seção 14.3).
  for (const proibido of ["nome", "razao_social", "cnpj", "site", "endereco", "telefone", "email", "responsavel"]) {
    if (proibido in perfil) erros.push(`O perfil não pode trazer o campo "${proibido}": o módulo só recebe o codinome.`);
  }
  return erros;
}

function valoresDaPergunta(pergunta) {
  return (pergunta.opcoes ?? []).map((o) => String(o.valor));
}

/** Entrada do POST /gerar: { perfil, respostas }. */
export function validarEntrada(entrada, questionario, { perguntaAplicavel } = {}) {
  const erros = [];
  if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) {
    return ["O pedido chegou vazio ou em formato inesperado."];
  }
  erros.push(...validarPerfil(entrada.perfil));

  const respostas = entrada.respostas;
  if (!respostas || typeof respostas !== "object" || Array.isArray(respostas)) {
    erros.push("As respostas do questionário não foram enviadas.");
    return erros;
  }

  const perguntas = new Map((questionario.perguntas ?? []).map((p) => [p.id, p]));
  for (const id of Object.keys(respostas)) {
    if (!perguntas.has(id)) erros.push(`A resposta "${id}" não corresponde a nenhuma pergunta deste módulo.`);
  }

  for (const pergunta of perguntas.values()) {
    const aplicavel = perguntaAplicavel
      ? perguntaAplicavel(pergunta, { perfil: entrada.perfil ?? {}, respostas })
      : true;
    const resposta = respostas[pergunta.id];
    const vazia = resposta === undefined || resposta === null || resposta === "" || (Array.isArray(resposta) && resposta.length === 0);

    if (!aplicavel) {
      if (!vazia) erros.push(`A pergunta ${pergunta.id} não deveria ter sido respondida neste perfil.`);
      continue;
    }
    if (vazia) {
      if (pergunta.obrigatoria) erros.push(`A pergunta ${pergunta.id} é obrigatória.`);
      continue;
    }

    if (pergunta.tipo === "texto_curto") {
      if (typeof resposta !== "string") erros.push(`A resposta da pergunta ${pergunta.id} deve ser um texto.`);
      else if (resposta.length > LIMITE_TEXTO) erros.push(`A resposta da pergunta ${pergunta.id} passa de ${LIMITE_TEXTO} caracteres.`);
      continue;
    }

    const permitidos = valoresDaPergunta(pergunta);
    if (pergunta.tipo === "multipla") {
      if (!Array.isArray(resposta)) {
        erros.push(`A pergunta ${pergunta.id} aceita várias opções: envie uma lista.`);
        continue;
      }
      if (resposta.some((v) => !permitidos.includes(String(v)))) erros.push(`A pergunta ${pergunta.id} recebeu uma opção desconhecida.`);
      if (new Set(resposta.map(String)).size !== resposta.length) erros.push(`A pergunta ${pergunta.id} recebeu a mesma opção duas vezes.`);
      if (resposta.map(String).includes("nenhum") && resposta.length > 1) erros.push(`Na pergunta ${pergunta.id}, "nenhum" não combina com outras opções.`);
      continue;
    }

    if (Array.isArray(resposta)) {
      erros.push(`A pergunta ${pergunta.id} aceita uma só opção.`);
      continue;
    }
    if (!permitidos.includes(String(resposta))) erros.push(`A pergunta ${pergunta.id} recebeu uma opção desconhecida.`);
  }
  return erros;
}

/** Estrutura do questionário — usada pelo npm run checar e pelos testes. */
export function validarQuestionario(questionario, manifesto) {
  const erros = [];
  const perguntas = questionario?.perguntas;
  if (!Array.isArray(perguntas)) return ["O questionario.json precisa de uma lista \"perguntas\"."];
  if (perguntas.length < 10 || perguntas.length > 15) erros.push(`O questionário deve ter de 10 a 15 perguntas (tem ${perguntas.length}).`);

  const temas = new Set(manifesto?.temas ?? []);
  const ids = new Set();
  let textosCurtos = 0;

  for (const p of perguntas) {
    const id = String(p?.id ?? "");
    if (!/^M[A-Z0-9]\d*_Q\d{2}$/.test(id)) erros.push(`O id "${id}" não segue o padrão M1_Q01.`);
    if (ids.has(id)) erros.push(`O id ${id} aparece duas vezes.`);
    ids.add(id);
    if (!TIPOS_VALIDOS.includes(p?.tipo)) erros.push(`A pergunta ${id} tem um tipo inválido.`);
    if (!String(p?.texto ?? "").trim()) erros.push(`A pergunta ${id} está sem texto.`);
    if (!String(p?.ajuda ?? "").trim()) erros.push(`A pergunta ${id} está sem ajuda (explicação para leigos).`);
    if (typeof p?.obrigatoria !== "boolean") erros.push(`A pergunta ${id} está sem o campo obrigatoria.`);
    if (temas.size > 0 && !temas.has(p?.tema)) erros.push(`O tema da pergunta ${id} não está na lista de temas do modulo.json.`);

    if (p?.tipo === "texto_curto") {
      textosCurtos += 1;
      if (p.opcoes) erros.push(`A pergunta ${id} é de texto e não deve ter opções.`);
      continue;
    }
    const valores = (p?.opcoes ?? []).map((o) => String(o?.valor));
    if (valores.length < 2) erros.push(`A pergunta ${id} precisa de opções.`);
    if (!valores.includes("nao_sei")) erros.push(`A pergunta ${id} precisa da opção "nao_sei".`);
    for (const o of p?.opcoes ?? []) {
      if (!String(o?.rotulo ?? "").trim()) erros.push(`Uma opção da pergunta ${id} está sem rótulo.`);
      if (![0, 1, 2].includes(Number(o?.pontos))) erros.push(`A opção "${o?.valor}" da pergunta ${id} deve valer 0, 1 ou 2.`);
    }
  }
  if (textosCurtos > 3) erros.push(`O questionário tem ${textosCurtos} perguntas de texto_curto (o máximo é 3).`);
  if (questionario.modulo && manifesto?.id && questionario.modulo !== manifesto.id) {
    erros.push("O campo \"modulo\" do questionario.json não é o mesmo id do modulo.json.");
  }
  return erros;
}

/** Saída devolvida ao navegador (CONTRATO.md, seção 10). */
export function validarSaida(saida, manifesto) {
  const erros = [];
  if (!saida || typeof saida !== "object" || Array.isArray(saida)) return ["A IA não devolveu um objeto JSON."];

  for (const campo of ["modulo", "versao", "codinome", "geradoEm", "resumoParaODono", "avisoLegal"]) {
    if (!String(saida[campo] ?? "").trim()) erros.push(`A saída está sem o campo ${campo}.`);
  }
  if (!saida.pontuacao || typeof saida.pontuacao.indice !== "number") erros.push("A saída está sem a pontuação calculada pelo código.");
  if (!Array.isArray(saida.pontosFortes)) erros.push("A saída está sem a lista pontosFortes.");

  if (!Array.isArray(saida.pontosDeAtencao)) erros.push("A saída está sem a lista pontosDeAtencao.");
  else {
    for (const item of saida.pontosDeAtencao) {
      if (!String(item?.titulo ?? "").trim() || !String(item?.explicacao ?? "").trim()) erros.push("Um ponto de atenção está sem título ou explicação.");
      if (!["alto", "medio", "baixo"].includes(item?.risco)) erros.push("Um ponto de atenção tem um risco fora de alto/medio/baixo.");
    }
  }

  const plano = saida.planoDeAcao;
  if (!Array.isArray(plano) || plano.length < 3 || plano.length > 7) erros.push("O plano de ação deve ter de 3 a 7 itens.");
  else {
    for (const item of plano) {
      if (!Number.isInteger(item?.prioridade)) erros.push("Um item do plano de ação está sem prioridade.");
      if (!String(item?.acao ?? "").trim() || !String(item?.porque ?? "").trim()) erros.push("Um item do plano de ação está sem ação ou sem o porquê.");
      if (!["baixo", "medio", "alto"].includes(item?.esforco)) erros.push("Um item do plano de ação tem esforço fora de baixo/medio/alto.");
      if (!["sem custo", "baixo", "medio", "alto"].includes(item?.custo)) erros.push("Um item do plano de ação tem custo fora dos valores do contrato.");
      if (!["esta semana", "este mes", "em 3 meses"].includes(item?.prazo)) erros.push("Um item do plano de ação tem prazo fora dos valores do contrato.");
    }
  }

  const esperados = (manifesto?.artefatos ?? []).map((a) => a.id);
  const recebidos = Array.isArray(saida.artefatos) ? saida.artefatos.map((a) => a?.id) : [];
  for (const id of esperados) {
    const artefato = (saida.artefatos ?? []).find((a) => a?.id === id);
    if (!artefato) erros.push(`A saída está sem o artefato "${id}" do manifesto.`);
    else if (!String(artefato.conteudoMarkdown ?? "").trim()) erros.push(`O artefato "${id}" veio sem conteúdo.`);
    else if (!String(artefato.titulo ?? "").trim()) erros.push(`O artefato "${id}" veio sem título.`);
  }
  for (const id of recebidos) {
    if (id && !esperados.includes(id)) erros.push(`A saída trouxe um artefato que não está no manifesto: "${id}".`);
  }
  return erros;
}

export { LIMITE_TEXTO, PADRAO_CODINOME, TIPOS_VALIDOS };
