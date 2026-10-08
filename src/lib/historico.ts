// Histórico de alterações: nomes amigáveis das áreas e dos campos.

import { textoPuro } from "@/lib/html";

export type RegistroHistorico = {
  id: number;
  em: string;
  tabela: string;
  acao: "criou" | "editou" | "excluiu";
  registro: string;
  resumo: string;
  quem: string | null;
  quem_nome: string;
  mudancas: Record<string, { de: string; para: string }> | null;
  dados: Record<string, unknown> | null;
};

export const NOME_TABELA: Record<string, string> = {
  prioridades: "Prioridades",
  recados: "Recados",
  conexoes: "Conexões",
  pautas: "Pautas (Partiu / Jornalismo)",
  pautas_realizadas: "Pauta feita",
  convidados: "Convidados",
  eventos: "Eventos",
  locutores: "Locutores",
  escala: "Escala",
  premios: "Cliente / Evento / Prêmio",
  promo_rodadas: "Grade da promoção",
  promo_entregas: "Prêmio concluído no ar",
  ouvintes: "Ouvintes",
  ganhadores: "Ganhadores",
  perfis: "Usuários",
  permissoes: "Acessos por área",
};

export const DESCRICAO_CAMPO: Record<string, string> = {
  nome: "Nome", titulo: "Título", conteudo_html: "Texto", descricao_html: "Nota", texto_html: "Texto",
  data_inicio: "Início", data_fim: "Fim", hora_inicio: "Hora início", hora_fim: "Hora fim", horario: "Horário", horario_fim: "Até",
  ativo: "Ativo", fixado: "Fixado", imagem_path: "Foto", premio_id: "Prêmio", aviso: "Aviso", data: "Dia",
  telefone: "Telefone", bairro: "Bairro", cidade: "Cidade", bloqueado: "Bloqueado", motivo_bloqueio: "Motivo do bloqueio",
  evento: "É evento", parceria: "Parceria", tipo: "Tipo", nivel: "Nível", area: "Área", senha_alterada: "Senha trocada",
  locutor: "Locutor", cliente: "Cliente", premio_nome: "Prêmio", obs: "Observação", entregue_em: "Entregue em",
};

const ESCONDER = new Set(["id", "created_at", "updated_at", "created_by", "nome_busca", "atualizado_em", "criado_em", "criado_por", "feito_por", "user_id"]);

/** Os campos de um item excluído, legíveis (sem HTML, ids e campos vazios). */
export function resumoDados(dados: Record<string, unknown>): [string, string][] {
  return Object.entries(dados)
    .filter(([k, v]) => !ESCONDER.has(k) && !k.endsWith("_id") && v !== null && v !== "" && v !== false)
    .map(([k, v]) => {
      const s = typeof v === "string" ? (/<[a-z]/i.test(v) ? textoPuro(v) : v) : JSON.stringify(v);
      return [k, s.length > 200 ? `${s.slice(0, 200)}…` : s] as [string, string];
    });
}
