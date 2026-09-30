"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Imagem } from "@/components/Imagem";
import { fmtData, hojeISO } from "@/lib/datas";
import { sanitizarHtml, textoPuro } from "@/lib/html";
import { removerImagem, urlImagem } from "@/lib/imagens";
import type { Prioridade } from "@/lib/tipos";
import { CampoImagem, useImagemForm } from "./CampoImagem";
import { CabecalhoLista, erroMsg, useLista, type Avisar } from "./comum";
import { EditorTexto } from "./EditorTexto";

const novo = () => ({ data: hojeISO(), conteudo_html: "", ativo: true });

export function Prioridades({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const lista = useLista<Prioridade>(sb, "prioridades", "data", hojeISO());
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

  function editar(p: Prioridade) {
    setForm({ data: p.data, conteudo_html: p.conteudo_html, ativo: p.ativo });
    setEditandoId(p.id);
    imagem.reiniciar(p.imagem_path);
    setVersao((v) => v + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!textoPuro(form.conteudo_html) && !imagem.arquivo && !imagem.atual) {
      avisar("Escreva o conteúdo ou envie uma imagem.", true);
      return;
    }
    setSalvando(true);
    try {
      const img = await imagem.preparar(sb, "prioridades");
      const dados = { data: form.data, conteudo_html: sanitizarHtml(form.conteudo_html), ativo: form.ativo, imagem_path: img.path };
      const { error } = editandoId
        ? await sb.from("prioridades").update(dados).eq("id", editandoId)
        : await sb.from("prioridades").insert(dados);
      if (error) {
        await img.desfazer();
        throw new Error(error.message);
      }
      await img.confirmar();
      avisar(editandoId ? "Prioridade atualizada" : "Prioridade salva");
      limpar();
      lista.recarregar();
    } catch (err) {
      avisar(erroMsg(err), true);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p: Prioridade) {
    const { error } = await sb.from("prioridades").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) return avisar(error.message, true);
    lista.recarregar();
  }

  async function excluir(p: Prioridade) {
    if (!confirm("Excluir esta prioridade? Não dá para desfazer.")) return;
    const { error } = await sb.from("prioridades").delete().eq("id", p.id);
    if (error) return avisar(error.message, true);
    await removerImagem(sb, p.imagem_path);
    if (editandoId === p.id) limpar();
    avisar("Prioridade excluída");
    lista.recarregar();
  }

  return (
    <>
      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? "Editar prioridade" : "Nova prioridade do ar"}</h2>
        <div className="form-grade">
          <label className="campo">
            Data
            <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </label>
        </div>
        <EditorTexto key={`prio-${versao}`} rotulo="Conteúdo" valorInicial={form.conteudo_html} placeholder="O que o locutor precisa falar no ar…" onChange={(html) => setForm((f) => ({ ...f, conteudo_html: html }))} />
        <CampoImagem sb={sb} imagem={imagem} />
        <label className="check">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          Exibir na dashboard
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar prioridade"}</button>
          {editandoId && <button type="button" className="branco" onClick={limpar}>Cancelar edição</button>}
        </div>
      </form>

      <section className="card">
        <CabecalhoLista titulo="Prioridades" anteriores={lista.anteriores} setAnteriores={lista.setAnteriores} rotuloAnteriores="Mostrar dias anteriores" />
        {lista.erro && <div className="aviso erro">{lista.erro}</div>}
        {!lista.carregando && lista.itens.length === 0 ? (
          <div className="vazio">Nenhuma prioridade {lista.anteriores ? "cadastrada" : "de hoje em diante"}.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Imagem</th><th>Data</th><th>Conteúdo</th><th>Exibir</th><th>Ações</th></tr></thead>
              <tbody>
                {lista.itens.map((p) => (
                  <tr key={p.id} className={`${p.ativo ? "" : "oculto"} ${editandoId === p.id ? "editando" : ""}`}>
                    <td><Imagem src={urlImagem(sb, p.imagem_path)} alt="" className="mini-thumb" /></td>
                    <td>{fmtData(p.data)}</td>
                    <td className="texto">{textoPuro(p.conteudo_html).slice(0, 140) || "—"}</td>
                    <td><input type="checkbox" aria-label="Exibir na dashboard" checked={p.ativo} onChange={() => alternarAtivo(p)} /></td>
                    <td>
                      <div className="tabela-acoes">
                        <button type="button" className="pequeno" onClick={() => editar(p)}>Editar</button>
                        <button type="button" className="pequeno vermelho" onClick={() => excluir(p)}>Excluir</button>
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
