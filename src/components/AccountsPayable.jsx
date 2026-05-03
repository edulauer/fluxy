import { AlertCircle } from "lucide-react";
import { currency, shortDate } from "../utils/format.js";

export default function AccountsPayable({ entries, loading }) {
  return (
    <section className="payable-section">
      <div className="section-heading">
        <h2>Contas a pagar</h2>
      </div>

      {loading ? (
        <div className="empty-state">Carregando contas a pagar...</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">Nenhuma conta pendente vencida ou para hoje.</div>
      ) : (
        <div className="payable-list">
          {entries.map((entry) => (
            <article className="payable-row" key={entry.id}>
              <div className="payable-icon" aria-hidden="true">
                <AlertCircle size={18} strokeWidth={2.2} />
              </div>
              <div className="payable-main">
                <strong>{entry.description}</strong>
                <span>
                  {entry.category} · {entry.store || "Geral"} · Venc. {shortDate(entry.dueDate)}
                </span>
                {(entry.supplier || entry.employeeName) && <small>{entry.supplier || entry.employeeName}</small>}
              </div>
              <strong className="payable-value">{currency(entry.value)}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
