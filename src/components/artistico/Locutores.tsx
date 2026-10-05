"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatar } from "@/components/Avatar";
import { horaCurta } from "@/lib/datas";
import { horarioFaixa } from "@/lib/escala";
import { removerImagemSemUso } from "@/lib/imagens";
import type { Locutor } from "@/lib/tipos";
import { CampoImagem, useImagemForm } from "./CampoImagem";
import { erroMsg, useLocutoresEquipe, type Avisar } from "./comum";

export const NOMES_DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Seg a Sex", "Seg a Qui", "Sáb e Dom", "Seg, Qua, Sex" */
export function textoDias(dias: number[]): string {
  const d = [...dias].sort((a, b) => a - b);
  if (d.length === 0) return "";
  if (d.length === 7) return "Todos os dias";
  if (d.length === 2 && d[0] === 0 && d[1] === 6) return "Sáb e Dom";
  const seguidos = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  if (seguidos && d.length >= 3) return `${NOMES_DIAS[d[0]]} a ${NOMES_DIAS[d[d.length - 1]]}`;
  return d.map((x) => NOMES_DIAS[x]).join(", ");
}

const novo = () => ({
  nome: "",
  nome_completo: "",
  programa: "",
  cor: "#46ff9f",
  dias: [1, 2, 3, 4, 5],
  hora_inicio: "",
  hora_fim: "",
  freela: false,
  ativo: true,
});

