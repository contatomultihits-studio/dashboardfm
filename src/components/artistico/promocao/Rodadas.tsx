"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Imagem } from "@/components/Imagem";
import { Modal } from "@/components/Modal";
import { fmtData, fmtDiaSemana, hojeISO, horaCurta, somarDias } from "@/lib/datas";
import { noArEm, nomesFaixa } from "@/lib/escala";
import { urlImagem } from "@/lib/imagens";
import { datasEntre, faixaPremio, localOuvinte, type Ganhador, type Ouvinte, type Premio, type Rodada } from "@/lib/promocao";
import type { ItemEscala } from "@/lib/tipos";
import { erroMsg, useLocutoresEquipe, type Avisar } from "../comum";
import type { usePremios } from "./comum";
import { RegistrarGanhador } from "./RegistrarGanhador";

type Faixa = { inicio: string; fim: string };

/** Junta faixas sem repetir o mesmo começo, em ordem. */
function juntarFaixas(a: Faixa[], b: Faixa[]): Faixa[] {
  const por = new Map<string, Faixa>();
  for (const f of [...a, ...b]) por.set(f.inicio, f);
  return [...por.values()].sort((x, y) => x.inicio.localeCompare(y.inicio));
}

/** Grade do dia: em que horários sai prêmio, qual prêmio, com aviso ou não, e quem ganhou. */
export function Rodadas({ sb, avisar, premiosLista }: { sb: SupabaseClient; avisar: Avisar; premiosLista: ReturnType<typeof usePremios> }) {
  const { premios } = premiosLista;
  const [dia, setDia] = useState(hojeISO);
  const [rodadas, setRodadas] = useState<Rodada[]>([]);
  const [ganhadores, setGanhadores] = useState<(Ganhador & { ouvinte?: Ouvinte })[]>([]);
  const [escala, setEscala] = useState<ItemEscala[]>([]);
  const { locutores } = useLocutoresEquipe(sb);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState<Rodada | null>(null);
  const [editando, setEditando] = useState<Rodada | null>(null);
  const [gerar, setGerar] = useState(() => ({ de: hojeISO(), ate: hojeISO(), inicio: "", fim: "", faixas: [] as Faixa[], premio_id: "", aviso: false }));
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const [r, g, e] = await Promise.all([
      sb.from("promo_rodadas").select("*").eq("data", dia).order("horario"),
      sb.from("ganhadores").select("*").eq("data", dia).order("ganho_em"),
      sb.from("escala").select("*").in("data", [dia, somarDias(dia, -1)]),
    ]);
    const falha = r.error ?? g.error ?? e.error;
    setErro(falha?.message ?? null);
    if (!falha) {
      const gs = g.data as Ganhador[];
      const ids = [...new Set(gs.map((x) => x.ouvinte_id))];
      const { data: os } = ids.length ? await sb.from("ouvintes").select("*").in("id", ids) : { data: [] };
      const porId = new Map((os as Ouvinte[]).map((o) => [o.id, o]));
      setRodadas(r.data as Rodada[]);
      setGanhadores(gs.map((x) => ({ ...x, ouvinte: porId.get(x.ouvinte_id) })));
      setEscala(e.data as ItemEscala[]);
    }
    setCarregando(false);
  }, [sb, dia]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // A grade nova começa no dia que está aberto.
  useEffect(() => setGerar((g) => ({ ...g, de: dia, ate: g.ate === g.de || g.ate < dia ? dia : g.ate })), [dia]);

  const premioPorId = useMemo(() => new Map(premios.map((p) => [p.id, p])), [premios]);
  const locutorNoAr = (r: Rodada) => {
    const f = locutores.length ? noArEm(r.data, horaCurta(r.horario)!, locutores, escala) : null;
    return f ? nomesFaixa(f) : "";
  };

  // Os horários exatos escolhidos (e o que ficou digitado no campo, se não clicou em "adicionar").
  // As faixas escolhidas (e a que ficou digitada nos campos, se não clicou em "adicionar").
  const digitada = gerar.inicio && gerar.fim && gerar.fim > gerar.inicio ? [{ inicio: gerar.inicio, fim: gerar.fim }] : [];
  const faixasNovas = juntarFaixas(gerar.faixas, digitada);
  function adicionarFaixa() {
    if (!gerar.inicio || !gerar.fim) return avisar("Preencha o horário de começo e de fim.", true);
    if (gerar.fim <= gerar.inicio) return avisar("O fim precisa ser depois do começo (para passar da meia-noite, vá até 23:59 e cadastre o resto no dia seguinte).", true);
    // A próxima faixa já começa onde esta terminou.
    setGerar((g) => ({ ...g, faixas: juntarFaixas(g.faixas, [{ inicio: g.inicio, fim: g.fim }]), inicio: g.fim, fim: "" }));
  }
  const diasNovos = datasEntre(gerar.de, gerar.ate);

  async function criarGrade(e: React.FormEvent) {
    e.preventDefault();
    if (gerar.inicio && gerar.fim && gerar.fim <= gerar.inicio) return avisar("O fim precisa ser depois do começo.", true);
    if (!faixasNovas.length || !diasNovos.length) return avisar("Coloque pelo menos uma faixa de horário (das … até …).", true);
    setGerando(true);
    try {
      // Não repete horário que já existe no dia.
      const { data, error } = await sb.from("promo_rodadas").select("data,horario").gte("data", gerar.de).lte("data", gerar.ate);
      if (error) throw new Error(error.message);
      const existe = new Set((data as Pick<Rodada, "data" | "horario">[]).map((x) => `${x.data} ${horaCurta(x.horario)}`));
      const novas = diasNovos.flatMap((d) =>
        faixasNovas.filter((h) => !existe.has(`${d} ${h.inicio}`)).map((h) => ({ data: d, horario: h.inicio, horario_fim: h.fim, premio_id: gerar.premio_id || null, aviso: gerar.aviso })),
      );
      if (!novas.length) {
        setGerar((g) => ({ ...g, inicio: "", fim: "", faixas: [] }));
        return avisar("Esses horários já estão na grade.");
      }
      const { error: e2 } = await sb.from("promo_rodadas").insert(novas);
      if (e2) throw new Error(e2.message);
      const pulados = diasNovos.length * faixasNovas.length - novas.length;
      avisar(`${novas.length} ${novas.length === 1 ? "prêmio colocado na grade" : "prêmios colocados na grade"}${pulados ? ` (${pulados} já existiam)` : ""}`);
      setGerar((g) => ({ ...g, inicio: "", fim: "", faixas: [] }));
      carregar();
    } catch (err) {
      avisar(erroMsg(err), true);
    } finally {
      setGerando(false);
    }
  }

  async function copiarDiaAnterior() {
    const ontem = somarDias(dia, -1);
    const { data, error } = await sb.from("promo_rodadas").select("*").eq("data", ontem);
    if (error) return avisar(error.message, true);
    const existe = new Set(rodadas.map((r) => horaCurta(r.horario)));
    const novas = (data as Rodada[])
      .filter((r) => !existe.has(horaCurta(r.horario)))
      .map((r) => ({ data: dia, horario: horaCurta(r.horario), horario_fim: horaCurta(r.horario_fim), premio_id: r.premio_id, aviso: r.aviso, ativo: r.ativo }));
    if (!novas.length) return avisar(`Nada para copiar de ${fmtData(ontem)}.`, true);
    const { error: e2 } = await sb.from("promo_rodadas").insert(novas);
    if (e2) return avisar(e2.message, true);
    avisar(`Copiada a grade de ${fmtData(ontem)}: ${novas.length} horários`);
    carregar();
  }

  // Muda na tela na hora; se o banco recusar, volta como estava.
  async function mudar(r: Rodada, campos: Partial<Rodada>) {
    setRodadas((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...campos } : x)));
    const { error } = await sb.from("promo_rodadas").update(campos).eq("id", r.id);
    if (error) {
      setRodadas((rs) => rs.map((x) => (x.id === r.id ? r : x)));
      avisar(error.message, true);
    }
  }

  async function excluir(r: Rodada) {
    const temGanhador = ganhadores.some((g) => g.rodada_id === r.id);
    if (!confirm(`Tirar o horário das ${horaCurta(r.horario)} da grade?${temGanhador ? " O ganhador continua no histórico." : ""}`)) return;
    const { error } = await sb.from("promo_rodadas").delete().eq("id", r.id);
    if (error) return avisar(error.message, true);
    avisar("Horário removido");
    carregar();
  }

  async function desfazerGanhador(g: Ganhador & { ouvinte?: Ouvinte }) {
    if (!confirm(`Apagar ${g.ouvinte?.nome ?? "este ganhador"} deste prêmio? O ouvinte continua cadastrado.`)) return;
    const { error } = await sb.from("ganhadores").delete().eq("id", g.id);
    if (error) return avisar(error.message, true);
    avisar("Ganhador removido");
    carregar();
  }

  return (
    <>
      <section className="card">
        <div className="secao-topo" style={{ flexWrap: "wrap" }}>
          <h2>Grade de prêmios · {fmtDiaSemana(dia)}</h2>
          <div className="tabela-acoes">
            <button type="button" className="pequeno verde" onClick={() => setDia((d) => somarDias(d, -1))}>◀ Dia anterior</button>
            <input type="date" aria-label="Dia da grade" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} />
            <button type="button" className="pequeno verde" onClick={() => setDia((d) => somarDias(d, 1))}>Próximo dia ▶</button>
          </div>
        </div>
        {erro && <div className="aviso erro">{erro}</div>}
        {!carregando && rodadas.length === 0 ? (
          <div className="vazio">
            Sem prêmios neste dia. Monte a grade abaixo
            <div style={{ marginTop: 10 }}><button type="button" className="pequeno branco" onClick={copiarDiaAnterior}>Copiar a grade de {fmtData(somarDias(dia, -1))}</button></div>
          </div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr><th>Horário</th><th>Prêmio</th><th>Aviso</th><th>No ar</th><th>Ganhador</th><th>Exibir</th><th>Ações</th></tr>
              </thead>
              <tbody>
                {rodadas.map((r) => {
                  const p = r.premio_id ? premioPorId.get(r.premio_id) : undefined;
                  const gs = ganhadores.filter((g) => g.rodada_id === r.id);
                  return (
                    <tr key={r.id} className={r.ativo ? "" : "oculto"}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <strong className="rodada-hora">{horaCurta(r.horario)}</strong>
                        <span className="rodada-ate"> às </span>
                        <input
                          type="time"
                          className="rodada-fim"
                          aria-label={`Fim do prêmio das ${horaCurta(r.horario)}`}
                          defaultValue={horaCurta(r.horario_fim) ?? ""}
                          key={`${r.id}-${r.horario_fim}`}
                          onBlur={(e) => {
                            const v = e.target.value;
                            if (v === (horaCurta(r.horario_fim) ?? "")) return;
                            if (v && v <= horaCurta(r.horario)!) {
                              e.target.value = horaCurta(r.horario_fim) ?? "";
                              return avisar("O fim precisa ser depois do começo.", true);
                            }
                            mudar(r, { horario_fim: v || null });
                          }}
                        />
                      </td>
                      <td>
                        <div className="rodada-premio">
                          <Imagem src={urlImagem(sb, p?.imagem_path)} alt="" className="mini-thumb" largura={88} altura={88} sizes="44px" />
                          <select aria-label={`Prêmio das ${horaCurta(r.horario)}`} value={r.premio_id ?? ""} onChange={(e) => mudar(r, { premio_id: e.target.value || null })}>
                            <option value="">— Escolher prêmio —</option>
                            {premios.filter((x) => x.ativo || x.id === r.premio_id).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                          </select>
                        </div>
                      </td>
                      <td><input type="checkbox" aria-label={`Aviso das ${horaCurta(r.horario)}`} title="Pop-up 5 min antes na tela do locutor" checked={r.aviso} onChange={() => mudar(r, { aviso: !r.aviso })} /></td>
                      <td>{locutorNoAr(r) || <span className="trecho">Gravado</span>}</td>
                      <td className="texto">
                        {gs.map((g) => (
                          <div key={g.id} className="rodada-ganhador">
                            🏆 <strong>{g.ouvinte?.nome ?? "Ouvinte"}</strong>
                            {g.ouvinte && localOuvinte(g.ouvinte) && <span className="trecho"> · {localOuvinte(g.ouvinte)}</span>}
                            <button type="button" className="pequeno branco" aria-label={`Desfazer ganhador ${g.ouvinte?.nome ?? ""}`} onClick={() => desfazerGanhador(g)}>✕</button>
                          </div>
                        ))}
                        <button type="button" className={`pequeno ${gs.length ? "branco" : "amarelo"}`} onClick={() => setRegistrando(r)}>
                          {gs.length ? "+ Outro ganhador" : "🏆 Incluir ganhador"}
                        </button>
                      </td>
                      <td><input type="checkbox" aria-label={`Exibir prêmio das ${horaCurta(r.horario)}`} checked={r.ativo} onChange={() => mudar(r, { ativo: !r.ativo })} /></td>
                      <td>
                        <div className="tabela-acoes">
                          <button type="button" className="pequeno" aria-label={`Editar prêmio das ${horaCurta(r.horario)}`} onClick={() => setEditando(r)}>Editar</button>
                          <button type="button" className="pequeno vermelho" onClick={() => excluir(r)}>Excluir</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form className="card form" onSubmit={criarGrade}>
        <h2>Colocar prêmio na grade</h2>
        <p className="dica">Escolha de que horas até que horas o prêmio fica na tela do locutor (ex.: das 06:00 às 09:00). Dá para adicionar várias faixas de uma vez: depois de adicionar uma, a próxima já começa onde ela terminou. Depois do sorteio, a promoção clica em “Incluir ganhador” na tabela acima.</p>
        <div className="form-grade">
          <label className="campo">
            Dia
            <input type="date" required value={gerar.de} onChange={(e) => e.target.value && setGerar({ ...gerar, de: e.target.value, ate: gerar.ate === gerar.de || gerar.ate < e.target.value ? e.target.value : gerar.ate })} />
          </label>
          <label className="campo">
            Repetir até o dia (opcional)
            <input type="date" required min={gerar.de} value={gerar.ate} onChange={(e) => e.target.value && setGerar({ ...gerar, ate: e.target.value })} />
          </label>
          <div className="campo campo-faixa">
            <span className="rotulo-campo">Fica na tela do locutor</span>
            <div className="faixa-linha">
              <input type="time" aria-label="Das" value={gerar.inicio} onChange={(e) => setGerar({ ...gerar, inicio: e.target.value })} />
              <span className="rodada-ate">às</span>
              <input
                type="time"
                aria-label="Até"
                value={gerar.fim}
                onChange={(e) => setGerar({ ...gerar, fim: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarFaixa();
                  }
                }}
              />
              <button type="button" className="pequeno branco" style={{ whiteSpace: "nowrap" }} disabled={!gerar.inicio || !gerar.fim} onClick={adicionarFaixa}>+ Adicionar</button>
            </div>
          </div>
          <label className="campo">
            Prêmio
            <select value={gerar.premio_id} onChange={(e) => setGerar({ ...gerar, premio_id: e.target.value })}>
              <option value="">Escolher depois</option>
              {premios.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        </div>
        {gerar.faixas.length > 0 && (
          <div className="atalhos" aria-label="Faixas escolhidas">
            <span>Faixas:</span>
            {gerar.faixas.map((h) => (
              <button key={h.inicio} type="button" className="pequeno amarelo" title="Tirar esta faixa" onClick={() => setGerar((g) => ({ ...g, faixas: g.faixas.filter((x) => x.inicio !== h.inicio) }))}>
                {h.inicio} às {h.fim} ✕
              </button>
            ))}
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={gerar.aviso} onChange={(e) => setGerar({ ...gerar, aviso: e.target.checked })} />
          ⏰ Avisar 5 min antes na tela do locutor (pop-up com som)
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={gerando || !faixasNovas.length || !diasNovos.length}>
            {gerando ? "Salvando…" : faixasNovas.length * diasNovos.length <= 1 ? "Colocar na grade" : `Colocar ${faixasNovas.length * diasNovos.length} prêmios na grade`}
          </button>
          {faixasNovas.length > 0 && (
            <span className="resumo-periodo">
              {faixasNovas.map((h) => `${h.inicio} às ${h.fim}`).join(", ")}
              {diasNovos.length > 1 ? ` · todos os dias de ${fmtData(gerar.de)} a ${fmtData(gerar.ate)}` : ` · ${fmtData(gerar.de)}`}
            </span>
          )}
          {rodadas.length > 0 && <button type="button" className="branco" onClick={copiarDiaAnterior}>Copiar a grade de {fmtData(somarDias(dia, -1))}</button>}
        </div>
      </form>

      {editando && (
        <EditarRodada
          sb={sb}
          avisar={avisar}
          rodada={editando}
          premios={premios}
          onSalvo={(novoDia) => {
            setEditando(null);
            if (novoDia !== dia) setDia(novoDia);
            else carregar();
          }}
          onFechar={() => setEditando(null)}
        />
      )}

      {registrando && (
        <RegistrarGanhador
          sb={sb}
          avisar={avisar}
          rodada={registrando}
          premios={premios}
          dia={dia}
          locutorSugerido={locutorNoAr(registrando)}
          onSalvo={() => {
            setRegistrando(null);
            carregar();
          }}
          onFechar={() => setRegistrando(null)}
        />
      )}
    </>
  );
}

/** Editar um prêmio da grade: dia, faixa de horário, prêmio, aviso e se aparece para o locutor. */
function EditarRodada({ sb, avisar, rodada, premios, onSalvo, onFechar }: {
  sb: SupabaseClient;
  avisar: Avisar;
  rodada: Rodada;
  premios: Premio[];
  onSalvo: (dia: string) => void;
  onFechar: () => void;
}) {
  const [form, setForm] = useState({
    data: rodada.data,
    inicio: horaCurta(rodada.horario) ?? "",
    fim: horaCurta(rodada.horario_fim) ?? "",
    premio_id: rodada.premio_id ?? "",
    aviso: rodada.aviso,
    ativo: rodada.ativo,
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.data || !form.inicio) return avisar("Preencha o dia e o horário de começo.", true);
    if (form.fim && form.fim <= form.inicio) return avisar("O fim precisa ser depois do começo.", true);
    setSalvando(true);
    const { error } = await sb.from("promo_rodadas").update({
      data: form.data,
      horario: form.inicio,
      horario_fim: form.fim || null,
      premio_id: form.premio_id || null,
      aviso: form.aviso,
      ativo: form.ativo,
    }).eq("id", rodada.id);
    setSalvando(false);
    if (error) return avisar(error.message, true);
    avisar("Prêmio da grade atualizado");
    onSalvo(form.data);
  }

  return (
    <Modal titulo={`Editar prêmio das ${faixaPremio(rodada)}`} onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <div className="form-grade">
          <label className="campo">
            Dia
            <input type="date" required value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
          </label>
          <label className="campo">
            Das
            <input type="time" required value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
          </label>
          <label className="campo">
            Até
            <input type="time" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} />
          </label>
        </div>
        <label className="campo">
          Prêmio
          <select value={form.premio_id} onChange={(e) => setForm({ ...form, premio_id: e.target.value })}>
            <option value="">— Escolher prêmio —</option>
            {premios.filter((p) => p.ativo || p.id === form.premio_id).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={form.aviso} onChange={(e) => setForm({ ...form, aviso: e.target.checked })} />
          ⏰ Avisar 5 min antes na tela do locutor (pop-up com som)
        </label>
        <label className="check">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
          Exibir na tela do locutor
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : "Salvar alterações"}</button>
          <button type="button" className="branco" onClick={onFechar}>Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}
