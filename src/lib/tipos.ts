/** Algo que fica no ar por um período (prioridades, recados, conexões e pautas). */
export type ItemNoAr = {
  id: string;
  data_inicio: string;
  data_fim: string;
  /** "HH:MM:SS" ou null (= desde o começo do dia). */
  hora_inicio?: string | null;
  /** "HH:MM:SS" ou null (= até o fim do dia). */
  hora_fim?: string | null;
  titulo: string;
  conteudo_html: string;
  ativo: boolean;
  imagem_path?: string | null;
  destaque?: boolean;
  /** Prioridades e conexões: fica na frente, fora do rodízio. */
  fixado?: boolean;
  /** Recados: só em alguns dias da semana (0 = dom … 6 = sáb), na faixa diária janela_inicio–janela_fim. */
  repetir?: boolean;
  dias_semana?: number[];
  janela_inicio?: string | null;
  janela_fim?: string | null;
  /** Recados: abre pop-up com som na tela do locutor na hora em que começa. */
  lembrete?: boolean;
  /** Só nas pautas do "Partiu Rádio Disney". */
  cliente?: string;
  locutor?: string;
  locutor_id?: string | null;
  horario?: string;
  tipo?: TipoPauta;
  secao?: SecaoPauta;
  aviso?: boolean;
};

export type Prioridade = ItemNoAr & { imagem_path: string | null };

/** Recado rápido: sem imagem, pode ser destacado. */
export type Recado = ItemNoAr & { destaque: boolean };

/** Conexões: institucional e atemporal da emissora (igual às prioridades). */
export type Conexao = Prioridade;

/** Seção da pauta: Partiu Rádio Disney (ações externas) ou Jornalismo. */
export type SecaoPauta = "partiu" | "jornalismo";

export const SECAO_PAUTA_LABEL: Record<SecaoPauta, string> = {
  partiu: "Partiu Rádio Disney",
  jornalismo: "Jornalismo",
};

export type TipoPauta =
  | "EXPECTATIVA"
  | "VALENDO"
  | "ESPN"
  | "NOTA"
  | "CONTA_TUDO"
  | "CE_VIU"
  | "CLASSICOS"
  | "EM_CARTAZ"
  | "DESAFIO_RD";

export const TIPO_PAUTA_LABEL: Record<TipoPauta, string> = {
  EXPECTATIVA: "Expectativa",
  VALENDO: "Valendo",
  ESPN: "ESPN",
  NOTA: "Nota",
  CONTA_TUDO: "Conta Tudo",
  CE_VIU: "Cê Viu?",
  CLASSICOS: "Clássicos",
  EM_CARTAZ: "Em Cartaz",
  DESAFIO_RD: "Desafio RD",
};

export const TIPOS_POR_SECAO: Record<SecaoPauta, TipoPauta[]> = {
  partiu: ["EXPECTATIVA", "VALENDO"],
  jornalismo: ["ESPN", "NOTA", "CONTA_TUDO", "CE_VIU", "CLASSICOS", "EM_CARTAZ", "DESAFIO_RD"],
};

/** Classe da etiqueta de cada tipo (cor). */
export function classeTipo(t: TipoPauta | undefined): string {
  if (t === "EXPECTATIVA") return "expectativa";
  if (t === "VALENDO" || !t) return "valendo";
  return `jornal jornal-${t.toLowerCase()}`;
}

/** Nome principal da pauta: o cliente no Partiu, o assunto no Jornalismo. */
export function nomePauta(p: { secao?: SecaoPauta; cliente?: string; titulo?: string }): string {
  return p.secao === "jornalismo" ? p.titulo || "Jornalismo" : p.cliente || p.titulo || "Pauta";
}

/** Pauta de ação externa ("Partiu Rádio Disney"): vai ao ar num horário, lida por um locutor. */
export type Pauta = ItemNoAr & {
  cliente: string;
  locutor: string;
  locutor_id?: string | null;
  horario: string;
  tipo: TipoPauta;
  /** Antigas (antes da migração 010) não têm: valem como Partiu, com aviso. */
  secao?: SecaoPauta;
  aviso?: boolean;
};

/** O "feito" do locutor: uma por pauta por dia. */
export type PautaRealizada = {
  id: string;
  pauta_id: string;
  dia: string;
  realizado_em: string;
  origem: "locutor" | "producao";
};

export type Convidado = {
  id: string;
  nome: string;
  data_visita: string;
  horario: string | null;
  mini_pauta_html: string;
  imagem_path: string | null;
  concluido: boolean;
  ativo: boolean;
};

export type Vinculo = "RADIO_OFICIAL" | "APOIO" | "CAMAROTE";

export type Evento = {
  id: string;
  nome: string;
  data_evento: string;
  local: string | null;
  vinculo: Vinculo;
  descricao_html: string;
  imagem_path: string | null;
  ativo: boolean;
};

export const VINCULO_LABEL: Record<Vinculo, string> = {
  RADIO_OFICIAL: "Rádio oficial",
  APOIO: "Apoio",
  CAMAROTE: "Camarote Rádio Disney",
};

/** Classe da etiqueta de cada vínculo (cor). */
export function classeVinculo(v: Vinculo): string {
  return v === "RADIO_OFICIAL" ? "oficial" : v === "CAMAROTE" ? "camarote" : "apoio";
}

/** Locutor: perfil e horário fixo da semana (freela costuma não ter). */
export type Locutor = {
  id: string;
  nome: string;
  nome_completo: string;
  programa: string;
  cor: string;
  imagem_path: string | null;
  /** 0 = domingo ... 6 = sábado. */
  dias: number[];
  hora_inicio: string | null;
  hora_fim: string | null;
  freela: boolean;
  ativo: boolean;
};

/** Quem fica num horário numa data específica (fins de semana e trocas). */
export type ItemEscala = {
  id: string;
  data: string;
  locutor_id: string;
  hora_inicio: string;
  hora_fim: string;
};

/** Uma leitura de prioridade/conexão na dashboard (para o relatório de leituras). */
export type Leitura = {
  id: string;
  tipo: "prioridade" | "conexao";
  item_id: string;
  titulo: string;
  dia: string;
  lido_em: string;
  locutor: string;
};
