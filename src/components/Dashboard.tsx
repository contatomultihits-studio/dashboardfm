"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AvisoConfig } from "@/components/AvisoConfig";
import { Carrossel } from "@/components/Carrossel";
import { Imagem } from "@/components/Imagem";
import { Modal } from "@/components/Modal";
import { TextoRico } from "@/components/TextoRico";
import { Topbar } from "@/components/Topbar";
import { ATUALIZAR_A_CADA_MS, VOLTAR_PARA_HOJE_MS } from "@/lib/config";
import { fmtData, fmtDiaMes, fmtDiaSemana, fmtHora, hojeISO, somarDias } from "@/lib/datas";
import { textoPuro } from "@/lib/html";
import { urlImagem } from "@/lib/imagens";
import { getSupabase } from "@/lib/supabase/client";
import { VINCULO_LABEL, type Convidado, type Evento, type Prioridade, type Recado } from "@/lib/tipos";

/** Convidado na dashboard: os que já vieram aparecem depois dos próximos, em preto e branco. */
type ConvidadoCard = Convidado & { jaVeio: boolean };

const ULTIMOS_CONVIDADOS = 6;

type Aberto =
  | { tipo: "prioridade"; item: Prioridade }
  | { tipo: "recado"; item: Recado }
  | { tipo: "convidado"; item: ConvidadoCard }
  | { tipo: "evento"; item: Evento }
  | null;

