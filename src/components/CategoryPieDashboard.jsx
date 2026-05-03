import { useEffect, useMemo, useState } from "react";
import { getCategorySummary } from "../api.js";
import { currency } from "../utils/format.js";

const palette = ["#138a4a", "#2d5f73", "#d59c2c", "#7b61a8", "#c43b3b", "#3b7f8f", "#8f6b2f", "#5c7a45"];
const currentMonth = new Date().toISOString().slice(0, 7);

function buildGradient(items) {
  if (!items.length) return "#edf2ef";

  let cursor = 0;
  const total = items.reduce((sum, item) => sum + item.total, 0);
  const slices = items.map((item, index) => {
    const start = cursor;
    const size = (item.total / total) * 100;
    cursor += size;
    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });

  return `conic-gradient(${slices.join(", ")})`;
}

function PieCard({ title, tone, data }) {
  const gradient = useMemo(() => buildGradient(data.categories), [data.categories]);

  return (
    <article className={`pie-card ${tone}`}>
      <div className="pie-visual" style={{ background: gradient }} aria-hidden="true">
        <span>{data.categories.length}</span>
      </div>

      <div className="pie-details">
        <div>
          <span>{title}</span>
          <strong>{currency(data.total)}</strong>
        </div>

        {data.categories.length === 0 ? (
          <p className="pie-empty">Sem lançamentos no mês.</p>
        ) : (
          <div className="pie-list">
            {data.categories.map((item, index) => {
              const percentage = data.total ? (item.total / data.total) * 100 : 0;
              return (
                <div className="pie-row" key={item.category}>
                  <i style={{ background: palette[index % palette.length] }} />
                  <span>{item.category}</span>
                  <strong>{currency(item.total)}</strong>
                  <small>{percentage.toFixed(1)}%</small>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

export default function CategoryPieDashboard() {
  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);

    getCategorySummary(month)
      .then((data) => {
        if (!active) return;
        setSummary(data);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [month]);

  return (
    <section className="pie-dashboard">
      <div className="pie-header">
        <div>
          <span>Mensal por categoria</span>
          <strong>Receita / Despesa</strong>
        </div>
        <label>
          <span>Mês/Ano</span>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonth)} />
        </label>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading || !summary ? (
        <div className="empty-state">Carregando dashboard mensal...</div>
      ) : (
        <div className="pie-grid">
          <PieCard data={summary.income} title="Receitas" tone="income" />
          <PieCard data={summary.expense} title="Despesas" tone="expense" />
        </div>
      )}
    </section>
  );
}
