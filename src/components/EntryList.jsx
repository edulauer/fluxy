import { Pencil, Trash2 } from "lucide-react";
import { currency, shortDate } from "../utils/format.js";

export default function EntryList({ entries, loading, onDelete, onEdit }) {
  if (loading) return <div className="empty-state">Carregando lancamentos...</div>;
  if (entries.length === 0) return <div className="empty-state">Nenhum lancamento no periodo.</div>;

  return (
    <div className="entry-list">
      {entries.map((entry) => (
        <article className={`entry-card ${entry.type}`} key={entry.id}>
          <div className="entry-main">
            <span className="entry-date">{shortDate(entry.date)}</span>
            <strong>{entry.description}</strong>
            <small>{entry.category} · {entry.store || "Geral"}</small>
            <div className="entry-meta">
              {entry.type === "expense" && entry.dueDate && <span>Venc. {shortDate(entry.dueDate)}</span>}
              {entry.type === "expense" && entry.paymentDate && <span>Pago {shortDate(entry.paymentDate)}</span>}
              {entry.type === "expense" && entry.employeeName && <span>{entry.employeeName}</span>}
              {entry.type === "expense" && entry.supplier && <span>{entry.supplier}</span>}
            </div>
          </div>
          <div className="entry-side">
            <strong>{currency(entry.value)}</strong>
            <div className="entry-actions">
              <button type="button" onClick={() => onEdit(entry)} aria-label={`Editar ${entry.description}`} title="Editar">
                <Pencil aria-hidden="true" size={17} strokeWidth={2.2} />
              </button>
              <button type="button" onClick={() => onDelete(entry.id)} aria-label={`Excluir ${entry.description}`} title="Excluir">
                <Trash2 aria-hidden="true" size={17} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
