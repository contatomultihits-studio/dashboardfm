import { describe, expect, it } from "vitest";
import { extractAwardPosition, monthlyTotals, normalizePhone, parseSpreadsheetDate } from "../src/lib/normalizers";

describe("normalização das planilhas", () => {
  it("normaliza telefone com DDD padrão", () => expect(normalizePhone("98765-4321")).toBe("11987654321"));
  it("interpreta datas em formatos de planilha", () => expect(parseSpreadsheetDate("10-Nov", 2025)).toBe("2025-11-10"));
  it("extrai posição premiada", () => expect(extractAwardPosition("2ªPOSIÇÃO")).toBe(2));
  it("soma totais mensais", () => expect(monthlyTotals([{ date: "2026-01-01", quantity: 5 }, { date: "2026-01-02", quantity: 7 }])["2026-01"]).toBe(12));
});
