"use client";

import { useCallback, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Avatar } from "@/components/Avatar";
import { Imagem } from "@/components/Imagem";
import { EtiquetaSituacao } from "@/components/EtiquetaSituacao";
import { agoraHHMM, diasNoPeriodo, ehSemPrazo, fimDoPeriodo, fmtData, hojeISO, horaCurta, SEM_PRAZO, situacaoPeriodo, somarDias, type Duracao } from "@/lib/datas";
import { sanitizarHtml, textoPuro } from "@/lib/html";
import { removerImagemSemUso, urlImagem } from "@/lib/imagens";
import { ATALHOS_DIAS, DIAS_CURTOS, ORDEM_DIAS, proximasVezes, resumoRepeticao, situacaoRepetida, viraMeiaNoite } from "@/lib/repeticao";
import { classeTipo, nomePauta, TIPO_PAUTA_LABEL, TIPOS_POR_SECAO, type ItemNoAr, type SecaoPauta, type TipoPauta } from "@/lib/tipos";
import { CampoImagem, useImagemForm } from "./CampoImagem";
import { CampoLocutor } from "./CampoLocutor";
import { CabecalhoLista, erroMsg, useLista, useLocutoresEquipe, type Avisar } from "./comum";
import { EditorTexto } from "./EditorTexto";

/** O que muda entre prioridades, recados, conexões e pautas: tabela, campos extras e os textos da tela. */
export type ConfigItensNoAr = {
  tabela: "prioridades" | "recados" | "conexoes" | "pautas";
  comImagem: boolean;
  comDestaque: boolean;
  /** Prioridades e conexões: "Fixar em primeiro" (fica na frente, fora do rodízio de "já lido"). */
  comFixar?: boolean;
  feminino: boolean;
  /** "prioridade" / "recado" */
  nome: string;
  /** "Prioridades" / "Recados" */
  plural: string;
  tituloNovo: string;
  rotuloTitulo: string;
  exemploTitulo: string;
  /** Conexões: conteúdo atemporal, começa "sem prazo" para sair do ar. */
  semPrazo?: boolean;
  /** Pautas do Partiu Rádio Disney: cliente, locutor, horário no ar e tipo; título opcional. */
  pauta?: boolean;
  /** Seção da pauta (Partiu ou Jornalismo); só com `pauta`. */
  secao?: SecaoPauta;
  /** Recados: opção de aparecer só em alguns dias da semana e num horário diário. */
  comRepetir?: boolean;
};

/** Classe da etiqueta de situação de um item que repete. */
const CLASSE_REPETIDA = { "no-ar": "situacao-no-ar", agendada: "situacao-agendada", "mais-tarde": "situacao-agendada", encerrada: "situacao-encerrada", "hoje-nao": "cinza" } as const;

type Atalho = { rotulo: string; fim: (inicio: string) => string };

const duracao = (rotulo: string, d: Duracao): Atalho => ({ rotulo, fim: (inicio) => fimDoPeriodo(inicio, d) });

const ATALHOS_PADRAO: Atalho[] = [
  duracao("1 semana", { qtd: 1, unidade: "semana" }),
  duracao("2 semanas", { qtd: 2, unidade: "semana" }),
  duracao("1 mês", { qtd: 1, unidade: "mes" }),
  duracao("2 meses", { qtd: 2, unidade: "mes" }),
  duracao("3 meses", { qtd: 3, unidade: "mes" }),
];

const SEM_PRAZO_ATALHO: Atalho = { rotulo: "Sem prazo", fim: () => SEM_PRAZO };

const ATALHOS_PAUTA: Atalho[] = [
  duracao("Só no dia", { qtd: 1, unidade: "dia" }),
  duracao("2 dias", { qtd: 2, unidade: "dia" }),
  duracao("3 dias", { qtd: 3, unidade: "dia" }),
  duracao("1 semana", { qtd: 1, unidade: "semana" }),
];

function atalhosDe(c: ConfigItensNoAr): Atalho[] {
  if (c.pauta) return ATALHOS_PAUTA;
  if (c.semPrazo) return [SEM_PRAZO_ATALHO, ...ATALHOS_PADRAO];
  return ATALHOS_PADRAO;
}

