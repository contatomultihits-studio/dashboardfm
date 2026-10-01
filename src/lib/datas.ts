// Datas sempre no fuso do navegador (evita o bug de "virar o dia" às 21h do UTC).

const pad = (n: number) => String(n).padStart(2, "0");

export function paraISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function hojeISO(agora = new Date()): string {
  return paraISO(agora);
}

export function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return paraISO(new Date(y, m - 1, d + dias));
}

/** Soma meses mantendo o dia; se o mês não tem esse dia (31/01 + 1), usa o último dia do mês. */
export function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ultimoDia = new Date(y, m - 1 + meses + 1, 0).getDate();
  return paraISO(new Date(y, m - 1 + meses, Math.min(d, ultimoDia)));
}

export type Duracao = { qtd: number; unidade: "semana" | "mes" };

/** Último dia no ar (inclusive) para um período que começa em `inicio`. Ex.: 01/10 + 1 mês → 31/10. */
export function fimDoPeriodo(inicio: string, { qtd, unidade }: Duracao): string {
  if (unidade === "semana") return somarDias(inicio, 7 * qtd - 1);
  return somarDias(somarMeses(inicio, qtd), -1);
}

export type Situacao = "agendada" | "no-ar" | "encerrada";

export function situacaoPeriodo(inicio: string, fim: string, hoje: string): Situacao {
  if (hoje < inicio) return "agendada";
  if (hoje > fim) return "encerrada";
  return "no-ar";
}

/** Quantidade de dias no ar, contando o primeiro e o último. */
export function diasNoPeriodo(inicio: string, fim: string): number {
  const [y1, m1, d1] = inicio.split("-").map(Number);
  const [y2, m2, d2] = fim.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000) + 1;
}

const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MESES = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** Partes para a "folhinha" de calendário: QUI · 02 · OUT. */
export function partesData(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { semana: DIAS_SEMANA[new Date(y, m - 1, d).getDay()], dia: String(d).padStart(2, "0"), mes: MESES[m - 1] };
}

export type Quando = { texto: string; tipo: "hoje" | "amanha" | "futuro" | "passado" };

/** "HOJE", "AMANHÃ", "EM 5 DIAS", "ONTEM", "HÁ 3 DIAS" em relação a `hoje`. */
export function quando(iso: string, hoje: string): Quando {
  const n = diasNoPeriodo(hoje, iso.slice(0, 10)) - 1;
  if (n === 0) return { texto: "Hoje", tipo: "hoje" };
  if (n === 1) return { texto: "Amanhã", tipo: "amanha" };
  if (n > 1) return { texto: `Em ${n} dias`, tipo: "futuro" };
  if (n === -1) return { texto: "Ontem", tipo: "passado" };
  return { texto: `Há ${-n} dias`, tipo: "passado" };
}

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "--";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function fmtDiaMes(iso: string | null | undefined): string {
  if (!iso) return "--/--";
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

export function fmtHora(hora: string | null | undefined): string {
  const m = String(hora ?? "").match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : "--:--";
}

export function fmtDiaSemana(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}
