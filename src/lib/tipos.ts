/** Algo que fica no ar por um período (prioridades e recados). */
export type ItemNoAr = {
  id: string;
  data_inicio: string;
  data_fim: string;
  titulo: string;
  conteudo_html: string;
  ativo: boolean;
  imagem_path?: string | null;
  destaque?: boolean;
};

export type Prioridade = ItemNoAr & { imagem_path: string | null };

/** Recado rápido: sem imagem, pode ser destacado. */
export type Recado = ItemNoAr & { destaque: boolean };

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
