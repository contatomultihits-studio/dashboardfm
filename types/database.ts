export type Programa = {
  id: string;
  nome: string;
  cor_hex: string;
  ativo: boolean;
};

export type Participacao = {
  id: string;
  programa_id: string;
  data_referencia: string;
  quantidade: number;
  tipo_registro: string;
  created_at: string;
};

export type Premio = {
  id: string;
  programa_id: string;
  nome: string;
  descricao: string;
  estoque_inicial: number;
};

export type PrioridadeAr = {
  id: string;
  programa_id: string;
  data: string;
  conteudo: string;
  concluido: boolean;
};

export type ResumoParticipacao = {
  programa: string;
  cor_hex: string;
  total_participacoes: number;
  dias_com_registro: number;
};
