"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvisoConfig } from "@/components/AvisoConfig";
import { Carrossel } from "@/components/Carrossel";
import { Imagem } from "@/components/Imagem";
import { Modal } from "@/components/Modal";
import { TextoRico } from "@/components/TextoRico";
import { Topbar } from "@/components/Topbar";
import { ATUALIZAR_A_CADA_MS } from "@/lib/config";
import { fmtData, fmtDiaMes, fmtDiaSemana, fmtHora, hojeISO, somarDias } from "@/lib/datas";
import { textoPuro } from "@/lib/html";
import { urlImagem } from "@/lib/imagens";
import { getSupabase } from "@/lib/supabase/client";
import { VINCULO_LABEL, type Convidado, type Evento, type Prioridade } from "@/lib/tipos";

type Aberto =
  | { tipo: "prioridade"; item: Prioridade }
  | { tipo: "convidado"; item: Convidado }
  | { tipo: "evento"; item: Evento }
  | null;

export function Dashboard() {
  const sb = getSupabase();
  const [dia, setDia] = useState<string | null>(null);
  const [prioridades, setPrioridades] = useState<Prioridade[]>([]);
  const [convidados, setConvidados] = useState<Convidado[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);
  const fechar = useCallback(() => setAberto(null), []);
  const ultimaBusca = useRef(0);

  // O dia só é definido no navegador, para usar o fuso de quem está vendo.
  useEffect(() => setDia(hojeISO()), []);

  const carregar = useCallback(async () => {
    if (!sb || !dia) return;
    const busca = ++ultimaBusca.current;
    setCarregando(true);
    // Filtra "ativo" também aqui: quem está logado enxerga os ocultos pelas regras do banco.
    const [p, c, e] = await Promise.all([
      // No ar no dia escolhido: entrou até esse dia e só sai depois dele. As que saem primeiro vêm antes.
      sb.from("prioridades").select("*").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true)
        .order("data_fim").order("created_at"),
      sb.from("convidados").select("*").gte("data_visita", dia).eq("ativo", true).eq("concluido", false)
        .order("data_visita").order("horario", { nullsFirst: false }).limit(60),
      sb.from("eventos").select("*").gte("data_evento", dia).eq("ativo", true).order("data_evento").limit(60),
    ]);
    if (busca !== ultimaBusca.current) return; // já trocaram de dia; descarta resposta antiga
    const falha = p.error ?? c.error ?? e.error;
    if (falha) {
      setErro(falha.message);
    } else {
      setErro(null);
      setPrioridades(p.data as Prioridade[]);
      setConvidados(c.data as Convidado[]);
      setEventos(e.data as Evento[]);
      setAtualizadoEm(new Date());
    }
    setCarregando(false);
  }, [sb, dia]);

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, ATUALIZAR_A_CADA_MS);
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [carregar]);

  const ehHoje = dia === hojeISO();

  return (
    <>
      <Topbar atual="dashboard" />
      <main className="container">
        {!sb ? (
          <AvisoConfig />
        ) : (
          <>
            <section className="card barra-dia" aria-label="Dia">
              <div>
                <small>{ehHoje ? "Hoje" : "Dia selecionado"}</small>
                <h1>{dia ? fmtDiaSemana(dia) : "…"}</h1>
                {atualizadoEm && (
                  <span className="atualizado">
                    Atualizado às {atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <div className="acoes">
                <button type="button" className="verde" disabled={!dia} onClick={() => dia && setDia(somarDias(dia, -1))}>◀ Dia anterior</button>
                <button type="button" disabled={ehHoje} onClick={() => setDia(hojeISO())}>Hoje</button>
                <button type="button" className="verde" disabled={!dia} onClick={() => dia && setDia(somarDias(dia, 1))}>Próximo dia ▶</button>
                <button type="button" className="branco" onClick={carregar}>Atualizar</button>
              </div>
            </section>

            {erro && <div className="aviso erro">Erro ao buscar dados: {erro}</div>}

            <Carrossel
              key={`prio-${dia}`}
              titulo="Prioridades no ar"
              itens={prioridades}
              carregando={carregando}
              vazio="Sem prioridades para este dia."
              render={(p) => (
                <button type="button" className="item-card" onClick={() => setAberto({ tipo: "prioridade", item: p })}>
                  <Imagem src={urlImagem(sb, p.imagem_path)} alt="" className="thumb" />
                  <span className="item-texto">{textoPuro(p.conteudo_html) || "Prioridade do ar"}</span>
                  <span className="item-rodape">
                    {p.data_fim === dia ? (
                      <span className="etiqueta ultimo-dia">Último dia</span>
                    ) : (
                      <span className="etiqueta cinza">Até {fmtDiaMes(p.data_fim)}</span>
                    )}
                  </span>
                </button>
              )}
            />

            <Carrossel
              key={`conv-${dia}`}
              titulo="Próximos convidados"
              itens={convidados}
              carregando={carregando}
              vazio="Sem convidados programados."
              render={(c) => (
                <button type="button" className="item-card foto-card" onClick={() => setAberto({ tipo: "convidado", item: c })}>
                  <div className="foto-wrap">
                    <Imagem src={urlImagem(sb, c.imagem_path)} alt="" className="thumb" />
                    <div className="foto-overlay">
                      <strong>{c.nome}</strong>
                      <small>{fmtDiaMes(c.data_visita)}{c.horario ? ` às ${fmtHora(c.horario)}` : ""}</small>
                    </div>
                  </div>
                </button>
              )}
            />

            <Carrossel
              key={`evt-${dia}`}
              titulo="Agenda de eventos"
              itens={eventos}
              carregando={carregando}
              vazio="Sem eventos na agenda."
              render={(e) => (
                <button type="button" className="item-card foto-card" onClick={() => setAberto({ tipo: "evento", item: e })}>
                  <div className="foto-wrap">
                    <Imagem src={urlImagem(sb, e.imagem_path)} alt="" className="thumb" />
                    <div className="foto-overlay">
                      <span className={`etiqueta ${e.vinculo === "RADIO_OFICIAL" ? "oficial" : "apoio"}`}>{VINCULO_LABEL[e.vinculo]}</span>
                      <strong>{e.nome}</strong>
                      <small>{fmtDiaMes(e.data_evento)}{e.local ? ` • ${e.local}` : ""}</small>
                    </div>
                  </div>
                </button>
              )}
            />
          </>
        )}
      </main>

      {aberto?.tipo === "prioridade" && (
        <Modal titulo="Prioridade no ar" onFechar={fechar}>
          <div className="modal-meta">
            <span className="etiqueta cinza">
              No ar de {fmtData(aberto.item.data_inicio)} a {fmtData(aberto.item.data_fim)}
            </span>
          </div>
          {aberto.item.imagem_path && <Imagem src={urlImagem(sb, aberto.item.imagem_path)} alt="Imagem da prioridade" className="modal-img" />}
          <TextoRico html={aberto.item.conteudo_html} />
        </Modal>
      )}
      {aberto?.tipo === "convidado" && (
        <Modal titulo={aberto.item.nome} onFechar={fechar}>
          <div className="modal-meta">
            <span className="etiqueta cinza">{fmtData(aberto.item.data_visita)}{aberto.item.horario ? ` às ${fmtHora(aberto.item.horario)}` : ""}</span>
          </div>
          {aberto.item.imagem_path && <Imagem src={urlImagem(sb, aberto.item.imagem_path)} alt={aberto.item.nome} className="modal-img" />}
          <h3>Mini pauta</h3>
          <TextoRico html={aberto.item.mini_pauta_html} />
        </Modal>
      )}
      {aberto?.tipo === "evento" && (
        <Modal titulo={aberto.item.nome} onFechar={fechar}>
          <div className="modal-meta">
            <span className={`etiqueta ${aberto.item.vinculo === "RADIO_OFICIAL" ? "oficial" : "apoio"}`}>{VINCULO_LABEL[aberto.item.vinculo]}</span>
            <span className="etiqueta cinza">{fmtData(aberto.item.data_evento)}</span>
            {aberto.item.local && <span className="etiqueta cinza">{aberto.item.local}</span>}
          </div>
          {aberto.item.imagem_path && <Imagem src={urlImagem(sb, aberto.item.imagem_path)} alt={aberto.item.nome} className="modal-img" />}
          <TextoRico html={aberto.item.descricao_html} />
        </Modal>
      )}
    </>
  );
}
