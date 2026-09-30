import { describe, expect, it } from "vitest";
import { normalizarTamanhos, sanitizarHtml, textoPuro } from "@/lib/html";

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

  it("mantém tamanho de fonte relativo (em)", () => {
    expect(sanitizarHtml('<span style="font-size: 1.25em">grande</span>')).toBe('<span style="font-size: 1.25em">grande</span>');
  });

  it("converte tamanho do navegador (palavra ou <font>) para em", () => {
    expect(sanitizarHtml('<span style="font-size: x-large">a</span>')).toBe('<span style="font-size: 1.5em">a</span>');
    expect(sanitizarHtml('<font size="6" color="#dc2626">b</font>')).toBe('<span style="font-size: 2em; color: #dc2626">b</span>');
  });

  it("descarta tamanhos absurdos ou em pixels", () => {
    expect(sanitizarHtml('<span style="font-size: 300px">a</span>')).toBe("<span>a</span>");
    expect(sanitizarHtml('<span style="font-size: 50em">a</span>')).toBe("<span>a</span>");
  });
});

describe("normalizarTamanhos", () => {
  it("troca o que o editor criou por em", () => {
    const div = document.createElement("div");
    div.innerHTML = '<span style="font-size: large">x</span><font size="2">y</font>';
    normalizarTamanhos(div);
    expect(div.innerHTML).toBe('<span style="font-size: 1.25em;">x</span><span style="font-size: 0.85em;">y</span>');
  });
});

describe("textoPuro", () => {
  it("tira as tags e separa as linhas", () => {
    expect(textoPuro("<p>Linha 1</p><p>Linha <b>2</b></p>")).toBe("Linha 1 Linha 2");
  });
});
