/**
 * ÚNICO arquivo do módulo que fala com a IA (CONTRATO.md, seção 8).
 * Formato Chat Completions. Já vem pronto: os grupos não precisam reescrevê-lo.
 *
 * Lê do .env: IA_API_KEY, IA_MODELO e IA_URL. A chave nunca vai para o navegador,
 * para os logs, para o repositório nem para as mensagens de erro.
 */

const TEMPO_LIMITE_MS = 60_000;

class ErroDeIA extends Error {
  constructor(mensagem, { etapa, causa } = {}) {
    super(mensagem);
    this.name = "ErroDeIA";
    this.etapa = etapa;
    if (causa) this.causa = String(causa?.name ?? causa);
  }
}

function configuracao() {
  const chave = process.env.IA_API_KEY?.trim();
  const modelo = process.env.IA_MODELO?.trim();
  const url = process.env.IA_URL?.trim();
  const faltando = [!chave && "IA_API_KEY", !modelo && "IA_MODELO", !url && "IA_URL"].filter(Boolean);
  if (faltando.length > 0) {
    throw new ErroDeIA(
      `A IA ainda não está configurada: falta ${faltando.join(", ")} no arquivo .env. ` +
        "Copie o .env.example para .env e preencha os valores que o curador passou.",
      { etapa: "configuracao" },
    );
  }
  return { chave, modelo, url };
}

async function umaTentativa({ chave, modelo, url }, corpo) {
  let resposta;
  try {
    resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chave}` },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (causa) {
    // Falha de rede ou tempo esgotado: vale uma nova tentativa.
    const erro = new ErroDeIA(
      "Não foi possível falar com a IA (rede indisponível ou tempo esgotado). Tente de novo em alguns instantes.",
      { etapa: "rede", causa },
    );
    erro.podeRepetir = true;
    throw erro;
  }

  if (!resposta.ok) {
    const dica =
      resposta.status === 401 || resposta.status === 403
        ? "O acesso à IA foi recusado. Confirme os valores do .env com o curador."
        : resposta.status === 429
          ? "A IA está recebendo pedidos demais agora. Espere um instante e tente de novo."
          : "A IA respondeu com erro. Tente de novo em alguns instantes.";
    // Nunca inclua a chave, o prompt ou as respostas na mensagem de erro.
    throw new ErroDeIA(`${dica} (código ${resposta.status})`, { etapa: "resposta" });
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch (causa) {
    throw new ErroDeIA("A IA respondeu num formato inesperado.", { etapa: "formato", causa });
  }

  const texto = dados?.choices?.[0]?.message?.content;
  if (typeof texto !== "string" || texto.trim() === "") {
    throw new ErroDeIA("A IA respondeu sem conteúdo.", { etapa: "formato" });
  }
  return texto;
}

/**
 * A IA está configurada? Use isto em vez de ler IA_API_KEY fora deste arquivo:
 * só o adaptador toca nas credenciais (CONTRATO.md, seção 8).
 */
export function iaConfigurada() {
  try {
    configuracao();
    return true;
  } catch {
    return false;
  }
}

/**
 * Assinatura exata do contrato. Devolve SOMENTE o texto da IA.
 * @param {{ sistema: string, usuario: string, maxTokens?: number, temperatura?: number }} entrada
 * @returns {Promise<string>} texto de choices[0].message.content
 */
export async function gerar({ sistema, usuario, maxTokens = 4000, temperatura = 0.3 }) {
  if (typeof sistema !== "string" || typeof usuario !== "string" || !sistema.trim() || !usuario.trim()) {
    throw new ErroDeIA("Os prompts do módulo chegaram vazios.", { etapa: "prompts" });
  }
  const conf = configuracao();
  const corpo = {
    model: conf.modelo,
    messages: [
      { role: "system", content: sistema },
      { role: "user", content: usuario },
    ],
    max_tokens: maxTokens,
    temperature: temperatura,
  };

  try {
    return await umaTentativa(conf, corpo);
  } catch (erro) {
    if (!erro?.podeRepetir) throw erro;
    return await umaTentativa(conf, corpo); // uma única nova tentativa, só em falha de rede
  }
}

export { ErroDeIA };
