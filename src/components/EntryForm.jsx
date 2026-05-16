import { useEffect, useMemo, useState } from "react";

const today = new Date().toISOString().slice(0, 10);
const emptyForm = {
  type: "income",
  value: "",
  date: today,
  dueDate: "",
  paymentDate: "",
  description: "",
  category: "Vendas",
  store: "Geral",
  employeeName: "",
  supplier: "",
  recurrence: 1,
  intervalDays: ""
};

const stores = ["Geral", "Loja 1", "Loja 2"];

export default function EntryForm({ categories, suppliers, entry, onCancel, onSave }) {
  const [form, setForm] = useState(emptyForm);
  const availableCategories = useMemo(() => categories[form.type] || [], [categories, form.type]);

  useEffect(() => {
    if (entry) {
      setForm({
        type: entry.type,
        value: entry.value,
        date: entry.date,
        dueDate: entry.dueDate || "",
        paymentDate: entry.paymentDate || "",
        description: entry.description,
        category: entry.category,
        store: entry.store || "Geral",
        employeeName: entry.employeeName || "",
        supplier: entry.supplier || "",
        recurrence: 1,
        intervalDays: ""
      });
    }
  }, [entry]);

  useEffect(() => {
    if (!availableCategories.length || availableCategories.includes(form.category)) return;
    setForm((current) => ({ ...current, category: availableCategories[0] }));
  }, [availableCategories, form.category]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateType(type) {
    setForm((current) => ({
      ...current,
      type,
      category: categories[type]?.[0] || current.category,
      dueDate: type === "expense" ? current.dueDate : "",
      paymentDate: type === "expense" ? current.paymentDate : "",
      employeeName: type === "expense" ? current.employeeName : "",
      supplier: type === "expense" ? current.supplier : "",
      recurrence: type === "expense" ? current.recurrence : 1,
      intervalDays: type === "expense" ? current.intervalDays : ""
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await onSave({ ...form, value: Number(form.value) });
    setForm(emptyForm);
  }

  return (
    <section className="entry-panel">
      <div className="section-heading">
        <h2>{entry ? "Editar lancamento" : "Novo lancamento"}</h2>
        {entry && (
          <button className="text-button" type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>

      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="segmented" role="group" aria-label="Tipo do lancamento">
          <button className={form.type === "income" ? "active income" : ""} type="button" onClick={() => updateType("income")}>
            Receita
          </button>
          <button className={form.type === "expense" ? "active expense" : ""} type="button" onClick={() => updateType("expense")}>
            Despesa
          </button>
        </div>

        <div className="form-grid">
          <label>
            <span>Data de lançamento</span>
            <input name="date" onChange={(event) => updateField("date", event.target.value)} required type="date" value={form.date} />
          </label>

          <label>
            <span>Valor</span>
            <input
              inputMode="decimal"
              min="0.01"
              name="value"
              onChange={(event) => updateField("value", event.target.value)}
              placeholder="0,00"
              required
              step="0.01"
              type="number"
              value={form.value}
            />
          </label>

          <label>
            <span>Loja</span>
            <select name="store" onChange={(event) => updateField("store", event.target.value)} required value={form.store}>
              {stores.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </label>

          {form.type === "expense" && (
            <>
              <label>
                <span>Vencimento</span>
                <input name="dueDate" onChange={(event) => updateField("dueDate", event.target.value)} type="date" value={form.dueDate} />
              </label>

              <label>
                <span>Pagamento</span>
                <input name="paymentDate" onChange={(event) => updateField("paymentDate", event.target.value)} type="date" value={form.paymentDate} />
              </label>
            </>
          )}

          <label className="wide">
            <span>Descricao</span>
            <input
              maxLength="80"
              name="description"
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Ex: venda balcão"
              required
              value={form.description}
            />
          </label>

          <label className="wide">
            <span>Categoria</span>
            <select name="category" onChange={(event) => updateField("category", event.target.value)} required value={form.category}>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          {form.type === "expense" && (
            <>
              <label>
                <span>Funcionario</span>
                <input
                  maxLength="80"
                  name="employeeName"
                  onChange={(event) => updateField("employeeName", event.target.value)}
                  placeholder="Opcional"
                  value={form.employeeName}
                />
              </label>

              <label>
                <span>Fornecedor</span>
                <select
                  name="supplier"
                  onChange={(event) => updateField("supplier", event.target.value)}
                  value={form.supplier}
                >
                  <option value="">Sem fornecedor</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.name}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              {!entry && (
                <>
                  <label>
                    <span>Recorrência</span>
                    <input
                      max="12"
                      min="1"
                      name="recurrence"
                      onChange={(event) => updateField("recurrence", event.target.value)}
                      required
                      type="number"
                      value={form.recurrence}
                    />
                  </label>

                  <label>
                    <span>Intervalo (dias)</span>
                    <input
                      min="1"
                      name="intervalDays"
                      onChange={(event) => updateField("intervalDays", event.target.value)}
                      placeholder="Ex: 30"
                      required={Number(form.recurrence) > 1}
                      type="number"
                      value={form.intervalDays}
                    />
                  </label>
                </>
              )}
            </>
          )}
        </div>

        <button className={`primary-button ${form.type}`} type="submit">
          {entry ? "Salvar alteracoes" : "Adicionar"}
        </button>
      </form>
    </section>
  );
}
