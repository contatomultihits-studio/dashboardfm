import { describe, expect, it } from "vitest";
import { sanitizarHtml, textoPuro } from "@/lib/html";

describe("sanitizarHtml", () => {
  it("mantém a formatação do editor", () => {
    const html = '<b>Oi</b> <span style="color: rgb(220, 38, 38); background-color: #fff06a;">vermelho</span><ul><li>item</li></ul>';
    expect(sanitizarHtml(html)).toBe(
      '<b>Oi</b> <span style="color: rgb(220, 38, 38); background-color: rgb(255, 240, 106)">vermelho</span><ul><li>item</li></ul>',
    );
  });

  it("remove scripts, eventos e links perigosos", () => {
    const limpo = sanitizarHtml('<img src=x onerror="alert(1)"><script>alert(2)</script><a href="javascript:alert(3)">clique</a><b onclick="x()">ok</b>');
    expect(limpo).toBe("clique<b>ok</b>");
  });

  it("descarta estilos fora da lista", () => {
    expect(sanitizarHtml('<span style="position: fixed; color: red; background-image: url(x)">a</span>')).toBe("<span>a</span>");
  });

  it("vazio continua vazio", () => {
    expect(sanitizarHtml(null)).toBe("");
  });
});

describe("textoPuro", () => {
  it("tira as tags e separa as linhas", () => {
    expect(textoPuro("<p>Linha 1</p><p>Linha <b>2</b></p>")).toBe("Linha 1 Linha 2");
  });
});
