"use client";

import { useEffect, useRef, useState } from "react";

export function useItensPorPagina(maximo: number) {
  const [n, setN] = useState(maximo);
  useEffect(() => {
    const calc = () => setN(window.innerWidth <= 600 ? 1 : window.innerWidth <= 900 ? 2 : maximo);
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, [maximo]);
  return n;
}

export function Carrossel<T extends { id: string }>({
  titulo,
  itens,
  vazio,
  carregando,
  render,
  porPaginaMax = 3,
  className = "",
  autoAvancarMs,
  ocultarTitulo = false,
  ocultarSeVazio = false,
}: {
  titulo: string;
  itens: T[];
  vazio: string;
  carregando?: boolean;
  render: (item: T) => React.ReactNode;
  /** Quantos cards por linha no computador (no celular é 1, no tablet 2). */
  porPaginaMax?: number;
  className?: string;
  /** Se definido, passa sozinho para a próxima página nesse intervalo (e volta ao início no fim). */
  autoAvancarMs?: number;
  /** Não mostra o título na tela (continua para leitores de tela). */
  ocultarTitulo?: boolean;
  /** Some com a seção inteira quando não há itens (depois de carregar). */
  ocultarSeVazio?: boolean;
}) {
  const porPagina = useItensPorPagina(porPaginaMax);
  const [inicio, setInicio] = useState(0);
  const maxInicio = Math.max(0, itens.length - porPagina);
  const atual = Math.min(inicio, maxInicio);
  const visiveis = itens.slice(atual, atual + porPagina);
  const ultimo = Math.min(itens.length, atual + porPagina);
  const faixa = ultimo === atual + 1 ? `${ultimo}` : `${atual + 1}–${ultimo}`;

  // Avanço automático: pausa enquanto o mouse está em cima ou algo dentro tem foco.
  const [pausado, setPausado] = useState(false);
  const limites = useRef({ atual, maxInicio, porPagina });
  limites.current = { atual, maxInicio, porPagina };
  useEffect(() => {
    if (!autoAvancarMs || pausado) return;
    const timer = setInterval(() => {
      const l = limites.current;
      if (l.maxInicio === 0) return;
      setInicio(l.atual >= l.maxInicio ? 0 : Math.min(l.maxInicio, l.atual + l.porPagina));
    }, autoAvancarMs);
    return () => clearInterval(timer);
  }, [autoAvancarMs, pausado]);

  if (ocultarSeVazio && !carregando && itens.length === 0) return null;

  return (
    <section
      className={`card ${className}`}
      aria-label={titulo}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      {(() => {
        const nav = itens.length > 0 && (
          <div className="carrossel-nav">
            <button type="button" className="icone branco" aria-label={`${titulo}: anteriores`} disabled={atual <= 0} onClick={() => setInicio(Math.max(0, atual - porPagina))}>◀</button>
            <span aria-live="polite" style={{ whiteSpace: "nowrap" }}>{faixa} de {itens.length}</span>
            <button type="button" className="icone" aria-label={`${titulo}: próximos`} disabled={atual >= maxInicio} onClick={() => setInicio(Math.min(maxInicio, atual + porPagina))}>▶</button>
          </div>
        );
        const corpo =
          carregando && itens.length === 0 ? (
            <div className="vazio">Carregando…</div>
          ) : itens.length === 0 ? (
            <div className="vazio">{vazio}</div>
          ) : (
            <div className="carrossel-grade" style={{ gridTemplateColumns: `repeat(${porPagina}, minmax(0, 1fr))` }}>
              {visiveis.map((item) => <div key={item.id} style={{ display: "grid" }}>{render(item)}</div>)}
            </div>
          );
        if (!ocultarTitulo) {
          return (
            <>
              <div className="secao-topo">
                <h2>{titulo}</h2>
                {nav}
              </div>
              {corpo}
            </>
          );
        }
        // Sem título: só os cards; as setas ficam embaixo, e só quando há mais do que cabe na linha.
        return (
          <>
            <h2 className="so-leitor">{titulo}</h2>
            {corpo}
            {itens.length > porPagina && <div className="carrossel-rodape">{nav}</div>}
          </>
        );
      })()}
    </section>
  );
}
