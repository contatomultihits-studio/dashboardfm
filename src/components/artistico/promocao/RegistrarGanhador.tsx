"use client";

import { useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Modal } from "@/components/Modal";
import { fmtData } from "@/lib/datas";
import { faixaPremio, fmtTelefone, localOuvinte, normalizarBusca, normalizarTelefone, situacaoOuvinte, type Ganhador, type Ouvinte, type Premio, type Rodada } from "@/lib/promocao";
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

/** Ouvintes da base parecidos com o que está sendo digitado: mesmo pedaço de nome ou de telefone. */
async function buscarParecidos(sb: SupabaseClient, nome: string, telefone: string): Promise<Resultado[]> {
  const n = normalizarBusca(nome);
  const t = normalizarTelefone(telefone);
  const consultas = [];
  if (n.length >= 3) consultas.push(sb.from("ouvintes").select("*").ilike("nome_busca", `%${n}%`).order("nome").limit(15));
  if (t.length >= 4) consultas.push(sb.from("ouvintes").select("*").ilike("telefone", `%${t.slice(-8)}%`).limit(10));
  if (!consultas.length) return [];
  const respostas = await Promise.all(consultas);
  const por = new Map<string, Ouvinte>();
  for (const r of respostas) {
    if (r.error) throw new Error(r.error.message);
    for (const o of r.data as Ouvinte[]) por.set(o.id, o);
  }
  // Quem tem o mesmo telefone vem primeiro.
  const lista = [...por.values()].sort((a, b) => Number(Boolean(t) && b.telefone.endsWith(t.slice(-8))) - Number(Boolean(t) && a.telefone.endsWith(t.slice(-8))));
  return comVitorias(sb, lista);
}

const VAZIO = { nome: "", telefone: "", bairro: "", cidade: "" };

