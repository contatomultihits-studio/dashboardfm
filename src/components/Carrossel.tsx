"use client";

import { useEffect, useState } from "react";

function useItensPorPagina() {
  const [n, setN] = useState(3);
  useEffect(() => {
    const calc = () => setN(window.innerWidth <= 600 ? 1 : window.innerWidth <= 900 ? 2 : 3);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  return n;
}

export function Carrossel<T extends { id: string }>({
  titulo,
  itens,
  vazio,
  carregando,
  render,
}: {
  titulo: string;
  itens: T[];
  vazio: string;
  carregando?: boolean;
  render: (item: T) => React.ReactNode;
}) {
  const porPagina = useItensPorPagina();
  const [inicio, setInicio] = useState(0);
  const maxInicio = Math.max(0, itens.length - porPagina);
  const atual = Math.min(inicio, maxInicio);
  const visiveis = itens.slice(atual, atual + porPagina);
  const ultimo = Math.min(itens.length, atual + porPagina);
  const faixa = ultimo === atual + 1 ? `${ultimo}` : `${atual + 1}–${ultimo}`;

  return (
    <section className="card" aria-label={titulo}>
      <div className="secao-topo">
        <h2>{titulo}</h2>
        {itens.length > 0 && (
          <div className="carrossel-nav">
            <button type="button" className="icone branco" aria-label={`${titulo}: anteriores`} disabled={atual <= 0} onClick={() => setInicio(Math.max(0, atual - porPagina))}>◀</button>
            <span aria-live="polite" style={{ whiteSpace: "nowrap" }}>{faixa} de {itens.length}</span>
            <button type="button" className="icone" aria-label={`${titulo}: próximos`} disabled={atual >= maxInicio} onClick={() => setInicio(Math.min(maxInicio, atual + porPagina))}>▶</button>
          </div>
        )}
      </div>
      {carregando && itens.length === 0 ? (
        <div className="vazio">Carregando…</div>
      ) : itens.length === 0 ? (
        <div className="vazio">{vazio}</div>
      ) : (
        <div className="carrossel-grade">{visiveis.map((item) => <div key={item.id} style={{ display: "grid" }}>{render(item)}</div>)}</div>
      )}
    </section>
  );
}
