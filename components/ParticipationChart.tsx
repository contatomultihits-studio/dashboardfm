'use client';

import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ResumoParticipacao } from '@/types/database';

export function ParticipationChart({ data }: { data: ResumoParticipacao[] }) {
  return (
    <div className="card" style={{ height: 340 }}>
      <h3 style={{ marginTop: 0 }}>Participações por programa</h3>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={data}>
          <CartesianGrid stroke="#273148" strokeDasharray="3 3" />
          <XAxis dataKey="programa" stroke="#A8B3C7" />
          <YAxis stroke="#A8B3C7" />
          <Tooltip
            contentStyle={{ background: '#151A24', border: '1px solid #273148', borderRadius: 8 }}
            labelStyle={{ color: '#EFF4FF' }}
          />
          <Bar dataKey="total_participacoes" fill="#35C4FF" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