/**
 * Incluir o ganhador de um prêmio: a produção preenche o cadastro e, enquanto digita, o sistema
 * mostra quem já está na base (e se pode ganhar). Dá para usar um cadastro existente ou criar um novo.
 * O ganhador entra direto na lista de ganhadores (relatório e planilha).
 * Com `rodada`, o prêmio e a data vêm da grade; sem, escolhe o prêmio e a data aqui.
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
  const [form, setForm] = useState(VAZIO);
  const [escolhido, setEscolhido] = useState<Resultado | null>(null);
  const [parecidos, setParecidos] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [premioId, setPremioId] = useState(rodada?.premio_id ?? "");
  const [data, setData] = useState(rodada?.data ?? dia);
  const [locutor, setLocutor] = useState(locutorSugerido);
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const premio = premios.find((p) => p.id === premioId);

  // Enquanto digita nome ou telefone, procura na base.
  useEffect(() => {
    if (escolhido) return;
    let vivo = true;
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const r = await buscarParecidos(sb, form.nome, form.telefone);
        if (vivo) setParecidos(r);
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
  }, [sb, form.nome, form.telefone, escolhido, avisar]);

  const situacao = useMemo(() => (escolhido ? situacaoOuvinte(escolhido.ouvinte, escolhido.vitorias, data) : null), [escolhido, data]);
  // Cadastro novo com o telefone de alguém que não pode ganhar: barra (é a mesma pessoa).
  const tel = normalizarTelefone(form.telefone);
  const mesmoTelefone = !escolhido && tel.length >= 8 ? parecidos.find((p) => p.ouvinte.telefone && p.ouvinte.telefone.slice(-8) === tel.slice(-8)) : undefined;
  const situacaoTelefone = mesmoTelefone ? situacaoOuvinte(mesmoTelefone.ouvinte, mesmoTelefone.vitorias, data) : null;
  const bloqueio = situacao && situacao.tipo !== "livre" ? situacao.texto : situacaoTelefone && situacaoTelefone.tipo !== "livre" ? `Esse telefone é de ${mesmoTelefone!.ouvinte.nome}. ${situacaoTelefone.texto}` : null;

  function usar(r: Resultado) {
    setEscolhido(r);
    setForm({ nome: r.ouvinte.nome, telefone: fmtTelefone(r.ouvinte.telefone), bairro: r.ouvinte.bairro, cidade: r.ouvinte.cidade });
  }

  function trocar() {
    setEscolhido(null);
    setForm(VAZIO);
  }

  async function salvar() {
    if (!premio && !rodada) return avisar("Escolha o prêmio.", true);
    if (!form.nome.trim()) return avisar("O nome do ganhador é obrigatório.", true);
    if (bloqueio) return avisar(bloqueio, true);
    setSalvando(true);
    try {
      let ouvinteId = escolhido?.ouvinte.id;
      const dados = { nome: form.nome.trim(), telefone: tel, bairro: form.bairro.trim(), cidade: form.cidade.trim() };
      if (ouvinteId) {
        // Completa o cadastro antigo com o que a produção acrescentou (ex.: bairro).
        const o = escolhido!.ouvinte;
        const extra = Object.fromEntries(Object.entries(dados).filter(([k, v]) => v && v !== o[k as keyof typeof dados]));
        if (Object.keys(extra).length) await sb.from("ouvintes").update(extra).eq("id", ouvinteId);
      } else {
        ouvinteId = crypto.randomUUID();
        const { error } = await sb.from("ouvintes").insert({ id: ouvinteId, ...dados });
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
      avisar(`Ganhador registrado: ${dados.nome}`);
      onSalvo();
    } catch (e) {
      avisar(erroMsg(e), true);
    } finally {
      setSalvando(false);
    }
  }

  const titulo = rodada ? `Ganhador do prêmio das ${faixaPremio(rodada)}` : "Lançar ganhador";
  const campo = (k: keyof typeof VAZIO) => ({
    value: form[k],
    disabled: Boolean(escolhido) && k !== "bairro" && k !== "cidade",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <Modal titulo={titulo} onFechar={onFechar}>
      <div className="form">
        {rodada ? (
          <div className="ganhador-premio">
            <strong>{premio?.nome || "Horário sem prêmio definido"}</strong>
            <span>{fmtData(rodada.data)} · {faixaPremio(rodada)}{premio?.patrocinador ? ` · ${premio.patrocinador}` : ""}</span>
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

        <h3>Dados do ganhador</h3>
        <div className="form-grade">
          <label className="campo">
            Nome
            <input type="text" required maxLength={80} autoFocus placeholder="Nome do ouvinte" {...campo("nome")} />
          </label>
          <label className="campo">
            Telefone (opcional)
            <input type="tel" maxLength={20} placeholder="(11) 99999-8888" {...campo("telefone")} />
          </label>
          <label className="campo">
            Bairro (opcional)
            <input type="text" maxLength={60} {...campo("bairro")} />
          </label>
          <label className="campo">
            Cidade (opcional)
            <input type="text" maxLength={60} {...campo("cidade")} />
          </label>
        </div>

        {escolhido ? (
          <div className={`ouvinte-escolhido situacao-${situacao?.tipo}`}>
            <div>
              <strong>Cadastro já existente: {escolhido.ouvinte.nome}</strong>
              <div className="trecho">
                {escolhido.vitorias.length ? `${escolhido.vitorias.length} ${escolhido.vitorias.length === 1 ? "prêmio" : "prêmios"} · último em ${fmtData(escolhido.vitorias[0].data)} (${escolhido.vitorias[0].premio_nome})` : "Nunca ganhou"}
              </div>
              <div className={`situacao-ouvinte ${situacao?.tipo}`} role="status">{situacao?.texto}</div>
            </div>
            <button type="button" className="pequeno branco" onClick={trocar}>Trocar</button>
          </div>
        ) : (
          <div className="parecidos" aria-label="Já está na base?">
            <span className="rotulo-campo">Já ganhou? Na base de ouvintes</span>
            {form.nome.trim().length < 3 && tel.length < 4 ? (
              <span className="dica">Digite o nome ou o telefone: o sistema mostra aqui se a pessoa já está na base e se pode ganhar.</span>
            ) : buscando ? (
              <span className="dica">Procurando…</span>
            ) : parecidos.length ? (
              <ListaOuvintes resultados={parecidos} dia={data} onEscolher={usar} />
            ) : (
              <span className="situacao-ouvinte livre">Ninguém parecido na base: vai entrar como ouvinte novo.</span>
            )}
          </div>
        )}
        {bloqueio && <div className="aviso erro" role="alert">{bloqueio}</div>}

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
        <p className="dica">Ao registrar, o ganhador aparece no card do locutor e entra na lista de ganhadores (relatório e planilha).</p>
        <div className="acoes">
          <button type="button" className="verde" disabled={salvando || !form.nome.trim() || Boolean(bloqueio)} onClick={salvar}>
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
              {s.tipo === "livre" ? "É este" : "Não pode"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
