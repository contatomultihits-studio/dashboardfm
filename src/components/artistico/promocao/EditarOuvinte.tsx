"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Modal } from "@/components/Modal";
import { fmtTelefone, normalizarTelefone, type Ouvinte } from "@/lib/promocao";
import type { Avisar } from "../comum";

/** Dados do ouvinte (corrigir nome, telefone, bairro, cidade, bloqueio). Sem `ouvinte`, cadastra um novo. */
export function EditarOuvinte({ sb, avisar, ouvinte, onSalvo, onFechar }: {
  sb: SupabaseClient;
  avisar: Avisar;
  ouvinte: Ouvinte | null;
  onSalvo: () => void;
  onFechar: () => void;
}) {
  const [form, setForm] = useState({
    nome: ouvinte?.nome ?? "",
    telefone: fmtTelefone(ouvinte?.telefone),
    bairro: ouvinte?.bairro ?? "",
    cidade: ouvinte?.cidade ?? "",
    bloqueado: ouvinte?.bloqueado ?? false,
    motivo_bloqueio: ouvinte?.motivo_bloqueio ?? "",
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return avisar("O nome é obrigatório.", true);
    setSalvando(true);
    const dados = {
      nome: form.nome.trim(),
      telefone: normalizarTelefone(form.telefone),
      bairro: form.bairro.trim(),
      cidade: form.cidade.trim(),
      bloqueado: form.bloqueado,
      motivo_bloqueio: form.bloqueado ? form.motivo_bloqueio.trim() : "",
    };
    const { error } = ouvinte ? await sb.from("ouvintes").update(dados).eq("id", ouvinte.id) : await sb.from("ouvintes").insert(dados);
    setSalvando(false);
    if (error) return avisar(error.message, true);
    avisar(ouvinte ? "Ouvinte atualizado" : form.bloqueado ? "Ouvinte cadastrado como bloqueado" : "Ouvinte cadastrado");
    onSalvo();
  }

  return (
    <Modal titulo={ouvinte ? `Editar ouvinte · ${ouvinte.nome}` : "Cadastrar ouvinte"} onFechar={onFechar}>
      <form className="form" onSubmit={salvar}>
        <div className="form-grade">
          <label className="campo">
            Nome
            <input type="text" required maxLength={80} autoFocus value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </label>
          <label className="campo">
            Telefone (opcional)
            <input type="tel" maxLength={20} placeholder="(11) 99999-8888" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </label>
          <label className="campo">
            Bairro (opcional)
            <input type="text" maxLength={60} value={form.bairro} onChange={(e) => setForm({ ...form, bairro: e.target.value })} />
          </label>
          <label className="campo">
            Cidade (opcional)
            <input type="text" maxLength={60} value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={form.bloqueado} onChange={(e) => setForm({ ...form, bloqueado: e.target.checked })} />
          🚫 Bloqueado (não pode ganhar prêmios)
        </label>
        {form.bloqueado && (
          <label className="campo">
            Motivo do bloqueio
            <input type="text" maxLength={200} placeholder="Ex.: usou dados de outra pessoa" value={form.motivo_bloqueio} onChange={(e) => setForm({ ...form, motivo_bloqueio: e.target.value })} />
          </label>
        )}
        <div className="acoes">
          <button type="submit" className="verde" disabled={salvando}>{salvando ? "Salvando…" : ouvinte ? "Salvar alterações" : "Cadastrar ouvinte"}</button>
          <button type="button" className="branco" onClick={onFechar}>Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}
