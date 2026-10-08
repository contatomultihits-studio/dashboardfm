export const NOME_RADIO = "Rádio Disney";
export const ATUALIZAR_A_CADA_MS = 60_000;
/** Canal do YouTube da Rádio Disney Brasil (RadioDisneyBra). Pode ser trocado pela variável YOUTUBE_CHANNEL_ID. */
export const YOUTUBE_CANAL_ID = "UCTXWb08TrMnoJKEWNEb6VWg";
/** Carrossel "Últimos vídeos no YouTube" na dashboard. Desligado por enquanto; mude para true para voltar. */
export const MOSTRAR_YOUTUBE = false;

/** Fuso da emissora: horários de pautas feitas e o relatório usam sempre este. */
export const FUSO = "America/Sao_Paulo";

/** Até quantos minutos de diferença do horário previsto a pauta conta como "no horário". */
export const TOLERANCIA_PAUTA_MIN = 5;

/** Quantos minutos antes do horário da pauta aparece o lembrete na tela. */
export const LEMBRETE_PAUTA_MIN = 5;
/** Até quantos minutos de atraso o lembrete continua na tela (depois fica só o card "atrasada"). */
export const LEMBRETE_ATRASO_MAX_MIN = 30;

/** Promoção: quem ganhou só pode ganhar de novo depois deste número de dias (igual ao banco). */
export const CARENCIA_PROMO_DIAS = 30;