export function Dashboard() {
  const sb = getSupabase();
  const [dia, setDia] = useState<string | null>(null);
  const [prioridades, setPrioridades] = useState<Prioridade[]>([]);
  const [recados, setRecados] = useState<Recado[]>([]);
  const [convidados, setConvidados] = useState<ConvidadoCard[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);
  const fechar = useCallback(() => setAberto(null), []);
  const ultimaBusca = useRef(0);

  // O dia só é definido no navegador, para usar o fuso de quem está vendo.
  useEffect(() => setDia(hojeISO()), []);

  // Última vez que alguém trocou o dia na mão, e qual era "hoje" na última checagem.
  const ultimaTroca = useRef(0);
  const hojeNaChecagem = useRef(hojeISO());
  const mudarDia = useCallback((novo: string) => {
    ultimaTroca.current = Date.now();
    setDia(novo);
  }, []);

  // A cada minuto: vira o dia à meia-noite para quem está em "hoje", e volta para hoje
  // quem ficou parado muito tempo em outro dia (a tela do estúdio nunca fica presa num dia velho).
  useEffect(() => {
    const checar = () => {
      const agora = hojeISO();
      setDia((atual) => {
        if (!atual) return atual;
        if (atual === hojeNaChecagem.current && atual !== agora) return agora;
        if (atual !== agora && Date.now() - ultimaTroca.current >= VOLTAR_PARA_HOJE_MS) return agora;
        return atual;
      });
      hojeNaChecagem.current = agora;
    };
    const timer = setInterval(checar, 60_000);
    return () => clearInterval(timer);
  }, []);

  const carregar = useCallback(async () => {
    if (!sb || !dia) return;
    const busca = ++ultimaBusca.current;
    setCarregando(true);
    // Filtra "ativo" também aqui: quem está logado enxerga os ocultos pelas regras do banco.
    const [p, r, c, cv, e] = await Promise.all([
      // No ar no dia escolhido: entrou até esse dia e só sai depois dele. As que saem primeiro vêm antes.
      sb.from("prioridades").select("*").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true)
        .order("data_fim").order("created_at"),
      // Recados no ar no dia: os destacados primeiro, depois os que saem antes.
      sb.from("recados").select("*").lte("data_inicio", dia).gte("data_fim", dia).eq("ativo", true)
        .order("destaque", { ascending: false }).order("data_fim").order("created_at"),
      sb.from("convidados").select("*").gte("data_visita", dia).eq("ativo", true).eq("concluido", false)
        .order("data_visita").order("horario", { nullsFirst: false }).limit(60),
      // Últimos que já vieram: data anterior ao dia ou marcados como "já veio".
      sb.from("convidados").select("*").eq("ativo", true).or(`data_visita.lt.${dia},concluido.eq.true`)
        .order("data_visita", { ascending: false }).order("horario", { ascending: false, nullsFirst: false })
        .limit(ULTIMOS_CONVIDADOS),
      sb.from("eventos").select("*").gte("data_evento", dia).eq("ativo", true).order("data_evento").limit(60),
    ]);
    if (busca !== ultimaBusca.current) return; // já trocaram de dia; descarta resposta antiga
    const falha = p.error ?? r.error ?? c.error ?? cv.error ?? e.error;
    if (falha) {
      setErro(falha.message);
    } else {
      setErro(null);
      setPrioridades(p.data as Prioridade[]);
      setRecados(r.data as Recado[]);
      setConvidados([
        ...(c.data as Convidado[]).map((x) => ({ ...x, jaVeio: false })),
        ...(cv.data as Convidado[]).map((x) => ({ ...x, jaVeio: true })),
      ]);
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
      <Topbar
        atual="dashboard"
        meio={
          sb && (
            <div className="barra-dia" role="group" aria-label="Dia">
              <div className="barra-dia-data">
                <small>
                  {ehHoje ? "Hoje" : "Dia selecionado"}
                  {atualizadoEm &&
                    ` · atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
                </small>
                <strong>{dia ? fmtDiaSemana(dia) : "…"}</strong>
              </div>
              <div className="barra-dia-acoes">
                <button type="button" className="pequeno verde" disabled={!dia} onClick={() => dia && mudarDia(somarDias(dia, -1))}>◀ Dia anterior</button>
                <button type="button" className="pequeno" disabled={ehHoje} onClick={() => mudarDia(hojeISO())}>Hoje</button>
                <button type="button" className="pequeno verde" disabled={!dia} onClick={() => dia && mudarDia(somarDias(dia, 1))}>Próximo dia ▶</button>
                <button type="button" className="pequeno branco" onClick={carregar} title="Buscar de novo agora">↻ Atualizar</button>
              </div>
            </div>
          )
        }
      />
      <main className="container">
        {!sb ? (
          <AvisoConfig />
        ) : (
          <>

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
                  <span className="item-titulo">{p.titulo || textoPuro(p.conteudo_html) || "Prioridade do ar"}</span>
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
              key={`rec-${dia}`}
              titulo="Recados rápidos"
              className="secao-recados"
              itens={recados}
              carregando={carregando}
              porPaginaMax={4}
              vazio="Sem recados para este dia."
              render={(r) => (
                <button
                  type="button"
                  className={`item-card recado-card ${r.destaque ? "destaque" : ""}`}
                  onClick={() => setAberto({ tipo: "recado", item: r })}
                >
                  {r.destaque && <span className="etiqueta destaque">Importante</span>}
                  <span className="item-titulo">{r.titulo || textoPuro(r.conteudo_html) || "Recado"}</span>
                  <span className="item-rodape">
                    {r.data_fim === dia ? (
                      <span className="etiqueta ultimo-dia">Último dia</span>
                    ) : (
                      <span className="etiqueta cinza">Até {fmtDiaMes(r.data_fim)}</span>
                    )}
                  </span>
                </button>
              )}
            />

            <Carrossel
              key={`conv-${dia}`}
              titulo={convidados.some((c) => !c.jaVeio) || convidados.length === 0 ? "Próximos convidados" : "Últimos convidados"}
              itens={convidados}
              carregando={carregando}
              vazio="Sem convidados programados."
              render={(c) => (
                <button type="button" className={`item-card foto-card ${c.jaVeio ? "ja-veio" : ""}`} onClick={() => setAberto({ tipo: "convidado", item: c })}>
                  <div className="foto-wrap">
                    <Imagem src={urlImagem(sb, c.imagem_path)} alt="" className="thumb" />
                    <div className="foto-overlay">
                      {c.jaVeio && <span className="etiqueta cinza">Já veio</span>}
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
        <Modal titulo={aberto.item.titulo || "Prioridade no ar"} onFechar={fechar} leitura>
          <div className="modal-meta">
            <span className="etiqueta cinza">
              No ar de {fmtData(aberto.item.data_inicio)} a {fmtData(aberto.item.data_fim)}
            </span>
          </div>
          <TextoRico html={aberto.item.conteudo_html} />
        </Modal>
      )}
      {aberto?.tipo === "recado" && (
        <Modal titulo={aberto.item.titulo || "Recado"} onFechar={fechar} leitura>
          <div className="modal-meta">
            {aberto.item.destaque && <span className="etiqueta destaque">Importante</span>}
            <span className="etiqueta cinza">
              No ar de {fmtData(aberto.item.data_inicio)} a {fmtData(aberto.item.data_fim)}
            </span>
          </div>
          <TextoRico html={aberto.item.conteudo_html} />
        </Modal>
      )}
      {aberto?.tipo === "convidado" && (
        <Modal titulo={aberto.item.nome} onFechar={fechar} leitura>
          <div className="modal-meta">
            {aberto.item.jaVeio && <span className="etiqueta cinza">Já veio</span>}
            <span className="etiqueta cinza">{fmtData(aberto.item.data_visita)}{aberto.item.horario ? ` às ${fmtHora(aberto.item.horario)}` : ""}</span>
          </div>
          <h3>Mini pauta</h3>
          <TextoRico html={aberto.item.mini_pauta_html} />
        </Modal>
      )}
      {aberto?.tipo === "evento" && (
        <Modal titulo={aberto.item.nome} onFechar={fechar} leitura>
          <div className="modal-meta">
            <span className={`etiqueta ${aberto.item.vinculo === "RADIO_OFICIAL" ? "oficial" : "apoio"}`}>{VINCULO_LABEL[aberto.item.vinculo]}</span>
            <span className="etiqueta cinza">{fmtData(aberto.item.data_evento)}</span>
            {aberto.item.local && <span className="etiqueta cinza">{aberto.item.local}</span>}
          </div>
          <TextoRico html={aberto.item.descricao_html} />
        </Modal>
      )}
    </>
  );
}
