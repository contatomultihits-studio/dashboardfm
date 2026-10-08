"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtData, hojeISO } from "@/lib/datas";
import { fmtTelefone, localOuvinte, situacaoOuvinte, type Ganhador, type Ouvinte } from "@/lib/promocao";
import { erroMsg, type Avisar } from "../comum";
import { CARREGAR_MAIS, POR_PAGINA } from "./comum";
import { EditarOuvinte } from "./EditarOuvinte";
import { buscarOuvintes, comVitorias } from "./RegistrarGanhador";

type Linha = { ouvinte: Ouvinte; vitorias: Pick<Ganhador, "data" | "premio_nome">[] };


/**
 * Base de ouvintes: busca "já ganhou?", histórico, cadastro e lista de bloqueados.
 * `bloqueados`: só a lista de bloqueados (na aba Ganhadores e bloqueados).
 */
export function Ouvintes({ sb, avisar, bloqueados = false }: { sb: SupabaseClient; avisar: Avisar; bloqueados?: boolean }) {
  const hoje = hojeISO();
  const [termo, setTermo] = useState("");
  const [soBloqueadosMarcado, setSoBloqueados] = useState(false);
  const soBloqueados = bloqueados || soBloqueadosMarcado;
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  // Ouvinte aberto na janela de edição ("novo" = cadastro).
  const [editando, setEditando] = useState<Ouvinte | "novo" | null>(null);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [temMais, setTemMais] = useState(false);

  // Nova busca ou filtro: volta para os primeiros.
  useEffect(() => setLimite(POR_PAGINA), [termo, soBloqueados]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const t = termo.trim();
      let r: Linha[];
      if (t.length >= 2) {
        r = await buscarOuvintes(sb, t, soBloqueados ? 200 : limite + 1);
        if (soBloqueados) r = r.filter((x) => x.ouvinte.bloqueado);
      } else {
        let q = sb.from("ouvintes").select("*");
        if (soBloqueados) q = q.eq("bloqueado", true);
        const { data, error } = await q.order("created_at", { ascending: false }).limit(limite + 1);
        if (error) throw new Error(error.message);
        r = await comVitorias(sb, data as Ouvinte[]);
      }
      setTemMais(r.length > limite);
      setLinhas(r.slice(0, limite));
    } catch (e) {
      avisar(erroMsg(e), true);
    } finally {
      setCarregando(false);
    }
  }, [sb, termo, soBloqueados, limite, avisar]);

  useEffect(() => {
    const timer = setTimeout(carregar, 300);
    return () => clearTimeout(timer);
  }, [carregar]);

  async function bloquear(o: Ouvinte) {
    if (o.bloqueado) {
      if (!confirm(`Desbloquear ${o.nome}? Volta a poder ganhar (respeitando os 30 dias).`)) return;
      const { error } = await sb.from("ouvintes").update({ bloqueado: false, motivo_bloqueio: "" }).eq("id", o.id);
      if (error) return avisar(error.message, true);
      avisar(`${o.nome} desbloqueado`);
    } else {
      const motivo = prompt(`Bloquear ${o.nome}. Qual o motivo? (aparece para a equipe)`);
      if (motivo === null) return;
      const { error } = await sb.from("ouvintes").update({ bloqueado: true, motivo_bloqueio: motivo.trim() }).eq("id", o.id);
      if (error) return avisar(error.message, true);
      avisar(`${o.nome} bloqueado`);
    }
    carregar();
  }

  async function excluir(l: Linha) {
    const extra = l.vitorias.length ? ` Isso apaga também o histórico de ${l.vitorias.length} ${l.vitorias.length === 1 ? "prêmio" : "prêmios"}.` : "";
    if (!confirm(`Excluir ${l.ouvinte.nome} da base?${extra} Não dá para desfazer.`)) return;
    const { error } = await sb.from("ouvintes").delete().eq("id", l.ouvinte.id);
    if (error) return avisar(error.message, true);
    avisar("Ouvinte excluído");
    carregar();
  }

  return (
    <>
      <section className="card">
        <div className="secao-topo" style={{ flexWrap: "wrap" }}>
          <h2>{bloqueados ? "Ouvintes bloqueados" : "Ouvintes · já ganhou?"}</h2>
          <div className="tabela-acoes" style={{ alignItems: "center" }}>
            {!bloqueados && (
              <label className="check">
                <input type="checkbox" checked={soBloqueados} onChange={(e) => setSoBloqueados(e.target.checked)} />
                Só bloqueados
              </label>
            )}
            <button type="button" className="pequeno amarelo" data-edita onClick={() => setEditando("novo")}>+ Cadastrar ouvinte / bloquear</button>
          </div>
        </div>
        <label className="campo">
          {bloqueados ? "Buscar entre os bloqueados" : "Buscar por nome ou telefone"}
          <input type="search" placeholder="Ex.: Maria Silva ou 99999-8888" value={termo} onChange={(e) => setTermo(e.target.value)} />
        </label>
        <p className="dica" style={{ marginTop: 8 }}>
          {termo.trim().length >= 2 ? "Resultado da busca" : soBloqueados ? "Lista de bloqueados" : "Últimos cadastrados"} · regra: quem ganhou só pode ganhar de novo depois de 30 dias.
        </p>
        {!carregando && linhas.length === 0 ? (
          <div className="vazio">{termo.trim().length >= 2 ? `Ninguém encontrado com “${termo.trim()}”.` : soBloqueados ? "Nenhum ouvinte bloqueado." : "Nenhum ouvinte na base ainda."}</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr><th>Ouvinte</th><th>Prêmios</th><th>Situação hoje</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const s = situacaoOuvinte(l.ouvinte, l.vitorias, hoje);
                  return (
                    <Fragment key={l.ouvinte.id}>
                      <tr>
                        <td className="texto">
                          <strong>{l.ouvinte.nome}</strong>
                          <div className="trecho">{[fmtTelefone(l.ouvinte.telefone), localOuvinte(l.ouvinte)].filter(Boolean).join(" · ") || "Sem telefone e endereço"}</div>
                        </td>
                        <td>
                          {l.vitorias.length ? (
                            <button type="button" className="pequeno branco" aria-expanded={aberto === l.ouvinte.id} onClick={() => setAberto(aberto === l.ouvinte.id ? null : l.ouvinte.id)}>
                              {l.vitorias.length} · último {fmtData(l.vitorias[0].data)} {aberto === l.ouvinte.id ? "▲" : "▼"}
                            </button>
                          ) : "Nunca ganhou"}
                        </td>
                        <td><span className={`situacao-ouvinte ${s.tipo}`}>{s.texto}</span></td>
                        <td>
                          <div className="tabela-acoes">
                            <button type="button" className="pequeno" onClick={() => setEditando(l.ouvinte)}>Editar</button>
                            <button type="button" className={`pequeno ${l.ouvinte.bloqueado ? "verde" : "branco"}`} onClick={() => bloquear(l.ouvinte)}>{l.ouvinte.bloqueado ? "Desbloquear" : "Bloquear"}</button>
                            <button type="button" className="pequeno vermelho" onClick={() => excluir(l)}>Excluir</button>
                          </div>
                        </td>
                      </tr>
                      {aberto === l.ouvinte.id && (
                        <tr className="historico">
                          <td colSpan={4}>
                            <ul>
                              {l.vitorias.map((v, i) => <li key={i}><strong>{fmtData(v.data)}</strong> · {v.premio_nome}</li>)}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {temMais && (
          <div className="carregar-mais">
            <button type="button" className="branco" onClick={() => setLimite((n) => n + CARREGAR_MAIS)}>Carregar mais</button>
          </div>
        )}
      </section>

      {editando && (
        <EditarOuvinte
          sb={sb}
          avisar={avisar}
          ouvinte={editando === "novo" ? null : editando}
          onSalvo={() => {
            setEditando(null);
            carregar();
          }}
          onFechar={() => setEditando(null)}
        />
      )}
    </>
  );
}
