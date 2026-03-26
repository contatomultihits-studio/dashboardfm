'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { KpiCard } from '@/components/KpiCard';
import { ParticipationChart } from '@/components/ParticipationChart';
import { ResumoParticipacao } from '@/types/database';

export default function GestorPage() {
  const [resumo, setResumo] = useState<ResumoParticipacao[]>([]);
  const [erro, setErro] = useState('');
  const { client: supabase, error: supabaseError } = getSupabaseBrowserClient();

  useEffect(() => {
    const load = async () => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('resumo_participacoes')
        .select('*')
        .order('total_participacoes', { ascending: false });
      if (error) return setErro(error.message);
      setResumo((data || []) as ResumoParticipacao[]);
    };
    load();
  }, [supabase]);

  const kpis = useMemo(() => {
    const totalParticipacoes = resumo.reduce((acc, item) => acc + Number(item.total_participacoes), 0);
    const totalDias = resumo.reduce((acc, item) => acc + Number(item.dias_com_registro), 0);
    const programaLider = resumo[0]?.programa ?? '—';
    const mediaDia = totalDias ? (totalParticipacoes / totalDias).toFixed(1) : '0.0';
    return { totalParticipacoes, totalDias, programaLider, mediaDia };
  }, [resumo]);

  return (
    <section className="grid" style={{ gap: '1rem' }}>
      <div className="card">
        <h1 style={{ marginTop: 0 }}>Dashboard de Gestores</h1>
        <small>Visão rápida de performance para decisão semanal e fechamento mensal.</small>
        {supabaseError && <p style={{ color: '#FF6B6B' }}>{supabaseError}</p>}
        {erro && <p style={{ color: '#FF6B6B' }}>{erro}</p>}
      </div>

      <div className="grid grid-3">
        <KpiCard title="Total de participações" value={kpis.totalParticipacoes} helper="acumulado na visão resumo_participacoes" />
        <KpiCard title="Dias com registro" value={kpis.totalDias} helper="somatório de dias monitorados" />
        <KpiCard title="Programa líder" value={kpis.programaLider} helper={`média diária geral ${kpis.mediaDia}`} />
      </div>

      <ParticipationChart data={resumo} />

      <div className="card">
        <h3>Ranking por programa</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Programa</th>
              <th>Total participações</th>
              <th>Dias com registro</th>
            </tr>
          </thead>
          <tbody>
            {resumo.map((row) => (
              <tr key={row.programa}>
                <td>
                  <span style={{ width: 12, height: 12, borderRadius: 999, background: row.cor_hex, display: 'inline-block' }} />{' '}
                  {row.programa}
                </td>
                <td>{row.total_participacoes}</td>
                <td>{row.dias_com_registro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
