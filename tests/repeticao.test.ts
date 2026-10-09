import { describe, expect, it } from "vitest";
import { diaDaSemana, noArRepetido, proximasVezes, resumoRepeticao, situacaoRepetida, textoDias } from "@/lib/repeticao";

// 2026-10-12 é segunda; 2026-10-14 quarta.
const base = { data_inicio: "2026-10-01", data_fim: "2026-10-31", repetir: true, dias_semana: [1, 3], janela_inicio: "10:00:00", janela_fim: "12:00:00" };

describe("recado que repete", () => {
  it("dia da semana", () => {
    expect(diaDaSemana("2026-10-12")).toBe(1);
    expect(diaDaSemana("2026-10-18")).toBe(0);
  });
  it("só nos dias e no horário marcados", () => {
    expect(noArRepetido(base, "2026-10-12", "10:00")).toBe(true);
    expect(noArRepetido(base, "2026-10-12", "11:59")).toBe(true);
    expect(noArRepetido(base, "2026-10-12", "12:00")).toBe(false);
    expect(noArRepetido(base, "2026-10-12", "09:59")).toBe(false);
    expect(noArRepetido(base, "2026-10-13", "10:30")).toBe(false); // terça
    expect(noArRepetido(base, "2026-11-02", "10:30")).toBe(false); // segunda fora do período
  });
  it("faixa que passa da meia-noite continua no dia seguinte", () => {
    const noite = { ...base, dias_semana: [5], janela_inicio: "22:00", janela_fim: "01:00" }; // sexta 22h às 01h
    expect(noArRepetido(noite, "2026-10-16", "23:30")).toBe(true); // sexta
    expect(noArRepetido(noite, "2026-10-17", "00:30")).toBe(true); // madrugada de sábado
    expect(noArRepetido(noite, "2026-10-17", "01:00")).toBe(false);
    expect(noArRepetido(noite, "2026-10-17", "23:00")).toBe(false); // sábado não é dia marcado
    expect(resumoRepeticao(noite)).toBe("Sex · 22h às 01h (dia seguinte)");
  });
  it("textos", () => {
    expect(resumoRepeticao(base)).toBe("Seg e Qua · 10h às 12h");
    expect(textoDias([1, 2, 3, 4, 5])).toBe("Seg a Sex");
    expect(textoDias([6, 0])).toBe("Fim de semana");
    expect(textoDias([0, 1, 2, 3, 4, 5, 6])).toBe("Todos os dias");
    expect(textoDias([5, 1, 3])).toBe("Seg, Qua e Sex");
  });
  it("próximas vezes", () => {
    expect(proximasVezes(base, "2026-10-12", "09:00", 3)).toEqual(["seg 12/10 10h–12h", "qua 14/10 10h–12h", "seg 19/10 10h–12h"]);
    expect(proximasVezes(base, "2026-10-12", "10:30", 2)).toEqual(["agora", "qua 14/10 10h–12h"]);
    expect(proximasVezes({ ...base, data_fim: "2026-10-14" }, "2026-10-12", "13:00", 4)).toEqual(["qua 14/10 10h–12h"]);
  });
  it("situação na lista", () => {
    expect(situacaoRepetida(base, "2026-10-12", "10:30").texto).toBe("No ar agora");
    expect(situacaoRepetida(base, "2026-10-12", "08:00").texto).toBe("Hoje às 10h");
    expect(situacaoRepetida(base, "2026-10-13", "10:30").texto).toBe("Hoje não aparece");
    expect(situacaoRepetida(base, "2026-09-20", "10:30").tipo).toBe("agendada");
    expect(situacaoRepetida(base, "2026-11-02", "10:30").tipo).toBe("encerrada");
  });
});
