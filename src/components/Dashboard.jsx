import { currency, periodLabels } from "../utils/format.js";

export default function Dashboard({ entries, totals, period }) {
  return (
    <section className="dashboard" aria-label="Resumo financeiro">
      <div className="dashboard-title">
        <div>
          <span>Resumo</span>
          <strong>{periodLabels[period]}</strong>
        </div>
      </div>

      <div className="metric-grid">
        <article className="metric income">
          <span>Receitas</span>
          <strong>{currency(totals.income)}</strong>
        </article>
        <article className="metric expense">
          <span>Despesas</span>
          <strong>{currency(totals.expense)}</strong>
        </article>
        <article className={`metric balance ${totals.balance < 0 ? "negative" : ""}`}>
          <span>Saldo</span>
          <strong>{currency(totals.balance)}</strong>
        </article>
      </div>
    </section>
  );
}