function novo(padrao: Atalho, secao: SecaoPauta = "partiu") {
  const inicio = hojeISO();
  return {
    data_inicio: inicio,
    data_fim: padrao.fim(inicio),
    hora_inicio: "",
    hora_fim: "",
    titulo: "",
    conteudo_html: "",
    ativo: true,
    destaque: false,
    fixado: false,
    cliente: "",
    locutor: "",
    locutor_id: null as string | null,
    horario: "",
    tipo: (secao === "jornalismo" ? "NOTA" : "VALENDO") as TipoPauta,
    // No Partiu o aviso de 5 min é sempre ligado; no Jornalismo, só onde a produção marcar.
    aviso: secao !== "jornalismo",
    repetir: false,
    dias_semana: [] as number[],
    janela_inicio: "",
    janela_fim: "",
  };
}

/** Campos da repetição (recados), copiados ao editar e ao duplicar. */
function camposRepetir(p: ItemNoAr) {
  return { repetir: Boolean(p.repetir), dias_semana: p.dias_semana ?? [], janela_inicio: horaCurta(p.janela_inicio) ?? "", janela_fim: horaCurta(p.janela_fim) ?? "" };
}

/** Campos das pautas, copiados ao editar e ao duplicar. */
function camposPauta(p: ItemNoAr) {
  return { cliente: p.cliente ?? "", locutor: p.locutor ?? "", locutor_id: p.locutor_id ?? null, horario: horaCurta(p.horario) ?? "", tipo: p.tipo ?? ("VALENDO" as TipoPauta), aviso: p.aviso !== false };
}

