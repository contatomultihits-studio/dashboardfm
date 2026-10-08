// Quem entrou, o que pode ver e editar, e as regras de senha.

export const AREAS = [
  { id: "prioridades", rotulo: "Prioridades do ar" },
  { id: "recados", rotulo: "Recados" },
  { id: "partiu", rotulo: "Partiu Rádio Disney" },
  { id: "jornalismo", rotulo: "Jornalismo" },
  { id: "promocao", rotulo: "Promoção" },
  { id: "conexoes", rotulo: "Conexões" },
  { id: "convidados", rotulo: "Convidados" },
  { id: "eventos", rotulo: "Eventos" },
  { id: "relatorios", rotulo: "Relatórios" },
  { id: "locutores", rotulo: "Locutores e escala" },
] as const;
export type Area = (typeof AREAS)[number]["id"];
export type Nivel = "ver" | "editar";
export type Tipo = "admin" | "equipe" | "locutor";
export type Permissoes = Partial<Record<Area, Nivel>>;

export type Acesso = {
  nome: string;
  email: string;
  tipo: Tipo;
  ativo: boolean;
  senha_alterada: boolean;
  permissoes: Permissoes;
};

export const TIPOS: Record<Tipo, string> = {
  admin: "Administrador",
  equipe: "Equipe",
  locutor: "Locutor (só a dashboard)",
};

/** Modelos prontos para a página de usuários. */
export const MODELOS: { id: string; rotulo: string; tipo: Tipo; permissoes: Permissoes }[] = [
  { id: "locutor", rotulo: "Locutor", tipo: "locutor", permissoes: {} },
  { id: "jornalismo", rotulo: "Jornalismo", tipo: "equipe", permissoes: { jornalismo: "editar", conexoes: "editar" } },
  { id: "promocao", rotulo: "Promoção", tipo: "equipe", permissoes: { promocao: "editar", relatorios: "ver" } },
  { id: "gestor", rotulo: "Gestor (só ver)", tipo: "equipe", permissoes: Object.fromEntries(AREAS.map((a) => [a.id, "ver"])) },
  { id: "tudo", rotulo: "Produção (tudo)", tipo: "equipe", permissoes: Object.fromEntries(AREAS.map((a) => [a.id, "editar"])) },
];

/** Pode ver (nivel "ver") ou editar a área. Admin pode tudo; locutor, nada no artístico. */
export function pode(a: Acesso | null, area: Area, nivel: Nivel = "ver"): boolean {
  if (!a || !a.ativo) return false;
  if (a.tipo === "admin") return true;
  if (a.tipo !== "equipe") return false;
  const n = a.permissoes[area];
  return nivel === "ver" ? Boolean(n) : n === "editar";
}

/** Entra no artístico quem é admin ou equipe com pelo menos uma área. */
export function entraNoArtistico(a: Acesso | null): boolean {
  return AREAS.some((x) => pode(a, x.id));
}

/** Para onde vai depois de entrar, quando não há destino pedido. */
export const inicioDe = (a: Acesso | null) => (entraNoArtistico(a) ? "/artistico" : "/");

/** Só aceita caminhos do próprio site (nada de //outro-site ou https://). */
export function destinoSeguro(r: string | null | undefined, padrao = "/"): string {
  if (!r || !r.startsWith("/") || r.startsWith("//") || r.startsWith("/\\")) return padrao;
  if (r.startsWith("/login") || r.startsWith("/trocar-senha")) return padrao;
  return r;
}

/** Erro da nova senha, ou null se está boa. */
export function problemaSenha(senha: string, confirmar: string): string | null {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) return "Use letras e números na senha.";
  if (/^(.)\1+$/.test(senha) || /^(12345678|abcd1234|senha123|password1|radio1234|disney123)/i.test(senha)) return "Essa senha é fácil demais. Escolha outra.";
  if (senha !== confirmar) return "As duas senhas não são iguais.";
  return null;
}

/** Mensagem pronta para o administrador mandar à pessoa. */
export function mensagemAcesso(nome: string, email: string, senha: string, site: string): string {
  return [
    `Olá, ${nome.split(" ")[0]}! Seu acesso à Central do Locutor está pronto.`,
    "",
    `Site: ${site}/login`,
    `E-mail: ${email}`,
    `Senha inicial: ${senha}`,
    "",
    "No primeiro acesso o site vai pedir para você criar a sua própria senha (mínimo 8 caracteres, com letras e números).",
  ].join("\n");
}
