// Regras do "Partiu Rádio Disney": situação de cada pauta no dia e o relatório para Opec/produção.

import { FUSO, LEMBRETE_ATRASO_MAX_MIN, LEMBRETE_PAUTA_MIN, TOLERANCIA_PAUTA_MIN } from "@/lib/config";
import { fmtData, horaCurta } from "@/lib/datas";
import { TIPO_PAUTA_LABEL, type Pauta, type PautaRealizada } from "@/lib/tipos";

const relogio = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Hora "HH:MM" de um momento, sempre no fuso da emissora. */
export function horaNoFuso(iso: string): string {
  return relogio.format(new Date(iso));
}

/** Minutos entre dois horários "HH:MM" (positivo = `b` depois de `a`). */
export function minutosEntre(a: string, b: string): number {
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return m(b) - m(a);
}

export type SituacaoPauta =
  | { tipo: "feita"; texto: string }
  | { tipo: "atrasada"; texto: string }
  | { tipo: "agora"; texto: string }
  | { tipo: "pendente"; texto: string }
  | { tipo: "nao-feita"; texto: string };

/**
 * Situação no card. Em hoje, compara com o relógio; em dias passados, sem "feito" é "não feita";
 * em dias futuros, só pendente.
 */
export function situacaoPauta(
  horario: string,
  realizada: PautaRealizada | undefined,
  dia: string,
  hoje: string,
  agora: string,
): SituacaoPauta {
  if (realizada) return { tipo: "feita", texto: `Feita às ${horaNoFuso(realizada.realizado_em)}` };
  if (dia < hoje) return { tipo: "nao-feita", texto: "Não feita" };
  if (dia > hoje) return { tipo: "pendente", texto: "Agendada" };
  const faltam = minutosEntre(agora, horaCurta(horario) ?? "00:00");
  if (faltam < 0) return { tipo: "atrasada", texto: `Atrasada ${-faltam} min` };
  if (faltam === 0) return { tipo: "agora", texto: "É agora!" };
  if (faltam <= 15) return { tipo: "agora", texto: `Em ${faltam} min` };
  return { tipo: "pendente", texto: "Pendente" };
}

/** Pendentes primeiro (pelo horário), as já feitas no fim. */
export function ordenarPautas<T extends Pick<Pauta, "id" | "horario">>(pautas: T[], feitas: Map<string, unknown>): T[] {
  return [...pautas].sort((a, b) => {
    const fa = feitas.has(a.id) ? 1 : 0;
    const fb = feitas.has(b.id) ? 1 : 0;
    return fa - fb || a.horario.localeCompare(b.horario);
  });
}

export type Lembrete<T> = { pauta: T; faltam: number };

/**
 * Pautas de hoje que pedem atenção agora: faltam até LEMBRETE_PAUTA_MIN minutos, ou já passaram
 * há no máximo LEMBRETE_ATRASO_MAX_MIN, sem "feita" e sem o locutor ter fechado o aviso.
 * A mais urgente vem primeiro.
 */
export function pautasParaLembrar<T extends Pick<Pauta, "id" | "horario">>(
  pautas: T[],
  feitas: Map<string, unknown>,
  dispensadas: Set<string>,
  agora: string,
): Lembrete<T>[] {
  return pautas
    .filter((p) => !feitas.has(p.id) && !dispensadas.has(p.id))
    .map((p) => ({ pauta: p, faltam: minutosEntre(agora, horaCurta(p.horario) ?? "00:00") }))
    .filter((l) => l.faltam <= LEMBRETE_PAUTA_MIN && l.faltam >= -LEMBRETE_ATRASO_MAX_MIN)
    .sort((a, b) => a.faltam - b.faltam);
}

/** "Em 5 min", "É agora!", "Atrasada 3 min". */
export function textoFaltam(faltam: number): string {
  if (faltam > 0) return `Em ${faltam} min`;
  if (faltam === 0) return "É agora!";
  return `Atrasada ${-faltam} min`;
}

