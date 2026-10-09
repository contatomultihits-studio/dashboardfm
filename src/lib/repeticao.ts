// Recados que repetem: só em alguns dias da semana e num horário diário (ex.: seg e qua, das 10h às 12h).

import { fmtData, horaCurta, somarDias } from "@/lib/datas";

/** 0 = domingo … 6 = sábado (igual ao getDay do JavaScript). */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DIAS_CURTOS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] as const;
const DIAS_NOME = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Ordem dos botões no formulário: segunda primeiro. */
export const ORDEM_DIAS: DiaSemana[] = [1, 2, 3, 4, 5, 6, 0];

export const ATALHOS_DIAS: { rotulo: string; dias: DiaSemana[] }[] = [
  { rotulo: "Seg a Sex", dias: [1, 2, 3, 4, 5] },
  { rotulo: "Fim de semana", dias: [6, 0] },
  { rotulo: "Todos", dias: [0, 1, 2, 3, 4, 5, 6] },
];

export type Repeticao = {
  data_inicio: string;
  data_fim: string;
  repetir?: boolean | null;
  dias_semana?: number[] | null;
  janela_inicio?: string | null;
  janela_fim?: string | null;
};

/** Dia da semana de uma data "AAAA-MM-DD". */
export function diaDaSemana(iso: string): DiaSemana {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as DiaSemana;
}

const hm = (h: string | null | undefined) => horaCurta(h) ?? "00:00";
/** A faixa passa da meia-noite (ex.: 22h às 01h)? */
export const viraMeiaNoite = (r: Pick<Repeticao, "janela_inicio" | "janela_fim">) => hm(r.janela_fim) <= hm(r.janela_inicio);

/** O recado vale neste dia (dentro do período e num dia da semana marcado)? */
function valeNoDia(r: Repeticao, dia: string): boolean {
  return dia >= r.data_inicio && dia <= r.data_fim && (r.dias_semana ?? []).includes(diaDaSemana(dia));
}

/** Está no ar agora? `agora` = "HH:MM". Faixa que vira a meia-noite continua até o horário final do dia seguinte. */
export function noArRepetido(r: Repeticao, hoje: string, agora: string): boolean {
  const ini = hm(r.janela_inicio);
  const fim = hm(r.janela_fim);
  if (!viraMeiaNoite(r)) return valeNoDia(r, hoje) && agora >= ini && agora < fim;
  return (valeNoDia(r, hoje) && agora >= ini) || (valeNoDia(r, somarDias(hoje, -1)) && agora < fim);
}

/** "10h" / "10h30" */
export function horaH(h: string | null | undefined): string {
  const c = hm(h);
  return c.endsWith(":00") ? `${c.slice(0, 2)}h` : c.replace(":", "h");
}

/** "Seg a Sex", "Fim de semana", "Todos os dias", "Seg e Qua", "Seg, Qua e Sex" */
export function textoDias(dias: number[] | null | undefined): string {
  const set = new Set(dias ?? []);
  if (set.size === 7) return "Todos os dias";
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return "Seg a Sex";
  if (set.size === 2 && set.has(0) && set.has(6)) return "Fim de semana";
  const nomes = ORDEM_DIAS.filter((d) => set.has(d)).map((d) => DIAS_NOME[d]);
  return nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** "Seg e Qua · 10h às 12h" (com "(dia seguinte)" quando passa da meia-noite). */
export function resumoRepeticao(r: Repeticao): string {
  return `${textoDias(r.dias_semana)} · ${horaH(r.janela_inicio)} às ${horaH(r.janela_fim)}${viraMeiaNoite(r) ? " (dia seguinte)" : ""}`;
}

/** Próximas vezes que vai aparecer, a partir de agora (para conferir antes de salvar). */
export function proximasVezes(r: Repeticao, hoje: string, agora: string, quantas = 4): string[] {
  const lista: string[] = [];
  const ini = hm(r.janela_inicio);
  const fim = hm(r.janela_fim);
  if (noArRepetido(r, hoje, agora)) lista.push("agora");
  for (let i = 0; i < 400 && lista.length < quantas; i++) {
    const dia = somarDias(hoje > r.data_inicio ? hoje : r.data_inicio, i);
    if (dia > r.data_fim) break;
    if (!valeNoDia(r, dia)) continue;
    if (dia === hoje && agora >= ini) continue; // a de hoje já começou (ou passou)
    lista.push(`${DIAS_NOME[diaDaSemana(dia)].toLowerCase()} ${fmtData(dia).slice(0, 5)} ${horaH(ini)}–${horaH(fim)}`);
  }
  return lista;
}

export type SituacaoRepetida = { tipo: "no-ar" | "agendada" | "encerrada" | "hoje-nao" | "mais-tarde"; texto: string };

/** Etiqueta da lista do Artístico. */
export function situacaoRepetida(r: Repeticao, hoje: string, agora: string): SituacaoRepetida {
  if (noArRepetido(r, hoje, agora)) return { tipo: "no-ar", texto: "No ar agora" };
  if (hoje < r.data_inicio) return { tipo: "agendada", texto: "Agendado" };
  const ultimo = viraMeiaNoite(r) ? somarDias(r.data_fim, 1) : r.data_fim;
  if (hoje > ultimo || (hoje === r.data_fim && !viraMeiaNoite(r) && agora >= hm(r.janela_fim))) return { tipo: "encerrada", texto: "Encerrado" };
  if (valeNoDia(r, hoje) && agora < hm(r.janela_inicio)) return { tipo: "mais-tarde", texto: `Hoje às ${horaH(r.janela_inicio)}` };
  return { tipo: "hoje-nao", texto: "Hoje não aparece" };
}

/** Recado como lembrete: horário curto no mesmo dia vira pop-up na tela do locutor. */
export const LEMBRETE_ATE_MIN = 30;

type ComHorario = Repeticao & { hora_inicio?: string | null; hora_fim?: string | null };
const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/** Duração em minutos de cada vez que o recado aparece; null quando é o dia todo ou vários dias. */
export function duracaoRecadoMin(r: ComHorario): number | null {
  if (r.repetir) {
    if (!r.janela_inicio || !r.janela_fim) return null;
    return (minutos(hm(r.janela_fim)) - minutos(hm(r.janela_inicio)) + 1440) % 1440 || null;
  }
  if (r.data_inicio !== r.data_fim || !r.hora_inicio || !r.hora_fim) return null;
  const d = minutos(hm(r.hora_fim)) - minutos(hm(r.hora_inicio));
  return d > 0 ? d : null;
}

/** Sugere marcar "Lembrete com pop-up": menos de 30 minutos no mesmo dia. */
export const sugereLembrete = (r: ComHorario) => {
  const d = duracaoRecadoMin(r);
  return d !== null && d < LEMBRETE_ATE_MIN;
};

/** Horário em que o recado sai do ar hoje ("HH:MM") e quantos minutos faltam. */
export function fimHoje(r: ComHorario, agora: string): { fim: string; faltam: number } | null {
  const fim = r.repetir ? hm(r.janela_fim) : r.hora_fim ? hm(r.hora_fim) : null;
  if (!fim) return null;
  return { fim, faltam: (minutos(fim) - minutos(agora) + 1440) % 1440 };
}