export function Locutores({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const { locutores, carregando, recarregar } = useLocutoresEquipe(sb);
  const imagem = useImagemForm();
  const [form, setForm] = useState(novo);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setForm(novo());
    setEditandoId(null);
    imagem.reiniciar(null);
  }

  function editar(l: Locutor) {
    setForm({
      nome: l.nome,
      nome_completo: l.nome_completo,
      programa: l.programa,
      cor: l.cor,
      dias: l.dias,
      hora_inicio: horaCurta(l.hora_inicio) ?? "",
      hora_fim: horaCurta(l.hora_fim) ?? "",
      freela: l.freela,
      ativo: l.ativo,
    });
    setEditandoId(l.id);
    imagem.reiniciar(l.imagem_path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function alternarDia(d: number) {
    setForm((f) => ({ ...f, dias: f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d].sort() }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return avisar("Coloque o nome do locutor.", true);
    if (Boolean(form.hora_inicio) !== Boolean(form.hora_fim)) return avisar("Preencha o horário fixo completo (das e até), ou deixe os dois vazios.", true);
    if (form.hora_inicio && form.hora_inicio === form.hora_fim) return avisar("O horário de início e de fim não podem ser iguais.", true);
    if (form.hora_inicio && form.dias.length === 0) return avisar("Marque os dias do horário fixo.", true);
    setSalvando(true);
    try {
      const img = await imagem.preparar(sb, "locutores");
      const dados = {
        nome: form.nome.trim(),
        nome_completo: form.nome_completo.trim(),
        programa: form.programa.trim(),
        cor: form.cor,
        dias: form.dias,
        hora_inicio: form.hora_inicio || null,
        hora_fim: form.hora_fim || null,
        freela: form.freela,
        ativo: form.ativo,
        imagem_path: img.path,
      };
      const { error } = editandoId
        ? await sb.from("locutores").update(dados).eq("id", editandoId)
        : await sb.from("locutores").insert(dados);
      if (error) {
        await img.desfazer();
        throw new Error(error.message);
      }
      await img.confirmar();
      avisar(editandoId ? "Locutor atualizado" : "Locutor cadastrado");
      limpar();
      recarregar();
    } catch (err) {
      avisar(erroMsg(err), true);
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(l: Locutor) {
    const { error } = await sb.from("locutores").update({ ativo: !l.ativo }).eq("id", l.id);
    if (error) return avisar(error.message, true);
    recarregar();
  }

  async function excluir(l: Locutor) {
    if (!confirm(`Excluir ${l.nome}? Sai também de todas as escalas. As pautas antigas continuam com o nome.\nSe a pessoa só saiu da escala, prefira desmarcar "Ativo".`)) return;
    const { error } = await sb.from("locutores").delete().eq("id", l.id);
    if (error) return avisar(error.message, true);
    await removerImagemSemUso(sb, "locutores", l.imagem_path);
    if (editandoId === l.id) limpar();
    avisar("Locutor excluído");
    recarregar();
  }

  return (
    <>
      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? `Editar ${form.nome || "locutor"}` : "Novo locutor"}</h2>
        <div className="form-grade">
          <label className="campo">
            Nome (como aparece na escala)
            <input type="text" required maxLength={40} placeholder="Ex.: Rodrigo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="campo">
            Nome completo (opcional)
            <input type="text" maxLength={80} placeholder="Ex.: Rodrigo Campos" value={form.nome_completo} onChange={(e) => setForm({ ...form, nome_completo: e.target.value })} />
          </label>
          <label className="campo">
            Programa (opcional)
            <input type="text" maxLength={60} placeholder="Ex.: Manhã Disney" value={form.programa} onChange={(e) => setForm({ ...form, programa: e.target.value })} />
          </label>
          <label className="campo">
            Cor na escala
            <input type="color" value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
          </label>
        </div>

        <fieldset className="grupo">
          <legend>Horário fixo (deixe vazio para freela)</legend>
          <div className="form-grade">
            <label className="campo">
              Das
              <input type="time" aria-label="Horário fixo: início" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
            </label>
            <label className="campo">
              Até
              <input type="time" aria-label="Horário fixo: fim" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
            </label>
          </div>
          <div className="atalhos" role="group" aria-label="Dias do horário fixo">
            <span>Dias:</span>
            {NOMES_DIAS.map((n, d) => (
              <button key={n} type="button" className={`pequeno ${form.dias.includes(d) ? "verde" : "branco"}`} aria-pressed={form.dias.includes(d)} onClick={() => alternarDia(d)}>
                {n}
              </button>
            ))}
          </div>
          <p className="dica">Ex.: 22h até 02h vira a noite (entra no dia seguinte). Fim de semana e trocas ficam na aba Escala.</p>
        </fieldset>

        <CampoImagem sb={sb} imagem={imagem} rotulo="Foto" />
        <label className="check">
          <input type="checkbox" checked={form.freela} onChange={(e) => setForm({ ...form, freela: e.target.checked })} />
          Freela
        </label>
        <label className="check">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          Ativo (aparece na escala e para escolher nas pautas)
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : editandoId ? "Salvar alterações" : "Cadastrar locutor"}</button>
          {editandoId && <button type="button" className="branco" onClick={limpar}>Cancelar edição</button>}
        </div>
      </form>

      <section className="card">
        <div className="secao-topo"><h2>Locutores</h2></div>
        {!carregando && locutores.length === 0 ? (
          <div className="vazio">Nenhum locutor cadastrado.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr><th>Foto</th><th>Locutor</th><th>Horário fixo</th><th>Ativo</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {locutores.map((l) => (
                  <tr key={l.id} className={`${l.ativo ? "" : "oculto"} ${editandoId === l.id ? "editando" : ""}`}>
                    <td><Avatar sb={sb} locutor={l} tamanho={44} /></td>
                    <td className="texto">
                      <strong>{l.nome}</strong>
                      {l.freela && <span className="etiqueta cinza" style={{ marginLeft: 6 }}>Freela</span>}
                      {(l.nome_completo || l.programa) && <div className="trecho">{[l.nome_completo, l.programa].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {l.hora_inicio && l.hora_fim ? `${textoDias(l.dias)} · ${horarioFaixa({ inicio: horaCurta(l.hora_inicio)!, fim: horaCurta(l.hora_fim)! })}` : "—"}
                    </td>
                    <td><input type="checkbox" aria-label={`${l.nome} ativo`} checked={l.ativo} onChange={() => alternarAtivo(l)} /></td>
                    <td>
                      <div className="tabela-acoes">
                        <button type="button" className="pequeno" onClick={() => editar(l)}>Editar</button>
                        <button type="button" className="pequeno vermelho" onClick={() => excluir(l)}>Excluir</button>
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
