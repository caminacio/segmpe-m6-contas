/**
 * Dublê (mock) da IA para os testes: mesma assinatura de src/ia/adaptador.js,
 * sem chamada de rede e sem gastar chamadas pagas (CONTRATO.md, seção 2).
 *
 * Nos testes, passe este `gerar` no lugar do adaptador real.
 */

/** Guarda o que foi enviado, para os testes conferirem os prompts. */
export const ultimaChamada = { sistema: null, usuario: null, maxTokens: null, temperatura: null };

function saidaDeExemplo() {
  return {
    resumoParaODono:
      "Sua empresa já tem cuidados importantes para suas contas digitais. Faltam ajustes para reduzir o risco de acesso indevido e proteger o acesso em casos de falta ou saída de pessoas. O plano abaixo começa pelo que não custa nada.",
    pontosFortes: ["Existe uma pessoa responsável pela tecnologia.", "A equipe sabe a quem avisar quando algo parece errado."],
    pontosDeAtencao: [
      {
        titulo: "Senhas compartilhadas",
        explicacao: "Quando várias pessoas usam o mesmo usuário, não se sabe quem fez cada coisa e o acesso continua valendo depois que alguém sai.",
        risco: "alto",
      },
      {
        titulo: "Sem lista dos sistemas",
        explicacao: "Sem uma lista simples do que a empresa usa, é fácil esquecer uma conta antiga aberta.",
        risco: "medio",
      },
    ],
    planoDeAcao: [
      { prioridade: 1, acao: "Criar um usuário para cada pessoa no sistema de vendas.", porque: "Dá para saber quem fez cada lançamento.", esforco: "baixo", custo: "sem custo", prazo: "esta semana" },
      { prioridade: 2, acao: "Ligar a verificação em duas etapas no e-mail da empresa.", porque: "Impede a entrada só com a senha descoberta.", esforco: "baixo", custo: "sem custo", prazo: "esta semana" },
      { prioridade: 3, acao: "Fazer uma lista dos sistemas e de quem cuida de cada um.", porque: "Ajuda a fechar contas antigas e a pedir ajuda certa.", esforco: "medio", custo: "sem custo", prazo: "este mes" },
    ],
    artefatos: [
      {
        id: "inventario-contas",
        titulo: "Inventário de contas críticas",
        conteudoMarkdown: "## Inventário de contas críticas\n\n| Conta ou serviço | Responsável por função | Verificação em duas etapas | Recuperação atualizada | Segundo administrador |\n|---|---|---|---|---|\n| Exemplo sem dados reais | Administração | A confirmar | A confirmar | A confirmar |\n\nNão inclua senhas, nomes pessoais ou dados de acesso nesta tabela.",
      },
      {
        id: "guia-duas-etapas",
        titulo: "Guia de verificação em duas etapas",
        conteudoMarkdown: "## Guia de verificação em duas etapas\n\n1. Identifique uma conta marcada no inventário.\n2. Abra a página oficial de ajuda ou segurança do serviço.\n3. Procure por verificação em duas etapas nas configurações de segurança.\n4. Siga somente os passos da página oficial e confirme com o responsável da conta.\n5. Revise a recuperação e registre quem pode administrar a conta, sem registrar senhas.",
      },
    ],
    avisoLegal: "Material educacional de apoio; não substitui consultoria especializada, auditoria ou assessoria jurídica.",
  };
}

/** Mesma assinatura do adaptador real: devolve só o texto (JSON em string). */
export async function gerar({ sistema, usuario, maxTokens = 4000, temperatura = 0.3 }) {
  Object.assign(ultimaChamada, { sistema, usuario, maxTokens, temperatura });
  return JSON.stringify(saidaDeExemplo());
}

/** Dublê que devolve um JSON quebrado, para testar a nova tentativa e o erro amigável. */
export async function gerarQuebrado() {
  return "Claro! Aqui está o relatório: { \"resumoParaODono\": ";
}

/** Dublê que falha como o provedor fora do ar. */
export async function gerarComFalha() {
  throw new Error("A IA respondeu com erro. Tente de novo em alguns instantes.");
}

export { saidaDeExemplo };
