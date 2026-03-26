export function KpiCard({ title, value, helper }: { title: string; value: string | number; helper: string }) {
  return (
    <div className="card">
      <small>{title}</small>
      <h2 style={{ margin: '0.4rem 0', fontSize: '2rem' }}>{value}</h2>
      <small>{helper}</small>
    </div>
  );
}