export type LinhaRelatorio = {
  pauta: Pauta;
  previsto: string;
  realizado: string | null;
  /** Minutos de diferença (positivo = depois do previsto). */
  diferenca: number | null;
  situacao: string;
  ajusteProducao: boolean;
};

export function linhasRelatorio(pautas: Pauta[], realizadas: PautaRealizada[]): LinhaRelatorio[] {
  const porPauta = new Map(realizadas.map((r) => [r.pauta_id, r]));
  return [...pautas]
    .sort((a, b) => a.horario.localeCompare(b.horario) || a.cliente.localeCompare(b.cliente))
    .map((p) => {
      const previsto = horaCurta(p.horario) ?? "--:--";
      const r = porPauta.get(p.id);
      if (!r) return { pauta: p, previsto, realizado: null, diferenca: null, situacao: "Não feita", ajusteProducao: false };
      const realizado = horaNoFuso(r.realizado_em);
      const diferenca = minutosEntre(previsto, realizado);
      const situacao =
        Math.abs(diferenca) <= TOLERANCIA_PAUTA_MIN
          ? "No horário"
          : diferenca > 0
            ? `Atrasou ${diferenca} min`
            : `Adiantou ${-diferenca} min`;
      return { pauta: p, previsto, realizado, diferenca, situacao, ajusteProducao: r.origem === "producao" };
    });
}

export function resumoRelatorio(linhas: LinhaRelatorio[]) {
  const feitas = linhas.filter((l) => l.realizado).length;
  const noHorario = linhas.filter((l) => l.situacao === "No horário").length;
  return { total: linhas.length, feitas, naoFeitas: linhas.length - feitas, noHorario };
}

/** Texto pronto para colar no e-mail da Opec e dos produtores. */
export function textoRelatorio(dia: string, linhas: LinhaRelatorio[]): string {
  const r = resumoRelatorio(linhas);
  const cab = [
    `PARTIU RÁDIO DISNEY — Relatório de pautas de ${fmtData(dia)}`,
    `${r.feitas} de ${r.total} pautas feitas · ${r.noHorario} no horário · ${r.naoFeitas} não feitas`,
    "",
  ];
  const corpo = linhas.map((l) => {
    const tipo = TIPO_PAUTA_LABEL[l.pauta.tipo].toUpperCase();
    const feita = l.realizado ? `feita às ${l.realizado} (${l.situacao.toLowerCase()})${l.ajusteProducao ? " [registrada pela produção]" : ""}` : "NÃO FEITA";
    return `${l.previsto} · ${l.pauta.cliente} · ${tipo} · ${l.pauta.locutor || "sem locutor"} → ${feita}`;
  });
  return [...cab, ...corpo].join("\n");
}

const celula = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Planilha (CSV com ";", abre direto no Excel em português). */
export function csvRelatorio(dia: string, linhas: LinhaRelatorio[]): string {
  const cab = ["Data", "Horário previsto", "Cliente", "Ação", "Locutor", "Tipo", "Feita às", "Diferença (min)", "Situação", "Registro"];
  const corpo = linhas.map((l) => [
    fmtData(dia),
    l.previsto,
    l.pauta.cliente,
    l.pauta.titulo ?? "",
    l.pauta.locutor ?? "",
    TIPO_PAUTA_LABEL[l.pauta.tipo],
    l.realizado ?? "",
    l.diferenca === null ? "" : String(l.diferenca),
    l.situacao,
    l.realizado ? (l.ajusteProducao ? "Produção" : "Locutor") : "",
  ]);
  return "﻿" + [cab, ...corpo].map((linha) => linha.map(celula).join(";")).join("\r\n");
}

/** Monta o instante (com fuso de Brasília) para a produção registrar um horário à mão. */
export function instanteNoFuso(dia: string, hhmm: string): string {
  // O Brasil não tem horário de verão desde 2019: Brasília é sempre UTC-3.
  return `${dia}T${hhmm}:00-03:00`;
}