export function ItensNoAr({ sb, avisar, config: c }: { sb: SupabaseClient; avisar: Avisar; config: ConfigItensNoAr }) {
  const g = (fem: string, masc: string) => (c.feminino ? fem : masc);
  const Nome = c.nome[0].toUpperCase() + c.nome.slice(1);
  const hoje = hojeISO();
  // Lista: o que ainda está no ar ou vai entrar (sai do ar hoje ou depois), pela data de entrada.
  const secao = c.secao ?? "partiu";
  const jornal = Boolean(c.pauta) && secao === "jornalismo";
  const lista = useLista<ItemNoAr>(sb, c.tabela, "data_inicio", hoje, c.pauta ? "horario" : "data_fim", "data_fim", c.pauta ? ["secao", secao] : undefined);
  const imagem = useImagemForm();
  const atalhos = atalhosDe(c);
  const { locutores } = useLocutoresEquipe(sb);
  const locutorDe = (p: ItemNoAr) => (p.locutor_id ? locutores.find((l) => l.id === p.locutor_id) : undefined);
  const padrao = atalhos[0];
  const [form, setForm] = useState(() => novo(padrao, secao));
  // Atalho escolhido: se a data de entrada mudar, a saída acompanha.
  const [atalho, setAtalho] = useState<Atalho | null>(padrao);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [salvando, setSalvando] = useState(false);

  function limpar() {
    setForm(novo(padrao, secao));
    setAtalho(padrao);
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
      fixado: Boolean(p.fixado),
      ...camposPauta(p),
      ...camposRepetir(p),
    });
    setAtalho(ehSemPrazo(p.data_fim) ? SEM_PRAZO_ATALHO : null);
    setEditandoId(p.id);
    imagem.reiniciar(p.imagem_path ?? null);
    setVersao((v) => v + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** Nova versão a partir de uma existente: mesmo texto e foto, começando no dia seguinte ao fim dela. */
  function duplicar(p: ItemNoAr) {
    const inicio = ehSemPrazo(p.data_fim) ? hoje : somarDias(p.data_fim, 1);
    setForm({
      data_inicio: inicio,
      data_fim: inicio,
      hora_inicio: "",
      hora_fim: horaCurta(p.hora_fim) ?? "",
      titulo: p.titulo ?? "",
      conteudo_html: p.conteudo_html,
      ativo: p.ativo,
      destaque: Boolean(p.destaque),
      fixado: Boolean(p.fixado),
      ...camposPauta(p),
      ...camposRepetir(p),
    });
    setAtalho(null);
    setEditandoId(null);
    imagem.reiniciar(p.imagem_path ?? null);
    setVersao((v) => v + 1);
    avisar("Cópia pronta: ajuste o texto e as datas e salve");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const mudarLocutor = useCallback((v: { locutor_id: string | null; locutor: string }) => setForm((f) => ({ ...f, ...v })), []);

  function mudarInicio(inicio: string) {
    if (!inicio) return;
    setForm((f) => ({
      ...f,
      data_inicio: inicio,
      data_fim: atalho ? atalho.fim(inicio) : f.data_fim < inicio ? inicio : f.data_fim,
    }));
  }

  function escolherAtalho(a: Atalho) {
    setAtalho(a);
    setForm((f) => ({ ...f, data_fim: a.fim(f.data_inicio) }));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (form.data_fim < form.data_inicio) {
      avisar("A data de saída não pode ser antes da entrada.", true);
      return;
    }
    const repetir = Boolean(c.comRepetir && form.repetir);
    if (repetir && !form.dias_semana.length) {
      avisar("Marque pelo menos um dia da semana.", true);
      return;
    }
    if (repetir && (!form.janela_inicio || !form.janela_fim || form.janela_inicio === form.janela_fim)) {
      avisar("Preencha o horário em que o recado aparece (das … às …).", true);
      return;
    }
    if (!repetir && form.data_fim === form.data_inicio && form.hora_inicio && form.hora_fim && form.hora_fim <= form.hora_inicio) {
      avisar("No mesmo dia, o horário de saída precisa ser depois do de entrada.", true);
      return;
    }
    if (c.pauta && (!(jornal ? form.titulo : form.cliente).trim() || !form.locutor.trim() || !form.horario)) {
      avisar(`Preencha ${jornal ? "assunto" : "cliente"}, locutor e o horário que a pauta vai ao ar.`, true);
      return;
    }
    if ((!c.pauta || jornal) && !form.titulo.trim()) {
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
      const dados: Record<string, unknown> = {
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        ...(c.pauta
          ? {
              secao,
              horario: form.horario,
              cliente: jornal ? "" : form.cliente.trim(),
              locutor: form.locutor.trim(),
              locutor_id: form.locutor_id,
              tipo: form.tipo,
              aviso: jornal ? form.aviso : true,
            }
          : repetir
            ? { hora_inicio: null, hora_fim: null }
            : { hora_inicio: form.hora_inicio || null, hora_fim: semPrazo ? null : form.hora_fim || null }),
        ...(c.comRepetir
          ? {
              repetir,
              dias_semana: repetir ? form.dias_semana : [],
              janela_inicio: repetir ? form.janela_inicio : null,
              janela_fim: repetir ? form.janela_fim : null,
            }
          : {}),
        titulo: form.titulo.trim(),
        conteudo_html: sanitizarHtml(form.conteudo_html),
        ativo: form.ativo,
        ...(img ? { imagem_path: img.path } : {}),
        ...(c.comDestaque ? { destaque: form.destaque } : {}),
        ...(c.comFixar ? { fixado: form.fixado } : {}),
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
    if (p.repetir) {
      // Recado que repete: para de aparecer de vez (dá para ligar de novo em "Exibir").
      if (!confirm(`Tirar este recado do ar? Ele deixa de aparecer em todos os dias marcados (dá para voltar marcando "Exibir").`)) return;
      const { error } = await sb.from(c.tabela).update({ ativo: false }).eq("id", p.id);
      if (error) return avisar(error.message, true);
      avisar(`${Nome} saiu do ar`);
      return lista.recarregar();
    }
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

  const semPrazo = ehSemPrazo(form.data_fim);
  const dias = !semPrazo && form.data_fim >= form.data_inicio ? diasNoPeriodo(form.data_inicio, form.data_fim) : 0;

  return (
    <>
      <form className="card form" onSubmit={salvar}>
        <h2>{editandoId ? `Editar ${c.nome}` : c.tituloNovo}</h2>
        {c.pauta && (
          <>
            <div className="form-grade pauta-grade">
              {jornal ? (
                <label className="campo">
                  Assunto (aparece no card)
                  <input type="text" required maxLength={80} placeholder={`Ex.: ${c.exemploTitulo}`} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </label>
              ) : (
                <label className="campo">
                  Cliente
                  <input type="text" required maxLength={80} placeholder="Ex.: Shopping Eldorado" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} />
                </label>
              )}
              <CampoLocutor
                key={`loc-${versao}`}
                sb={sb}
                data={form.data_inicio}
                horario={form.horario}
                locutorId={form.locutor_id}
                nome={form.locutor}
                onChange={mudarLocutor}
              />
              <label className="campo">
                Horário no ar
                <input type="time" required value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} />
              </label>
            </div>
            <div className="atalhos" role="radiogroup" aria-label="Tipo da pauta">
              <span>Tipo:</span>
              {TIPOS_POR_SECAO[secao].map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.tipo === t}
                  className={`pequeno ${form.tipo === t ? (t === "VALENDO" ? "vermelho" : jornal ? "verde" : "amarelo") : "branco"}`}
                  onClick={() => setForm({ ...form, tipo: t })}
                >
                  {TIPO_PAUTA_LABEL[t]}
                </button>
              ))}
            </div>
            {jornal && (
              <label className="check">
                <input type="checkbox" checked={form.aviso} onChange={(e) => setForm({ ...form, aviso: e.target.checked })} />
                ⏰ Avisar 5 min antes na dashboard (com som e "Abrir pauta")
              </label>
            )}
          </>
        )}
        {!jornal && (
        <label className="campo">
          {c.rotuloTitulo}
          <input
            type="text"
            required={!c.pauta}
            maxLength={80}
            placeholder={`Ex.: ${c.exemploTitulo}`}
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          />
        </label>
        )}
        <div className={`form-grade ${c.pauta ? "" : "periodo-grade"}`}>
          <label className="campo">
            Entra no ar
            <input type="date" required value={form.data_inicio} onChange={(e) => mudarInicio(e.target.value)} />
          </label>
          {!c.pauta && !form.repetir && (
            <label className="campo">
              às (opcional)
              <input type="time" aria-label="Horário de entrada" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} />
            </label>
          )}
          <label className="campo">
            {c.pauta ? "Último dia" : "Sai do ar (último dia)"}
            {semPrazo ? (
              <input type="text" readOnly value="Sem prazo" title="Escolha uma duração abaixo para definir a data de saída" />
            ) : (
              <input
                type="date"
                required
                min={form.data_inicio}
                value={form.data_fim}
                onChange={(e) => {
                  setAtalho(null);
                  setForm({ ...form, data_fim: e.target.value });
                }}
              />
            )}
          </label>
          {!c.pauta && !form.repetir && (
            <label className="campo">
              até (opcional)
              <input type="time" aria-label="Horário de saída" disabled={semPrazo} value={semPrazo ? "" : form.hora_fim} onChange={(e) => setForm({ ...form, hora_fim: e.target.value })} />
            </label>
          )}
        </div>
        <p className="dica">
          {c.pauta
            ? "Fica na dashboard o dia todo, em cada dia do período, até o locutor marcar como feita."
            : form.repetir
              ? "O período é a validade: o recado só aparece nos dias e no horário marcados abaixo."
              : "Sem horário, vale o dia todo. Com horário, sai da dashboard sozinho no minuto marcado."}
        </p>
        {c.comRepetir && (
          <div className="repetir">
            <div className="campo" role="radiogroup" aria-label="Quando aparece">
              <span className="campo-rotulo">Quando aparece</span>
              <label className="check">
                <input type="radio" name="quando-aparece" checked={!form.repetir} onChange={() => setForm({ ...form, repetir: false })} />
                Período corrido (todos os dias do período)
              </label>
              <label className="check">
                <input type="radio" name="quando-aparece" checked={form.repetir} onChange={() => setForm({ ...form, repetir: true })} />
                Só em alguns dias e horários
              </label>
            </div>
            {form.repetir && (
              <div className="repetir-opcoes">
                <div className="atalhos" role="group" aria-label="Dias da semana">
                  <span>Dias:</span>
                  {ORDEM_DIAS.map((d) => {
                    const marcado = form.dias_semana.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        className={`pequeno ${marcado ? "verde" : "branco"}`}
                        aria-pressed={marcado}
                        onClick={() => setForm({ ...form, dias_semana: marcado ? form.dias_semana.filter((x) => x !== d) : [...form.dias_semana, d].sort() })}
                      >
                        {DIAS_CURTOS[d]}
                      </button>
                    );
                  })}
                  {ATALHOS_DIAS.map((a) => (
                    <button key={a.rotulo} type="button" className="pequeno amarelo" onClick={() => setForm({ ...form, dias_semana: [...a.dias].sort() })}>{a.rotulo}</button>
                  ))}
                </div>
                <div className="form-grade repetir-horas">
                  <label className="campo">
                    Aparece das
                    <input type="time" required value={form.janela_inicio} onChange={(e) => setForm({ ...form, janela_inicio: e.target.value })} />
                  </label>
                  <label className="campo">
                    às
                    <input type="time" required value={form.janela_fim} onChange={(e) => setForm({ ...form, janela_fim: e.target.value })} />
                  </label>
                </div>
                {form.janela_inicio && form.janela_fim && form.janela_inicio !== form.janela_fim && viraMeiaNoite(form) && (
                  <p className="dica">Passa da meia-noite: fica até {form.janela_fim} do dia seguinte.</p>
                )}
                {form.dias_semana.length > 0 && form.janela_inicio && form.janela_fim && form.janela_inicio !== form.janela_fim && (
                  <p className="dica proximas-vezes" aria-live="polite">
                    <strong>Próximas vezes:</strong>{" "}
                    {(() => {
                      const v = proximasVezes({ ...form, repetir: true }, hoje, agoraHHMM());
                      return v.length ? v.map((x) => (x === "agora" ? "no ar agora" : x)).join(" · ") : "nenhuma dentro do período: confira as datas";
                    })()}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <div className="atalhos" role="group" aria-label="Duração">
          <span>Duração:</span>
          {atalhos.map((a) => {
            const ativo = form.data_fim === a.fim(form.data_inicio);
            return (
              <button
                key={a.rotulo}
                type="button"
                className={`pequeno ${ativo ? "verde" : "branco"}`}
                aria-pressed={ativo}
                onClick={() => escolherAtalho(a)}
              >
                {a.rotulo}
              </button>
            );
          })}
          {semPrazo && <span className="resumo-periodo">No ar a partir de {fmtData(form.data_inicio)}, sem data para sair</span>}
          {dias > 0 && (
            <span className="resumo-periodo">
              {fmtData(form.data_inicio)}
              {form.hora_inicio ? ` ${form.hora_inicio}` : ""} a {fmtData(form.data_fim)}
              {form.hora_fim && !c.pauta ? ` ${form.hora_fim}` : ""} · {dias} {dias === 1 ? "dia" : "dias"} no ar
            </span>
          )}
        </div>
        <EditorTexto key={`${c.tabela}-${versao}`} rotulo={c.pauta ? "Pauta (texto que o locutor vai ler)" : "Texto para o locutor ler no ar"} valorInicial={form.conteudo_html} placeholder="O que o locutor precisa falar no ar…" onChange={(html) => setForm((f) => ({ ...f, conteudo_html: html }))} />
        {c.comImagem && <CampoImagem sb={sb} imagem={imagem} />}
        {c.comDestaque && (
          <label className="check">
            <input type="checkbox" checked={form.destaque} onChange={(e) => setForm({ ...form, destaque: e.target.checked })} />
            Destacar (fica em vermelho e aparece primeiro)
          </label>
        )}
        {c.comFixar && (
          <label className="check">
            <input type="checkbox" checked={form.fixado} onChange={(e) => setForm({ ...form, fixado: e.target.checked })} />
            ⭐ Fixar em primeiro (fica sempre na frente na dashboard, fora do rodízio)
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
                  <th>Período no ar</th>
                  {c.pauta && <th>Horário</th>}
                  <th>Situação</th>
                  <th>{c.pauta ? "Pauta" : "Título"}</th>
                  <th>Exibir</th><th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.itens.map((p) => (
                  <tr key={p.id} className={`${p.ativo ? "" : "oculto"} ${editandoId === p.id ? "editando" : ""}`}>
                    {c.comImagem && <td><Imagem src={urlImagem(sb, p.imagem_path)} alt="" className="mini-thumb" largura={88} altura={88} sizes="44px" /></td>}
                    <td style={{ whiteSpace: "nowrap" }}>
                      {fmtData(p.data_inicio)}
                      {horaCurta(p.hora_inicio) && ` ${horaCurta(p.hora_inicio)}`}
                      {ehSemPrazo(p.data_fim) ? " → sem prazo" : (p.data_fim !== p.data_inicio || horaCurta(p.hora_fim)) && (
                        <>
                          {" → "}
                          {p.data_fim !== p.data_inicio && fmtData(p.data_fim)}
                          {horaCurta(p.hora_fim) && ` ${horaCurta(p.hora_fim)}`}
                        </>
                      )}
                      {p.repetir && <div className="trecho">🔁 {resumoRepeticao(p)}</div>}
                    </td>
                    {c.pauta && <td><strong>{horaCurta(p.horario)}</strong></td>}
                    <td>
                      {p.repetir ? (() => {
                        const st = situacaoRepetida(p, hoje, agoraHHMM());
                        return <span className={`etiqueta ${CLASSE_REPETIDA[st.tipo]}`}>{st.texto}</span>;
                      })() : <EtiquetaSituacao inicio={p.data_inicio} fim={p.data_fim} hoje={hoje} horaInicio={p.hora_inicio} horaFim={p.hora_fim} />}
                    </td>
                    <td className="texto">
                      {p.destaque && <span className="etiqueta destaque" style={{ marginRight: 6 }}>Destaque</span>}
                      {p.fixado && <span className="etiqueta fixado" style={{ marginRight: 6 }}>⭐ Fixado</span>}
                      {c.pauta ? (
                        <>
                          <span className={`etiqueta ${classeTipo(p.tipo)}`} style={{ marginRight: 6 }}>{TIPO_PAUTA_LABEL[p.tipo ?? "VALENDO"]}</span>
                          {jornal && p.aviso && <span className="etiqueta cinza" style={{ marginRight: 6 }} title="Avisa 5 min antes">⏰ Aviso</span>}
                          <strong>{nomePauta(p)}</strong> · {locutorDe(p) ? <Avatar sb={sb} locutor={locutorDe(p)!} tamanho={24} /> : "🎙"} {p.locutor}
                          {!jornal && p.titulo && <div className="trecho">{p.titulo}</div>}
                        </>
                      ) : p.titulo ? <strong>{p.titulo}</strong> : <em className="sem-titulo">Sem título</em>}
                      <div className="trecho">{textoPuro(p.conteudo_html).slice(0, 100) || "—"}</div>
                    </td>
                    <td><input type="checkbox" aria-label="Exibir na dashboard" checked={p.ativo} onChange={() => alternarAtivo(p)} /></td>
                    <td>
                      <div className="tabela-acoes">
                        <button type="button" className="pequeno" onClick={() => editar(p)}>Editar</button>
                        <button type="button" className="pequeno branco" onClick={() => duplicar(p)} title="Criar a próxima versão (ex.: 'é amanhã', 'é hoje')">Duplicar</button>
                        {!c.pauta && (p.repetir ? p.ativo && situacaoRepetida(p, hoje, agoraHHMM()).tipo !== "encerrada" : situacaoPeriodo(p.data_inicio, p.data_fim, hoje, { inicio: p.hora_inicio, fim: p.hora_fim, agora: agoraHHMM() }) === "no-ar") && (
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
