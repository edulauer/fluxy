import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupplier, deleteSupplier, getSuppliers } from "../api.js";

export default function SupplierManager({ onChanged }) {
  const [suppliers, setSuppliers] = useState([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadSuppliers() {
    setLoading(true);
    try {
      setSuppliers(await getSuppliers());
      setMessage("");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await createSupplier({ name });
      setName("");
      await loadSuppliers();
      await onChanged();
      setMessage("Fornecedor adicionado.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function handleDelete(supplier) {
    const confirmed = window.confirm(`Excluir o fornecedor ${supplier.name}?`);
    if (!confirmed) return;

    try {
      await deleteSupplier(supplier.id);
      await loadSuppliers();
      await onChanged();
      setMessage("Fornecedor excluido.");
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <section className="supplier-page">
      <div className="section-heading">
        <h2>Fornecedores</h2>
      </div>

      <form className="supplier-form" onSubmit={handleSubmit}>
        <label>
          <span>Nome</span>
          <input maxLength="80" onChange={(event) => setName(event.target.value)} placeholder="Ex: Distribuidora Alfa" required value={name} />
        </label>

        <button className="primary-button expense" type="submit">
          Adicionar fornecedor
        </button>
      </form>

      {message && <div className="inline-message">{message}</div>}

      {loading ? (
        <div className="empty-state">Carregando fornecedores...</div>
      ) : suppliers.length === 0 ? (
        <div className="empty-state">Nenhum fornecedor cadastrado.</div>
      ) : (
        <div className="supplier-list">
          {suppliers.map((supplier) => (
            <div className="supplier-row" key={supplier.id}>
              <strong>{supplier.name}</strong>
              <button type="button" onClick={() => handleDelete(supplier)} aria-label={`Excluir ${supplier.name}`} title="Excluir">
                <Trash2 aria-hidden="true" size={17} strokeWidth={2.2} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
