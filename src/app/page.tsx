import { prisma } from "@/lib/db";
import { canAccessSensitive, currentRole, maskSensitive } from "@/lib/auth";
import { formatDateBR, monthlyTotals } from "@/lib/normalizers";

export const dynamic = "force-dynamic";

const modules = ["Programação", "Desafio RD", "Breaks", "Comenta Aí", "Concorrência SP", "Música premiada", "Xuguéder", "Pedidos musicais", "Importações", "Auditoria"];

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const from = params.from ?? "2026-07-01";
  const to = params.to ?? "2026-08-31";
  const [programParticipations, challenge, breaks, polls, competitors, songs, episodes, requests, listeners, audits] = await Promise.all([
    prisma.programParticipation.findMany({ where: { date: { gte: from, lte: to } }, include: { program: true }, orderBy: { date: "asc" } }),
    prisma.challengeParticipation.findMany({ where: { date: { gte: from, lte: to } }, include: { listener: true }, orderBy: [{ date: "desc" }, { time: "asc" }], take: 8 }),
    prisma.breakItem.findMany({ orderBy: { exitDate: "asc" } }),
    prisma.pollIdea.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: "asc" }, take: 6 }),
    prisma.competitorPromotion.findMany({ include: { radio: true }, take: 6, orderBy: { createdAt: "desc" } }),
    prisma.awardedSong.findMany({ where: { day: { gte: from, lte: to } }, take: 6, orderBy: { day: "desc" } }),
    prisma.xuguedEREpisode.findMany({ take: 6, orderBy: { airedDate: "desc" } }),
    prisma.musicRequest.findMany({ include: { program: true }, orderBy: { quantity: "desc" }, take: 6 }),
    prisma.listener.findMany({ take: 5, orderBy: { createdAt: "desc" } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5 })
  ]).catch(() => [[], [], [], [], [], [], [], [], [], []] as any);
  const totalPeriod = programParticipations.reduce((s, row) => s + row.quantity, 0);
  const totals = monthlyTotals(programParticipations);
  const byProgram = Object.values(programParticipations.reduce<Record<string, { name: string; total: number }>>((acc, row) => { acc[row.program.name] ??= { name: row.program.name, total: 0 }; acc[row.program.name].total += row.quantity; return acc; }, {})).sort((a,b)=>b.total-a.total);
  const activeBreaks = breaks.filter((b) => b.status === "NO_AR").length;
  const winnerCount = challenge.filter((c) => c.winner).length;
  const sensitive = canAccessSensitive(currentRole());
  return <div className="shell"><aside className="side"><div className="brand">Rádio Disney</div><p>Controle e Métricas da Produção</p><div className="pill">Perfil: {currentRole()}</div><nav className="nav">{modules.map((m)=><a key={m} href={`#${m}`}>{m}</a>)}</nav></aside><main className="main"><section className="hero"><h1>Ambiente analítico unificado</h1><p>Protótipo com dados fictícios para substituir as 7 planilhas históricas, mantendo rastreabilidade, auditoria, filtros por período e proteção para dados sensíveis.</p><form className="form"><input name="from" type="date" defaultValue={from}/><input name="to" type="date" defaultValue={to}/><button className="btn">Filtrar período</button></form></section><section className="grid"><Card title="Participações no período" value={totalPeriod}/><Card title="Programas monitorados" value={byProgram.length}/><Card title="Breaks no ar" value={activeBreaks}/><Card title="Vencedores no filtro" value={winnerCount}/></section><section className="modules"><div className="card" id="Programação"><h3>Programação</h3><p className="muted">Totais calculados a partir do banco, por mês e programa.</p><table className="table"><tbody>{Object.entries(totals).map(([m,t])=><tr key={m}><td>{m}</td><td>{t}</td></tr>)}</tbody></table></div><div className="card"><h3>Ranking dos programas</h3><table className="table"><tbody>{byProgram.map(p=><tr key={p.name}><td>{p.name}</td><td>{p.total}</td></tr>)}</tbody></table></div><div className="card alert" id="Central operacional"><h3>Alertas</h3><p>{activeBreaks} peças em veiculação e {breaks.length-activeBreaks} encerradas.</p><p>{challenge.some(c=>c.listener.phoneNormalized)?"Duplicidade por telefone pronta para revisão manual.":"Sem telefones para revisar."}</p></div><DataCard id="Desafio RD" title="Desafio RD" rows={challenge.map(c=>[formatDateBR(c.date), c.time, c.listener.name, sensitive ? c.listener.phoneOriginal ?? "—" : maskSensitive(c.listener.phoneOriginal), `${c.score} pts`])}/><DataCard id="Breaks" title="Breaks" rows={breaks.map(b=>[b.name,b.status,formatDateBR(b.entryDate),formatDateBR(b.exitDate)])}/><DataCard id="Comenta Aí" title="Comenta Aí" rows={polls.map(p=>[formatDateBR(p.date),p.onAirPoll ?? "—",p.suggestion ?? "—",String(p.participations ?? "")])}/><DataCard id="Concorrência SP" title="Concorrência SP" rows={competitors.map(p=>[p.radio.name,p.title,p.channel ?? "—",p.status ?? "—"])}/><DataCard id="Música premiada" title="Música premiada" rows={songs.map(s=>[formatDateBR(s.day),String(s.position ?? "—"),s.songOriginal ?? "—"])}/><DataCard id="Xuguéder" title="Xuguéder" rows={episodes.map(e=>[String(e.episodeNumber),e.character,e.theme,formatDateBR(e.airedDate)])}/><DataCard id="Pedidos musicais" title="Pedidos musicais" rows={requests.map(r=>[r.artistNormalized,r.songNormalized,r.program?.name ?? "—",String(r.quantity)])}/><DataCard id="Administração" title="Administração e auditoria" rows={audits.map(a=>[a.entity,a.action,a.sensitive ? "sensível" : "normal",new Date(a.createdAt).toLocaleString("pt-BR")])}/><div className="card" id="Importações"><h3>Importador CSV futuro</h3><p>Modelo genérico com ImportBatch/ImportError, templates por módulo e preservação de rawData para correções reversíveis.</p><a className="btn" href="/templates/program_participation.csv">Baixar template Programação</a></div></section></main></div>;
}
function Card({ title, value }: { title: string; value: number }) { return <div className="card"><h3>{title}</h3><div className="metric">{value.toLocaleString("pt-BR")}</div></div>; }
function DataCard({ id, title, rows }: { id: string; title: string; rows: (string | number)[][] }) { return <div className="card" id={id}><h3>{title}</h3><table className="table"><tbody>{rows.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{c}</td>)}</tr>)}</tbody></table></div>; }
