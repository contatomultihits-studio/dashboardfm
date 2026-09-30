"use client";

import { useMemo } from "react";
import { sanitizarHtml } from "@/lib/html";

export function TextoRico({ html }: { html: string | null | undefined }) {
  const limpo = useMemo(() => sanitizarHtml(html), [html]);
  if (!limpo.trim()) return <p className="texto-rico">—</p>;
  return <div className="texto-rico" dangerouslySetInnerHTML={{ __html: limpo }} />;
}
