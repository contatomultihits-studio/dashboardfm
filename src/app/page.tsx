import { prisma } from "@/lib/db";
import { canAccessSensitive, currentRole, maskSensitive } from "@/lib/auth";
import { formatDateBR, monthlyTotals } from "@/lib/normalizers";

export const dynamic = "force-dynamic";

const modules = [
  "Programação",
  "Desafio RD",
  "Breaks",
  "Comenta Aí",
  "Concorrência SP",
  "Música premiada",
  "Xuguéder",
  "Pedidos musicais",
  "Importações",
  "Auditoria",
];

type ProgramParticipationRow = { date: string; quantity: number; program: { name: string } };
type ChallengeRow = { date: string; time: string; score: number; winner: boolean; listener: { name: string; phoneOriginal: string | null; phoneNormalized: string | null } };
type BreakRow = { name: string; status: string; entryDate: string | null; exitDate: string | null };
type PollRow = { date: string | null; onAirPoll: string | null; suggestion: string | null; participations: number | null };
type CompetitorRow = { radio: { name: string }; title: string; channel: string | null; status: string | null };
type AwardedSongRow = { day: string; position: number | null; songOriginal: string | null };
type EpisodeRow = { episodeNumber: number; character: string; theme: string; airedDate: string };
type MusicRequestRow = { artistNormalized: string; songNormalized: string; quantity: number; program: { name: string } | null };
type AuditRow = { entity: string; action: string; sensitive: boolean; createdAt: Date };

type DashboardData = {
  programParticipations: ProgramParticipationRow[];
  challenge: ChallengeRow[];
  breaks: BreakRow[];
  polls: PollRow[];
  competitors: CompetitorRow[];
  songs: AwardedSongRow[];
  episodes: EpisodeRow[];
  requests: MusicRequestRow[];
  audits: AuditRow[];
};

function emptyDashboardData(): DashboardData {
  return {
    programParticipations: [],
    challenge: [],
    breaks: [],
    polls: [],
    competitors: [],
    songs: [],
    episodes: [],
    requests: [],
    audits: [],
  };
}

