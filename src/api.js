const headers = { "Content-Type": "application/json" };
const tokenKey = "financeAuthToken";

async function request(path, options = {}) {
  const token = localStorage.getItem(tokenKey);
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await fetch(path, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return null;

  const body = await response.json();
  if (response.status === 401) {
    localStorage.removeItem(tokenKey);
    window.dispatchEvent(new Event("finance:logout"));
  }

  if (!response.ok) {
    throw new Error(body.error || "Nao foi possivel concluir a operacao.");
  }

  return body;
}

export function getStoredToken() {
  return localStorage.getItem(tokenKey);
}

export async function login(password) {
  const data = await request("/api/login", {
    method: "POST",
    headers,
    body: JSON.stringify({ password })
  });
  localStorage.setItem(tokenKey, data.token);
  return data;
}

export function logout() {
  localStorage.removeItem(tokenKey);
}

export function getConfig() {
  return request("/api/config");
}

export function getEntries(filters) {
  const params = new URLSearchParams(filters);
  return request(`/api/entries?${params.toString()}`);
}

export function getCategories() {
  return request("/api/categories");
}

export function getCategoryList() {
  return request("/api/categories/list");
}

export function getCategorySummary(month) {
  const params = new URLSearchParams({ month });
  return request(`/api/dashboard/category-summary?${params.toString()}`);
}

export function getAccountsPayable() {
  return request("/api/accounts-payable");
}

export function getSuppliers() {
  return request("/api/suppliers");
}

export function createSupplier(supplier) {
  return request("/api/suppliers", {
    method: "POST",
    headers,
    body: JSON.stringify(supplier)
  });
}

export function deleteSupplier(id) {
  return request(`/api/suppliers/${id}`, { method: "DELETE" });
}

export function createCategory(category) {
  return request("/api/categories", {
    method: "POST",
    headers,
    body: JSON.stringify(category)
  });
}

export function deleteCategory(id) {
  return request(`/api/categories/${id}`, { method: "DELETE" });
}

export function createEntry(entry) {
  return request("/api/entries", {
    method: "POST",
    headers,
    body: JSON.stringify(entry)
  });
}

export function updateEntry(id, entry) {
  return request(`/api/entries/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(entry)
  });
}

export function deleteEntry(id) {
  return request(`/api/entries/${id}`, { method: "DELETE" });
}
