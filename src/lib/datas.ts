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
