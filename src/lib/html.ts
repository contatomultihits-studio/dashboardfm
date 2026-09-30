// O texto rico (mini pauta, descrição etc.) é guardado como HTML.
// Antes de exibir, tudo passa por aqui: só ficam tags e estilos de formatação.

const TAGS_PERMITIDAS = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "SPAN", "UL", "OL", "LI"]);

/** Tamanhos do editor. Guardados em "em" (relativos ao texto), para crescer junto na tela de leitura. */
export const TAMANHOS = [
  { rotulo: "Pequeno", em: "0.85em", comando: "2" },
  { rotulo: "Normal", em: "1em", comando: "3" },
  { rotulo: "Grande", em: "1.25em", comando: "4" },
  { rotulo: "Muito grande", em: "1.5em", comando: "5" },
  { rotulo: "Enorme", em: "2em", comando: "6" },
] as const;

// O navegador aplica tamanho como palavra (font-size: large) ou <font size="4">; convertemos para "em".
const TAMANHO_PALAVRA: Record<string, string> = {
  "xx-small": "0.75em", "x-small": "0.75em", small: "0.85em", medium: "1em",
  large: "1.25em", "x-large": "1.5em", "xx-large": "2em", "xxx-large": "2.5em",
};
const TAMANHO_FONT: Record<string, string> = { "1": "0.75em", "2": "0.85em", "3": "1em", "4": "1.25em", "5": "1.5em", "6": "2em", "7": "2.5em" };
const TAMANHO_EM = /^(0\.[5-9]\d*|[12](\.\d+)?|2\.5|3)em$/;

function tamanhoEm(valor: string): string | null {
  const v = valor.trim().toLowerCase();
  const convertido = TAMANHO_PALAVRA[v] ?? v;
  return TAMANHO_EM.test(convertido) ? convertido : null;
}

/** Troca, dentro do editor, os tamanhos que o navegador criou pelo formato em "em". */
export function normalizarTamanhos(raiz: HTMLElement) {
  raiz.querySelectorAll("font[size]").forEach((font) => {
    const span = raiz.ownerDocument.createElement("span");
    const em = TAMANHO_FONT[font.getAttribute("size") ?? ""];
    if (em) span.style.fontSize = em;
    const cor = font.getAttribute("color");
    if (cor) span.style.color = cor;
    while (font.firstChild) span.appendChild(font.firstChild);
    font.replaceWith(span);
  });
  raiz.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    if (!el.style.fontSize) return;
    const em = tamanhoEm(el.style.fontSize);
    if (em) el.style.fontSize = em;
    else el.style.removeProperty("font-size");
  });
}
const COR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\))$/i;
const ESTILOS: Record<string, RegExp> = {
  color: COR,
  "background-color": COR,
  "font-weight": /^(bold|normal|[1-9]00)$/i,
  "font-style": /^(italic|normal)$/i,
  "text-decoration": /^(underline|none)$/i,
  "text-decoration-line": /^(underline|none)$/i,
  "text-align": /^(left|center|right)$/i,
  "font-size": TAMANHO_EM,
};

function limparNo(no: Node, doc: Document): Node | null {
  if (no.nodeType === Node.TEXT_NODE) return doc.createTextNode(no.textContent ?? "");
  if (no.nodeType !== Node.ELEMENT_NODE) return null;
  const el = no as HTMLElement;

  const filhos = Array.from(el.childNodes)
    .map((f) => limparNo(f, doc))
    .filter((f): f is Node => f !== null);

  // <font size/color> vira <span> com estilo equivalente.
  if (el.tagName === "FONT") {
    const span = doc.createElement("span");
    const estilos: string[] = [];
    const em = TAMANHO_FONT[el.getAttribute("size") ?? ""];
    if (em) estilos.push(`font-size: ${em}`);
    const cor = el.getAttribute("color") ?? "";
    if (COR.test(cor)) estilos.push(`color: ${cor}`);
    if (estilos.length) span.setAttribute("style", estilos.join("; "));
    filhos.forEach((f) => span.appendChild(f));
    return span;
  }

  // Tag não permitida: mantém só o conteúdo (menos script/style, que somem).
  if (!TAGS_PERMITIDAS.has(el.tagName)) {
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "TEMPLATE"].includes(el.tagName)) return null;
    const frag = doc.createDocumentFragment();
    filhos.forEach((f) => frag.appendChild(f));
    return frag;
  }

  const novo = doc.createElement(el.tagName.toLowerCase());
  const estilos: string[] = [];
  for (const prop of Object.keys(ESTILOS)) {
    let valor = el.style.getPropertyValue(prop).trim();
    if (prop === "font-size" && valor) valor = tamanhoEm(valor) ?? "";
    if (valor && ESTILOS[prop].test(valor)) estilos.push(`${prop}: ${valor}`);
  }
  if (estilos.length) novo.setAttribute("style", estilos.join("; "));
  filhos.forEach((f) => novo.appendChild(f));
  return novo;
}

export function sanitizarHtml(html: string | null | undefined): string {
  if (!html || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const raiz = doc.body.firstElementChild;
  if (!raiz) return "";
  const saida = doc.createElement("div");
  Array.from(raiz.childNodes).forEach((f) => {
    const limpo = limparNo(f, doc);
    if (limpo) saida.appendChild(limpo);
  });
  return saida.innerHTML;
}

export function textoPuro(html: string | null | undefined): string {
  if (!html) return "";
  if (typeof DOMParser === "undefined") return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const doc = new DOMParser().parseFromString(html.replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, " $&"), "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}
