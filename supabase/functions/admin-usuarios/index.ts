// Edge Function admin-usuarios: só o administrador cria, renova a senha e exclui usuários.
// A chave secreta (service role) existe só aqui, no servidor do Supabase; o site nunca a vê.
//
// Ações (POST com o login do administrador):
//   { acao: "criar", nome, email, tipo, permissoes }  -> { user_id, senha }
//   { acao: "nova_senha", user_id }                    -> { senha }
//   { acao: "excluir", user_id }                       -> { ok: true }
import { createClient } from "jsr:@supabase/supabase-js@2";

const AREAS = ["prioridades", "recados", "partiu", "jornalismo", "promocao", "conexoes", "convidados", "eventos", "locutores", "relatorios"];
const TIPOS = ["admin", "equipe", "locutor"];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

/** Senha inicial aleatória: 12 caracteres, com letras maiúsculas, minúsculas e números (sem 0/O, 1/l/I). */
function gerarSenha(): string {
  const mai = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const min = "abcdefghijkmnopqrstuvwxyz";
  const num = "23456789";
  const todos = mai + min + num;
  const r = new Uint32Array(16);
  crypto.getRandomValues(r);
  const c = [mai[r[0] % mai.length], min[r[1] % min.length], num[r[2] % num.length]];
  for (let i = 3; i < 12; i++) c.push(todos[r[i] % todos.length]);
  for (let i = c.length - 1; i > 0; i--) {
    const j = r[(i + 3) % 16] % (i + 1);
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c.join("");
}

function permissoesValidas(p: unknown): { area: string; nivel: string }[] {
  if (!p || typeof p !== "object") return [];
  return Object.entries(p as Record<string, unknown>)
    .filter(([area, nivel]) => AREAS.includes(area) && (nivel === "ver" || nivel === "editar"))
    .map(([area, nivel]) => ({ area, nivel: nivel as string }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return resposta({ erro: "Método não permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1) Quem está pedindo? Precisa ser o administrador ativo.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return resposta({ erro: "Faça login." }, 401);
  const { data: quem, error: erroQuem } = await admin.auth.getUser(token);
  if (erroQuem || !quem.user) return resposta({ erro: "Faça login." }, 401);
  const { data: perfil } = await admin.from("perfis").select("tipo, ativo").eq("user_id", quem.user.id).maybeSingle();
  if (!perfil || !perfil.ativo || perfil.tipo !== "admin") return resposta({ erro: "Só o administrador pode fazer isso." }, 403);

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return resposta({ erro: "Pedido inválido." }, 400);
  }

  // 2) Criar usuário
  if (corpo.acao === "criar") {
    const nome = String(corpo.nome ?? "").trim();
    const email = String(corpo.email ?? "").trim().toLowerCase();
    const tipo = String(corpo.tipo ?? "");
    if (!nome) return resposta({ erro: "Informe o nome." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return resposta({ erro: "E-mail inválido." }, 400);
    if (!TIPOS.includes(tipo)) return resposta({ erro: "Tipo inválido." }, 400);

    const senha = gerarSenha();
    const { data: criado, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error || !criado.user) {
      const msg = error?.message ?? "";
      return resposta({ erro: /already|registered|exists/i.test(msg) ? "Já existe um usuário com esse e-mail." : msg || "Não deu para criar o usuário." }, 400);
    }
    const id = criado.user.id;
    const { error: e1 } = await admin.from("perfis").insert({ user_id: id, nome, email, tipo, criado_por: quem.user.id });
    const perms = tipo === "equipe" ? permissoesValidas(corpo.permissoes) : [];
    const { error: e2 } = !e1 && perms.length
      ? await admin.from("permissoes").insert(perms.map((p) => ({ user_id: id, ...p })))
      : { error: null };
    if (e1 || e2) {
      // Sem perfil completo, o login não pode ficar sobrando.
      await admin.auth.admin.deleteUser(id);
      return resposta({ erro: `Não deu para salvar o perfil: ${(e1 ?? e2)!.message}` }, 500);
    }
    return resposta({ user_id: id, senha });
  }

  const alvo = String(corpo.user_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(alvo)) return resposta({ erro: "Usuário inválido." }, 400);
  if (alvo === quem.user.id) return resposta({ erro: "Isso não vale para o seu próprio usuário." }, 400);
  const { data: existe } = await admin.from("perfis").select("user_id").eq("user_id", alvo).maybeSingle();
  if (!existe) return resposta({ erro: "Usuário não encontrado." }, 404);

  // 3) Nova senha: a pessoa troca de novo no próximo acesso.
  if (corpo.acao === "nova_senha") {
    const senha = gerarSenha();
    const { error } = await admin.auth.admin.updateUserById(alvo, { password: senha });
    if (error) return resposta({ erro: error.message }, 500);
    await admin.from("perfis").update({ senha_alterada: false }).eq("user_id", alvo);
    return resposta({ senha });
  }

  // 4) Excluir (perfil e áreas saem junto)
  if (corpo.acao === "excluir") {
    const { error } = await admin.auth.admin.deleteUser(alvo);
    if (error) return resposta({ erro: error.message }, 500);
    return resposta({ ok: true });
  }

  return resposta({ erro: "Ação desconhecida." }, 400);
});
