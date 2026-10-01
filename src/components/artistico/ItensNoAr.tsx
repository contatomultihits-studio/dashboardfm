"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Imagem } from "@/components/Imagem";
import { EtiquetaSituacao } from "@/components/EtiquetaSituacao";
import { agoraHHMM, diasNoPeriodo, fimDoPeriodo, fmtData, hojeISO, horaCurta, situacaoPeriodo, somarDias, type Duracao } from "@/lib/datas";
import { sanitizarHtml, textoPuro } from "@/lib/html";
import { removerImagemSemUso, urlImagem } from "@/lib/imagens";
import type { ItemNoAr } from "@/lib/tipos";
import { CampoImagem, useImagemForm } from "./CampoImagem";
import { CabecalhoLista, erroMsg, useLista, type Avisar } from "./comum";
import { EditorTexto } from "./EditorTexto";

/** O que muda entre prioridades e recados: tabela, se tem imagem/destaque e os textos da tela. */
export type ConfigItensNoAr = {
  tabela: "prioridades" | "recados";
  comImagem: boolean;
  comDestaque: boolean;
  feminino: boolean;
  /** "prioridade" / "recado" */
  nome: string;
  /** "Prioridades" / "Recados" */
  plural: string;
  tituloNovo: string;
  rotuloTitulo: string;
  exemploTitulo: string;
};

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
  return {
    data_inicio: inicio,
    data_fim: fimDoPeriodo(inicio, PADRAO),
    hora_inicio: "",
    hora_fim: "",
    titulo: "",
    conteudo_html: "",
    ativo: true,
    destaque: false,
  };
}

