import { describe, expect, it } from "vitest";
import { diaDaSemana, faixasDoDia, fimDeSemana, horarioFaixa, noArEm, nomesFaixa, proximaFaixa, quemVemDepois } from "@/lib/escala";
import type { ItemEscala, Locutor } from "@/lib/tipos";

const loc = (id: string, nome: string, inicio: string | null = null, fim: string | null = null, extra: Partial<Locutor> = {}): Locutor => ({
  id,
  nome,
  nome_completo: "",
  programa: "",
  cor: "#000000",
  imagem_path: null,
  dias: [1, 2, 3, 4, 5],
  hora_inicio: inicio,
  hora_fim: fim,
  freela: false,
  ativo: true,
  ...extra,
});

// Horário normal da escala da Rádio Disney
const L = [
  loc("serginho", "Serginho", "06:00:00", "10:00:00"),
  loc("suzana", "Suzana", "06:00:00", "10:00:00"),
  loc("rodrigo", "Rodrigo", "10:00:00", "14:00:00"),
  loc("cw", "CW", "14:00:00", "18:00:00"),
  loc("gustavo", "Gustavo", "18:00:00", "22:00:00"),
  loc("vanessa", "Vanessa", "22:00:00", "02:00:00"),
  loc("marcus", "Marcus", null, null, { freela: true }),
  loc("aurelio", "M. Aurélio", null, null, { freela: true }),
];

const esc = (data: string, locutor_id: string, hora_inicio: string, hora_fim: string): ItemEscala => ({ id: `${data}-${locutor_id}-${hora_inicio}`, data, locutor_id, hora_inicio, hora_fim });

// Sábado 03/10 e domingo 04/10/2026
const E = [
  esc("2026-10-03", "serginho", "07:00", "12:00"),
  esc("2026-10-03", "suzana", "07:00", "12:00"),
  esc("2026-10-03", "gustavo", "12:00", "17:00"),
  esc("2026-10-03", "aurelio", "17:00", "22:00"),
  esc("2026-10-03", "marcus", "22:00", "03:00"),
  esc("2026-10-04", "cw", "07:00", "12:00"),
  esc("2026-10-04", "aurelio", "12:00", "17:00"),
  esc("2026-10-04", "vanessa", "17:00", "22:00"),
  esc("2026-10-04", "marcus", "22:00", "03:00"),
];

describe("escala de locutores", () => {
  it("dia da semana sem depender do fuso", () => {
    expect(diaDaSemana("2026-10-03")).toBe(6);
    expect(diaDaSemana("2026-10-04")).toBe(0);
    expect(diaDaSemana("2026-10-05")).toBe(1);
  });

  it("segunda: horário fixo, com a dupla da manhã numa faixa só", () => {
    const f = faixasDoDia("2026-10-05", L, E);
    expect(f.map((x) => `${horarioFaixa(x)} ${nomesFaixa(x)}`)).toEqual([
      "06h às 10h Serginho & Suzana",
      "10h às 14h Rodrigo",
      "14h às 18h CW",
      "18h às 22h Gustavo",
      "22h às 02h Vanessa",
    ]);
    expect(f.every((x) => x.origem === "fixo")).toBe(true);
  });

  it("sábado: só a escala (sem horário fixo no fim de semana)", () => {
    const f = faixasDoDia("2026-10-03", L, E);
    expect(f.map(nomesFaixa)).toEqual(["Serginho & Suzana", "Gustavo", "M. Aurélio", "Marcus"]);
    expect(f.every((x) => x.origem === "escala")).toBe(true);
  });

  it("quem está no ar, inclusive virando a noite, e gravado nos buracos", () => {
    expect(nomesFaixa(noArEm("2026-10-05", "11:30", L, E)!)).toBe("Rodrigo");
    expect(nomesFaixa(noArEm("2026-10-05", "06:00", L, E)!)).toBe("Serginho & Suzana");
    expect(noArEm("2026-10-05", "10:00", L, E)!.locutores[0].id).toBe("rodrigo"); // troca na hora certa
    expect(nomesFaixa(noArEm("2026-10-06", "01:30", L, E)!)).toBe("Vanessa"); // segunda 22h–02h
    expect(noArEm("2026-10-06", "03:00", L, E)).toBeNull(); // gravado
    expect(nomesFaixa(noArEm("2026-10-04", "02:00", L, E)!)).toBe("Marcus"); // sábado 22h–03h
    expect(noArEm("2026-10-04", "05:00", L, E)).toBeNull();
    expect(nomesFaixa(noArEm("2026-10-03", "01:00", L, E)!)).toBe("Vanessa"); // sexta 22h–02h
  });

  it("próximo a entrar", () => {
    expect(nomesFaixa(proximaFaixa("2026-10-05", "11:00", L, E)!)).toBe("CW");
    expect(proximaFaixa("2026-10-05", "23:00", L, E)).toBeNull();
  });

  it("troca num dia de semana substitui só o horário que bate", () => {
    const troca = [esc("2026-10-07", "marcus", "10:00", "14:00")];
    const f = faixasDoDia("2026-10-07", L, troca);
    expect(f.map(nomesFaixa)).toEqual(["Serginho & Suzana", "Marcus", "CW", "Gustavo", "Vanessa"]);
    expect(f[1].origem).toBe("escala");
  });

  it("locutor inativo sai do horário fixo", () => {
    const sem = L.map((l) => (l.id === "cw" ? { ...l, ativo: false } : l));
    expect(faixasDoDia("2026-10-05", sem, []).map(nomesFaixa)).not.toContain("CW");
  });

  it("quem vem depois: no mesmo dia ou o primeiro de amanhã", () => {
    expect(nomesFaixa(quemVemDepois("2026-10-05", "19:00", L, E)!.faixa)).toBe("Vanessa");
    const depois = quemVemDepois("2026-10-05", "23:00", L, E)!;
    expect(nomesFaixa(depois.faixa)).toBe("Serginho & Suzana");
    expect(depois.amanha).toBe(true);
    expect(nomesFaixa(quemVemDepois("2026-10-06", "01:00", L, E)!.faixa)).toBe("Serginho & Suzana");
  });

  it("fim de semana a mostrar: o próximo durante a semana, o atual no sábado e no domingo", () => {
    expect(fimDeSemana("2026-10-05")).toEqual(["2026-10-10", "2026-10-11"]); // segunda
    expect(fimDeSemana("2026-10-09")).toEqual(["2026-10-10", "2026-10-11"]); // sexta
    expect(fimDeSemana("2026-10-10")).toEqual(["2026-10-10", "2026-10-11"]); // sábado
    expect(fimDeSemana("2026-10-11")).toEqual(["2026-10-10", "2026-10-11"]); // domingo
    expect(fimDeSemana("2026-12-28")).toEqual(["2027-01-02", "2027-01-03"]); // virada de ano
  });

  it("formata horários quebrados", () => {
    expect(horarioFaixa({ inicio: "10:30", fim: "14:00" })).toBe("10h30 às 14h");
  });
});
