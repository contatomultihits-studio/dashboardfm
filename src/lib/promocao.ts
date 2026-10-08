// Promoção: prêmios do dia (grade por horário), ganhadores, ouvintes e a regra dos 30 dias.

import { CARENCIA_PROMO_DIAS } from "@/lib/config";
import { diasNoPeriodo, fmtData, horaCurta, somarDias } from "@/lib/datas";

export type Premio = {
  id: string;
  nome: string;
  /** Chamada curta para o card (ex.: "Par de ingressos"). */
  titulo: string;
  descricao_html: string;
  patrocinador: string;
  imagem_path: string | null;
  ativo: boolean;
  /** Validade: a grade só aceita o prêmio entre estas datas (sem data = sem limite). */
  data_inicio?: string | null;
  data_fim?: string | null;
  /** É um evento? Então tem tipo de parceria. */
  evento?: boolean;
  parceria?: Parceria | null;
};

export type Parceria = "RADIO_OFICIAL" | "APOIO" | "CAMAROTE";
export const PARCERIAS: Record<Parceria, string> = {
  RADIO_OFICIAL: "Rádio Oficial",
  APOIO: "Apoio",
  CAMAROTE: "Camarote Rádio Disney",
};

/** O prêmio pode ir para a grade neste dia? */
export function premioValidoEm(p: Pick<Premio, "data_inicio" | "data_fim">, dia: string): boolean {
  return (!p.data_inicio || dia >= p.data_inicio) && (!p.data_fim || dia <= p.data_fim);
}

/** Algum dia da lista fica fora da validade? Devolve o primeiro. */
export function diaForaDaValidade(p: Pick<Premio, "data_inicio" | "data_fim">, dias: string[]): string | null {
  return dias.find((d) => !premioValidoEm(p, d)) ?? null;
}

/** "Válido de 08/10/2026 a 13/10/2026" / "Válido a partir de …" / "Sem validade definida" */
export function textoValidade(p: Pick<Premio, "data_inicio" | "data_fim">): string {
  if (p.data_inicio && p.data_fim) return `Válido de ${fmtData(p.data_inicio)} a ${fmtData(p.data_fim)}`;
  if (p.data_inicio) return `Válido a partir de ${fmtData(p.data_inicio)}`;
  if (p.data_fim) return `Válido até ${fmtData(p.data_fim)}`;
  return "Sem validade definida";
}

/** "Evento · Camarote Rádio Disney" */
export function tipoPremio(p: Pick<Premio, "evento" | "parceria">): string {
  if (!p.evento) return "";
  return p.parceria ? `Evento · ${PARCERIAS[p.parceria]}` : "Evento";
}

/** Prêmio entregue no ar (o "Concluído" do locutor). */
export type Entrega = {
  id: string;
  rodada_id: string | null;
  data: string;
  horario: string;
  horario_fim: string | null;
  premio_id: string | null;
  premio_nome: string;
  locutor: string;
  entregue_em: string;
};

/** Um horário da grade do dia ("prêmio das 15h"). */
export type Rodada = {
  id: string;
  data: string;
  /** Começo da faixa em que o prêmio fica na tela do locutor. */
  horario: string;
  /** Fim da faixa; sem fim (horários antigos), vale DURACAO_PADRAO_PREMIO_MIN. */
  horario_fim?: string | null;
  premio_id: string | null;
  /** Pop-up 5 min antes na tela do locutor. */
  aviso: boolean;
  ativo: boolean;
};

export type Ouvinte = {
  id: string;
  nome: string;
  /** Só números. */
  telefone: string;
  bairro: string;
  cidade: string;
  bloqueado: boolean;
  motivo_bloqueio: string;
};

export type Ganhador = {
  id: string;
  ouvinte_id: string;
  rodada_id: string | null;
  premio_id: string | null;
  premio_nome: string;
  data: string;
  ganho_em: string;
  locutor: string;
  importado: boolean;
  obs: string;
};

/** O que a dashboard pode ver de quem ganhou (sem telefone). */
export type GanhadorPublico = { rodada_id: string; nome: string; bairro: string; cidade: string; telefone_final?: string };

/** "Bela Vista · São Paulo · final 4758" (o que o locutor vê de quem ganhou). */
export function detalheGanhador(g: GanhadorPublico): string {
  return [localOuvinte(g), g.telefone_final ? `final ${g.telefone_final}` : ""].filter(Boolean).join(" · ");
}

/** Só os números; tira o +55 do começo. */
export function normalizarTelefone(t: string): string {
  const d = t.replace(/\D/g, "");
  return d.length >= 12 && d.startsWith("55") ? d.slice(2) : d;
}

