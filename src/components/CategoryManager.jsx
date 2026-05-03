import { useEffect, useMemo, useState } from "react";
import { createCategory, deleteCategory, getCategoryList } from "../api.js";

const typeLabels = {
  income: "Receita",
  expense: "Despesa"
};

const subtypeOptions = {
  income: ["Receita Operacional", "Receita Nao-Operacional"],
  expense: ["Despesa Fixa", "Despesa Variavel"]
};

export default function CategoryManager({ onChanged }) {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ type: "expense", name: "", categorySubtype: subtypeOptions.expense[0] });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadCategories() {
    setLoading(true);
    try {
      setCategories(await getCategoryList());
      setMessage("");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  const grouped = useMemo(() => {
    return categories.reduce(
      (acc, category) => {
        acc[category.type].push(category);
        return acc;
      },
      { income: [], expense: [] }
    );
  }, [categories]);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await createCategory(form);
      setForm((current) => ({ ...current, name: "" }));
      await loadCategories();
      await onChanged();
      setMessage("Categoria adicionada.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  function updateType(type) {
    setForm({
      ...form,
      type,
      categorySubtype: subtypeOptions[type][0]
    });
  }

  async function handleDelete(category) {
    const confirmed = window.confirm(`Excluir a categoria ${category.name}?`);
    if (!confirmed) return;

    try {
      await deleteCategory(category.id);
      await loadCategories();
      await onChanged();
      setMessage("Categoria excluida. Lancamentos vinculados foram movidos para Outros.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <section className="category-page">
      <div className="section-heading">
        <h2>Categorias</h2>
      </div>

      <form className="category-form" onSubmit={handleSubmit}>
        <div className="segmented" role="group" aria-label="Tipo da categoria">
          <button className={form.type === "income" ? "active income" : ""} type="button" onClick={() => updateType("income")}>
            Receita
          </button>
          <button className={form.type === "expense" ? "active expense" : ""} type="button" onClick={() => updateType("expense")}>
            Despesa
          </button>
        </div>

        <label>
          <span>Nome</span>
          <input
            maxLength="40"
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ex: Assinaturas"
            required
            value={form.name}
          />
        </label>

        <label>
          <span>Tipo</span>
          <select
            onChange={(event) => setForm({ ...form, categorySubtype: event.target.value })}
            required
            value={form.categorySubtype}
          >
            {subtypeOptions[form.type].map((subtype) => (
              <option key={subtype} value={subtype}>
                {subtype}
              </option>
            ))}
          </select>
        </label>

        <button className={`primary-button ${form.type}`} type="submit">
          Adicionar categoria
        </button>
      </form>

      {message && <div className="inline-message">{message}</div>}

      {loading ? (
        <div className="empty-state">Carregando categorias...</div>
      ) : (
        <div className="category-columns">
          {["income", "expense"].map((type) => (
            <article className="category-group" key={type}>
              <h3>{typeLabels[type]}</h3>
              <div className="category-list">
                {grouped[type].map((category) => (
                  <div className={`category-row ${type}`} key={category.id}>
                    <span>
                      <strong>{category.name}</strong>
                      <small>{category.categorySubtype}</small>
                    </span>
                    <button type="button" onClick={() => handleDelete(category)} aria-label={`Excluir ${category.name}`}>
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
