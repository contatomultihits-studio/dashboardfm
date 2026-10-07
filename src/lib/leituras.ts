// "Já lido vai para o fim": cada tela guarda (no navegador) quando o locutor abriu cada card,
// para distribuir as falas. Fixados ficam sempre na frente, fora do rodízio.

/** id do card → quando foi aberto (ISO). Só vale no dia: muda o dia, zera. */
export type Leituras = Record<string, string>;

const CHAVE = "dashboardfm:lidos";

export function lerLeituras(hoje: string): Leituras {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as { dia: string; lidos: Leituras } | null;
    return bruto && bruto.dia === hoje ? bruto.lidos : {};
  } catch {
    return {};
  }
}

export function salvarLeituras(hoje: string, lidos: Leituras) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ dia: hoje, lidos }));
  } catch {
    // navegação privada ou sem espaço: segue sem guardar
  }
}

/**
 * Ordem do carrossel: fixados (na ordem que vieram), depois os não lidos (na ordem que vieram),
 * depois os lidos — o lido há mais tempo primeiro, assim o rodízio continua sozinho.
 */
export function ordenarPorLeitura<T extends { id: string; fixado?: boolean }>(itens: T[], lidos: Leituras): T[] {
  const fixados = itens.filter((i) => i.fixado);
  const resto = itens.filter((i) => !i.fixado);
  const naoLidos = resto.filter((i) => !lidos[i.id]);
  const lidosOrdem = resto.filter((i) => lidos[i.id]).sort((a, b) => lidos[a.id].localeCompare(lidos[b.id]));
  return [...fixados, ...naoLidos, ...lidosOrdem];
}
