import { describe, expect, it } from "vitest";
import { csvLeituras, linhasLeituras, resumoLeituras, textoLeituras } from "@/lib/relatorioLeituras";
import type { Leitura } from "@/lib/tipos";

const lei = (item_id: string, tipo: Leitura["tipo"], titulo: string, lido_em: string, locutor = ""): Leitura => ({
  id: `${item_id}-${lido_em}`, tipo, item_id, titulo, dia: "2026-10-07", lido_em, locutor,
});

describe("relatório de leituras", () => {
  const noAr = [
    { id: "p1", tipo: "prioridade" as const, titulo: "iPhone 18" },
    { id: "p2", tipo: "prioridade" as const, titulo: "Camarote; Fanzone" },
    { id: "c1", tipo: "conexao" as const, titulo: "Rádio Disney no app" },
  ];
  const leituras = [
    lei("p1", "prioridade", "iPhone 18", "2026-10-07T16:40:00Z", "Gustavo"),
    lei("p1", "prioridade", "iPhone 18", "2026-10-07T13:02:00Z", "Rodrigo"),
    lei("c1", "conexao", "Rádio Disney no app", "2026-10-07T12:15:00Z", "Serginho & Suzana"),
  ];

  it("uma linha por card, com horários em ordem e quem estava no ar; não lidos aparecem", () => {
    const linhas = linhasLeituras(noAr, leituras);
    expect(linhas.map((l) => [l.titulo, l.leituras.map((x) => x.hora)])).toEqual([
      ["Camarote; Fanzone", []],
      ["iPhone 18", ["10:02", "13:40"]],
      ["Rádio Disney no app", ["09:15"]],
    ]);
    expect(linhas[1].leituras[0].locutor).toBe("Rodrigo");
    expect(resumoLeituras(linhas)).toEqual({ cards: 3, lidos: 2, naoLidos: 1, total: 3 });
  });

  it("card que saiu do ar mas foi lido também entra (com o título guardado)", () => {
    const linhas = linhasLeituras([], [lei("velho", "prioridade", "Promo antiga", "2026-10-07T13:00:00Z")]);
    expect(linhas[0].titulo).toBe("Promo antiga");
  });

  it("texto do e-mail e planilha", () => {
    const linhas = linhasLeituras(noAr, leituras);
    const t = textoLeituras("2026-10-07", linhas);
    expect(t).toContain("Relatório de leituras de 07/10/2026");
    expect(t).toContain("3 leituras · 2 de 3 cards lidos · 1 sem leitura");
    expect(t).toContain("PRIORIDADE · iPhone 18 → 2x: 10:02 (Rodrigo), 13:40 (Gustavo)");
    expect(t).toContain("PRIORIDADE · Camarote; Fanzone → 0x: NÃO LIDO");
    const csv = csvLeituras("2026-10-07", linhas);
    expect(csv.split("\r\n")).toHaveLength(5);
    expect(csv).toContain('"Camarote; Fanzone";Não lido');
  });
});
