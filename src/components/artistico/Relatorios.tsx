"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Avisar } from "./comum";
import { usePremios } from "./promocao/comum";
import { Ganhadores } from "./promocao/Ganhadores";
import { RelatorioLeituras } from "./RelatorioLeituras";
import { RelatorioPautas } from "./RelatorioPautas";

const RELATORIOS = [
  { id: "partiu", icone: "🚗", titulo: "Relatório do Partiu", texto: "Pautas das ações externas: previsto x feito, para a Opec e os produtores." },
  { id: "jornalismo", icone: "📰", titulo: "Relatório do Jornalismo", texto: "Pautas do jornalismo: previsto x feito, no mesmo formato." },
  { id: "leituras", icone: "📖", titulo: "Relatório de leituras", texto: "Quantas vezes cada prioridade e conexão foi lida, a que horas e por quem." },
  { id: "ganhadores", icone: "🏆", titulo: "Ganhadores da promoção", texto: "Quem ganhou o quê, por período, com planilha para baixar." },
] as const;
type Relatorio = (typeof RELATORIOS)[number]["id"];

/** Todos os relatórios numa página só: um card para cada, e o escolhido abre embaixo. */
export function Relatorios({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const [aberto, setAberto] = useState<Relatorio | null>(null);
  const premios = usePremios(sb);

  return (
    <>
      <section className="card">
        <div className="secao-topo"><h2>Relatórios</h2></div>
        <div className="relatorios-grade" role="tablist" aria-label="Relatórios">
          {RELATORIOS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={aberto === r.id}
              className={`relatorio-card ${aberto === r.id ? "ativo" : ""}`}
              onClick={() => setAberto(r.id)}
            >
              <span className="relatorio-icone" aria-hidden>{r.icone}</span>
              <strong>{r.titulo}</strong>
              <span className="relatorio-card-texto">{r.texto}</span>
            </button>
          ))}
          <div className="relatorio-card em-breve" aria-disabled="true">
            <span className="relatorio-icone" aria-hidden>📊</span>
            <strong>Métricas das promoções</strong>
            <span className="relatorio-card-texto">Gráficos, grandes números e participações. Em breve.</span>
          </div>
        </div>
        {!aberto && <p className="dica" style={{ marginTop: 12 }}>Escolha um relatório para abrir.</p>}
      </section>

      {aberto === "partiu" && <RelatorioPautas key="partiu" sb={sb} avisar={avisar} secao="partiu" />}
      {aberto === "jornalismo" && <RelatorioPautas key="jornalismo" sb={sb} avisar={avisar} secao="jornalismo" />}
      {aberto === "leituras" && <RelatorioLeituras sb={sb} avisar={avisar} />}
      {aberto === "ganhadores" && <Ganhadores sb={sb} avisar={avisar} premiosLista={premios} />}
    </>
  );
}