/** (11) 99999-8888 */
export function fmtTelefone(t: string | null | undefined): string {
  const d = normalizarTelefone(t ?? "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Igual à coluna nome_busca do banco: minúsculas, sem acento. */
export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** "Tatuapé · São Paulo" */
export function localOuvinte(o: Pick<Ouvinte, "bairro" | "cidade">): string {
  return [o.bairro, o.cidade].map((x) => x?.trim()).filter(Boolean).join(" · ");
}

export type SituacaoOuvinte =
  | { tipo: "livre"; texto: string }
  | { tipo: "carencia"; texto: string; ultima: string; liberaEm: string }
  | { tipo: "bloqueado"; texto: string };

/**
 * Pode ganhar no `dia`? Bloqueado nunca; quem ganhou há menos de 30 dias (para trás ou para frente,
 * igual ao banco) só depois da carência.
 */
export function situacaoOuvinte(o: Pick<Ouvinte, "bloqueado" | "motivo_bloqueio">, vitorias: Pick<Ganhador, "data">[], dia: string): SituacaoOuvinte {
  if (o.bloqueado) return { tipo: "bloqueado", texto: `Bloqueado${o.motivo_bloqueio ? `: ${o.motivo_bloqueio}` : ""}` };
  const perto = vitorias.filter((v) => Math.abs(diasNoPeriodo(v.data, dia) - 1) < CARENCIA_PROMO_DIAS).map((v) => v.data).sort();
  if (perto.length) {
    const ultima = perto[perto.length - 1];
    const liberaEm = somarDias(ultima, CARENCIA_PROMO_DIAS);
    return { tipo: "carencia", texto: `Ganhou em ${fmtData(ultima)}: só pode ganhar de novo a partir de ${fmtData(liberaEm)}`, ultima, liberaEm };
  }
  return { tipo: "livre", texto: vitorias.length ? "Pode ganhar (passou dos 30 dias)" : "Pode ganhar (nunca ganhou)" };
}

const minutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
/** Datas de `inicio` a `fim` (incluindo). */
export function datasEntre(inicio: string, fim: string): string[] {
  const n = fim >= inicio ? diasNoPeriodo(inicio, fim) : 0;
  return Array.from({ length: Math.min(n, 62) }, (_, i) => somarDias(inicio, i));
}

/** Prêmio sem horário de fim fica na tela por este tempo. */
export const DURACAO_PADRAO_PREMIO_MIN = 60;

type ComFaixa = Pick<Rodada, "horario" | "horario_fim">;
const inicioMin = (r: ComFaixa) => minutos(horaCurta(r.horario)!);
const fimMin = (r: ComFaixa) => (r.horario_fim ? minutos(horaCurta(r.horario_fim)!) : inicioMin(r) + DURACAO_PADRAO_PREMIO_MIN);

/** Situação de um prêmio agora: na tela, já passou ou ainda vem. */
export function estadoPremio(r: ComFaixa, agora: string): "agora" | "passou" | "depois" {
  const ag = minutos(agora);
  if (ag < inicioMin(r)) return "depois";
  return ag < fimMin(r) ? "agora" : "passou";
}

/** "06h às 09h" / "15h30 às 16h" */
export function faixaPremio(r: ComFaixa): string {
  const h = (m: number) => {
    const hh = String(Math.floor(m / 60) % 24).padStart(2, "0");
    return m % 60 ? `${hh}h${String(m % 60).padStart(2, "0")}` : `${hh}h`;
  };
  return `${h(inicioMin(r))} às ${h(fimMin(r))}`;
}

/**
 * O carrossel do locutor: o prêmio da hora é o que está na faixa agora (se dois se cruzam, o que
 * começou por último); o último é o que terminou mais recentemente; o próximo, o que começa a seguir.
 */
export function momentoPromo<T extends ComFaixa>(rodadas: T[], agora: string): { ultimo: T | null; daHora: T | null; proximo: T | null } {
  const ord = [...rodadas].sort((a, b) => inicioMin(a) - inicioMin(b) || fimMin(a) - fimMin(b));
  const noAr = ord.filter((r) => estadoPremio(r, agora) === "agora");
  const passados = ord.filter((r) => estadoPremio(r, agora) === "passou").sort((a, b) => fimMin(a) - fimMin(b) || inicioMin(a) - inicioMin(b));
  return {
    daHora: noAr[noAr.length - 1] ?? null,
    ultimo: passados[passados.length - 1] ?? null,
    proximo: ord.find((r) => estadoPremio(r, agora) === "depois") ?? null,
  };
}

/** Situação de cada prêmio no carrossel do locutor. */
export type EstadoFila = "concluido" | "agora" | "pendente" | "depois";

/**
 * O carrossel do dia: todos os prêmios da grade em ordem de horário; os concluídos vão para o fim.
 * Prêmio cuja faixa já passou sem "Concluído" continua na fila como pendente.
 */
export function filaPromo<T extends ComFaixa & { id: string }>(rodadas: T[], concluidas: Set<string>, agora: string): { rodada: T; estado: EstadoFila }[] {
  const ord = [...rodadas].sort((a, b) => inicioMin(a) - inicioMin(b) || fimMin(a) - fimMin(b));
  const estado = (r: T): EstadoFila => {
    if (concluidas.has(r.id)) return "concluido";
    const e = estadoPremio(r, agora);
    return e === "agora" ? "agora" : e === "passou" ? "pendente" : "depois";
  };
  const comEstado = ord.map((r) => ({ rodada: r, estado: estado(r) }));
  return [...comEstado.filter((x) => x.estado !== "concluido"), ...comEstado.filter((x) => x.estado === "concluido")];
}

/** Linha do relatório de entregas: o previsto na grade e o que foi feito no ar. */
export type LinhaEntrega = {
  /** Horário da grade (para desfazer); null se o horário foi apagado da grade. */
  rodada_id: string | null;
  data: string;
  horario: string;
  horario_fim: string | null;
  premio: string;
  locutor: string;
  entregue_em: string | null;
};

/** Junta a grade (previsto) com as entregas (feito); entrega de horário apagado da grade também entra. */
export function relatorioEntregas(
  rodadas: (Pick<Rodada, "id" | "data" | "horario" | "horario_fim"> & { premio: string })[],
  entregas: Entrega[],
): LinhaEntrega[] {
  const porRodada = new Map(entregas.filter((e) => e.rodada_id).map((e) => [e.rodada_id!, e]));
  const linhas: LinhaEntrega[] = rodadas.map((r) => {
    const e = porRodada.get(r.id);
    return { rodada_id: e ? r.id : null, data: r.data, horario: r.horario, horario_fim: r.horario_fim ?? null, premio: e?.premio_nome || r.premio, locutor: e?.locutor ?? "", entregue_em: e?.entregue_em ?? null };
  });
  const naGrade = new Set(rodadas.map((r) => r.id));
  for (const e of entregas) {
    if (!e.rodada_id || !naGrade.has(e.rodada_id)) {
      linhas.push({ rodada_id: null, data: e.data, horario: e.horario, horario_fim: e.horario_fim, premio: e.premio_nome, locutor: e.locutor, entregue_em: e.entregue_em });
    }
  }
  return linhas.sort((a, b) => a.data.localeCompare(b.data) || a.horario.localeCompare(b.horario));
}

/** Planilha do relatório de entregas. */
export function csvEntregas(linhas: LinhaEntrega[], horaDe: (iso: string) => string): string {
  const cab = ["Data", "Horário previsto", "Prêmio", "Entregue no ar", "Locutor", "Situação"];
  const corpo = linhas.map((l) => [
    fmtData(l.data),
    faixaPremio(l),
    l.premio,
    l.entregue_em ? horaDe(l.entregue_em) : "",
    l.locutor,
    l.entregue_em ? "Entregue" : "Não entregue",
  ]);
  return "\ufeff" + [cab, ...corpo].map((linha) => linha.map(celula).join(";")).join("\r\n");
}

/** Um participante do sorteio (uma linha colada). */
export type Participante = { linha: string; nome: string; telefone: string };

/**
 * Lista colada pelo locutor (do WhatsApp, por exemplo): uma pessoa por linha.
 * Separa nome e telefone quando a linha tem número; tira repetidos e linhas vazias.
 */
export function lerParticipantes(texto: string): Participante[] {
  const vistos = new Set<string>();
  const lista: Participante[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.replace(/^\s*\d+[.)-]\s+/, "").trim();
    if (!linha) continue;
    const tel = normalizarTelefone(linha.match(/\+?[\d\s().-]{8,}/)?.[0] ?? "");
    const telefone = tel.length >= 8 ? tel : "";
    const nome = (telefone ? linha.replace(/\+?[\d\s().-]{8,}/, " ") : linha).replace(/[\s:;,–—-]+$/, "").replace(/^[\s:;,–—-]+/, "").replace(/\s{2,}/g, " ").trim();
    const chave = telefone || normalizarBusca(nome);
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push({ linha, nome: nome || linha, telefone });
  }
  return lista;
}

/** Sorteia um participante que ainda não saiu. */
export function sortear<T>(lista: T[], jaSorteados: Set<number>, aleatorio: () => number = Math.random): number | null {
  const livres = lista.map((_, i) => i).filter((i) => !jaSorteados.has(i));
  if (!livres.length) return null;
  return livres[Math.min(livres.length - 1, Math.floor(aleatorio() * livres.length))];
}

/** O que a busca do locutor devolve (sem telefone completo). */
export type OuvinteLocutor = {
  nome: string;
  bairro: string;
  cidade: string;
  telefone_final: string;
  bloqueado: boolean;
  motivo_bloqueio: string;
  ultima_vitoria: string | null;
  ultimo_premio: string | null;
  vitorias: number;
};

/** Pode ganhar hoje? (mesma regra dos 30 dias, a partir do que a busca do locutor devolve). */
export function situacaoLocutor(o: OuvinteLocutor, dia: string): SituacaoOuvinte {
  return situacaoOuvinte(o, o.ultima_vitoria ? [{ data: o.ultima_vitoria }] : [], dia);
}

export type LinhaGanhador = Ganhador & { ouvinte: Ouvinte | undefined; horario: string | null };

const celula = (v: string) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Planilha (CSV com ";", abre direto no Excel em português). */
export function csvGanhadores(linhas: LinhaGanhador[]): string {
  const cab = ["Data", "Horário", "Ouvinte", "Telefone", "Bairro", "Cidade", "Prêmio", "Locutor", "Observação"];
  const corpo = linhas.map((l) => [
    fmtData(l.data),
    l.horario ?? "",
    l.ouvinte?.nome ?? "",
    fmtTelefone(l.ouvinte?.telefone),
    l.ouvinte?.bairro ?? "",
    l.ouvinte?.cidade ?? "",
    l.premio_nome,
    l.locutor,
    l.obs,
  ]);
  return "﻿" + [cab, ...corpo].map((linha) => linha.map(celula).join(";")).join("\r\n");
}

/** Pop-up do prêmio: aparece 5 min antes e fica até 15 min depois (ou até fechar / ter ganhador). */
export const AVISO_PREMIO_ANTES_MIN = 5;
export const AVISO_PREMIO_DEPOIS_MIN = 15;

export type LembretePremio<T> = { rodada: T; faltam: number };

export function premiosParaLembrar<T extends Pick<Rodada, "id" | "horario" | "aviso">>(
  rodadas: T[],
  comGanhador: Set<string>,
  dispensadas: Set<string>,
  agora: string,
): LembretePremio<T>[] {
  const ag = minutos(agora);
  return rodadas
    .filter((r) => r.aviso && !comGanhador.has(r.id) && !dispensadas.has(r.id))
    .map((r) => ({ rodada: r, faltam: minutos(horaCurta(r.horario)!) - ag }))
    .filter((l) => l.faltam <= AVISO_PREMIO_ANTES_MIN && l.faltam >= -AVISO_PREMIO_DEPOIS_MIN)
    .sort((a, b) => a.faltam - b.faltam);
}

/** "Em 5 min", "É agora!", "Começou há 3 min". */
export function textoFaltamPremio(faltam: number): string {
  if (faltam > 0) return `Em ${faltam} min`;
  if (faltam === 0) return "É agora!";
  return `Começou há ${-faltam} min`;
}

/** Como estava cada prêmio do dia na última olhada da tela: o prêmio escolhido e quem ganhou. */
export type FotoPromo = Record<string, { premio: string | null; ganhadores: string[] }>;

export function fotoPromo(rodadas: Pick<Rodada, "id" | "premio_id">[], ganhadores: Pick<GanhadorPublico, "rodada_id" | "nome">[]): FotoPromo {
  const foto: FotoPromo = {};
  for (const r of rodadas) foto[r.id] = { premio: r.premio_id, ganhadores: [] };
  for (const g of ganhadores) foto[g.rodada_id]?.ganhadores.push(g.nome);
  return foto;
}

/** O que a promoção mudou desde a última olhada: ganhador incluído ou prêmio trocado. */
export type NovidadePromo = { rodada_id: string; tipo: "ganhador"; nomes: string[] } | { rodada_id: string; tipo: "premio" };

export function novidadesPromo(antes: FotoPromo, depois: FotoPromo): NovidadePromo[] {
  const lista: NovidadePromo[] = [];
  for (const [id, d] of Object.entries(depois)) {
    const a = antes[id];
    if (!a) continue; // horário novo na grade: não é aviso
    const novos = d.ganhadores.filter((n) => !a.ganhadores.includes(n));
    if (novos.length) lista.push({ rodada_id: id, tipo: "ganhador", nomes: novos });
    else if (a.premio !== d.premio && d.premio) lista.push({ rodada_id: id, tipo: "premio" });
  }
  return lista;
}
