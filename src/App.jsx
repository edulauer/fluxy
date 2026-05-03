import { useEffect, useMemo, useState } from "react";
import { createEntry, deleteEntry, getAccountsPayable, getCategories, getEntries, getStoredToken, login, logout, updateEntry } from "./api.js";
import AccountsPayable from "./components/AccountsPayable.jsx";
import CategoryManager from "./components/CategoryManager.jsx";
import CategoryPieDashboard from "./components/CategoryPieDashboard.jsx";
import Dashboard from "./components/Dashboard.jsx";
import EntryForm from "./components/EntryForm.jsx";
import EntryList from "./components/EntryList.jsx";
import Filters from "./components/Filters.jsx";
import Login from "./components/Login.jsx";

const initialFilters = { month: new Date().toISOString().slice(0, 7), type: "all" };

function formatForCsv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(getStoredToken()));
  const [entries, setEntries] = useState([]);
  const [accountsPayable, setAccountsPayable] = useState([]);
  const [categories, setCategories] = useState({ income: [], expense: [] });
  const [filters, setFilters] = useState(initialFilters);
  const [editingEntry, setEditingEntry] = useState(null);
  const [page, setPage] = useState("home");
  const [loading, setLoading] = useState(true);
  const [payableLoading, setPayableLoading] = useState(true);
  const [error, setError] = useState("");
  const [loginError, setLoginError] = useState("");

  async function loadCategories() {
    try {
      setCategories(await getCategories());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadEntries(nextFilters = filters) {
    setLoading(true);
    try {
      const data = await getEntries(nextFilters);
      setEntries(data);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadAccountsPayable() {
    setPayableLoading(true);
    try {
      setAccountsPayable(await getAccountsPayable());
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setPayableLoading(false);
    }
  }

  useEffect(() => {
    function handleLogout() {
      setAuthenticated(false);
      setLoginError("Sessao expirada. Faca login novamente.");
    }

    window.addEventListener("finance:logout", handleLogout);
    return () => window.removeEventListener("finance:logout", handleLogout);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadCategories();
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    loadEntries(filters);
  }, [authenticated, filters.month, filters.type]);

  useEffect(() => {
    if (!authenticated) return;
    loadAccountsPayable();
  }, [authenticated]);

  const totals = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        if (entry.type === "income") acc.income += entry.value;
        if (entry.type === "expense") acc.expense += entry.value;
        acc.balance = acc.income - acc.expense;
        return acc;
      },
      { income: 0, expense: 0, balance: 0 }
    );
  }, [entries]);

  async function handleSave(entry) {
    try {
      if (editingEntry) {
        await updateEntry(editingEntry.id, entry);
      } else {
        await createEntry(entry);
      }
      setEditingEntry(null);
      await loadEntries(filters);
      await loadAccountsPayable();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    const confirmed = window.confirm("Excluir este lancamento?");
    if (!confirmed) return;

    try {
      await deleteEntry(id);
      await loadEntries(filters);
      await loadAccountsPayable();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleExportCsv() {
    const header = ["Tipo", "Valor", "Data de lançamento", "Vencimento", "Pagamento", "Loja", "Descricao", "Categoria", "Funcionario", "Fornecedor"];
    const rows = entries.map((entry) => [
      entry.type === "income" ? "Receita" : "Despesa",
      entry.value.toFixed(2),
      entry.date,
      entry.type === "expense" ? entry.dueDate || "" : "",
      entry.type === "expense" ? entry.paymentDate || "" : "",
      entry.store || "Geral",
      entry.description,
      entry.category,
      entry.type === "expense" ? entry.employeeName || "" : "",
      entry.type === "expense" ? entry.supplier || "" : ""
    ]);

    const csv = [header, ...rows].map((row) => row.map(formatForCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lancamentos-financeiros.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleLogin(password) {
    try {
      await login(password);
      setAuthenticated(true);
      setLoginError("");
    } catch (err) {
      setLoginError(err.message);
    }
  }

  function handleLogout() {
    logout();
    setAuthenticated(false);
    setEntries([]);
    setAccountsPayable([]);
    setCategories({ income: [], expense: [] });
    setPage("home");
    setEditingEntry(null);
  }

  if (!authenticated) {
    return <Login error={loginError} onLogin={handleLogin} />;
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Mini SaaS financeiro</p>
          <h1>{page === "home" ? "Fluxo Simples" : "Categorias"}</h1>
        </div>
        <div className="header-actions">
          <button className="ghost-button" onClick={() => setPage(page === "home" ? "categories" : "home")}>
            {page === "home" ? "Categorias" : "Voltar"}
          </button>
          {page === "home" && (
            <button className="ghost-button" onClick={handleExportCsv} disabled={entries.length === 0}>
              CSV
            </button>
          )}
          <button className="ghost-button" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      {page === "categories" ? (
        <CategoryManager onChanged={loadCategories} />
      ) : (
        <>
          <Dashboard entries={entries} totals={totals} period="month" />
          <CategoryPieDashboard />
          <AccountsPayable entries={accountsPayable} loading={payableLoading} />

          <EntryForm categories={categories} entry={editingEntry} onCancel={() => setEditingEntry(null)} onSave={handleSave} />

          <section className="records-section">
            <Filters filters={filters} onChange={setFilters} />
            <EntryList entries={entries} loading={loading} onDelete={handleDelete} onEdit={setEditingEntry} />
          </section>
        </>
      )}
    </main>
  );
}