export function ItensNoAr({ sb, avisar, config: c }: { sb: SupabaseClient; avisar: Avisar; config: ConfigItensNoAr }) {
  const g = (fem: string, masc: string) => (c.feminino ? fem : masc);
  const Nome = c.nome[0].toUpperCase() + c.nome.slice(1);
  const hoje = hojeISO();
  // Lista: o que ainda está no ar ou vai entrar (sai do ar hoje ou depois), pela data de entrada.
  const lista = useLista<ItemNoAr>(sb, c.tabela, "data_inicio", hoje, "data_fim", "data_fim");
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

  function editar(p: ItemNoAr) {
    setForm({
      data_inicio: p.data_inicio,
      data_fim: p.data_fim,
      hora_inicio: horaCurta(p.hora_inicio) ?? "",
      hora_fim: horaCurta(p.hora_fim) ?? "",
      titulo: p.titulo ?? "",
      conteudo_html: p.conteudo_html,
      ativo: p.ativo,
      destaque: Boolean(p.destaque),
    });
    setDuracao(null);
    setEditandoId(p.id);
    imagem.reiniciar(p.imagem_path ?? null);
    setVersao((v) => v + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Nova versão a partir de uma existente: mesmo texto e foto, começando no dia seguinte ao fim dela. */
  function duplicar(p: ItemNoAr) {
    const inicio = somarDias(p.data_fim, 1);
    setForm({
      data_inicio: inicio,
      data_fim: inicio,
      hora_inicio: "",
      hora_fim: horaCurta(p.hora_fim) ?? "",
      titulo: p.titulo ?? "",
      conteudo_html: p.conteudo_html,
      ativo: p.ativo,
      destaque: Boolean(p.destaque),
    });
    setDuracao(null);
    setEditandoId(null);
    imagem.reiniciar(p.imagem_path ?? null);
    setVersao((v) => v + 1);
    avisar("Cópia pronta: ajuste o texto e as datas e salve");
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
    if (form.data_fim === form.data_inicio && form.hora_inicio && form.hora_fim && form.hora_fim <= form.hora_inicio) {
      avisar("No mesmo dia, o horário de saída precisa ser depois do de entrada.", true);
      return;
    }
    if (!form.titulo.trim()) {
      avisar(`Dê um título para ${g("a", "o")} ${c.nome} (é o que aparece no card).`, true);
      return;
    }
    if (!textoPuro(form.conteudo_html)) {
      avisar("Escreva o texto que o locutor vai ler no ar.", true);
      return;
    }
    setSalvando(true);
    try {
      const img = c.comImagem ? await imagem.preparar(sb, c.tabela) : null;
      const dados = {
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        hora_inicio: form.hora_inicio || null,
        hora_fim: form.hora_fim || null,
        titulo: form.titulo.trim(),
        conteudo_html: sanitizarHtml(form.conteudo_html),
        ativo: form.ativo,
        ...(img ? { imagem_path: img.path } : {}),
        ...(c.comDestaque ? { destaque: form.destaque } : {}),
      };
      const { error } = editandoId
        ? await sb.from(c.tabela).update(dados).eq("id", editandoId)
        : await sb.from(c.tabela).insert(dados);
      if (error) {
        await img?.desfazer();
        throw new Error(error.message);
      }
      await img?.confirmar();
      avisar(editandoId ? `${Nome} ${g("atualizada", "atualizado")}` : `${Nome} ${g("salva", "salvo")}`);
      limpar();
      lista.recarregar();
    } catch (err) {
      avisar(erroMsg(err), true);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p: ItemNoAr) {
    const { error } = await sb.from(c.tabela).update({ ativo: !p.ativo }).eq("id", p.id);
    if (error) return avisar(error.message, true);
    lista.recarregar();
  }

  async function tirarDoAr(p: ItemNoAr) {
    if (!confirm(`Tirar ${g("esta", "este")} ${c.nome} do ar agora? ${g("Ela", "Ele")} sai da dashboard em até 1 minuto.`)) return;
    const { error } = await sb.from(c.tabela).update({ data_fim: hoje, hora_fim: agoraHHMM() }).eq("id", p.id);
    if (error) return avisar(error.message, true);
    avisar(`${Nome} saiu do ar`);
    lista.recarregar();
  }

  async function excluir(p: ItemNoAr) {
    if (!confirm(`Excluir ${g("esta", "este")} ${c.nome}? Não dá para desfazer.`)) return;
    const { error } = await sb.from(c.tabela).delete().eq("id", p.id);
    if (error) return avisar(error.message, true);
    if (c.comImagem) await removerImagemSemUso(sb, c.tabela, p.imagem_path);
    if (editandoId === p.id) limpar();
    avisar(`${Nome} ${g("excluída", "excluído")}`);
    lista.recarregar();
  }

  const dias = form.data_fim >= form.data_inicio ? diasNoPeriodo(form.data_inicio, form.data_fim) : 0;

  return (
    <>
      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? `Editar ${c.nome}` : c.tituloNovo}</h2>
        <label className="campo">
          {c.rotuloTitulo}
          <input
            type="text"
            required
            maxLength={80}
            placeholder={`Ex.: ${c.exemploTitulo}`}
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          />
        </label>
        <div className="form-grade periodo-grade">
          <label className="campo">
            Entra no ar
            <input type="date" required value={form.data_inicio} onChange={(e) => mudarInicio(e.target.value)} />
          </label>
          <label className="campo">
            às (opcional)
            <input type="time" aria-label="Horário de entrada" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
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
          <label className="campo">
            até (opcional)
            <input type="time" aria-label="Horário de saída" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
          </label>
        </div>
        <p className="dica">Sem horário, vale o dia todo. Com horário, sai da dashboard sozinho no minuto marcado.</p>
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
              {fmtData(form.data_inicio)}
              {form.hora_inicio ? ` ${form.hora_inicio}` : ""} a {fmtData(form.data_fim)}
              {form.hora_fim ? ` ${form.hora_fim}` : ""} · {dias} {dias === 1 ? "dia" : "dias"} no ar
            </span>
          )}
        </div>
        <EditorTexto key={`${c.tabela}-${versao}`} rotulo="Texto para o locutor ler no ar" valorInicial={form.conteudo_html} placeholder="O que o locutor precisa falar no ar…" onChange={(html) => setForm((f) => ({ ...f, conteudo_html: html }))} />
        {c.comImagem && <CampoImagem sb={sb} imagem={imagem} />}
        {c.comDestaque && (
          <label className="check">
            <input type="checkbox" checked={form.destaque} onChange={(e) => setForm({ ...form, destaque: e.target.checked })} />
            Destacar (fica em vermelho e aparece primeiro)
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          Exibir na dashboard
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : `Salvar ${c.nome}`}</button>
          {editandoId && <button type="button" className="branco" onClick={limpar}>Cancelar edição</button>}
        </div>
      </form>

      <section className="card">
        <CabecalhoLista titulo={c.plural} anteriores={lista.anteriores} setAnteriores={lista.setAnteriores} rotuloAnteriores={`Mostrar ${g("encerradas", "encerrados")}`} />
        {lista.erro && <div className="aviso erro">{lista.erro}</div>}
        {!lista.carregando && lista.itens.length === 0 ? (
          <div className="vazio">
            {g("Nenhuma", "Nenhum")} {c.nome} {lista.anteriores ? g("cadastrada", "cadastrado") : `no ar ou ${g("agendada", "agendado")}`}.
          </div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  {c.comImagem && <th>Imagem</th>}
                  <th>Período no ar</th><th>Situação</th><th>Título</th><th>Exibir</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.itens.map((p) => (
                  <tr key={p.id} className={`${p.ativo ? "" : "oculto"} ${editandoId === p.id ? "editando" : ""}`}>
                    {c.comImagem && <td><Imagem src={urlImagem(sb, p.imagem_path)} alt="" className="mini-thumb" largura={88} altura={88} sizes="44px" /></td>}
                    <td style={{ whiteSpace: "nowrap" }}>
                      {fmtData(p.data_inicio)}
                      {horaCurta(p.hora_inicio) && ` ${horaCurta(p.hora_inicio)}`}
                      {(p.data_fim !== p.data_inicio || horaCurta(p.hora_fim)) && (
                        <>
                          {" → "}
                          {p.data_fim !== p.data_inicio && fmtData(p.data_fim)}
                          {horaCurta(p.hora_fim) && ` ${horaCurta(p.hora_fim)}`}
                        </>
                      )}
                    </td>
                    <td>
                      <EtiquetaSituacao inicio={p.data_inicio} fim={p.data_fim} hoje={hoje} horaInicio={p.hora_inicio} horaFim={p.hora_fim} />
                    </td>
                    <td className="texto">
                      {p.destaque && <span className="etiqueta destaque" style={{ marginRight: 6 }}>Destaque</span>}
                      {p.titulo ? <strong>{p.titulo}</strong> : <em className="sem-titulo">Sem título</em>}
                      <div className="trecho">{textoPuro(p.conteudo_html).slice(0, 100) || "—"}</div>
                    </td>
                    <td><input type="checkbox" aria-label="Exibir na dashboard" checked={p.ativo} onChange={() => alternarAtivo(p)} /></td>
                    <td>
                      <div className="tabela-acoes">
                        <button type="button" className="pequeno" onClick={() => editar(p)}>Editar</button>
                        <button type="button" className="pequeno branco" onClick={() => duplicar(p)} title="Criar a próxima versão (ex.: 'é amanhã', 'é hoje')">Duplicar</button>
                        {situacaoPeriodo(p.data_inicio, p.data_fim, hoje, { inicio: p.hora_inicio, fim: p.hora_fim, agora: agoraHHMM() }) === "no-ar" && (
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
