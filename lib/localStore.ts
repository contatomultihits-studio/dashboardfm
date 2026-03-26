'use client';

import { Participacao, Premio, PrioridadeAr, Programa, ResumoParticipacao } from '@/types/database';

const keys = {
  programas: 'dashboardfm_programas',
  premios: 'dashboardfm_premios',
  participacoes: 'dashboardfm_participacoes',
  prioridades: 'dashboardfm_prioridades'
};

const defaultProgramas: Programa[] = [
  { id: 'local-1', nome: 'Programa Manhã Hits', cor_hex: '#35C4FF', ativo: true },
  { id: 'local-2', nome: 'Jornal da Tarde', cor_hex: '#8C5CFF', ativo: true }
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getProgramasLocal() {
  const value = read<Programa[]>(keys.programas, defaultProgramas);
  if (!value.length) write(keys.programas, defaultProgramas);
  return value.length ? value : defaultProgramas;
}

export function saveProgramaLocal(programa: Omit<Programa, 'id'>) {
  const current = getProgramasLocal();
  const next = [...current, { ...programa, id: `local-${crypto.randomUUID()}` }];
  write(keys.programas, next);
  return next;
}

export function removeProgramaLocal(id: string) {
  const current = getProgramasLocal().filter((p) => p.id !== id);
  write(keys.programas, current);
  return current;
}

export function getPremiosLocal() {
  return read<Premio[]>(keys.premios, []);
}

export function savePremioLocal(premio: Omit<Premio, 'id'>) {
  const current = getPremiosLocal();
  const next = [...current, { ...premio, id: `local-${crypto.randomUUID()}` }];
  write(keys.premios, next);
  return next;
}

export function saveParticipacaoLocal(item: Omit<Participacao, 'id' | 'created_at'>) {
  const current = read<Participacao[]>(keys.participacoes, []);
  current.push({ ...item, id: `local-${crypto.randomUUID()}`, created_at: new Date().toISOString() });
  write(keys.participacoes, current);
}

export function savePrioridadeLocal(item: Omit<PrioridadeAr, 'id'>) {
  const current = read<PrioridadeAr[]>(keys.prioridades, []);
  current.push({ ...item, id: `local-${crypto.randomUUID()}` });
  write(keys.prioridades, current);
}

export function getResumoLocal(): ResumoParticipacao[] {
  const programas = getProgramasLocal();
  const participacoes = read<Participacao[]>(keys.participacoes, []);

  const grouped = programas.map((programa) => {
    const registros = participacoes.filter((p) => p.programa_id === programa.id);
    const total = registros.reduce((acc, item) => acc + item.quantidade, 0);
    const dias = new Set(registros.map((r) => r.data_referencia)).size;
    return {
      programa: programa.nome,
      cor_hex: programa.cor_hex,
      total_participacoes: total,
      dias_com_registro: dias
    };
  });

  return grouped.sort((a, b) => b.total_participacoes - a.total_participacoes);
}
