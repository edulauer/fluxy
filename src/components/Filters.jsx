const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC"
});

function addMonths(month, amount) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + amount, 1));
  return date.toISOString().slice(0, 7);
}

function formatMonth(month) {
  return monthFormatter.format(new Date(`${month}-01T12:00:00Z`));
}

export default function Filters({ filters, onChange }) {
  function update(field, value) {
    onChange({ ...filters, [field]: value });
  }

  return (
    <div className="filters">
      <div className="month-pager" aria-label="Paginação mensal">
        <button type="button" onClick={() => update("month", addMonths(filters.month, -1))} aria-label="Mes anterior">
          &lt;
        </button>
        <strong>{formatMonth(filters.month)}</strong>
        <button type="button" onClick={() => update("month", addMonths(filters.month, 1))} aria-label="Proximo mes">
          &gt;
        </button>
      </div>

      <select aria-label="Tipo" onChange={(event) => update("type", event.target.value)} value={filters.type}>
        <option value="all">Todos</option>
        <option value="income">Receitas</option>
        <option value="expense">Despesas</option>
      </select>
    </div>
  );
}
