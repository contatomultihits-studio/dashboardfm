// Só os campos que a tela do locutor usa (sem created_at, updated_at, created_by…): menos dados por atualização.

export const COLUNAS = {
  prioridades: "id,data_inicio,data_fim,hora_inicio,hora_fim,titulo,conteudo_html,imagem_path,ativo,fixado",
  recados: "id,data_inicio,data_fim,hora_inicio,hora_fim,titulo,conteudo_html,destaque,ativo,repetir,dias_semana,janela_inicio,janela_fim,lembrete",
  conexoes: "id,data_inicio,data_fim,hora_inicio,hora_fim,titulo,conteudo_html,imagem_path,ativo,fixado",
  pautas: "id,data_inicio,data_fim,horario,cliente,locutor,locutor_id,tipo,titulo,conteudo_html,secao,aviso,ativo",
  pautas_realizadas: "id,pauta_id,dia,realizado_em,origem",
  locutores: "id,nome,nome_completo,programa,cor,imagem_path,dias,hora_inicio,hora_fim,freela,ativo",
  escala: "id,data,locutor_id,hora_inicio,hora_fim",
  convidados: "id,nome,data_visita,horario,mini_pauta_html,imagem_path,concluido,ativo",
  eventos: "id,nome,data_evento,local,vinculo,descricao_html,imagem_path,ativo",
  premios: "id,nome,titulo,descricao_html,patrocinador,imagem_path,ativo,data_inicio,data_fim,evento,parceria",
  promo_rodadas: "id,data,horario,horario_fim,premio_id,aviso,ativo",
  promo_entregas: "id,rodada_id,data,horario,horario_fim,premio_id,premio_nome,locutor,entregue_em",
} as const;

/** A tela do locutor só precisa da escala até o próximo fim de semana (e da madrugada de ontem). */
export const ESCALA_DIAS_A_FRENTE = 14;
