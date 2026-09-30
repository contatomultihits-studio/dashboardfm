"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Imagem } from "@/components/Imagem";
import { fmtData, fmtHora, hojeISO } from "@/lib/datas";
import { sanitizarHtml } from "@/lib/html";
import { removerImagem, urlImagem } from "@/lib/imagens";
import type { Convidado } from "@/lib/tipos";
import { CampoImagem, useImagemForm } from "./CampoImagem";
import { CabecalhoLista, erroMsg, useLista, type Avisar } from "./comum";
import { EditorTexto } from "./EditorTexto";

const novo = () => ({ nome: "", data_visita: hojeISO(), horario: "", mini_pauta_html: "", ativo: true });

export function Convidados({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const lista = useLista<Convidado>(sb, "convidados", "data_visita", hojeISO(), "horario");
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

  function editar(c: Convidado) {
    setForm({ nome: c.nome, data_visita: c.data_visita, horario: c.horario ? fmtHora(c.horario) : "", mini_pauta_html: c.mini_pauta_html, ativo: c.ativo });
    setEditandoId(c.id);
    imagem.reiniciar(c.imagem_path);
    setVersao((v) => v + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const img = await imagem.preparar(sb, "convidados");
      const dados = {
        nome: form.nome.trim(),
        data_visita: form.data_visita,
        horario: form.horario || null,
        mini_pauta_html: sanitizarHtml(form.mini_pauta_html),
        ativo: form.ativo,
        imagem_path: img.path,
      };
      const { error } = editandoId
        ? await sb.from("convidados").update(dados).eq("id", editandoId)
        : await sb.from("convidados").insert(dados);
      if (error) {
        await img.desfazer();
        throw new Error(error.message);
      }
      await img.confirmar();
      avisar(editandoId ? "Convidado atualizado" : "Convidado salvo");
      limpar();
      lista.recarregar();
    } catch (err) {
      avisar(erroMsg(err), true);
    } finally {
      setSalvando(false);
    }
  }

  async function atualizarCampo(c: Convidado, campo: "ativo" | "concluido") {
    const { error } = await sb.from("convidados").update({ [campo]: !c[campo] }).eq("id", c.id);
    if (error) return avisar(error.message, true);
    lista.recarregar();
  }

  async function excluir(c: Convidado) {
    if (!confirm(`Excluir o convidado "${c.nome}"? Não dá para desfazer.`)) return;
    const { error } = await sb.from("convidados").delete().eq("id", c.id);
    if (error) return avisar(error.message, true);
    await removerImagem(sb, c.imagem_path);
    if (editandoId === c.id) limpar();
    avisar("Convidado excluído");
    lista.recarregar();
  }

  return (
    <>
      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? "Editar convidado" : "Novo convidado"}</h2>
        <div className="form-grade">
          <label className="campo">
            Nome do convidado
            <input type="text" required maxLength={120} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="campo">
            Data da visita
            <input type="date" required value={form.data_visita} onChange={(e) => setForm({ ...form, data_visita: e.target.value })} />
          </label>
          <label className="campo">
            Horário
            <input type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
          </label>
        </div>
        <EditorTexto key={`conv-${versao}`} rotulo="Mini pauta" valorInicial={form.mini_pauta_html} placeholder="Assuntos, lançamento, curiosidades…" onChange={(html) => setForm((f) => ({ ...f, mini_pauta_html: html }))} />
        <CampoImagem sb={sb} imagem={imagem} rotulo="Foto" />
        <label className="check">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          Exibir na dashboard
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar convidado"}</button>
          {editandoId && <button type="button" className="branco" onClick={limpar}>Cancelar edição</button>}
        </div>
      </form>

      <section className="card">
        <CabecalhoLista titulo="Convidados" anteriores={lista.anteriores} setAnteriores={lista.setAnteriores} rotuloAnteriores="Mostrar visitas anteriores" />
        {lista.erro && <div className="aviso erro">{lista.erro}</div>}
        {!lista.carregando && lista.itens.length === 0 ? (
          <div className="vazio">Nenhum convidado {lista.anteriores ? "cadastrado" : "de hoje em diante"}.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Foto</th><th>Nome</th><th>Data</th><th>Hora</th><th>Exibir</th><th>Já veio</th><th>Ações</th></tr></thead>
              <tbody>
                {lista.itens.map((c) => (
                  <tr key={c.id} className={`${c.ativo && !c.concluido ? "" : "oculto"} ${editandoId === c.id ? "editando" : ""}`}>
                    <td><Imagem src={urlImagem(sb, c.imagem_path)} alt="" className="mini-thumb" /></td>
                    <td>{c.nome}</td>
                    <td>{fmtData(c.data_visita)}</td>
                    <td>{c.horario ? fmtHora(c.horario) : "—"}</td>
                    <td><input type="checkbox" aria-label="Exibir na dashboard" checked={c.ativo} onChange={() => atualizarCampo(c, "ativo")} /></td>
                    <td><input type="checkbox" aria-label="Visita concluída" checked={c.concluido} onChange={() => atualizarCampo(c, "concluido")} /></td>
                    <td>
                      <div className="tabela-acoes">
                        <button type="button" className="pequeno" onClick={() => editar(c)}>Editar</button>
                        <button type="button" className="pequeno vermelho" onClick={() => excluir(c)}>Excluir</button>
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
