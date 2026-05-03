import { currency, shortDay } from "../utils/format.js";

export default function MiniChart({ entries }) {
  const grouped = entries.reduce((acc, entry) => {
    acc[entry.date] ||= { date: entry.date, income: 0, expense: 0 };
    acc[entry.date][entry.type] += entry.value;
    return acc;
  }, {});

  const rows = Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  const max = Math.max(...rows.flatMap((row) => [row.income, row.expense]), 1);

  return (
    <div className="chart" aria-label="Receitas versus despesas">
      {rows.length === 0 ? (
        <span className="chart-empty">Sem dados para o grafico.</span>
      ) : (
        rows.map((row) => (
          <div className="chart-row" key={row.date}>
            <span>{shortDay(row.date)}</span>
            <div className="bars">
              <i className="bar income" style={{ width: `${Math.max((row.income / max) * 100, row.income ? 6 : 0)}%` }} title={currency(row.income)} />
              <i className="bar expense" style={{ width: `${Math.max((row.expense / max) * 100, row.expense ? 6 : 0)}%` }} title={currency(row.expense)} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
