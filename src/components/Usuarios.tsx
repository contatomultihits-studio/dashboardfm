"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAcesso } from "@/components/ComAcesso";
import { Modal } from "@/components/Modal";
import { Topbar } from "@/components/Topbar";
import { AREAS, MODELOS, TIPOS, mensagemAcesso, type Area, type Nivel, type Permissoes, type Tipo } from "@/lib/acesso";
import { getSupabase } from "@/lib/supabase/client";

type Perfil = { user_id: string; nome: string; email: string; tipo: Tipo; ativo: boolean; senha_alterada: boolean; criado_em: string };
type Linha = Perfil & { permissoes: Permissoes };
type Form = { nome: string; email: string; tipo: Tipo; permissoes: Permissoes; ativo: boolean };

const VAZIO: Form = { nome: "", email: "", tipo: "equipe", permissoes: {}, ativo: true };

/** Chama a função do servidor (a única que cria e apaga logins). */
async function chamar<T>(sb: SupabaseClient, corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.functions.invoke("admin-usuarios", { body: corpo });
  if (error) {
    let msg = error.message;
    const ctx = (error as { context?: Response }).context;
    try {
      if (ctx && typeof ctx.json === "function") msg = (await ctx.json()).erro ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return data as T;
}

function resumoAreas(l: Linha): string {
  if (l.tipo === "admin") return "Tudo, e cuida dos usuários";
  if (l.tipo === "locutor") return "Só a dashboard";
  const partes = AREAS.filter((a) => l.permissoes[a.id]).map((a) => `${a.rotulo}${l.permissoes[a.id] === "ver" ? " (ver)" : ""}`);
  return partes.length ? partes.join(" · ") : "Nenhuma área (só a dashboard)";
}

/** Tabela área × sem acesso / ver / editar. */
function Matriz({ permissoes, onChange }: { permissoes: Permissoes; onChange: (p: Permissoes) => void }) {
  const mudar = (area: Area, n: Nivel | "") => {
    const p = { ...permissoes };
    if (n) p[area] = n;
    else delete p[area];
    onChange(p);
  };
  return (
    <table className="usuarios-matriz">
      <thead><tr><th>Área</th><th>Acesso</th></tr></thead>
      <tbody>
        {AREAS.map((a) => (
          <tr key={a.id}>
            <td><strong>{a.rotulo}</strong></td>
            <td className="niveis" role="radiogroup" aria-label={a.rotulo}>
              {([["", "Sem acesso"], ["ver", "Só ver"], ["editar", "Editar"]] as const).map(([n, r]) => (
                <label key={n}>
                  <input type="radio" name={`area-${a.id}`} checked={(permissoes[a.id] ?? "") === n} onChange={() => mudar(a.id, n)} />
                  {r}
                </label>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CamposAcesso({ form, setForm, travado }: { form: Form; setForm: (f: Form) => void; travado?: boolean }) {
  return (
    <>
      <div className="campo" role="group" aria-label="Modelo pronto">
        <span className="campo-rotulo">Modelo pronto</span>
        <div className="modelos">
          {MODELOS.map((m) => (
            <button key={m.id} type="button" className="pequeno branco" disabled={travado} onClick={() => setForm({ ...form, tipo: m.tipo, permissoes: { ...m.permissoes } })}>
              {m.rotulo}
            </button>
          ))}
        </div>
      </div>
      <label className="campo">
        Tipo
        <select value={form.tipo} disabled={travado} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })}>
          {(Object.keys(TIPOS) as Tipo[]).map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
        </select>
      </label>
      {form.tipo === "equipe" ? (
        <Matriz permissoes={form.permissoes} onChange={(p) => setForm({ ...form, permissoes: p })} />
      ) : (
        <p className="dica">{form.tipo === "admin" ? "O administrador vê e edita tudo e cuida dos usuários." : "O locutor só vê a dashboard (pode marcar pauta feita)."}</p>
      )}
    </>
  );
}

export function Usuarios() {
  const sb = getSupabase()!;
  const eu = useAcesso();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState<Form>(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<{ id: string; form: Form } | null>(null);
  const [senhaNova, setSenhaNova] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; erro: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const avisar = useCallback((msg: string, erro = false) => {
    setToast({ msg, erro });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), erro ? 6000 : 2500);
  }, []);

  const carregar = useCallback(async () => {
    const [p, x, u] = await Promise.all([
      sb.from("perfis").select("*").order("nome"),
      sb.from("permissoes").select("*"),
      sb.auth.getUser(),
    ]);
    if (p.error || x.error) {
      avisar((p.error ?? x.error)!.message, true);
      setCarregando(false);
      return;
    }
    const porUser = new Map<string, Permissoes>();
    for (const r of x.data as { user_id: string; area: Area; nivel: Nivel }[]) {
      porUser.set(r.user_id, { ...porUser.get(r.user_id), [r.area]: r.nivel });
    }
    setLinhas((p.data as Perfil[]).map((r) => ({ ...r, permissoes: porUser.get(r.user_id) ?? {} })));
    setMeuId(u.data.user?.id ?? null);
    setCarregando(false);
  }, [sb, avisar]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (form.tipo === "equipe" && !Object.keys(form.permissoes).length && !confirm("Nenhuma área marcada: a pessoa só vai ver a dashboard. Criar assim mesmo?")) return;
    setSalvando(true);
    try {
      const r = await chamar<{ senha: string }>(sb, { acao: "criar", nome: form.nome, email: form.email, tipo: form.tipo, permissoes: form.permissoes });
      setSenhaNova({ nome: form.nome.trim(), email: form.email.trim().toLowerCase(), senha: r.senha });
      setForm(VAZIO);
      carregar();
    } catch (err) {
      avisar((err as Error).message, true);
    }
    setSalvando(false);
  }

  async function salvarEdicao() {
    if (!editando) return;
    const f = editando.form;
    const { error } = await sb.rpc("admin_salvar_acesso", { p_user: editando.id, p_nome: f.nome, p_tipo: f.tipo, p_ativo: f.ativo, p_permissoes: f.permissoes });
    if (error) return avisar(error.message, true);
    setEditando(null);
    avisar("Acesso salvo");
    carregar();
  }

  async function alternarAtivo(l: Linha) {
    if (l.ativo && !confirm(`Bloquear o acesso de ${l.nome}? A pessoa deixa de ver qualquer coisa até você liberar de novo.`)) return;
    const { error } = await sb.rpc("admin_salvar_acesso", { p_user: l.user_id, p_nome: l.nome, p_tipo: l.tipo, p_ativo: !l.ativo, p_permissoes: l.permissoes });
    if (error) return avisar(error.message, true);
    avisar(l.ativo ? "Acesso bloqueado" : "Acesso liberado");
    carregar();
  }

  async function novaSenha(l: Linha) {
    if (!confirm(`Gerar uma nova senha para ${l.nome}? A senha atual deixa de valer e a pessoa troca de novo no próximo acesso.`)) return;
    try {
      const r = await chamar<{ senha: string }>(sb, { acao: "nova_senha", user_id: l.user_id });
      setSenhaNova({ nome: l.nome, email: l.email, senha: r.senha });
      carregar();
    } catch (err) {
      avisar((err as Error).message, true);
    }
  }

  async function excluir(l: Linha) {
    if (!confirm(`Excluir ${l.nome} (${l.email})? O login some de vez. Para só pausar, use Bloquear.`)) return;
    try {
      await chamar(sb, { acao: "excluir", user_id: l.user_id });
      avisar("Usuário excluído");
      carregar();
    } catch (err) {
      avisar((err as Error).message, true);
    }
  }

  const mensagem = senhaNova ? mensagemAcesso(senhaNova.nome, senhaNova.email, senhaNova.senha, window.location.origin) : "";

  return (
    <>
      <Topbar atual="usuarios" />
      <main className="container">
        <form className="card form" onSubmit={criar}>
          <h2>Novo usuário</h2>
          <label className="campo">
            Nome
            <input type="text" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="campo">
            E-mail
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <CamposAcesso form={form} setForm={setForm} />
          <p className="dica">A senha inicial é criada na hora, aparece só para você e a pessoa troca no primeiro acesso.</p>
          <div className="acoes">
            <button type="submit" className="verde" disabled={salvando}>{salvando ? "Criando…" : "Criar usuário"}</button>
          </div>
        </form>

        <section className="card">
          <div className="secao-topo"><h2>Usuários</h2></div>
          {carregando ? (
            <div className="vazio">Carregando…</div>
          ) : (
            <div className="tabela-wrap">
              <table>
                <thead><tr><th>Pessoa</th><th>Tipo e áreas</th><th>Situação</th><th>Ações</th></tr></thead>
                <tbody>
                  {linhas.map((l) => {
                    const souEu = l.user_id === meuId;
                    return (
                      <tr key={l.user_id}>
                        <td className="texto"><strong>{l.nome}</strong><div className="trecho">{l.email}</div></td>
                        <td className="texto">
                          <strong>{TIPOS[l.tipo]}</strong>
                          <div className="usuario-areas">{resumoAreas(l)}</div>
                        </td>
                        <td>
                          <span className={`etiqueta ${l.ativo ? "situacao-no-ar" : "relatorio-falta"}`}>{l.ativo ? "Ativo" : "Bloqueado"}</span>
                          {!l.senha_alterada && <div className="trecho">Ainda não trocou a senha</div>}
                        </td>
                        <td>
                          <div className="tabela-acoes">
                            <button type="button" className="pequeno" aria-label={`Editar ${l.nome}`} onClick={() => setEditando({ id: l.user_id, form: { nome: l.nome, email: l.email, tipo: l.tipo, permissoes: { ...l.permissoes }, ativo: l.ativo } })}>Editar</button>
                            {!souEu && (
                              <>
                                <button type="button" className={`pequeno ${l.ativo ? "branco" : "verde"}`} onClick={() => alternarAtivo(l)}>{l.ativo ? "Bloquear" : "Liberar"}</button>
                                <button type="button" className="pequeno branco" onClick={() => novaSenha(l)}>Nova senha</button>
                                <button type="button" className="pequeno vermelho" onClick={() => excluir(l)}>Excluir</button>
                              </>
                            )}
                            {souEu && <a className="botao pequeno branco" href="/trocar-senha?redirect=/usuarios">Trocar minha senha</a>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="dica" style={{ marginTop: 12 }}>Entrou como {eu?.email}. Só o administrador vê esta página.</p>
        </section>
      </main>

      {editando && (
        <Modal titulo={`Acesso de ${editando.form.nome}`} onFechar={() => setEditando(null)}>
          <div className="form">
            <label className="campo">
              Nome
              <input type="text" value={editando.form.nome} onChange={(e) => setEditando({ ...editando, form: { ...editando.form, nome: e.target.value } })} />
            </label>
            <p className="dica">E-mail: {editando.form.email}</p>
            <CamposAcesso form={editando.form} setForm={(f) => setEditando({ ...editando, form: f })} travado={editando.id === meuId} />
            <div className="acoes">
              <button type="button" className="verde" onClick={salvarEdicao}>Salvar acesso</button>
              <button type="button" className="branco" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </div>
        </Modal>
      )}

      {senhaNova && (
        <Modal titulo={`Acesso de ${senhaNova.nome}`} onFechar={() => setSenhaNova(null)}>
          <p><strong>Anote ou copie agora:</strong> esta senha não aparece de novo.</p>
          <pre className="senha-gerada" aria-label="Mensagem para enviar">{mensagem}</pre>
          <div className="acoes">
            <button type="button" className="verde" onClick={() => navigator.clipboard.writeText(mensagem).then(() => avisar("Mensagem copiada"), () => avisar("Não deu para copiar; selecione o texto", true))}>Copiar mensagem</button>
            <button type="button" className="branco" onClick={() => setSenhaNova(null)}>Fechar</button>
          </div>
        </Modal>
      )}

      {toast && <div className={`toast ${toast.erro ? "erro" : ""}`} role="status">{toast.msg}</div>}
    </>
  );
}