async function loadDashboardData(from: string, to: string): Promise<DashboardData> {
  try {
    const [programParticipations, challenge, breaks, polls, competitors, songs, episodes, requests, audits] = await Promise.all([
      prisma.programParticipation.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true, quantity: true, program: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
      prisma.challengeParticipation.findMany({
        where: { date: { gte: from, lte: to } },
        select: {
          date: true,
          time: true,
          score: true,
          winner: true,
          listener: { select: { name: true, phoneOriginal: true, phoneNormalized: true } },
        },
        orderBy: [{ date: "desc" }, { time: "asc" }],
        take: 8,
      }),
      prisma.breakItem.findMany({
        select: { name: true, status: true, entryDate: true, exitDate: true },
        orderBy: { exitDate: "asc" },
      }),
      prisma.pollIdea.findMany({
        where: { date: { gte: from, lte: to } },
        select: { date: true, onAirPoll: true, suggestion: true, participations: true },
        orderBy: { date: "asc" },
        take: 6,
      }),
      prisma.competitorPromotion.findMany({
        select: { radio: { select: { name: true } }, title: true, channel: true, status: true },
        take: 6,
        orderBy: { createdAt: "desc" },
      }),
      prisma.awardedSong.findMany({
        where: { day: { gte: from, lte: to } },
        select: { day: true, position: true, songOriginal: true },
        take: 6,
        orderBy: { day: "desc" },
      }),
      prisma.xuguedEREpisode.findMany({
        select: { episodeNumber: true, character: true, theme: true, airedDate: true },
        take: 6,
        orderBy: { airedDate: "desc" },
      }),
      prisma.musicRequest.findMany({
        select: { artistNormalized: true, songNormalized: true, quantity: true, program: { select: { name: true } } },
        orderBy: { quantity: "desc" },
        take: 6,
      }),
      prisma.auditLog.findMany({
        select: { entity: true, action: true, sensitive: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return { programParticipations, challenge, breaks, polls, competitors, songs, episodes, requests, audits };
  } catch {
    return emptyDashboardData();
  }
}

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const from = params.from ?? "2026-07-01";
  const to = params.to ?? "2026-08-31";
  const data = await loadDashboardData(from, to);
  const { programParticipations, challenge, breaks, polls, competitors, songs, episodes, requests, audits } = data;
  const totalPeriod = programParticipations.reduce((sum, row) => sum + row.quantity, 0);
  const totals = monthlyTotals(programParticipations);
  const byProgram = Object.values(
    programParticipations.reduce<Record<string, { name: string; total: number }>>((acc, row) => {
      acc[row.program.name] ??= { name: row.program.name, total: 0 };
      acc[row.program.name].total += row.quantity;
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);
  const activeBreaks = breaks.filter((row) => row.status === "NO_AR").length;
  const winnerCount = challenge.filter((row) => row.winner).length;
  const sensitive = canAccessSensitive(currentRole());

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Rádio Disney</div>
        <p>Controle e Métricas da Produção</p>
        <div className="pill">Perfil: {currentRole()}</div>
        <nav className="nav">
          {modules.map((moduleName) => (
            <a key={moduleName} href={`#${moduleName}`}>{moduleName}</a>
          ))}
        </nav>
      </aside>
      <main className="main">
        <section className="hero">
          <h1>Ambiente analítico unificado</h1>
          <p>Protótipo com dados fictícios para substituir as 7 planilhas históricas, mantendo rastreabilidade, auditoria, filtros por período e proteção para dados sensíveis.</p>
          <form className="form">
            <input name="from" type="date" defaultValue={from} />
            <input name="to" type="date" defaultValue={to} />
            <button className="btn">Filtrar período</button>
          </form>
        </section>
        <section className="grid">
          <Card title="Participações no período" value={totalPeriod} />
          <Card title="Programas monitorados" value={byProgram.length} />
          <Card title="Breaks no ar" value={activeBreaks} />
          <Card title="Vencedores no filtro" value={winnerCount} />
        </section>
        <section className="modules">
          <div className="card" id="Programação">
            <h3>Programação</h3>
            <p className="muted">Totais calculados a partir do banco, por mês e programa.</p>
            <table className="table"><tbody>{Object.entries(totals).map(([month, total]) => <tr key={month}><td>{month}</td><td>{total}</td></tr>)}</tbody></table>
          </div>
          <div className="card">
            <h3>Ranking dos programas</h3>
            <table className="table"><tbody>{byProgram.map((program) => <tr key={program.name}><td>{program.name}</td><td>{program.total}</td></tr>)}</tbody></table>
          </div>
          <div className="card alert" id="Central operacional">
            <h3>Alertas</h3>
            <p>{activeBreaks} peças em veiculação e {breaks.length - activeBreaks} encerradas.</p>
            <p>{challenge.some((row) => row.listener.phoneNormalized) ? "Duplicidade por telefone pronta para revisão manual." : "Sem telefones para revisar."}</p>
          </div>
          <DataCard id="Desafio RD" title="Desafio RD" rows={challenge.map((row) => [formatDateBR(row.date), row.time, row.listener.name, sensitive ? row.listener.phoneOriginal ?? "—" : maskSensitive(row.listener.phoneOriginal), `${row.score} pts`])} />
          <DataCard id="Breaks" title="Breaks" rows={breaks.map((row) => [row.name, row.status, formatDateBR(row.entryDate), formatDateBR(row.exitDate)])} />
          <DataCard id="Comenta Aí" title="Comenta Aí" rows={polls.map((row) => [formatDateBR(row.date), row.onAirPoll ?? "—", row.suggestion ?? "—", String(row.participations ?? "")])} />
          <DataCard id="Concorrência SP" title="Concorrência SP" rows={competitors.map((row) => [row.radio.name, row.title, row.channel ?? "—", row.status ?? "—"])} />
          <DataCard id="Música premiada" title="Música premiada" rows={songs.map((row) => [formatDateBR(row.day), String(row.position ?? "—"), row.songOriginal ?? "—"])} />
          <DataCard id="Xuguéder" title="Xuguéder" rows={episodes.map((row) => [String(row.episodeNumber), row.character, row.theme, formatDateBR(row.airedDate)])} />
          <DataCard id="Pedidos musicais" title="Pedidos musicais" rows={requests.map((row) => [row.artistNormalized, row.songNormalized, row.program?.name ?? "—", String(row.quantity)])} />
          <DataCard id="Administração" title="Administração e auditoria" rows={audits.map((row) => [row.entity, row.action, row.sensitive ? "sensível" : "normal", new Date(row.createdAt).toLocaleString("pt-BR")])} />
          <div className="card" id="Importações">
            <h3>Importador CSV futuro</h3>
            <p>Modelo genérico com ImportBatch/ImportError, templates por módulo e preservação de rawData para correções reversíveis.</p>
            <a className="btn" href="/templates/program_participation.csv">Baixar template Programação</a>
          </div>
        </section>
      </main>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return <div className="card"><h3>{title}</h3><div className="metric">{value.toLocaleString("pt-BR")}</div></div>;
}

function DataCard({ id, title, rows }: { id: string; title: string; rows: (string | number)[][] }) {
  return <div className="card" id={id}><h3>{title}</h3><table className="table"><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
