import { expect, it } from "vitest";
import { resumoDados } from "@/lib/historico";

it("resumoDados mostra só o que interessa de um item excluído", () => {
  const r = resumoDados({ id: "x", nome: "Show", descricao_html: "<p>Par de <b>ingressos</b></p>", premio_id: "y", ativo: false, data_inicio: "2026-10-08", imagem_path: null, created_by: "z", evento: true });
  expect(r).toEqual([["nome", "Show"], ["descricao_html", "Par de ingressos"], ["data_inicio", "2026-10-08"], ["evento", "true"]]);
});
