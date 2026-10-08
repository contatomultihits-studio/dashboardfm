"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Modal } from "@/components/Modal";
import { fmtData, horaCurta } from "@/lib/datas";
import { fmtTelefone, localOuvinte, normalizarBusca, normalizarTelefone, situacaoOuvinte, type Ganhador, type Ouvinte, type Premio, type Rodada } from "@/lib/promocao";
import { erroMsg, type Avisar } from "../comum";

type Resultado = { ouvinte: Ouvinte; vitorias: Pick<Ganhador, "data" | "premio_nome">[] };

/** Busca ouvintes por nome (sem acento) ou telefone, com as vitórias de cada um. */
export async function buscarOuvintes(sb: SupabaseClient, termo: string, limite = 20): Promise<Resultado[]> {
  const digitos = normalizarTelefone(termo);
  const nome = normalizarBusca(termo);
  let q = sb.from("ouvintes").select("*");
  const ehTelefone = /^[\d\s()+\-.]+$/.test(termo) && digitos.length >= 4;
  q = ehTelefone ? q.ilike("telefone", `%${digitos}%`) : q.ilike("nome_busca", `%${nome}%`);
  const { data, error } = await q.order("nome").limit(limite);
  if (error) throw new Error(error.message);
  return comVitorias(sb, data as Ouvinte[]);
}

export async function comVitorias(sb: SupabaseClient, ouvintes: Ouvinte[]): Promise<Resultado[]> {
  if (!ouvintes.length) return [];
  const { data, error } = await sb.from("ganhadores").select("ouvinte_id,data,premio_nome").in("ouvinte_id", ouvintes.map((o) => o.id)).order("data", { ascending: false });
  if (error) throw new Error(error.message);
  const por = new Map<string, Pick<Ganhador, "data" | "premio_nome">[]>();
  for (const g of data as Pick<Ganhador, "ouvinte_id" | "data" | "premio_nome">[]) por.set(g.ouvinte_id, [...(por.get(g.ouvinte_id) ?? []), g]);
  return ouvintes.map((o) => ({ ouvinte: o, vitorias: por.get(o.id) ?? [] }));
}

const NOVO = { nome: "", telefone: "", bairro: "", cidade: "" };

/**
 * Registrar quem ganhou: procura o ouvinte (e mostra se pode ganhar) ou cadastra um novo.
 * Com `rodada`, o prêmio e a data vêm do horário; sem, escolhe o prêmio e a data aqui.
 */
