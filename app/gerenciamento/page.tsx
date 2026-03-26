'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { Premio, Programa } from '@/types/database';

export default function GerenciamentoPage() {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [premios, setPremios] = useState<Premio[]>([]);
  const [feedback, setFeedback] = useState('');
  const { client: supabase, error: supabaseError } = getSupabaseBrowserClient();

  const [novoPrograma, setNovoPrograma] = useState({ nome: '', cor_hex: '#35C4FF', ativo: true });
  const [novoPremio, setNovoPremio] = useState({
    nome: '',
    descricao: '',
    estoque_inicial: 0,
    programa_id: ''
  });

  async function recarregar() {
    if (!supabase) return;
    const [resProgramas, resPremios] = await Promise.all([
      supabase.from('programas').select('*').order('nome'),
      supabase.from('premios').select('*').order('nome')
    ]);
    if (resProgramas.error) setFeedback(resProgramas.error.message);
    if (resPremios.error) setFeedback(resPremios.error.message);
    if (!resProgramas.error) setProgramas(resProgramas.data as Programa[]);
    if (!resPremios.error) setPremios(resPremios.data as Premio[]);
  }

  useEffect(() => {
    recarregar();
  }, [supabase]);

  async function criarPrograma(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.from('programas').insert(novoPrograma);
    if (error) return setFeedback(error.message);
    setNovoPrograma({ nome: '', cor_hex: '#35C4FF', ativo: true });
    setFeedback('Programa criado com sucesso.');
    await recarregar();
  }

  async function criarPremio(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const { error } = await supabase.from('premios').insert(novoPremio);
    if (error) return setFeedback(error.message);
    setNovoPremio({ nome: '', descricao: '', estoque_inicial: 0, programa_id: '' });
    setFeedback('Prêmio criado com sucesso.');
    await recarregar();
  }

  async function removerPrograma(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from('programas').delete().eq('id', id);
    if (error) return setFeedback(error.message);
    setFeedback('Programa removido.');
    await recarregar();
  }

  return (
    <section className="grid" style={{ gap: '1rem' }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Gerenciamento</h1>
        <small>Administre programas e prêmios para manter o cadastro operacional da rádio.</small>
        {supabaseError && <p style={{ color: '#FF6B6B' }}>{supabaseError}</p>}
        {feedback && <p>{feedback}</p>}
      </div>

      <div className="grid grid-3" style={{ alignItems: 'start' }}>
        <form className="card" onSubmit={criarPrograma}>
          <h3>Novo programa</h3>
          <input
            className="input"
            placeholder="Nome"
            value={novoPrograma.nome}
            onChange={(e) => setNovoPrograma((f) => ({ ...f, nome: e.target.value }))}
            required
          />
          <input
            className="input"
            type="color"
            value={novoPrograma.cor_hex}
            onChange={(e) => setNovoPrograma((f) => ({ ...f, cor_hex: e.target.value }))}
            required
          />
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={novoPrograma.ativo}
              onChange={(e) => setNovoPrograma((f) => ({ ...f, ativo: e.target.checked }))}
            />
            Ativo
          </label>
          <button type="submit" disabled={!supabase}>Adicionar programa</button>
        </form>

        <form className="card" onSubmit={criarPremio}>
          <h3>Novo prêmio</h3>
          <select
            value={novoPremio.programa_id}
            onChange={(e) => setNovoPremio((f) => ({ ...f, programa_id: e.target.value }))}
            required
            disabled={!supabase}
          >
            <option value="">Programa relacionado...</option>
            {programas.map((programa) => (
              <option key={programa.id} value={programa.id}>
                {programa.nome}
              </option>
            ))}
          </select>
          <input
            className="input"
            placeholder="Nome do prêmio"
            value={novoPremio.nome}
            onChange={(e) => setNovoPremio((f) => ({ ...f, nome: e.target.value }))}
            required
          />
          <textarea
            rows={3}
            placeholder="Descrição"
            value={novoPremio.descricao}
            onChange={(e) => setNovoPremio((f) => ({ ...f, descricao: e.target.value }))}
            required
          />
          <input
            className="input"
            type="number"
            min={0}
            value={novoPremio.estoque_inicial}
            onChange={(e) => setNovoPremio((f) => ({ ...f, estoque_inicial: Number(e.target.value) }))}
            required
          />
          <button type="submit" disabled={!supabase}>Adicionar prêmio</button>
        </form>
      </div>

      <div className="card">
        <h3>Programas cadastrados</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Cor</th>
              <th>Status</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {programas.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>
                  <span style={{ width: 12, height: 12, borderRadius: 999, background: p.cor_hex, display: 'inline-block' }} />{' '}
                  {p.cor_hex}
                </td>
                <td>{p.ativo ? 'Ativo' : 'Inativo'}</td>
                <td>
                  <button onClick={() => removerPrograma(p.id)} disabled={!supabase}>Excluir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Prêmios cadastrados</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Estoque inicial</th>
            </tr>
          </thead>
          <tbody>
            {premios.map((p) => (
              <tr key={p.id}>
                <td>{p.nome}</td>
                <td>{p.descricao}</td>
                <td>{p.estoque_inicial}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
