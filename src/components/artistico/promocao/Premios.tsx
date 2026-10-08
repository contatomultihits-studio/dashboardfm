"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Imagem } from "@/components/Imagem";
import { hojeISO } from "@/lib/datas";
import { sanitizarHtml, textoPuro } from "@/lib/html";
import { removerImagemSemUso, urlImagem } from "@/lib/imagens";
import { PARCERIAS, premioValidoEm, textoValidade, tipoPremio, type Parceria, type Premio } from "@/lib/promocao";
import { CampoImagem, useImagemForm } from "../CampoImagem";
import { erroMsg, type Avisar } from "../comum";
import { EditorTexto } from "../EditorTexto";
import type { usePremios } from "./comum";

type Form = { nome: string; descricao_html: string; ativo: boolean; data_inicio: string; data_fim: string; evento: boolean; parceria: Parceria | "" };
const VAZIO: Form = { nome: "", descricao_html: "", ativo: true, data_inicio: "", data_fim: "", evento: false, parceria: "" };

/** Situação da validade hoje: etiqueta da lista. */
function etiquetaValidade(p: Premio, hoje: string): { texto: string; classe: string } | null {
  if (premioValidoEm(p, hoje)) return null;
  return p.data_fim && hoje > p.data_fim ? { texto: "Vencido", classe: "relatorio-falta" } : { texto: "Ainda não começou", classe: "cinza" };
}

/**
 * Cadastro único Cliente / Evento / Prêmio: nome, validade, parceria (quando é evento), foto e a nota
 * com o detalhe. A grade do dia escolhe daqui, só dentro da validade.
 */
export function Premios({ sb, avisar, lista }: { sb: SupabaseClient; avisar: Avisar; lista: ReturnType<typeof usePremios> }) {
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const imagem = useImagemForm();
  const hoje = hojeISO();

  function limpar() {
    setForm(VAZIO);
    setEditandoId(null);
    imagem.reiniciar(null);
    setVersao((v) => v + 1);
  }

  function editar(p: Premio) {
    setForm({
      nome: p.nome, descricao_html: p.descricao_html, ativo: p.ativo,
      data_inicio: p.data_inicio ?? "", data_fim: p.data_fim ?? "", evento: Boolean(p.evento), parceria: p.parceria ?? "",
    });
    setEditandoId(p.id);
    imagem.reiniciar(p.imagem_path);
    setVersao((v) => v + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return avisar("Dê um nome (cliente, evento ou prêmio).", true);
    if (!form.data_inicio || !form.data_fim) return avisar("Preencha a validade: de quando até quando o prêmio pode ir para a grade.", true);
    if (form.data_fim < form.data_inicio) return avisar("A data final precisa ser depois da data de início.", true);
    if (form.evento && !form.parceria) return avisar("Escolha o tipo de parceria do evento.", true);
    setSalvando(true);
    try {
      const img = await imagem.preparar(sb, "premios");
      const dados = {
        nome: form.nome.trim(),
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        evento: form.evento,
        parceria: form.evento ? form.parceria : null,
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
      avisar(editandoId ? "Cadastro atualizado" : "Cadastro salvo");
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
    if (!confirm(`Excluir "${p.nome}"? Os horários que usam ele ficam sem prêmio; o histórico de ganhadores continua.`)) return;
    const { error } = await sb.from("premios").delete().eq("id", p.id);
    if (error) return avisar(error.message, true);
    await removerImagemSemUso(sb, "premios", p.imagem_path);
    if (editandoId === p.id) limpar();
    avisar("Cadastro excluído");
    lista.recarregar();
  }

  return (
    <>
      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? "Editar cliente / evento / prêmio" : "Novo cliente / evento / prêmio"}</h2>
        <label className="campo">
          Nome
          <input type="text" required maxLength={80} placeholder="Ex.: Shopping Eldorado · Ingressos Disney On Ice" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <div className="form-grade">
          <label className="campo">
            Válido de
            <input type="date" required value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
          </label>
          <label className="campo">
            Até
            <input type="date" required min={form.data_inicio || undefined} value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
          </label>
        </div>
        <p className="dica" style={{ marginTop: -6 }}>A grade só deixa programar dentro desse período.</p>
        <label className="check">
          <input type="checkbox" checked={form.evento} onChange={(e) => setForm({ ...form, evento: e.target.checked, parceria: e.target.checked ? form.parceria : "" })} />
          É um evento
        </label>
        {form.evento && (
          <label className="campo">
            Tipo de parceria
            <select required value={form.parceria} onChange={(e) => setForm({ ...form, parceria: e.target.value as Parceria | "" })}>
              <option value="">— Escolher —</option>
              {(Object.keys(PARCERIAS) as Parceria[]).map((k) => <option key={k} value={k}>{PARCERIAS[k]}</option>)}
            </select>
          </label>
        )}
        <CampoImagem sb={sb} imagem={imagem} rotulo="Foto" />
        <EditorTexto key={`premio-${versao}`} rotulo="Nota / observação (o que é o prêmio e o que o locutor fala no ar)" valorInicial={form.descricao_html} placeholder="O que o ouvinte ganha, regras, como participar…" onChange={(html) => setForm((f) => ({ ...f, descricao_html: html }))} />
        <label className="check">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          Ativo (aparece para escolher na grade)
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Salvar cadastro"}</button>
          {editandoId && <button type="button" className="branco" onClick={limpar}>Cancelar edição</button>}
        </div>
      </form>

      <section className="card">
        <div className="secao-topo"><h2>Clientes / eventos / prêmios cadastrados</h2></div>
        {lista.erro && <div className="aviso erro">{lista.erro}</div>}
        {!lista.carregando && lista.premios.length === 0 ? (
          <div className="vazio">Nada cadastrado ainda.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr><th>Foto</th><th>Nome</th><th>Validade</th><th>Ativo</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {lista.premios.map((p) => (
                  <tr key={p.id} className={`${p.ativo ? "" : "oculto"} ${editandoId === p.id ? "editando" : ""}`}>
                    <td><Imagem src={urlImagem(sb, p.imagem_path)} alt="" className="mini-thumb" largura={88} altura={88} sizes="44px" /></td>
                    <td className="texto">
                      <strong>{p.nome}</strong>
                      {tipoPremio(p) && <div><span className={`etiqueta ${p.parceria === "RADIO_OFICIAL" ? "oficial" : p.parceria === "CAMAROTE" ? "camarote" : "apoio"}`}>{tipoPremio(p)}</span></div>}
                      {textoPuro(p.descricao_html) && <div className="trecho">{textoPuro(p.descricao_html).slice(0, 90)}</div>}
                    </td>
                    <td className="texto">
                      {textoValidade(p)}
                      {etiquetaValidade(p, hoje) && <div><span className={`etiqueta ${etiquetaValidade(p, hoje)!.classe}`}>{etiquetaValidade(p, hoje)!.texto}</span></div>}
                    </td>
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
