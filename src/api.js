const headers = { "Content-Type": "application/json" };

async function request(path, options = {}, notifyUnauthorized = true) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.headers || {})
    }
  });
  if (response.status === 204) return null;

  const body = await response.json();
  if (response.status === 401 && notifyUnauthorized) {
    window.dispatchEvent(new Event("finance:logout"));
  }

  if (!response.ok) {
    throw new Error(body.error || "Nao foi possivel concluir a operacao.");
  }

  return body;
}

export async function login(password) {
  return request("/api/login", {
    method: "POST",
    headers,
    body: JSON.stringify({ password })
  }, false);
}

export function logout() {
  return request("/api/logout", { method: "POST" });
}

export function getSession() {
  return request("/api/session", {}, false);
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
