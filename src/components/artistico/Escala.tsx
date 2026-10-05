"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatares } from "@/components/Avatar";
import { fmtData, fmtDiaSemana, hojeISO, somarDias } from "@/lib/datas";
import { diaDaSemana, faixasDoDia, horarioFaixa, nomesFaixa, type Faixa } from "@/lib/escala";
import type { ItemEscala } from "@/lib/tipos";
import { erroMsg, useLocutoresEquipe, type Avisar } from "./comum";

/** Sábado desta semana (ou hoje, se já for fim de semana). */
function proximoFimDeSemana(hoje: string) {
  const d = diaDaSemana(hoje);
  if (d === 6 || d === 0) return hoje;
  return somarDias(hoje, 6 - d);
}

const novaLinha = () => ({ locutor: "", parceiro: "", hora_inicio: "", hora_fim: "" });

/** Escala por data: fins de semana e trocas (folga, férias, freela) num dia de semana. */
export function Escala({ sb, avisar }: { sb: SupabaseClient; avisar: Avisar }) {
  const { locutores } = useLocutoresEquipe(sb);
  const ativos = locutores.filter((l) => l.ativo);
  const [data, setData] = useState(() => proximoFimDeSemana(hojeISO()));
  const [escala, setEscala] = useState<ItemEscala[]>([]);
  const [anterior, setAnterior] = useState<ItemEscala[]>([]);
  const [form, setForm] = useState(novaLinha);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const semanaPassada = somarDias(data, -7);
    const { data: linhas, error } = await sb.from("escala").select("*").in("data", [data, semanaPassada]).order("hora_inicio");
    if (error) return avisar(error.message, true);
    const todas = (linhas as ItemEscala[]) ?? [];
    setEscala(todas.filter((e) => e.data === data));
    setAnterior(todas.filter((e) => e.data === semanaPassada));
  }, [sb, data, avisar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const faixas = useMemo(() => faixasDoDia(data, locutores, escala), [data, locutores, escala]);
  const fimDeSemana = [0, 6].includes(diaDaSemana(data));
  const naEscala = new Set(faixas.flatMap((f) => f.locutores.map((l) => l.id)));
  const fora = ativos.filter((l) => !l.freela && !naEscala.has(l.id));

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.locutor || !form.hora_inicio || !form.hora_fim) return avisar("Escolha o locutor e o horário (das e até).", true);
    if (form.hora_inicio === form.hora_fim) return avisar("O horário de início e de fim não podem ser iguais.", true);
    const ids = [form.locutor, form.parceiro].filter((x, i, a) => x && a.indexOf(x) === i);
    setSalvando(true);
    try {
      const { error } = await sb.from("escala").insert(ids.map((locutor_id) => ({ data, locutor_id, hora_inicio: form.hora_inicio, hora_fim: form.hora_fim })));
      if (error) throw new Error(error.message);
      avisar("Adicionado à escala");
      setForm(novaLinha());
      carregar();
    } catch (err) {
      avisar(erroMsg(err), true);
    } finally {
      setSalvando(false);
    }
  }

  async function remover(f: Faixa) {
    if (!confirm(`Tirar ${nomesFaixa(f)} (${horarioFaixa(f)}) da escala de ${fmtData(data)}?`)) return;
    const ids = escala.filter((e) => f.locutores.some((l) => l.id === e.locutor_id) && e.hora_inicio.startsWith(f.inicio)).map((e) => e.id);
    const { error } = await sb.from("escala").delete().in("id", ids);
    if (error) return avisar(error.message, true);
    avisar("Removido da escala");
    carregar();
  }

  async function copiarSemanaPassada() {
    if (anterior.length === 0) return;
    if (escala.length > 0 && !confirm("Este dia já tem escala. Adicionar também os horários da semana passada?")) return;
    const { error } = await sb.from("escala").insert(anterior.map((e) => ({ data, locutor_id: e.locutor_id, hora_inicio: e.hora_inicio, hora_fim: e.hora_fim })));
    if (error) return avisar(error.message, true);
    avisar(`Copiada a escala de ${fmtData(somarDias(data, -7))}: agora é só ajustar`);
    carregar();
  }

  return (
    <>
      <section className="card">
        <div className="secao-topo" style={{ flexWrap: "wrap" }}>
          <h2>Escala · {fmtDiaSemana(data)}</h2>
          <div className="tabela-acoes">
            <button type="button" className="pequeno verde" onClick={() => setData((d) => somarDias(d, -1))}>◀ Dia anterior</button>
            <input type="date" aria-label="Dia da escala" value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
            <button type="button" className="pequeno verde" onClick={() => setData((d) => somarDias(d, 1))}>Próximo dia ▶</button>
            <button type="button" className="pequeno branco" onClick={() => setData(proximoFimDeSemana(somarDias(data, 1)))}>Próximo fim de semana</button>
          </div>
        </div>
        <p className="dica">
          {fimDeSemana
            ? "Fim de semana: vale só o que estiver aqui. Horário sem ninguém é programação gravada."
            : "Dia de semana: vale o horário fixo de cada locutor. Para uma troca (folga, férias, freela), adicione quem fica no horário: substitui só aquele horário, só neste dia."}
        </p>

        {faixas.length === 0 ? (
          <div className="vazio">Ninguém escalado neste dia.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead><tr><th>Horário</th><th>Locutor</th><th>Origem</th><th>Ações</th></tr></thead>
              <tbody>
                {faixas.map((f) => (
                  <tr key={`${f.inicio}-${f.origem}-${nomesFaixa(f)}`}>
                    <td style={{ whiteSpace: "nowrap" }}><strong>{horarioFaixa(f)}</strong></td>
                    <td className="texto">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <Avatares sb={sb} locutores={f.locutores} tamanho={36} />
                        <strong>{nomesFaixa(f)}</strong>
                      </span>
                    </td>
                    <td><span className={`etiqueta ${f.origem === "escala" ? "situacao-no-ar" : "cinza"}`}>{f.origem === "escala" ? "Escala do dia" : "Horário fixo"}</span></td>
                    <td>{f.origem === "escala" && <button type="button" className="pequeno vermelho" onClick={() => remover(f)}>Remover</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {fora.length > 0 && <p className="dica"><strong>Fora da escala neste dia (folga):</strong> {fora.map((l) => l.nome).join(", ")}</p>}
        {anterior.length > 0 && (
          <div className="acoes">
            <button type="button" className="branco" onClick={copiarSemanaPassada}>Copiar a escala de {fmtData(somarDias(data, -7))}</button>
          </div>
        )}
      </section>

      <form className="card form" onSubmit={adicionar}>
        <h2>Adicionar à escala de {fmtData(data)}</h2>
        <div className="form-grade">
          <label className="campo">
            Locutor
            <select required aria-label="Locutor da escala" value={form.locutor} onChange={(e) => setForm({ ...form, locutor: e.target.value })}>
              <option value="">Escolha…</option>
              {ativos.map((l) => <option key={l.id} value={l.id}>{l.nome}{l.freela ? " (freela)" : ""}</option>)}
            </select>
          </label>
          <label className="campo">
            Junto com (opcional, para dupla)
            <select aria-label="Dupla (opcional)" value={form.parceiro} onChange={(e) => setForm({ ...form, parceiro: e.target.value })}>
              <option value="">Ninguém</option>
              {ativos.filter((l) => l.id !== form.locutor).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </label>
          <label className="campo">
            Das
            <input type="time" required aria-label="Escala: início" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
          </label>
          <label className="campo">
            Até
            <input type="time" required aria-label="Escala: fim" value={form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
          </label>
        </div>
        <div className="atalhos" role="group" aria-label="Horários comuns">
          <span>Horários do fim de semana:</span>
          {[["07:00", "12:00"], ["12:00", "17:00"], ["17:00", "22:00"], ["22:00", "03:00"]].map(([i, f]) => (
            <button key={i} type="button" className={`pequeno ${form.hora_inicio === i && form.hora_fim === f ? "verde" : "branco"}`} onClick={() => setForm({ ...form, hora_inicio: i, hora_fim: f })}>
              {horarioFaixa({ inicio: i, fim: f })}
            </button>
          ))}
        </div>
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : "Adicionar à escala"}</button>
        </div>
      </form>
    </>
  );
}
