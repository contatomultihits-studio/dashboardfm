"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fmtData, hojeISO } from "@/lib/datas";
import { fmtTelefone, localOuvinte, normalizarTelefone, situacaoOuvinte, type Ganhador, type Ouvinte } from "@/lib/promocao";
import { erroMsg, type Avisar } from "../comum";
import { buscarOuvintes, comVitorias } from "./RegistrarGanhador";

type Linha = { ouvinte: Ouvinte; vitorias: Pick<Ganhador, "data" | "premio_nome">[] };

const VAZIO = { nome: "", telefone: "", bairro: "", cidade: "", bloqueado: false, motivo_bloqueio: "" };

/** Base de ouvintes: busca "já ganhou?", histórico, cadastro e lista de bloqueados. */
export function Ouvintes({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const hoje = hojeISO();
  const [termo, setTermo] = useState("");
  const [soBloqueados, setSoBloqueados] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<string | null>(null);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const t = termo.trim();
      let r: Linha[];
      if (t.length >= 2) {
        r = await buscarOuvintes(sb, t, 50);
        if (soBloqueados) r = r.filter((x) => x.ouvinte.bloqueado);
      } else {
        let q = sb.from("ouvintes").select("*");
        if (soBloqueados) q = q.eq("bloqueado", true);
        const { data, error } = await q.order("created_at", { ascending: false }).limit(30);
        if (error) throw new Error(error.message);
        r = await comVitorias(sb, data as Ouvinte[]);
      }
      setLinhas(r);
    } catch (e) {
      avisar(erroMsg(e), true);
    } finally {
      setCarregando(false);
    }
  }, [sb, termo, soBloqueados, avisar]);

  useEffect(() => {
    const timer = setTimeout(carregar, 300);
    return () => clearTimeout(timer);
  }, [carregar]);

  function limpar() {
    setForm(VAZIO);
    setEditandoId(null);
  }

  function editar(o: Ouvinte) {
    setForm({ nome: o.nome, telefone: fmtTelefone(o.telefone), bairro: o.bairro, cidade: o.cidade, bloqueado: o.bloqueado, motivo_bloqueio: o.motivo_bloqueio });
    setEditandoId(o.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return avisar("O nome é obrigatório.", true);
    setSalvando(true);
    const dados = {
      nome: form.nome.trim(),
      telefone: normalizarTelefone(form.telefone),
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      bloqueado: form.bloqueado,
      motivo_bloqueio: form.bloqueado ? form.motivo_bloqueio.trim() : "",
    };
    const { error } = editandoId ? await sb.from("ouvintes").update(dados).eq("id", editandoId) : await sb.from("ouvintes").insert(dados);
    setSalvando(false);
    if (error) return avisar(error.message, true);
    avisar(editandoId ? "Ouvinte atualizado" : form.bloqueado ? "Ouvinte cadastrado como bloqueado" : "Ouvinte cadastrado");
    limpar();
    carregar();
  }

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
    if (editandoId === l.ouvinte.id) limpar();
    avisar("Ouvinte excluído");
    carregar();
  }

  return (
    <>
      <section className="card">
        <div className="secao-topo" style={{ flexWrap: "wrap" }}>
          <h2>Ouvintes · já ganhou?</h2>
          <label className="check">
            <input type="checkbox" checked={soBloqueados} onChange={(e) => setSoBloqueados(e.target.checked)} />
            Só bloqueados
          </label>
        </div>
        <label className="campo">
          Buscar por nome ou telefone
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
                            <button type="button" className="pequeno" onClick={() => editar(l.ouvinte)}>Editar</button>
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
      </section>

      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? "Editar ouvinte" : "Cadastrar ouvinte (ou bloquear alguém)"}</h2>
        <div className="form-grade">
          <label className="campo">
            Nome
            <input type="text" required maxLength={80} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="campo">
            Telefone (opcional)
            <input type="tel" maxLength={20} placeholder="(11) 99999-8888" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </label>
          <label className="campo">
            Bairro (opcional)
            <input type="text" maxLength={60} value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
          </label>
          <label className="campo">
            Cidade (opcional)
            <input type="text" maxLength={60} value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.bloqueado} onChange={(e) => setForm({ ...form, bloqueado: e.target.checked })} />
          🚫 Bloqueado (não pode ganhar prêmios)
        </label>
        {form.bloqueado && (
          <label className="campo">
            Motivo do bloqueio
            <input type="text" maxLength={200} placeholder="Ex.: usou dados de outra pessoa" value={form.motivo_bloqueio} onChange={(e) => setForm({ ...form, motivo_bloqueio: e.target.value })} />
          </label>
        )}
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Cadastrar ouvinte"}</button>
          {editandoId && <button type="button" className="branco" onClick={limpar}>Cancelar edição</button>}
        </div>
      </form>
    </>
  );
}
