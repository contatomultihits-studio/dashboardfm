"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Imagem } from "@/components/Imagem";
import { sanitizarHtml, textoPuro } from "@/lib/html";
import { removerImagemSemUso, urlImagem } from "@/lib/imagens";
import type { Premio } from "@/lib/promocao";
import { CampoImagem, useImagemForm } from "../CampoImagem";
import { erroMsg, type Avisar } from "../comum";
import { EditorTexto } from "../EditorTexto";
import type { usePremios } from "./comum";

const VAZIO = { nome: "", titulo: "", patrocinador: "", descricao_html: "", ativo: true };

/** Catálogo: nome, título, foto e descrição de cada prêmio. A grade do dia escolhe daqui. */
export function Premios({ sb, avisar, lista }: { sb: SupabaseClient; avisar: Avisar; lista: ReturnType<typeof usePremios> }) {
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const imagem = useImagemForm();

  function limpar() {
    setForm(VAZIO);
    setEditandoId(null);
    imagem.reiniciar(null);
    setVersao((v) => v + 1);
  }

  function editar(p: Premio) {
    setForm({ nome: p.nome, titulo: p.titulo, patrocinador: p.patrocinador, descricao_html: p.descricao_html, ativo: p.ativo });
    setEditandoId(p.id);
    imagem.reiniciar(p.imagem_path);
    setVersao((v) => v + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return avisar("Dê um nome para o prêmio.", true);
    setSalvando(true);
    try {
      const img = await imagem.preparar(sb, "premios");
      const dados = {
        nome: form.nome.trim(),
        titulo: form.titulo.trim(),
        patrocinador: form.patrocinador.trim(),
        descricao_html: textoPuro(form.descricao_html) ? sanitizarHtml(form.descricao_html) : "",
        ativo: form.ativo,
        imagem_path: img.path,
      };
      const { error } = editandoId
        ? await sb.from("premios").update(dados).eq("id", editandoId)
        : await sb.from("premios").insert(dados);
      if (error) {
        await img.desfazer();
        throw new Error(error.message);
      }
      await img.confirmar();
      avisar(editandoId ? "Prêmio atualizado" : "Prêmio salvo");
      limpar();
      lista.recarregar();
    } catch (err) {
      avisar(erroMsg(err), true);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p: Premio) {
    const { error } = await sb.from("premios").update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) return avisar(error.message, true);
    lista.recarregar();
  }

  async function excluir(p: Premio) {
    if (!confirm(`Excluir o prêmio "${p.nome}"? Os horários que usam ele ficam sem prêmio; o histórico de ganhadores continua.`)) return;
    const { error } = await sb.from("premios").delete().eq("id", p.id);
    if (error) return avisar(error.message, true);
    await removerImagemSemUso(sb, "premios", p.imagem_path);
    if (editandoId === p.id) limpar();
    avisar("Prêmio excluído");
    lista.recarregar();
  }

  return (
    <>
      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? "Editar prêmio" : "Novo prêmio"}</h2>
        <div className="form-grade">
          <label className="campo">
            Nome do prêmio
            <input type="text" required maxLength={80} placeholder="Ex.: Ingressos show Disney On Ice" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="campo">
            Cliente / patrocinador (opcional)
            <input type="text" maxLength={80} placeholder="Ex.: Shopping Eldorado" value={form.patrocinador} onChange={(e) => setForm({ ...form, patrocinador: e.target.value })} />
          </label>
        </div>
        <CampoImagem sb={sb} imagem={imagem} rotulo="Foto do prêmio" />
        <EditorTexto key={`premio-${versao}`} rotulo="Texto do prêmio (o que o locutor fala no ar)" valorInicial={form.descricao_html} placeholder="Regras, como participar, o que o ouvinte ganha…" onChange={(html) => setForm((f) => ({ ...f, descricao_html: html }))} />
        <label className="check">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          Ativo (aparece para escolher na grade)
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar prêmio"}</button>
          {editandoId && <button type="button" className="branco" onClick={limpar}>Cancelar edição</button>}
        </div>
      </form>

      <section className="card">
        <div className="secao-topo"><h2>Prêmios cadastrados</h2></div>
        {lista.erro && <div className="aviso erro">{lista.erro}</div>}
        {!lista.carregando && lista.premios.length === 0 ? (
          <div className="vazio">Nenhum prêmio cadastrado ainda.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr><th>Foto</th><th>Prêmio</th><th>Cliente</th><th>Ativo</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {lista.premios.map((p) => (
                  <tr key={p.id} className={`${p.ativo ? "" : "oculto"} ${editandoId === p.id ? "editando" : ""}`}>
                    <td><Imagem src={urlImagem(sb, p.imagem_path)} alt="" className="mini-thumb" largura={88} altura={88} sizes="44px" /></td>
                    <td className="texto">
                      <strong>{p.nome}</strong>
                    </td>
                    <td>{p.patrocinador || "—"}</td>
                    <td><input type="checkbox" aria-label={`Prêmio ${p.nome} ativo`} checked={p.ativo} onChange={() => alternarAtivo(p)} /></td>
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
