import { describe, expect, it } from "vitest";
import { csvGanhadores, datasEntre, fmtTelefone, gerarHorarios, localOuvinte, momentoPromo, normalizarBusca, normalizarTelefone, premiosParaLembrar, situacaoOuvinte, textoFaltamPremio } from "@/lib/promocao";

const livre = { bloqueado: false, motivo_bloqueio: "" };

describe("telefone", () => {
  it("guarda só os números e tira o +55", () => {
    expect(normalizarTelefone("(11) 9 9999-8888")).toBe("11999998888");
    expect(normalizarTelefone("+55 11 99999-8888")).toBe("11999998888");
    expect(normalizarTelefone("")).toBe("");
  });
  it("formata celular e fixo", () => {
    expect(fmtTelefone("11999998888")).toBe("(11) 99999-8888");
    expect(fmtTelefone("1133334444")).toBe("(11) 3333-4444");
    expect(fmtTelefone("999")).toBe("999");
  });
});

describe("busca e local", () => {
  it("ignora acento e maiúscula", () => {
    expect(normalizarBusca("  João ÁVILA ")).toBe("joao avila");
  });
  it("junta bairro e cidade só com o que tem", () => {
    expect(localOuvinte({ bairro: "Tatuapé", cidade: "São Paulo" })).toBe("Tatuapé · São Paulo");
    expect(localOuvinte({ bairro: "", cidade: "Osasco" })).toBe("Osasco");
    expect(localOuvinte({ bairro: "", cidade: "" })).toBe("");
  });
});

describe("regra dos 30 dias", () => {
  it("nunca ganhou: pode", () => {
    expect(situacaoOuvinte(livre, [], "2026-10-08").tipo).toBe("livre");
  });
  it("ganhou há 29 dias: não pode; libera no 30º dia", () => {
    const s = situacaoOuvinte(livre, [{ data: "2026-09-09" }], "2026-10-08");
    expect(s.tipo).toBe("carencia");
    if (s.tipo === "carencia") expect(s.liberaEm).toBe("2026-10-09");
    expect(situacaoOuvinte(livre, [{ data: "2026-09-09" }], "2026-10-09").tipo).toBe("livre");
  });
  it("ganhou hoje: não pode de novo", () => {
    expect(situacaoOuvinte(livre, [{ data: "2026-10-08" }], "2026-10-08").tipo).toBe("carencia");
  });
  it("vale a vitória mais recente", () => {
    const s = situacaoOuvinte(livre, [{ data: "2026-08-01" }, { data: "2026-10-01" }], "2026-10-08");
    expect(s.tipo === "carencia" && s.ultima).toBe("2026-10-01");
  });
  it("bloqueado nunca ganha, com o motivo", () => {
    const s = situacaoOuvinte({ bloqueado: true, motivo_bloqueio: "Fraude" }, [], "2026-10-08");
    expect(s).toEqual({ tipo: "bloqueado", texto: "Bloqueado: Fraude" });
  });
});

describe("grade", () => {
  it("de hora em hora, incluindo o último horário", () => {
    expect(gerarHorarios("09:00", "12:00", 60)).toEqual(["09:00", "10:00", "11:00", "12:00"]);
  });
  it("a cada 2 horas e a cada 30 min", () => {
    expect(gerarHorarios("10:00", "17:00", 120)).toEqual(["10:00", "12:00", "14:00", "16:00"]);
    expect(gerarHorarios("10:00", "11:00", 30)).toEqual(["10:00", "10:30", "11:00"]);
  });
  it("entradas inválidas: vazio", () => {
    expect(gerarHorarios("", "12:00", 60)).toEqual([]);
    expect(gerarHorarios("09:00", "12:00", 0)).toEqual([]);
  });
  it("datas do período", () => {
    expect(datasEntre("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(datasEntre("2026-10-30", "2026-10-29")).toEqual([]);
  });
});

describe("carrossel: último, da hora, próximo", () => {
  const r = (h: string) => ({ id: h, horario: `${h}:00` });
  const dia = [r("12:00"), r("10:00"), r("11:00")];
  it("antes do primeiro: só o próximo", () => {
    expect(momentoPromo(dia, "09:30")).toEqual({ ultimo: null, daHora: null, proximo: r("10:00") });
  });
  it("no meio do dia", () => {
    expect(momentoPromo(dia, "11:20")).toEqual({ ultimo: r("10:00"), daHora: r("11:00"), proximo: r("12:00") });
  });
  it("no minuto exato vira o da hora", () => {
    expect(momentoPromo(dia, "10:00").daHora).toEqual(r("10:00"));
  });
  it("o último do dia vale por 1 hora, depois vira 'último'", () => {
    expect(momentoPromo(dia, "12:59").daHora).toEqual(r("12:00"));
    expect(momentoPromo(dia, "13:00")).toEqual({ ultimo: r("12:00"), daHora: null, proximo: null });
  });
  it("sem rodadas: tudo vazio", () => {
    expect(momentoPromo([], "10:00")).toEqual({ ultimo: null, daHora: null, proximo: null });
  });
});

describe("planilha de ganhadores", () => {
  it("colunas e telefone formatado", () => {
    const csv = csvGanhadores([{
      id: "g", ouvinte_id: "o", rodada_id: "r", premio_id: null, premio_nome: "Ingresso; pista", data: "2026-10-08", ganho_em: "", locutor: "Gustavo", importado: false, obs: "",
      horario: "15:00",
      ouvinte: { id: "o", nome: "Maria", telefone: "11999998888", bairro: "Tatuapé", cidade: "São Paulo", bloqueado: false, motivo_bloqueio: "" },
    }]);
    const [cab, linha] = csv.replace("﻿", "").split("\r\n");
    expect(cab).toBe("Data;Horário;Ouvinte;Telefone;Bairro;Cidade;Prêmio;Locutor;Observação");
    expect(linha).toBe('08/10/2026;15:00;Maria;(11) 99999-8888;Tatuapé;São Paulo;"Ingresso; pista";Gustavo;');
  });
});

describe("pop-up do prêmio", () => {
  const r = (id: string, h: string, aviso = true) => ({ id, horario: `${h}:00`, aviso });
  const lista = [r("a", "10:00"), r("b", "11:00"), r("c", "10:03", false)];
  it("5 min antes, só os que pedem aviso", () => {
    expect(premiosParaLembrar(lista, new Set(), new Set(), "09:54")).toEqual([]);
    expect(premiosParaLembrar(lista, new Set(), new Set(), "09:55").map((l) => [l.rodada.id, l.faltam])).toEqual([["a", 5]]);
  });
  it("fica até 15 min depois; some com ganhador ou fechado", () => {
    expect(premiosParaLembrar(lista, new Set(), new Set(), "10:15").map((l) => l.rodada.id)).toEqual(["a"]);
    expect(premiosParaLembrar(lista, new Set(), new Set(), "10:16")).toEqual([]);
    expect(premiosParaLembrar(lista, new Set(["a"]), new Set(), "10:00")).toEqual([]);
    expect(premiosParaLembrar(lista, new Set(), new Set(["a"]), "10:00")).toEqual([]);
  });
  it("textos", () => {
    expect(textoFaltamPremio(3)).toBe("Em 3 min");
    expect(textoFaltamPremio(0)).toBe("É agora!");
    expect(textoFaltamPremio(-4)).toBe("Começou há 4 min");
  });
});
