import { useEffect, useMemo, useState } from "react";
import { createEntry, deleteEntry, getAccountsPayable, getCategories, getConfig, getEntries, getStoredToken, getSuppliers, login, logout, updateEntry } from "./api.js";
import AccountsPayable from "./components/AccountsPayable.jsx";
import CategoryManager from "./components/CategoryManager.jsx";
import CategoryPieDashboard from "./components/CategoryPieDashboard.jsx";
import Dashboard from "./components/Dashboard.jsx";
import EntryForm from "./components/EntryForm.jsx";
import EntryList from "./components/EntryList.jsx";
import Filters from "./components/Filters.jsx";
import Login from "./components/Login.jsx";
import SupplierManager from "./components/SupplierManager.jsx";

const initialFilters = { month: new Date().toISOString().slice(0, 7), type: "all" };

function formatForCsv(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(getStoredToken()));
  const [companyName, setCompanyName] = useState("Fluxo Simples");
  const [entries, setEntries] = useState([]);
  const [accountsPayable, setAccountsPayable] = useState([]);
  const [categories, setCategories] = useState({ income: [], expense: [] });
  const [suppliers, setSuppliers] = useState([]);
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

  async function loadSuppliers() {
    try {
      setSuppliers(await getSuppliers());
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

    getConfig()
      .then((config) => setCompanyName(config.companyName || "Fluxo Simples"))
      .catch(() => setCompanyName("Fluxo Simples"));

    window.addEventListener("finance:logout", handleLogout);
    return () => window.removeEventListener("finance:logout", handleLogout);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadCategories();
    loadSuppliers();
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
    setSuppliers([]);
    setPage("home");
    setEditingEntry(null);
  }

  if (!authenticated) {
    return <Login companyName={companyName} error={loginError} onLogin={handleLogin} />;
  }

  const pageTitle = {
    home: companyName,
    dashboard: "Dashboard",
    categories: "Categorias",
    suppliers: "Fornecedores"
  }[page];

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Mini SaaS financeiro</p>
          <h1>{pageTitle}</h1>
        </div>
        <div className="header-actions">
          {page === "home" && (
            <>
              <button className="ghost-button" onClick={() => setPage("dashboard")}>
                Dashboard
              </button>
              <button className="ghost-button" onClick={() => setPage("categories")}>
                Categorias
              </button>
              <button className="ghost-button" onClick={() => setPage("suppliers")}>
                Fornecedores
              </button>
            </>
          )}
          {page !== "home" && (
            <button className="ghost-button" onClick={() => setPage("home")}>
              Voltar
            </button>
          )}
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

      {page === "dashboard" ? (
        <CategoryPieDashboard />
      ) : page === "categories" ? (
        <CategoryManager onChanged={loadCategories} />
      ) : page === "suppliers" ? (
        <SupplierManager onChanged={loadSuppliers} />
      ) : (
        <>
          <Dashboard entries={entries} totals={totals} period="month" />
          <AccountsPayable entries={accountsPayable} loading={payableLoading} />

          <EntryForm categories={categories} suppliers={suppliers} entry={editingEntry} onCancel={() => setEditingEntry(null)} onSave={handleSave} />

          <section className="records-section">
            <Filters filters={filters} onChange={setFilters} />
            <EntryList entries={entries} loading={loading} onDelete={handleDelete} onEdit={setEditingEntry} />
          </section>
        </>
      )}
    </main>
  );
}
