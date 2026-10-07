// Relatório de leituras: quantas vezes e em que horários cada prioridade/conexão foi aberta no dia.

import { fmtData } from "@/lib/datas";
import { horaNoFuso } from "@/lib/pautas";
import type { Leitura } from "@/lib/tipos";

export const TIPO_LEITURA_LABEL = { prioridade: "Prioridade", conexao: "Conexão" } as const;

export type ItemLido = { id: string; tipo: Leitura["tipo"]; titulo: string };

export type LinhaLeituras = ItemLido & {
  /** Em ordem de horário. */
  leituras: { hora: string; locutor: string }[];
};

/**
 * Uma linha por card: os que estavam no ar no dia (mesmo sem leitura) e os que foram lidos.
 * Prioridades antes de conexões; dentro de cada, os menos lidos primeiro (são os que pedem atenção).
 */
export function linhasLeituras(noAr: ItemLido[], leituras: Leitura[]): LinhaLeituras[] {
  const porId = new Map<string, LinhaLeituras>();
  for (const i of noAr) porId.set(i.id, { ...i, leituras: [] });
  for (const l of [...leituras].sort((a, b) => a.lido_em.localeCompare(b.lido_em))) {
    if (!porId.has(l.item_id)) porId.set(l.item_id, { id: l.item_id, tipo: l.tipo, titulo: l.titulo, leituras: [] });
    porId.get(l.item_id)!.leituras.push({ hora: horaNoFuso(l.lido_em), locutor: l.locutor });
  }
  const ordemTipo = { prioridade: 0, conexao: 1 };
  return [...porId.values()].sort(
    (a, b) => ordemTipo[a.tipo] - ordemTipo[b.tipo] || a.leituras.length - b.leituras.length || a.titulo.localeCompare(b.titulo),
  );
}

export function resumoLeituras(linhas: LinhaLeituras[]) {
  const total = linhas.reduce((n, l) => n + l.leituras.length, 0);
  const naoLidos = linhas.filter((l) => l.leituras.length === 0).length;
  return { cards: linhas.length, lidos: linhas.length - naoLidos, naoLidos, total };
}

/** Texto pronto para colar no e-mail. */
export function textoLeituras(dia: string, linhas: LinhaLeituras[]): string {
  const r = resumoLeituras(linhas);
  const cab = [
    `PRIORIDADES E CONEXÕES — Relatório de leituras de ${fmtData(dia)}`,
    `${r.total} leituras · ${r.lidos} de ${r.cards} cards lidos · ${r.naoLidos} sem leitura`,
    "",
  ];
  const corpo = linhas.map((l) => {
    const horarios = l.leituras.length
      ? l.leituras.map((x) => `${x.hora}${x.locutor ? ` (${x.locutor})` : ""}`).join(", ")
      : "NÃO LIDO";
    return `${TIPO_LEITURA_LABEL[l.tipo].toUpperCase()} · ${l.titulo} → ${l.leituras.length}x: ${horarios}`;
  });
  return [...cab, ...corpo].join("\n");
}

const celula = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Planilha: uma linha por leitura (e uma linha "não lido" para cada card sem leitura). */
export function csvLeituras(dia: string, linhas: LinhaLeituras[]): string {
  const cab = ["Data", "Tipo", "Card", "Lido às", "Locutor no ar", "Leituras no dia"];
  const corpo = linhas.flatMap((l) =>
    l.leituras.length
      ? l.leituras.map((x) => [fmtData(dia), TIPO_LEITURA_LABEL[l.tipo], l.titulo, x.hora, x.locutor, String(l.leituras.length)])
      : [[fmtData(dia), TIPO_LEITURA_LABEL[l.tipo], l.titulo, "Não lido", "", "0"]],
  );
  return "﻿" + [cab, ...corpo].map((linha) => linha.map(celula).join(";")).join("\r\n");
}
