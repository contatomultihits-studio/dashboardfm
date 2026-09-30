import { situacaoPeriodo } from "@/lib/datas";

const ROTULO = { agendada: "Agendada", "no-ar": "No ar", encerrada: "Encerrada" } as const;

export function EtiquetaSituacao({ inicio, fim, hoje }: { inicio: string; fim: string; hoje: string }) {
  const s = situacaoPeriodo(inicio, fim, hoje);
  return <span className={`etiqueta situacao-${s}`}>{ROTULO[s]}</span>;
}
