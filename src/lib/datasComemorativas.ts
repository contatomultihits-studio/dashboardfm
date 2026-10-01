// Datas comemorativas: lista fixa (dia/mês) + datas móveis calculadas para cada ano.
// Não depende de serviço externo: funciona sozinho todo ano.

import { paraISO, somarDias } from "@/lib/datas";

export type DataComemorativa = {
  /** Identificador estável (ex.: "10-12-criancas"). */
  id: string;
  /** Data no ano pedido, AAAA-MM-DD. */
  data: string;
  titulo: string;
  texto: string;
  feriado: boolean;
};

type Fixa = { dia: number; mes: number; titulo: string; texto: string; feriado?: boolean };

// Feriados nacionais marcados com `feriado: true`.
const FIXAS: Fixa[] = [
  { dia: 1, mes: 1, titulo: "Ano Novo", texto: "Confraternização Universal. Desejar um feliz ano novo aos ouvintes!", feriado: true },
  { dia: 6, mes: 1, titulo: "Dia de Reis", texto: "Dia de Reis: tradicionalmente, o dia de desmontar a árvore de Natal." },
  { dia: 25, mes: 1, titulo: "Aniversário de São Paulo", texto: "Aniversário da cidade de São Paulo." },
  { dia: 30, mes: 1, titulo: "Dia da Saudade", texto: "Dia da Saudade: chamar os ouvintes para mandar recado para quem está longe." },
  { dia: 2, mes: 2, titulo: "Dia de Iemanjá", texto: "Dia de Iemanjá, celebrado principalmente na Bahia." },
  { dia: 13, mes: 2, titulo: "Dia Mundial do Rádio", texto: "Dia Mundial do Rádio (UNESCO). Agradecer a quem acompanha a Rádio Disney!" },
  { dia: 8, mes: 3, titulo: "Dia Internacional da Mulher", texto: "Dia Internacional da Mulher. Homenagear as mulheres que ouvem a rádio." },
  { dia: 14, mes: 3, titulo: "Dia Nacional da Poesia", texto: "Dia Nacional da Poesia." },
  { dia: 15, mes: 3, titulo: "Dia do Consumidor", texto: "Dia Mundial dos Direitos do Consumidor." },
  { dia: 20, mes: 3, titulo: "Dia Internacional da Felicidade", texto: "Dia Internacional da Felicidade: o que deixa você feliz?" },
  { dia: 21, mes: 3, titulo: "Dia Internacional da Síndrome de Down", texto: "Dia Internacional da Síndrome de Down. Também é o Dia Internacional contra a Discriminação Racial." },
  { dia: 22, mes: 3, titulo: "Dia Mundial da Água", texto: "Dia Mundial da Água: lembrar de economizar água." },
  { dia: 27, mes: 3, titulo: "Dia do Circo", texto: "Dia do Circo." },
  { dia: 1, mes: 4, titulo: "Dia da Mentira", texto: "1º de abril, Dia da Mentira!" },
  { dia: 2, mes: 4, titulo: "Dia Mundial de Conscientização do Autismo", texto: "Dia Mundial de Conscientização do Autismo." },
  { dia: 7, mes: 4, titulo: "Dia Mundial da Saúde", texto: "Dia Mundial da Saúde. Também é o Dia do Jornalista." },
  { dia: 13, mes: 4, titulo: "Dia do Beijo", texto: "Dia do Beijo." },
  { dia: 18, mes: 4, titulo: "Dia Nacional do Livro Infantil", texto: "Dia Nacional do Livro Infantil, no aniversário de Monteiro Lobato. Qual livro marcou sua infância?" },
  { dia: 19, mes: 4, titulo: "Dia dos Povos Indígenas", texto: "Dia dos Povos Indígenas." },
  { dia: 21, mes: 4, titulo: "Tiradentes", texto: "Feriado de Tiradentes.", feriado: true },
  { dia: 22, mes: 4, titulo: "Dia da Terra", texto: "Dia da Terra e Dia do Descobrimento do Brasil." },
  { dia: 23, mes: 4, titulo: "Dia Mundial do Livro", texto: "Dia Mundial do Livro." },
  { dia: 29, mes: 4, titulo: "Dia Internacional da Dança", texto: "Dia Internacional da Dança: hora de colocar todo mundo para dançar!" },
  { dia: 1, mes: 5, titulo: "Dia do Trabalhador", texto: "Dia do Trabalhador.", feriado: true },
  { dia: 13, mes: 5, titulo: "Abolição da Escravatura", texto: "Aniversário da assinatura da Lei Áurea (1888)." },
  { dia: 25, mes: 5, titulo: "Dia do Orgulho Nerd", texto: "Dia do Orgulho Nerd (e Dia da Toalha!)." },
  { dia: 5, mes: 6, titulo: "Dia Mundial do Meio Ambiente", texto: "Dia Mundial do Meio Ambiente." },
  { dia: 12, mes: 6, titulo: "Dia dos Namorados", texto: "Dia dos Namorados! Abrir para os recados e as músicas dos casais." },
  { dia: 13, mes: 6, titulo: "Dia de Santo Antônio", texto: "Dia de Santo Antônio, o santo casamenteiro. Época de festa junina!" },
  { dia: 21, mes: 6, titulo: "Dia Mundial da Música", texto: "Dia Mundial da Música (Fête de la Musique)." },
  { dia: 24, mes: 6, titulo: "Dia de São João", texto: "Dia de São João: arraiá, quadrilha e festa junina!" },
  { dia: 28, mes: 6, titulo: "Dia do Orgulho LGBTQIA+", texto: "Dia Internacional do Orgulho LGBTQIA+." },
  { dia: 29, mes: 6, titulo: "Dia de São Pedro", texto: "Dia de São Pedro, encerrando as festas juninas." },
  { dia: 7, mes: 7, titulo: "Dia Mundial do Chocolate", texto: "Dia Mundial do Chocolate: qual é o seu favorito?" },
  { dia: 13, mes: 7, titulo: "Dia Mundial do Rock", texto: "Dia Mundial do Rock! Bom dia para tocar os rocks favoritos dos ouvintes." },
  { dia: 17, mes: 7, titulo: "Dia Mundial do Emoji", texto: "Dia Mundial do Emoji: qual emoji você mais usa?" },
  { dia: 20, mes: 7, titulo: "Dia do Amigo", texto: "Dia do Amigo: mande um alô para o seu melhor amigo!" },
  { dia: 26, mes: 7, titulo: "Dia dos Avós", texto: "Dia dos Avós: homenagem aos vovôs e vovós." },
  { dia: 30, mes: 7, titulo: "Dia Internacional da Amizade", texto: "Dia Internacional da Amizade." },
  { dia: 11, mes: 8, titulo: "Dia do Estudante", texto: "Dia do Estudante." },
  { dia: 22, mes: 8, titulo: "Dia do Folclore", texto: "Dia do Folclore: Saci, Curupira, Iara, Boitatá..." },
  { dia: 7, mes: 9, titulo: "Independência do Brasil", texto: "Dia da Independência do Brasil.", feriado: true },
  { dia: 15, mes: 9, titulo: "Dia do Cliente", texto: "Dia do Cliente." },
  { dia: 21, mes: 9, titulo: "Dia da Árvore", texto: "Dia da Árvore." },
  { dia: 25, mes: 9, titulo: "Dia Nacional do Rádio", texto: "Dia Nacional do Rádio, no aniversário de Roquette-Pinto. Agradecer aos ouvintes!" },
  { dia: 1, mes: 10, titulo: "Dia Internacional da Música", texto: "Dia Internacional da Música. Também é o Dia Internacional da Pessoa Idosa." },
  { dia: 4, mes: 10, titulo: "Dia dos Animais", texto: "Dia Mundial dos Animais: como é o nome do seu pet?" },
  { dia: 12, mes: 10, titulo: "Dia das Crianças", texto: "Dia das Crianças e de Nossa Senhora Aparecida! Muitos alôs para a criançada.", feriado: true },
  { dia: 15, mes: 10, titulo: "Dia do Professor", texto: "Dia do Professor: mande um recado para aquele professor especial." },
  { dia: 16, mes: 10, titulo: "Dia Mundial da Alimentação", texto: "Dia Mundial da Alimentação." },
  { dia: 28, mes: 10, titulo: "Dia Internacional da Animação", texto: "Dia Internacional da Animação: qual é o seu desenho favorito?" },
  { dia: 29, mes: 10, titulo: "Dia Nacional do Livro", texto: "Dia Nacional do Livro." },
  { dia: 31, mes: 10, titulo: "Halloween e Dia do Saci", texto: "Halloween, o Dia das Bruxas. No Brasil, também é o Dia do Saci." },
  { dia: 2, mes: 11, titulo: "Finados", texto: "Dia de Finados.", feriado: true },
  { dia: 7, mes: 11, titulo: "Dia do Radialista", texto: "Dia do Radialista: homenagem a quem faz a rádio acontecer." },
  { dia: 15, mes: 11, titulo: "Proclamação da República", texto: "Proclamação da República.", feriado: true },
  { dia: 18, mes: 11, titulo: "Aniversário do Mickey", texto: "Aniversário do Mickey Mouse, que estreou em 18 de novembro de 1928 em \"Steamboat Willie\"." },
  { dia: 19, mes: 11, titulo: "Dia da Bandeira", texto: "Dia da Bandeira." },
  { dia: 20, mes: 11, titulo: "Dia da Consciência Negra", texto: "Dia Nacional de Zumbi e da Consciência Negra.", feriado: true },
  { dia: 22, mes: 11, titulo: "Dia do Músico", texto: "Dia do Músico (Dia de Santa Cecília)." },
  { dia: 1, mes: 12, titulo: "Dia Mundial de Luta contra a Aids", texto: "Dia Mundial de Luta contra a Aids." },
  { dia: 3, mes: 12, titulo: "Dia da Pessoa com Deficiência", texto: "Dia Internacional da Pessoa com Deficiência." },
  { dia: 24, mes: 12, titulo: "Véspera de Natal", texto: "Véspera de Natal!" },
  { dia: 25, mes: 12, titulo: "Natal", texto: "Feliz Natal para todos os ouvintes!", feriado: true },
  { dia: 31, mes: 12, titulo: "Véspera de Ano Novo", texto: "Último dia do ano! Contagem regressiva para o Réveillon." },
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher, calendário gregoriano). */
export function pascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return paraISO(new Date(ano, mes - 1, dia));
}

