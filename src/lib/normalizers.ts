const MONTHS: Record<string, string> = { jan: "01", janeiro: "01", feb: "02", fev: "02", fevereiro: "02", mar: "03", março: "03", marco: "03", apr: "04", abr: "04", abril: "04", may: "05", mai: "05", maio: "05", jun: "06", junho: "06", jul: "07", julho: "07", aug: "08", ago: "08", agosto: "08", sep: "09", set: "09", setembro: "09", oct: "10", out: "10", outubro: "10", nov: "11", novembro: "11", dec: "12", dez: "12", dezembro: "12" };

export function normalizePhone(input?: string | null, defaultDdd = "11") {
  if (!input) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 8 || digits.length === 9) digits = `${defaultDdd}${digits}`;
  return digits || null;
}

export function maskCpf(input?: string | null) {
  const digits = input?.replace(/\D/g, "") ?? "";
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

export function parseSpreadsheetDate(input: string | number | Date | null | undefined, fallbackYear = 2026) {
  if (input === null || input === undefined || input === "") return null;
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input.toISOString().slice(0, 10);
  if (typeof input === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + input * 86400000).toISOString().slice(0, 10);
  }
  const value = String(input).trim().toLowerCase();
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;
  const slash = value.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/);
  if (slash) {
    const year = slash[3] ? Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]) : fallbackYear;
    return `${year}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`;
  }
  const textMonth = value.match(/^(\d{1,2})[-\s_]?([a-zçãé]+)(?:[-\s_]?(\d{2,4}))?$/i);
  if (textMonth) {
    const month = MONTHS[textMonth[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "")] ?? MONTHS[textMonth[2]];
    const year = textMonth[3] ? Number(textMonth[3].length === 2 ? `20${textMonth[3]}` : textMonth[3]) : fallbackYear;
    if (month) return `${year}-${month}-${textMonth[1].padStart(2, "0")}`;
  }
  return null;
}

export function formatDateBR(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function extractAwardPosition(input?: string | null) {
  const match = input?.match(/[1-8]/);
  return match ? Number(match[0]) : null;
}

export function normalizeTitle(input: string) {
  const trimmed = input.trim();
  if (/^sem m[úu]sica$/i.test(trimmed)) return "Sem Música";
  return trimmed.toLocaleLowerCase("pt-BR").replace(/(^|\s|[-'’])\p{L}/gu, (m) => m.toLocaleUpperCase("pt-BR"));
}

export function monthlyTotals(rows: { date: string; quantity: number }[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const month = row.date.slice(0, 7);
    acc[month] = (acc[month] ?? 0) + row.quantity;
    return acc;
  }, {});
}
