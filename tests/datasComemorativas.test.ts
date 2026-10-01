import { describe, expect, it } from "vitest";
import { datasDoAno, datasEntre, nesimoDiaDaSemana, pascoa } from "@/lib/datasComemorativas";

const em = (ano: number, titulo: string) => datasDoAno(ano).find((d) => d.titulo === titulo)?.data;

describe("datas móveis", () => {
  it("calcula a Páscoa", () => {
    expect(pascoa(2026)).toBe("2026-04-05");
    expect(pascoa(2027)).toBe("2027-03-28");
    expect(pascoa(2028)).toBe("2028-04-16");
  });

  it("calcula Carnaval, Sexta-feira Santa e Corpus Christi a partir da Páscoa", () => {
    expect(em(2026, "Carnaval")).toBe("2026-02-17");
    expect(em(2026, "Sexta-feira Santa")).toBe("2026-04-03");
    expect(em(2026, "Corpus Christi")).toBe("2026-06-04");
    expect(em(2027, "Carnaval")).toBe("2027-02-09");
  });

  it("calcula Dia das Mães, dos Pais, do Sorriso e Black Friday", () => {
    expect(em(2026, "Dia das Mães")).toBe("2026-05-10");
    expect(em(2026, "Dia dos Pais")).toBe("2026-08-09");
    expect(em(2026, "Dia Mundial do Sorriso")).toBe("2026-10-02");
    expect(em(2026, "Black Friday")).toBe("2026-11-27");
    expect(em(2027, "Dia das Mães")).toBe("2027-05-09");
  });

  it("acha o n-ésimo dia da semana", () => {
    expect(nesimoDiaDaSemana(2026, 11, 4, 4)).toBe("2026-11-26"); // 4ª quinta de nov/2026
  });
});

describe("datas do período", () => {
  it("traz as datas dos próximos dias, em ordem", () => {
    const semana = datasEntre("2026-10-01", 7).map((d) => `${d.data} ${d.titulo}`);
    expect(semana).toEqual([
      "2026-10-01 Dia Internacional da Música",
      "2026-10-02 Dia Mundial do Sorriso",
      "2026-10-04 Dia dos Animais",
    ]);
  });

  it("atravessa a virada do ano", () => {
    const virada = datasEntre("2026-12-30", 3).map((d) => d.titulo);
    expect(virada).toEqual(["Véspera de Ano Novo", "Ano Novo"]);
  });

  it("marca feriados nacionais", () => {
    expect(datasDoAno(2026).find((d) => d.titulo === "Dia das Crianças")?.feriado).toBe(true);
    expect(datasDoAno(2026).find((d) => d.titulo === "Dia do Professor")?.feriado).toBe(false);
  });

  it("não repete identificadores", () => {
    const ids = datasDoAno(2026).map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
