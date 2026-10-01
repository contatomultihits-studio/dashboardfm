import { agoraHHMM, situacaoPeriodo } from "@/lib/datas";

const ROTULO = { agendada: "Agendada", "no-ar": "No ar", encerrada: "Encerrada" } as const;

export function EtiquetaSituacao({ inicio, fim, hoje, horaInicio, horaFim }: {
  inicio: string;
  fim: string;
  hoje: string;
  horaInicio?: string | null;
  horaFim?: string | null;
}) {
  const s = situacaoPeriodo(inicio, fim, hoje, { inicio: horaInicio, fim: horaFim, agora: agoraHHMM() });
  return <span className={`etiqueta situacao-${s}`}>{ROTULO[s]}</span>;
}