/** N-ésimo dia da semana do mês (diaSemana: 0 = domingo). */
export function nesimoDiaDaSemana(ano: number, mes: number, diaSemana: number, n: number): string {
  const primeiro = new Date(ano, mes - 1, 1);
  const desloc = (diaSemana - primeiro.getDay() + 7) % 7;
  return paraISO(new Date(ano, mes - 1, 1 + desloc + 7 * (n - 1)));
}

function moveis(ano: number): Omit<DataComemorativa, "id">[] {
  const p = pascoa(ano);
  const acaoDeGracas = nesimoDiaDaSemana(ano, 11, 4, 4); // 4ª quinta-feira de novembro
  return [
    { data: somarDias(p, -47), titulo: "Carnaval", texto: "Terça-feira de Carnaval! Ponto facultativo na maior parte do país.", feriado: false },
    { data: somarDias(p, -46), titulo: "Quarta-feira de Cinzas", texto: "Quarta-feira de Cinzas: fim do Carnaval.", feriado: false },
    { data: somarDias(p, -2), titulo: "Sexta-feira Santa", texto: "Sexta-feira Santa.", feriado: true },
    { data: p, titulo: "Páscoa", texto: "Feliz Páscoa! Hora dos ovos de chocolate.", feriado: false },
    { data: somarDias(p, 60), titulo: "Corpus Christi", texto: "Corpus Christi. Ponto facultativo nacional.", feriado: false },
    { data: nesimoDiaDaSemana(ano, 5, 0, 2), titulo: "Dia das Mães", texto: "Dia das Mães! Abrir para os recados para as mamães.", feriado: false },
    { data: nesimoDiaDaSemana(ano, 8, 0, 2), titulo: "Dia dos Pais", texto: "Dia dos Pais! Abrir para os recados para os papais.", feriado: false },
    { data: nesimoDiaDaSemana(ano, 10, 5, 1), titulo: "Dia Mundial do Sorriso", texto: "Dia Mundial do Sorriso (primeira sexta-feira de outubro)." },
    { data: somarDias(acaoDeGracas, 1), titulo: "Black Friday", texto: "Black Friday.", feriado: false },
  ].map((x) => ({ feriado: false, ...x }));
}

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Todas as datas comemorativas de um ano, em ordem. */
export function datasDoAno(ano: number): DataComemorativa[] {
  const fixas = FIXAS.map((f) => ({
    data: paraISO(new Date(ano, f.mes - 1, f.dia)),
    titulo: f.titulo,
    texto: f.texto,
    feriado: Boolean(f.feriado),
  }));
  return [...fixas, ...moveis(ano)]
    .map((d) => ({ ...d, id: `${d.data}-${slug(d.titulo)}` }))
    .sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo));
}

/** Datas de `dia` até `dia + dias - 1` (atravessa a virada do ano). */
export function datasEntre(dia: string, dias: number): DataComemorativa[] {
  const fim = somarDias(dia, dias - 1);
  const anos = new Set([Number(dia.slice(0, 4)), Number(fim.slice(0, 4))]);
  return [...anos].flatMap(datasDoAno).filter((d) => d.data >= dia && d.data <= fim);
}
