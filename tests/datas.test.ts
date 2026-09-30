import { describe, expect, it } from "vitest";
import { fmtData, fmtDiaMes, fmtHora, hojeISO, somarDias } from "@/lib/datas";

describe("datas", () => {
  it("usa o dia local, não o UTC", () => {
    // 30/09 às 22h em São Paulo já é 01/10 em UTC
    const noite = new Date(2026, 8, 30, 22, 30);
    expect(hojeISO(noite)).toBe("2026-09-30");
  });

  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-09-30", 1)).toBe("2026-10-01");
    expect(somarDias("2026-01-01", -1)).toBe("2025-12-31");
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("formata para o padrão brasileiro", () => {
    expect(fmtData("2026-10-05")).toBe("05/10/2026");
    expect(fmtDiaMes("2026-10-05")).toBe("05/10");
    expect(fmtHora("14:30:00")).toBe("14:30");
    expect(fmtHora(null)).toBe("--:--");
  });
});
