"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Imagem } from "@/components/Imagem";
import { EtiquetaSituacao } from "@/components/EtiquetaSituacao";
import { diasNoPeriodo, fimDoPeriodo, fmtData, hojeISO, type Duracao } from "@/lib/datas";
import { sanitizarHtml, textoPuro } from "@/lib/html";
import { removerImagem, urlImagem } from "@/lib/imagens";
import type { Prioridade } from "@/lib/tipos";
import { CampoImagem, useImagemForm } from "./CampoImagem";
import { CabecalhoLista, erroMsg, useLista, type Avisar } from "./comum";
import { EditorTexto } from "./EditorTexto";

const ATALHOS: { rotulo: string; duracao: Duracao }[] = [
  { rotulo: "1 semana", duracao: { qtd: 1, unidade: "semana" } },
  { rotulo: "2 semanas", duracao: { qtd: 2, unidade: "semana" } },
  { rotulo: "1 mês", duracao: { qtd: 1, unidade: "mes" } },
  { rotulo: "2 meses", duracao: { qtd: 2, unidade: "mes" } },
  { rotulo: "3 meses", duracao: { qtd: 3, unidade: "mes" } },
];

const PADRAO = ATALHOS[0].duracao;

function novo() {
  const inicio = hojeISO();
  return { data_inicio: inicio, data_fim: fimDoPeriodo(inicio, PADRAO), conteudo_html: "", ativo: true };
}

export function Prioridades({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const hoje = hojeISO();
  // Lista: o que ainda está no ar ou vai entrar (sai do ar hoje ou depois), pela data de entrada.
  const lista = useLista<Prioridade>(sb, "prioridades", "data_inicio", hoje, "data_fim", "data_fim");
  const imagem = useImagemForm();
  const [form, setForm] = useState(novo);
  // Atalho escolhido: se a data de entrada mudar, a saída acompanha.
  const [duracao, setDuracao] = useState<Duracao | null>(PADRAO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setForm(novo());
    setDuracao(PADRAO);
    setEditandoId(null);
    imagem.reiniciar(null);
    setVersao((v) => v + 1);
  }

  function editar(p: Prioridade) {
    setForm({ data_inicio: p.data_inicio, data_fim: p.data_fim, conteudo_html: p.conteudo_html, ativo: p.ativo });
    setDuracao(null);
    setEditandoId(p.id);
    imagem.reiniciar(p.imagem_path);
    setVersao((v) => v + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function mudarInicio(inicio: string) {
    if (!inicio) return;
    setForm((f) => ({
      ...f,
      data_inicio: inicio,
      data_fim: duracao ? fimDoPeriodo(inicio, duracao) : f.data_fim < inicio ? inicio : f.data_fim,
    }));
  }

  function escolherAtalho(d: Duracao) {
    setDuracao(d);
    setForm((f) => ({ ...f, data_fim: fimDoPeriodo(f.data_inicio, d) }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (form.data_fim < form.data_inicio) {
      avisar("A data de saída não pode ser antes da entrada.", true);
      return;
    }
    if (!textoPuro(form.conteudo_html) && !imagem.arquivo && !imagem.atual) {
      avisar("Escreva o conteúdo ou envie uma imagem.", true);
      return;
    }
    setSalvando(true);
    try {
      const img = await imagem.preparar(sb, "prioridades");
      const dados = {
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        conteudo_html: sanitizarHtml(form.conteudo_html),
        ativo: form.ativo,
        imagem_path: img.path,
      };
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

  async function tirarDoAr(p: Prioridade) {
    if (!confirm("Tirar esta prioridade do ar hoje? Ela sai da dashboard a partir de amanhã.")) return;
    const fim = hoje < p.data_inicio ? p.data_inicio : hoje;
    const { error } = await sb.from("prioridades").update({ data_fim: fim }).eq("id", p.id);
    if (error) return avisar(error.message, true);
    avisar("Prioridade sai do ar hoje");
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

  const dias = form.data_fim >= form.data_inicio ? diasNoPeriodo(form.data_inicio, form.data_fim) : 0;

  return (
    <>
      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? "Editar prioridade" : "Nova prioridade do ar"}</h2>
        <div className="form-grade">
          <label className="campo">
            Entra no ar
            <input type="date" required value={form.data_inicio} onChange={(e) => mudarInicio(e.target.value)} />
          </label>
          <label className="campo">
            Sai do ar (último dia)
            <input
              type="date"
              required
              min={form.data_inicio}
              value={form.data_fim}
              onChange={(e) => {
                setDuracao(null);
                setForm({ ...form, data_fim: e.target.value });
              }}
            />
          </label>
        </div>
        <div className="atalhos" role="group" aria-label="Duração">
          <span>Duração:</span>
          {ATALHOS.map((a) => {
            const ativo = form.data_fim === fimDoPeriodo(form.data_inicio, a.duracao);
            return (
              <button
                key={a.rotulo}
                type="button"
                className={`pequeno ${ativo ? "verde" : "branco"}`}
                aria-pressed={ativo}
                onClick={() => escolherAtalho(a.duracao)}
              >
                {a.rotulo}
              </button>
            );
          })}
          {dias > 0 && (
            <span className="resumo-periodo">
              {fmtData(form.data_inicio)} a {fmtData(form.data_fim)} · {dias} {dias === 1 ? "dia" : "dias"} no ar
            </span>
          )}
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
        <CabecalhoLista titulo="Prioridades" anteriores={lista.anteriores} setAnteriores={lista.setAnteriores} rotuloAnteriores="Mostrar encerradas" />
        {lista.erro && <div className="aviso erro">{lista.erro}</div>}
        {!lista.carregando && lista.itens.length === 0 ? (
          <div className="vazio">Nenhuma prioridade {lista.anteriores ? "cadastrada" : "no ar ou agendada"}.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Imagem</th><th>Período no ar</th><th>Situação</th><th>Conteúdo</th><th>Exibir</th><th>Ações</th></tr></thead>
              <tbody>
                {lista.itens.map((p) => (
                  <tr key={p.id} className={`${p.ativo ? "" : "oculto"} ${editandoId === p.id ? "editando" : ""}`}>
                    <td><Imagem src={urlImagem(sb, p.imagem_path)} alt="" className="mini-thumb" /></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {fmtData(p.data_inicio)}
                      {p.data_fim !== p.data_inicio && <> → {fmtData(p.data_fim)}</>}
                    </td>
                    <td><EtiquetaSituacao inicio={p.data_inicio} fim={p.data_fim} hoje={hoje} /></td>
                    <td className="texto">{textoPuro(p.conteudo_html).slice(0, 140) || "—"}</td>
                    <td><input type="checkbox" aria-label="Exibir na dashboard" checked={p.ativo} onChange={() => alternarAtivo(p)} /></td>
                    <td>
                      <div className="tabela-acoes">
                        <button type="button" className="pequeno" onClick={() => editar(p)}>Editar</button>
                        {p.data_fim > hoje && p.data_inicio <= hoje && (
                          <button type="button" className="pequeno branco" onClick={() => tirarDoAr(p)}>Tirar do ar</button>
                        )}
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
