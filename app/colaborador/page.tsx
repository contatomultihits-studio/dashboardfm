'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Programa } from '@/types/database';

type Msg = { type: 'ok' | 'err'; text: string } | null;

export default function ColaboradorPage() {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [formParticipacao, setFormParticipacao] = useState({
    programa_id: '',
    data_referencia: '',
    quantidade: 0,
    tipo_registro: 'telefonema'
  });
  const [formPrioridade, setFormPrioridade] = useState({
    programa_id: '',
    data: '',
    conteudo: ''
  });

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('programas').select('*').eq('ativo', true).order('nome');
      if (!error) setProgramas(data as Programa[]);
    };
    load();
  }, []);

  async function salvarParticipacao(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('participacoes').insert(formParticipacao);
    if (error) return setMsg({ type: 'err', text: error.message });
    setMsg({ type: 'ok', text: 'Participação registrada com sucesso.' });
  }

  async function salvarPrioridade(e: FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from('prioridades_ar').insert({ ...formPrioridade, concluido: false });
    if (error) return setMsg({ type: 'err', text: error.message });
    setMsg({ type: 'ok', text: 'Prioridade inserida com sucesso.' });
  }

  return (
    <section className="grid">
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Área do Colaborador</h1>
        <small>Use esta tela para abastecer participações e conteúdo prioritário no ar.</small>
        {msg && (
          <p style={{ color: msg.type === 'ok' ? '#3AD5A0' : '#FF6B6B', marginBottom: 0 }}>{msg.text}</p>
        )}
      </div>

      <div className="grid grid-3" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={salvarParticipacao}>
          <h3>Registrar participação</h3>
          <label>Programa</label>
          <select
            value={formParticipacao.programa_id}
            onChange={(e) => setFormParticipacao((f) => ({ ...f, programa_id: e.target.value }))}
            required
          >
            <option value="">Selecione...</option>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <label>Data de referência</label>
          <input
            className="input"
            type="date"
            value={formParticipacao.data_referencia}
            onChange={(e) => setFormParticipacao((f) => ({ ...f, data_referencia: e.target.value }))}
            required
          />
          <label>Quantidade</label>
          <input
            className="input"
            type="number"
            min={0}
            value={formParticipacao.quantidade}
            onChange={(e) => setFormParticipacao((f) => ({ ...f, quantidade: Number(e.target.value) }))}
            required
          />
          <label>Tipo de registro</label>
          <input
            className="input"
            value={formParticipacao.tipo_registro}
            onChange={(e) => setFormParticipacao((f) => ({ ...f, tipo_registro: e.target.value }))}
            required
          />
          <button type="submit">Salvar participação</button>
        </form>

        <form className="card" onSubmit={salvarPrioridade}>
          <h3>Prioridade no ar</h3>
          <label>Programa</label>
          <select
            value={formPrioridade.programa_id}
            onChange={(e) => setFormPrioridade((f) => ({ ...f, programa_id: e.target.value }))}
            required
          >
            <option value="">Selecione...</option>
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
          <label>Data</label>
          <input
            className="input"
            type="date"
            value={formPrioridade.data}
            onChange={(e) => setFormPrioridade((f) => ({ ...f, data: e.target.value }))}
            required
          />
          <label>Conteúdo</label>
          <textarea
            rows={4}
            value={formPrioridade.conteudo}
            onChange={(e) => setFormPrioridade((f) => ({ ...f, conteudo: e.target.value }))}
            required
          />
          <button type="submit">Salvar prioridade</button>
        </form>
      </div>
    </section>
  );
}
