// O texto rico (mini pauta, descrição etc.) é guardado como HTML.
// Antes de exibir, tudo passa por aqui: só ficam tags e estilos de formatação.

const TAGS_PERMITIDAS = new Set(["P", "DIV", "BR", "B", "STRONG", "I", "EM", "U", "SPAN", "UL", "OL", "LI"]);
const COR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%]+\))$/i;
const ESTILOS: Record<string, RegExp> = {
  color: COR,
  "background-color": COR,
  "font-weight": /^(bold|normal|[1-9]00)$/i,
  "font-style": /^(italic|normal)$/i,
  "text-decoration": /^(underline|none)$/i,
  "text-decoration-line": /^(underline|none)$/i,
  "text-align": /^(left|center|right)$/i,
};

function limparNo(no: Node, doc: Document): Node | null {
  if (no.nodeType === Node.TEXT_NODE) return doc.createTextNode(no.textContent ?? "");
  if (no.nodeType !== Node.ELEMENT_NODE) return null;
  const el = no as HTMLElement;

  const filhos = Array.from(el.childNodes)
    .map((f) => limparNo(f, doc))
    .filter((f): f is Node => f !== null);

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
    const valor = el.style.getPropertyValue(prop).trim();
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
