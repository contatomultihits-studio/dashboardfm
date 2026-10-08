"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Imagem } from "@/components/Imagem";
import { fmtData, fmtDiaSemana, hojeISO, horaCurta, somarDias } from "@/lib/datas";
import { noArEm, nomesFaixa } from "@/lib/escala";
import { urlImagem } from "@/lib/imagens";
import { datasEntre, gerarHorarios, localOuvinte, type Ganhador, type Ouvinte, type Rodada } from "@/lib/promocao";
import type { ItemEscala } from "@/lib/tipos";
import { erroMsg, useLocutoresEquipe, type Avisar } from "../comum";
import type { usePremios } from "./comum";
import { RegistrarGanhador } from "./RegistrarGanhador";

const INTERVALOS = [
  { min: 60, rotulo: "De hora em hora" },
  { min: 120, rotulo: "A cada 2 horas" },
  { min: 180, rotulo: "A cada 3 horas" },
  { min: 30, rotulo: "A cada 30 minutos" },
];

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
  const [gerar, setGerar] = useState(() => ({ de: hojeISO(), ate: hojeISO(), inicio: "09:00", fim: "18:00", intervalo: 60, premio_id: "", aviso: false }));
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
  useEffect(() => setGerar((g) => ({ ...g, de: dia, ate: g.ate < dia ? dia : g.ate })), [dia]);

  const premioPorId = useMemo(() => new Map(premios.map((p) => [p.id, p])), [premios]);
  const locutorNoAr = (r: Rodada) => {
    const f = locutores.length ? noArEm(r.data, horaCurta(r.horario)!, locutores, escala) : null;
    return f ? nomesFaixa(f) : "";
  };

  const horariosNovos = gerarHorarios(gerar.inicio, gerar.fim, gerar.intervalo);
  const diasNovos = datasEntre(gerar.de, gerar.ate);

  async function criarGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!horariosNovos.length || !diasNovos.length) return avisar("Confira as datas e os horários.", true);
    setGerando(true);
    try {
      // Não repete horário que já existe no dia.
      const { data, error } = await sb.from("promo_rodadas").select("data,horario").gte("data", gerar.de).lte("data", gerar.ate);
      if (error) throw new Error(error.message);
      const existe = new Set((data as Pick<Rodada, "data" | "horario">[]).map((x) => `${x.data} ${horaCurta(x.horario)}`));
      const novas = diasNovos.flatMap((d) =>
        horariosNovos.filter((h) => !existe.has(`${d} ${h}`)).map((h) => ({ data: d, horario: h, premio_id: gerar.premio_id || null, aviso: gerar.aviso })),
      );
      if (!novas.length) return avisar("Esses horários já estão na grade.");
      const { error: e2 } = await sb.from("promo_rodadas").insert(novas);
      if (e2) throw new Error(e2.message);
      const pulados = diasNovos.length * horariosNovos.length - novas.length;
      avisar(`${novas.length} ${novas.length === 1 ? "horário criado" : "horários criados"}${pulados ? ` (${pulados} já existiam)` : ""}`);
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
      .map((r) => ({ data: dia, horario: horaCurta(r.horario), premio_id: r.premio_id, aviso: r.aviso, ativo: r.ativo }));
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
                      <td><strong className="rodada-hora">{horaCurta(r.horario)}</strong></td>
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
                          {gs.length ? "+ Outro ganhador" : "Registrar ganhador"}
                        </button>
                      </td>
                      <td><input type="checkbox" aria-label={`Exibir prêmio das ${horaCurta(r.horario)}`} checked={r.ativo} onChange={() => mudar(r, { ativo: !r.ativo })} /></td>
                      <td><button type="button" className="pequeno vermelho" onClick={() => excluir(r)}>Excluir</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <form className="card form" onSubmit={criarGrade}>
        <h2>Montar grade</h2>
        <p className="dica">Cria os horários de uma vez (ex.: de hora em hora das 9h às 18h, na semana toda). Depois é só escolher o prêmio de cada horário na tabela. Para um horário avulso, use o mesmo horário em “das” e “até”.</p>
        <div className="form-grade">
          <label className="campo">
            Do dia
            <input type="date" required value={gerar.de} onChange={(e) => e.target.value && setGerar({ ...gerar, de: e.target.value, ate: gerar.ate < e.target.value ? e.target.value : gerar.ate })} />
          </label>
          <label className="campo">
            Até o dia
            <input type="date" required min={gerar.de} value={gerar.ate} onChange={(e) => e.target.value && setGerar({ ...gerar, ate: e.target.value })} />
          </label>
          <label className="campo">
            Das
            <input type="time" required value={gerar.inicio} onChange={(e) => setGerar({ ...gerar, inicio: e.target.value })} />
          </label>
          <label className="campo">
            Até
            <input type="time" required value={gerar.fim} onChange={(e) => setGerar({ ...gerar, fim: e.target.value })} />
          </label>
          <label className="campo">
            Frequência
            <select value={gerar.intervalo} onChange={(e) => setGerar({ ...gerar, intervalo: Number(e.target.value) })}>
              {INTERVALOS.map((i) => <option key={i.min} value={i.min}>{i.rotulo}</option>)}
            </select>
          </label>
          <label className="campo">
            Prêmio (opcional)
            <select value={gerar.premio_id} onChange={(e) => setGerar({ ...gerar, premio_id: e.target.value })}>
              <option value="">Escolher depois</option>
              {premios.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={gerar.aviso} onChange={(e) => setGerar({ ...gerar, aviso: e.target.checked })} />
          ⏰ Avisar 5 min antes na tela do locutor (pop-up com som)
        </label>
        <div className="acoes">
          <button type="submit" className="verde" disabled={gerando || !horariosNovos.length || !diasNovos.length}>
            {gerando ? "Criando…" : `Criar ${horariosNovos.length * diasNovos.length} ${horariosNovos.length * diasNovos.length === 1 ? "horário" : "horários"}`}
          </button>
          {horariosNovos.length > 0 && (
            <span className="resumo-periodo">
              {horariosNovos.length <= 8 ? horariosNovos.join(", ") : `${horariosNovos.slice(0, 6).join(", ")} … ${horariosNovos[horariosNovos.length - 1]}`}
              {diasNovos.length > 1 ? ` · em ${diasNovos.length} dias` : ""}
            </span>
          )}
          {rodadas.length > 0 && <button type="button" className="branco" onClick={copiarDiaAnterior}>Copiar a grade de {fmtData(somarDias(dia, -1))}</button>}
        </div>
      </form>

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
