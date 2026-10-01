import { describe, expect, it } from "vitest";
import {
  diasNoPeriodo,
  fimDoPeriodo,
  fmtData,
  fmtDiaMes,
  fmtHora,
  hojeISO,
  partesData,
  quando,
  situacaoPeriodo,
  somarDias,
  somarMeses,
} from "@/lib/datas";

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

describe("folhinha e quando", () => {
  it("monta dia da semana, dia e mês", () => {
    expect(partesData("2026-10-02")).toEqual({ semana: "SEX", dia: "02", mes: "OUT" });
    expect(partesData("2026-12-25")).toEqual({ semana: "SEX", dia: "25", mes: "DEZ" });
  });

  it("diz quando é em relação a hoje", () => {
    expect(quando("2026-10-01", "2026-10-01")).toEqual({ texto: "Hoje", tipo: "hoje" });
    expect(quando("2026-10-02", "2026-10-01").texto).toBe("Amanhã");
    expect(quando("2026-10-06", "2026-10-01").texto).toBe("Em 5 dias");
    expect(quando("2026-09-30", "2026-10-01").texto).toBe("Ontem");
    expect(quando("2026-09-28", "2026-10-01")).toEqual({ texto: "Há 3 dias", tipo: "passado" });
    expect(quando("2026-11-01", "2026-10-30").texto).toBe("Em 2 dias");
  });
});

describe("período no ar", () => {
  it("soma meses sem pular para o mês seguinte", () => {
    expect(somarMeses("2026-10-15", 1)).toBe("2026-11-15");
    expect(somarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(somarMeses("2026-11-30", 2)).toBe("2027-01-30");
  });

  it("calcula o último dia no ar, contando o primeiro", () => {
    expect(fimDoPeriodo("2026-10-01", { qtd: 1, unidade: "semana" })).toBe("2026-10-07");
    expect(fimDoPeriodo("2026-10-01", { qtd: 2, unidade: "semana" })).toBe("2026-10-14");
    expect(fimDoPeriodo("2026-10-01", { qtd: 1, unidade: "mes" })).toBe("2026-10-31");
    expect(fimDoPeriodo("2026-10-15", { qtd: 3, unidade: "mes" })).toBe("2027-01-14");
  });

  it("conta os dias do período", () => {
    expect(diasNoPeriodo("2026-10-01", "2026-10-01")).toBe(1);
    expect(diasNoPeriodo("2026-10-01", "2026-10-31")).toBe(31);
  });

  it("diz se está agendada, no ar ou encerrada", () => {
    expect(situacaoPeriodo("2026-10-05", "2026-10-10", "2026-10-01")).toBe("agendada");
    expect(situacaoPeriodo("2026-10-05", "2026-10-10", "2026-10-05")).toBe("no-ar");
    expect(situacaoPeriodo("2026-10-05", "2026-10-10", "2026-10-10")).toBe("no-ar");
    expect(situacaoPeriodo("2026-10-05", "2026-10-10", "2026-10-11")).toBe("encerrada");
  });
});
