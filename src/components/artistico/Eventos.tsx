"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Imagem } from "@/components/Imagem";
import { fmtData, hojeISO } from "@/lib/datas";
import { sanitizarHtml } from "@/lib/html";
import { removerImagem, urlImagem } from "@/lib/imagens";
import { classeVinculo, VINCULO_LABEL, type Evento, type Vinculo } from "@/lib/tipos";
import { CampoImagem, useImagemForm } from "./CampoImagem";
import { CabecalhoLista, erroMsg, useLista, type Avisar } from "./comum";
import { EditorTexto } from "./EditorTexto";

const novo = () => ({ nome: "", data_evento: hojeISO(), local: "", vinculo: "RADIO_OFICIAL" as Vinculo, descricao_html: "", ativo: true });

export function Eventos({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const lista = useLista<Evento>(sb, "eventos", "data_evento", hojeISO());
  const imagem = useImagemForm();
  const [form, setForm] = useState(novo);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setForm(novo());
    setEditandoId(null);
    imagem.reiniciar(null);
    setVersao((v) => v + 1);
  }

  function editar(ev: Evento) {
    setForm({ nome: ev.nome, data_evento: ev.data_evento, local: ev.local ?? "", vinculo: ev.vinculo, descricao_html: ev.descricao_html, ativo: ev.ativo });
    setEditandoId(ev.id);
    imagem.reiniciar(ev.imagem_path);
    setVersao((v) => v + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const img = await imagem.preparar(sb, "eventos");
      const dados = {
        nome: form.nome.trim(),
        data_evento: form.data_evento,
        local: form.local.trim() || null,
        vinculo: form.vinculo,
        descricao_html: sanitizarHtml(form.descricao_html),
        ativo: form.ativo,
        imagem_path: img.path,
      };
      const { error } = editandoId
        ? await sb.from("eventos").update(dados).eq("id", editandoId)
        : await sb.from("eventos").insert(dados);
      if (error) {
        await img.desfazer();
        throw new Error(error.message);
      }
      await img.confirmar();
      avisar(editandoId ? "Evento atualizado" : "Evento salvo");
      limpar();
      lista.recarregar();
    } catch (err) {
      avisar(erroMsg(err), true);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(ev: Evento) {
    const { error } = await sb.from("eventos").update({ ativo: !ev.ativo }).eq("id", ev.id);
    if (error) return avisar(error.message, true);
    lista.recarregar();
  }

  async function excluir(ev: Evento) {
    if (!confirm(`Excluir o evento "${ev.nome}"? Não dá para desfazer.`)) return;
    const { error } = await sb.from("eventos").delete().eq("id", ev.id);
    if (error) return avisar(error.message, true);
    await removerImagem(sb, ev.imagem_path);
    if (editandoId === ev.id) limpar();
    avisar("Evento excluído");
    lista.recarregar();
  }

  return (
    <>
      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? "Editar evento" : "Novo evento"}</h2>
        <div className="form-grade">
          <label className="campo">
            Nome do evento
            <input type="text" required maxLength={140} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="campo">
            Data
            <input type="date" required value={form.data_evento} onChange={(e) => setForm({ ...form, data_evento: e.target.value })} />
          </label>
          <label className="campo">
            Local
            <input type="text" maxLength={140} value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} />
          </label>
          <label className="campo">
            Vínculo
            <select value={form.vinculo} onChange={(e) => setForm({ ...form, vinculo: e.target.value as Vinculo })}>
              {(Object.keys(VINCULO_LABEL) as Vinculo[]).map((v) => <option key={v} value={v}>{VINCULO_LABEL[v]}</option>)}
            </select>
          </label>
        </div>
        <EditorTexto key={`evt-${versao}`} rotulo="Descrição" valorInicial={form.descricao_html} placeholder="O que falar no ar sobre o evento…" onChange={(html) => setForm((f) => ({ ...f, descricao_html: html }))} />
        <CampoImagem sb={sb} imagem={imagem} />
        <label className="check">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          Exibir na dashboard
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar evento"}</button>
          {editandoId && <button type="button" className="branco" onClick={limpar}>Cancelar edição</button>}
        </div>
      </form>

      <section className="card">
        <CabecalhoLista titulo="Eventos" anteriores={lista.anteriores} setAnteriores={lista.setAnteriores} rotuloAnteriores="Mostrar eventos passados" />
        {lista.erro && <div className="aviso erro">{lista.erro}</div>}
        {!lista.carregando && lista.itens.length === 0 ? (
          <div className="vazio">Nenhum evento {lista.anteriores ? "cadastrado" : "de hoje em diante"}.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Imagem</th><th>Evento</th><th>Data</th><th>Local</th><th>Vínculo</th><th>Exibir</th><th>Ações</th></tr></thead>
              <tbody>
                {lista.itens.map((ev) => (
                  <tr key={ev.id} className={`${ev.ativo ? "" : "oculto"} ${editandoId === ev.id ? "editando" : ""}`}>
                    <td><Imagem src={urlImagem(sb, ev.imagem_path)} alt="" className="mini-thumb" largura={88} altura={88} sizes="44px" /></td>
                    <td>{ev.nome}</td>
                    <td>{fmtData(ev.data_evento)}</td>
                    <td>{ev.local || "—"}</td>
                    <td><span className={`etiqueta ${classeVinculo(ev.vinculo)}`}>{VINCULO_LABEL[ev.vinculo]}</span></td>
                    <td><input type="checkbox" aria-label="Exibir na dashboard" checked={ev.ativo} onChange={() => alternarAtivo(ev)} /></td>
                    <td>
                      <div className="tabela-acoes">
                        <button type="button" className="pequeno" onClick={() => editar(ev)}>Editar</button>
                        <button type="button" className="pequeno vermelho" onClick={() => excluir(ev)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
