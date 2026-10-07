import { beforeEach, describe, expect, it } from "vitest";
import { lerLeituras, ordenarPorLeitura, salvarLeituras } from "@/lib/leituras";

const it_ = (id: string, fixado = false) => ({ id, fixado });

describe("já lido vai para o fim", () => {
  beforeEach(() => localStorage.clear());

  it("fixados na frente, depois não lidos, depois lidos (o mais antigo primeiro)", () => {
    const itens = [it_("a"), it_("b"), it_("fix", true), it_("c"), it_("d")];
    const lidos = { a: "2026-10-07T13:30:00Z", c: "2026-10-07T13:10:00Z", fix: "2026-10-07T13:00:00Z" };
    expect(ordenarPorLeitura(itens, lidos).map((i) => i.id)).toEqual(["fix", "b", "d", "c", "a"]);
  });

  it("sem leituras, mantém a ordem (com fixados na frente)", () => {
    expect(ordenarPorLeitura([it_("a"), it_("b", true), it_("c")], {}).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("quando todos foram lidos, o lido há mais tempo volta para a frente", () => {
    const lidos = { a: "2026-10-07T13:00:00Z", b: "2026-10-07T13:05:00Z", c: "2026-10-07T12:55:00Z" };
    expect(ordenarPorLeitura([it_("a"), it_("b"), it_("c")], lidos).map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("guarda no navegador e zera quando muda o dia", () => {
    salvarLeituras("2026-10-07", { a: "2026-10-07T13:00:00Z" });
    expect(lerLeituras("2026-10-07")).toEqual({ a: "2026-10-07T13:00:00Z" });
    expect(lerLeituras("2026-10-08")).toEqual({});
  });
});
