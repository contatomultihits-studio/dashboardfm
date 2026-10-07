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
  /** Só nas pautas do "Partiu Rádio Disney". */
  cliente?: string;
  locutor?: string;
  locutor_id?: string | null;
  horario?: string;
  tipo?: TipoPauta;
};

export type Prioridade = ItemNoAr & { imagem_path: string | null };

/** Recado rápido: sem imagem, pode ser destacado. */
export type Recado = ItemNoAr & { destaque: boolean };

/** Conexões: institucional e atemporal da emissora (igual às prioridades). */
export type Conexao = Prioridade;

export type TipoPauta = "EXPECTATIVA" | "VALENDO";

export const TIPO_PAUTA_LABEL: Record<TipoPauta, string> = {
  EXPECTATIVA: "Expectativa",
  VALENDO: "Valendo",
};

/** Pauta de ação externa ("Partiu Rádio Disney"): vai ao ar num horário, lida por um locutor. */
export type Pauta = ItemNoAr & { cliente: string; locutor: string; locutor_id?: string | null; horario: string; tipo: TipoPauta };

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

export type Vinculo = "RADIO_OFICIAL" | "APOIO";

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
};

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
