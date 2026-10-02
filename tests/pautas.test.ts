import { describe, expect, it } from "vitest";
import { fimDoPeriodo, ehSemPrazo, SEM_PRAZO } from "@/lib/datas";
import { csvRelatorio, horaNoFuso, instanteNoFuso, linhasRelatorio, minutosEntre, ordenarPautas, resumoRelatorio, situacaoPauta, textoRelatorio } from "@/lib/pautas";
import type { Pauta, PautaRealizada } from "@/lib/tipos";

const pauta = (id: string, horario: string, extra: Partial<Pauta> = {}): Pauta => ({
  id,
  data_inicio: "2026-10-02",
  data_fim: "2026-10-02",
  titulo: "",
  conteudo_html: "<p>x</p>",
  ativo: true,
  cliente: `Cliente ${id}`,
  locutor: "Ana",
  horario,
  tipo: "VALENDO",
  ...extra,
});

const feita = (pauta_id: string, iso: string, origem: "locutor" | "producao" = "locutor"): PautaRealizada => ({
  id: `r-${pauta_id}`,
  pauta_id,
  dia: "2026-10-02",
  realizado_em: iso,
  origem,
});

describe("pautas", () => {
  it("mostra o horário feito no fuso de Brasília, seja qual for o do computador", () => {
    expect(horaNoFuso("2026-10-02T13:07:00Z")).toBe("10:07");
    expect(instanteNoFuso("2026-10-02", "10:07")).toBe("2026-10-02T10:07:00-03:00");
    expect(horaNoFuso(instanteNoFuso("2026-10-02", "23:59"))).toBe("23:59");
  });

  it("calcula minutos entre horários", () => {
    expect(minutosEntre("10:00", "10:12")).toBe(12);
    expect(minutosEntre("10:00:00", "09:50")).toBe(-10);
  });

  it("situação no card ao longo do dia", () => {
    const d = "2026-10-02";
    expect(situacaoPauta("10:30:00", undefined, d, d, "09:00")).toEqual({ tipo: "pendente", texto: "Pendente" });
    expect(situacaoPauta("10:30:00", undefined, d, d, "10:20")).toEqual({ tipo: "agora", texto: "Em 10 min" });
    expect(situacaoPauta("10:30:00", undefined, d, d, "10:30")).toEqual({ tipo: "agora", texto: "É agora!" });
    expect(situacaoPauta("10:30:00", undefined, d, d, "10:42")).toEqual({ tipo: "atrasada", texto: "Atrasada 12 min" });
    expect(situacaoPauta("10:30:00", feita("1", "2026-10-02T13:33:00Z"), d, d, "11:00")).toEqual({ tipo: "feita", texto: "Feita às 10:33" });
    expect(situacaoPauta("10:30:00", undefined, "2026-10-01", d, "11:00").tipo).toBe("nao-feita");
    expect(situacaoPauta("10:30:00", undefined, "2026-10-03", d, "11:00").tipo).toBe("pendente");
  });

  it("pendentes primeiro pelo horário, feitas no fim", () => {
    const ps = [pauta("a", "09:00:00"), pauta("b", "11:00:00"), pauta("c", "10:00:00")];
    const ordem = ordenarPautas(ps, new Map([["a", 1]])).map((p) => p.id);
    expect(ordem).toEqual(["c", "b", "a"]);
  });

  it("relatório: no horário, atrasou, adiantou e não feita", () => {
    const ps = [
      pauta("1", "10:00:00", { cliente: "Loja Azul", tipo: "EXPECTATIVA" }),
      pauta("2", "11:00:00", { cliente: "Shopping; Centro" }),
      pauta("3", "12:00:00"),
      pauta("4", "13:00:00"),
    ];
    const rs = [
      feita("1", "2026-10-02T13:04:00Z"),
      feita("2", "2026-10-02T14:20:00Z", "producao"),
      feita("3", "2026-10-02T14:50:00Z"),
    ];
    const linhas = linhasRelatorio(ps, rs);
    expect(linhas.map((l) => l.situacao)).toEqual(["No horário", "Atrasou 20 min", "Adiantou 10 min", "Não feita"]);
    expect(resumoRelatorio(linhas)).toEqual({ total: 4, feitas: 3, naoFeitas: 1, noHorario: 1 });

    const texto = textoRelatorio("2026-10-02", linhas);
    expect(texto).toContain("Relatório de pautas de 02/10/2026");
    expect(texto).toContain("3 de 4 pautas feitas");
    expect(texto).toContain("10:00 · Loja Azul · EXPECTATIVA · Ana → feita às 10:04 (no horário)");
    expect(texto).toContain("[registrada pela produção]");
    expect(texto).toContain("13:00 · Cliente 4 · VALENDO · Ana → NÃO FEITA");

    const csv = csvRelatorio("2026-10-02", linhas);
    expect(csv.startsWith("﻿Data;Horário previsto;Cliente")).toBe(true);
    expect(csv).toContain('"Shopping; Centro"');
    expect(csv.split("\r\n")).toHaveLength(5);
  });

  it("duração em dias e 'sem prazo'", () => {
    expect(fimDoPeriodo("2026-10-02", { qtd: 1, unidade: "dia" })).toBe("2026-10-02");
    expect(fimDoPeriodo("2026-10-02", { qtd: 3, unidade: "dia" })).toBe("2026-10-04");
    expect(ehSemPrazo(SEM_PRAZO)).toBe(true);
    expect(ehSemPrazo("2026-12-31")).toBe(false);
  });
});
