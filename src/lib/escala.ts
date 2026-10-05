// Escala de locutores: junta o horário fixo da semana com a escala por data
// (fins de semana e trocas) e responde "quem está no ar" e "quem vem depois".

import { horaCurta, somarDias } from "@/lib/datas";
import type { ItemEscala, Locutor } from "@/lib/tipos";

/** Um horário do dia, com um ou mais locutores (ex.: Serginho & Suzana). */
export type Faixa = {
  /** Data em que a faixa começa. */
  data: string;
  inicio: string;
  fim: string;
  /** Minutos desde 00:00 da data; `fimMin` passa de 1440 quando vira a noite. */
  inicioMin: number;
  fimMin: number;
  locutores: Locutor[];
  /** "fixo" = horário normal da semana; "escala" = definido para essa data. */
  origem: "fixo" | "escala";
};

const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));

/** Dia da semana de uma data ISO (0 = domingo), sem depender do fuso. */
export function diaDaSemana(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function faixaDe(data: string, inicio: string, fim: string, locutor: Locutor, origem: Faixa["origem"]): Faixa {
  const i = minutos(inicio);
  let f = minutos(fim);
  if (f <= i) f += 1440; // vira a noite: 22h às 03h
  return { data, inicio: horaCurta(inicio)!, fim: horaCurta(fim)!, inicioMin: i, fimMin: f, locutores: [locutor], origem };
}

const sobrepoe = (a: Faixa, b: Faixa) => a.inicioMin < b.fimMin && b.inicioMin < a.fimMin;

/**
 * Faixas de uma data, em ordem: a escala da data e, onde ela não cobre, o horário fixo.
 * Locutores no mesmo horário viram uma faixa só.
 */
export function faixasDoDia(data: string, locutores: Locutor[], escala: ItemEscala[]): Faixa[] {
  const porId = new Map(locutores.map((l) => [l.id, l]));
  const daEscala = escala
    .filter((e) => e.data === data && porId.has(e.locutor_id))
    .map((e) => faixaDe(data, e.hora_inicio, e.hora_fim, porId.get(e.locutor_id)!, "escala"));
  const dia = diaDaSemana(data);
  const fixas = locutores
    .filter((l) => l.ativo && l.hora_inicio && l.hora_fim && l.dias.includes(dia))
    .map((l) => faixaDe(data, l.hora_inicio!, l.hora_fim!, l, "fixo"))
    .filter((f) => !daEscala.some((e) => sobrepoe(e, f)));

  const agrupadas: Faixa[] = [];
  for (const f of [...daEscala, ...fixas].sort((a, b) => a.inicioMin - b.inicioMin || a.fimMin - b.fimMin)) {
    const igual = agrupadas.find((g) => g.inicioMin === f.inicioMin && g.fimMin === f.fimMin && g.origem === f.origem);
    if (igual) igual.locutores.push(...f.locutores);
    else agrupadas.push({ ...f, locutores: [...f.locutores] });
  }
  return agrupadas;
}

/** "Serginho & Suzana" */
export function nomesFaixa(f: Pick<Faixa, "locutores">): string {
  return f.locutores.map((l) => l.nome).join(" & ");
}

/** "06h às 10h" / "22h às 03h" / "10h30 às 14h" */
export function horarioFaixa(f: Pick<Faixa, "inicio" | "fim">): string {
  const h = (x: string) => (x.endsWith(":00") ? `${x.slice(0, 2)}h` : x.replace(":", "h"));
  return `${h(f.inicio)} às ${h(f.fim)}`;
}

/**
 * Quem está no ar numa data e hora ("HH:MM"), olhando também a faixa da noite anterior
 * que ainda não acabou (ex.: 01h de domingo ainda é o 22h–03h de sábado). `null` = gravado.
 */
export function noArEm(data: string, hora: string, locutores: Locutor[], escala: ItemEscala[]): Faixa | null {
  const agora = minutos(hora);
  const hoje = faixasDoDia(data, locutores, escala).find((f) => f.inicioMin <= agora && agora < f.fimMin);
  if (hoje) return hoje;
  const ontem = faixasDoDia(somarDias(data, -1), locutores, escala).find((f) => f.fimMin > 1440 && agora + 1440 < f.fimMin);
  return ontem ?? null;
}

/** Próxima faixa depois da hora (no mesmo dia). */
export function proximaFaixa(data: string, hora: string, locutores: Locutor[], escala: ItemEscala[]): Faixa | null {
  const agora = minutos(hora);
  return faixasDoDia(data, locutores, escala).find((f) => f.inicioMin > agora) ?? null;
}

/**
 * Quem entra depois da hora: no mesmo dia ou, se acabou a escala do dia, o primeiro do dia seguinte.
 * `amanha` indica que é do dia seguinte.
 */
export function quemVemDepois(data: string, hora: string, locutores: Locutor[], escala: ItemEscala[]): { faixa: Faixa; amanha: boolean } | null {
  const hoje = proximaFaixa(data, hora, locutores, escala);
  if (hoje) return { faixa: hoje, amanha: false };
  const amanha = faixasDoDia(somarDias(data, 1), locutores, escala)[0];
  return amanha ? { faixa: amanha, amanha: true } : null;
}

/** Sábado e domingo a mostrar: o fim de semana em curso (sáb/dom) ou o próximo (seg a sex). */
export function fimDeSemana(hoje: string): [string, string] {
  const d = diaDaSemana(hoje);
  const sabado = d === 6 ? hoje : d === 0 ? somarDias(hoje, -1) : somarDias(hoje, 6 - d);
  return [sabado, somarDias(sabado, 1)];
}
