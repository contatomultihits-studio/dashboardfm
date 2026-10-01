import { describe, expect, it } from "vitest";
import {
  agoraHHMM,
  diasNoPeriodo,
  fimDoPeriodo,
  fmtData,
  fmtDiaMes,
  fmtHora,
  hojeISO,
  horaCurta,
  noArAgora,
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

describe("horário de entrada e saída", () => {
  const promo = { data_inicio: "2026-10-01", data_fim: "2026-10-03", hora_inicio: "08:00:00", hora_fim: "18:00:00" };

  it("respeita o horário no primeiro e no último dia", () => {
    expect(noArAgora(promo, "2026-10-01", "2026-10-01", "07:59")).toBe(false);
    expect(noArAgora(promo, "2026-10-01", "2026-10-01", "08:00")).toBe(true);
    expect(noArAgora(promo, "2026-10-02", "2026-10-02", "03:00")).toBe(true); // dia do meio: o dia todo
    expect(noArAgora(promo, "2026-10-03", "2026-10-03", "17:59")).toBe(true);
    expect(noArAgora(promo, "2026-10-03", "2026-10-03", "18:00")).toBe(false); // sai às 18:00 em ponto
  });

  it("sem horário vale o dia todo", () => {
    const diaTodo = { data_inicio: "2026-10-01", data_fim: "2026-10-01" };
    expect(noArAgora(diaTodo, "2026-10-01", "2026-10-01", "00:00")).toBe(true);
    expect(noArAgora(diaTodo, "2026-10-01", "2026-10-01", "23:59")).toBe(true);
  });

  it("vendo outro dia, não olha o relógio", () => {
    expect(noArAgora(promo, "2026-10-03", "2026-10-01", "23:00")).toBe(true);
  });

  it("situação com horário", () => {
    const h = { inicio: "08:00", fim: "18:00" };
    expect(situacaoPeriodo("2026-10-01", "2026-10-03", "2026-10-01", { ...h, agora: "07:00" })).toBe("agendada");
    expect(situacaoPeriodo("2026-10-01", "2026-10-03", "2026-10-03", { ...h, agora: "18:30" })).toBe("encerrada");
    expect(situacaoPeriodo("2026-10-01", "2026-10-03", "2026-10-02", { ...h, agora: "23:00" })).toBe("no-ar");
  });

  it("formata hora", () => {
    expect(horaCurta("18:00:00")).toBe("18:00");
    expect(horaCurta(null)).toBe(null);
    expect(agoraHHMM(new Date(2026, 9, 1, 9, 5))).toBe("09:05");
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