export function RegistrarGanhador({ sb, avisar, rodada, premios, dia, locutorSugerido, onSalvo, onFechar }: {
  sb: SupabaseClient;
  avisar: Avisar;
  rodada: Rodada | null;
  premios: Premio[];
  dia: string;
  locutorSugerido: string;
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [escolhido, setEscolhido] = useState<Resultado | null>(null);
  const [novo, setNovo] = useState<typeof NOVO | null>(null);
  const [parecidos, setParecidos] = useState<Resultado[]>([]);
  const [premioId, setPremioId] = useState(rodada?.premio_id ?? "");
  const [data, setData] = useState(rodada?.data ?? dia);
  const [locutor, setLocutor] = useState(locutorSugerido);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const premio = premios.find((p) => p.id === premioId);

  // Busca enquanto digita (espera a pessoa parar um pouco).
  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) {
      setResultados(null);
      return;
    }
    let vivo = true;
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const r = await buscarOuvintes(sb, t);
        if (vivo) setResultados(r);
      } catch (e) {
        if (vivo) avisar(erroMsg(e), true);
      } finally {
        if (vivo) setBuscando(false);
      }
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [sb, termo, avisar]);

  // Cadastro novo: avisa se já existe alguém com o mesmo telefone ou o mesmo nome.
  useEffect(() => {
    if (!novo) return setParecidos([]);
    const tel = normalizarTelefone(novo.telefone);
    const nome = normalizarBusca(novo.nome);
    if (tel.length < 8 && nome.length < 3) return setParecidos([]);
    let vivo = true;
    const timer = setTimeout(async () => {
      const achados = new Map<string, Ouvinte>();
      if (tel.length >= 8) {
        const { data } = await sb.from("ouvintes").select("*").eq("telefone", tel).limit(5);
        for (const o of (data as Ouvinte[]) ?? []) achados.set(o.id, o);
      }
      if (nome.length >= 3) {
        const { data } = await sb.from("ouvintes").select("*").eq("nome_busca", nome).limit(5);
        for (const o of (data as Ouvinte[]) ?? []) achados.set(o.id, o);
      }
      const r = await comVitorias(sb, [...achados.values()]).catch(() => []);
      if (vivo) setParecidos(r);
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [sb, novo]);

  const situacao = useMemo(() => (escolhido ? situacaoOuvinte(escolhido.ouvinte, escolhido.vitorias, data) : null), [escolhido, data]);

  async function salvar() {
    if (!premio && !rodada) return avisar("Escolha o prêmio.", true);
    if (!escolhido && !novo?.nome.trim()) return avisar("Escolha um ouvinte da busca ou cadastre um novo (o nome é obrigatório).", true);
    if (situacao && situacao.tipo !== "livre") return avisar(situacao.texto, true);
    setSalvando(true);
    try {
      let ouvinteId = escolhido?.ouvinte.id;
      if (!ouvinteId && novo) {
        ouvinteId = crypto.randomUUID();
        const { error } = await sb.from("ouvintes").insert({
          id: ouvinteId,
          nome: novo.nome.trim(),
          telefone: normalizarTelefone(novo.telefone),
          bairro: novo.bairro.trim(),
          cidade: novo.cidade.trim(),
        });
        if (error) throw new Error(error.message);
      }
      const { error } = await sb.from("ganhadores").insert({
        ouvinte_id: ouvinteId,
        rodada_id: rodada?.id ?? null,
        premio_id: premio?.id ?? null,
        premio_nome: premio?.nome ?? "Prêmio",
        data,
        locutor: locutor.trim(),
        obs: obs.trim(),
      });
      if (error) throw new Error(error.message);
      avisar(`Ganhador registrado: ${escolhido?.ouvinte.nome ?? novo?.nome.trim()}`);
      onSalvo();
    } catch (e) {
      avisar(erroMsg(e), true);
    } finally {
      setSalvando(false);
    }
  }

  const titulo = rodada ? `Ganhador do prêmio das ${horaCurta(rodada.horario)}` : "Lançar ganhador";

  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <div className="form">
        {rodada ? (
          <div className="ganhador-premio">
            <strong>{premio?.nome ?? "Horário sem prêmio definido"}</strong>
            <span>{fmtData(rodada.data)} às {horaCurta(rodada.horario)}</span>
          </div>
        ) : (
          <div className="form-grade">
            <label className="campo">
              Prêmio
              <select value={premioId} onChange={(e) => setPremioId(e.target.value)}>
                <option value="">Escolha…</option>
                {premios.filter((p) => p.ativo || p.id === premioId).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </label>
            <label className="campo">
              Data
              <input type="date" required value={data} onChange={(e) => e.target.value && setData(e.target.value)} />
            </label>
          </div>
        )}

        {escolhido ? (
          <div className={`ouvinte-escolhido situacao-${situacao?.tipo}`}>
            <div>
              <strong>{escolhido.ouvinte.nome}</strong>
              <div className="trecho">{[fmtTelefone(escolhido.ouvinte.telefone), localOuvinte(escolhido.ouvinte)].filter(Boolean).join(" · ") || "Sem telefone e endereço"}</div>
              <div className={`situacao-ouvinte ${situacao?.tipo}`} role="status">{situacao?.texto}</div>
            </div>
            <button type="button" className="pequeno branco" onClick={() => setEscolhido(null)}>Trocar</button>
          </div>
        ) : novo ? (
          <div className="form">
            <h3>Novo ouvinte</h3>
            <div className="form-grade">
              <label className="campo">
                Nome
                <input type="text" required maxLength={80} autoFocus value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} />
              </label>
              <label className="campo">
                Telefone (opcional)
                <input type="tel" maxLength={20} placeholder="(11) 99999-8888" value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} />
              </label>
              <label className="campo">
                Bairro (opcional)
                <input type="text" maxLength={60} value={novo.bairro} onChange={(e) => setNovo({ ...novo, bairro: e.target.value })} />
              </label>
              <label className="campo">
                Cidade (opcional)
                <input type="text" maxLength={60} value={novo.cidade} onChange={(e) => setNovo({ ...novo, cidade: e.target.value })} />
              </label>
            </div>
            {parecidos.length > 0 && (
              <div className="aviso" role="alert">
                <strong>Já existe ouvinte parecido. É a mesma pessoa?</strong>
                <ListaOuvintes resultados={parecidos} dia={data} onEscolher={(r) => { setEscolhido(r); setNovo(null); }} />
              </div>
            )}
            <div className="acoes">
              <button type="button" className="pequeno branco" onClick={() => setNovo(null)}>Voltar para a busca</button>
            </div>
          </div>
        ) : (
          <>
            <label className="campo">
              Buscar ouvinte (nome ou telefone)
              <input type="search" autoFocus placeholder="Ex.: Maria Silva ou 99999-8888" value={termo} onChange={(e) => setTermo(e.target.value)} />
            </label>
            {buscando && <span className="dica">Buscando…</span>}
            {resultados && !buscando && (
              resultados.length ? (
                <ListaOuvintes resultados={resultados} dia={data} onEscolher={setEscolhido} />
              ) : (
                <div className="vazio">Ninguém encontrado com “{termo.trim()}”.</div>
              )
            )}
            <div className="acoes">
              <button
                type="button"
                className="amarelo"
                onClick={() => setNovo({ ...NOVO, ...(normalizarTelefone(termo).length >= 8 ? { telefone: termo } : { nome: termo.trim() }) })}
              >
                + Cadastrar novo ouvinte
              </button>
            </div>
          </>
        )}

        <div className="form-grade">
          <label className="campo">
            Locutor
            <input type="text" maxLength={80} value={locutor} onChange={(e) => setLocutor(e.target.value)} />
          </label>
          <label className="campo">
            Observação (opcional)
            <input type="text" maxLength={200} placeholder="Ex.: retira na recepção" value={obs} onChange={(e) => setObs(e.target.value)} />
          </label>
        </div>
        <div className="acoes">
          <button type="button" className="verde" disabled={salvando || (!escolhido && !novo) || (situacao !== null && situacao.tipo !== "livre")} onClick={salvar}>
            {salvando ? "Salvando…" : "🏆 Registrar ganhador"}
          </button>
          <button type="button" className="branco" onClick={onFechar}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}

/** Lista de ouvintes com a situação de cada um (pode ganhar, carência ou bloqueado). */
export function ListaOuvintes({ resultados, dia, onEscolher }: { resultados: Resultado[]; dia: string; onEscolher: (r: Resultado) => void }) {
  return (
    <ul className="lista-ouvintes">
      {resultados.map((r) => {
        const s = situacaoOuvinte(r.ouvinte, r.vitorias, dia);
        const ultima = r.vitorias[0];
        return (
          <li key={r.ouvinte.id} className={`situacao-${s.tipo}`}>
            <div>
              <strong>{r.ouvinte.nome}</strong>
              <div className="trecho">
                {[fmtTelefone(r.ouvinte.telefone), localOuvinte(r.ouvinte)].filter(Boolean).join(" · ") || "Sem telefone e endereço"}
                {ultima && ` · Último prêmio: ${fmtData(ultima.data)} (${ultima.premio_nome})`}
                {r.vitorias.length > 1 && ` · ${r.vitorias.length} prêmios no total`}
              </div>
              <div className={`situacao-ouvinte ${s.tipo}`}>{s.texto}</div>
            </div>
            <button type="button" className={`pequeno ${s.tipo === "livre" ? "verde" : "branco"}`} disabled={s.tipo !== "livre"} onClick={() => onEscolher(r)}>
              {s.tipo === "livre" ? "Escolher" : "Não pode"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
