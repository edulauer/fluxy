import crypto from "node:crypto";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, readEnvFile } from "./env.js";
import { initDatabase } from "./storage.js";

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3333);
const db = initDatabase();
const sessionToken = crypto.randomBytes(32).toString("base64url");
const stores = ["Geral", "Loja 1", "Loja 2"];
const categorySubtypes = {
  income: ["Receita Operacional", "Receita Nao-Operacional"],
  expense: ["Despesa Fixa", "Despesa Variavel"]
};

app.use(express.json());

function getConfiguredPassword() {
  const encoded = process.env.APP_PASSWORD_BASE64 || "";
  return Buffer.from(encoded, "base64").toString("utf8");
}

function requireAuth(req, res, next) {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token !== sessionToken) {
    return res.status(401).json({ error: "Sessao expirada. Faca login novamente." });
  }
  next();
}

function parseEntry(payload) {
  const value = Number(payload.value);
  const type = payload.type === "expense" ? "expense" : payload.type === "income" ? "income" : null;
  const date = String(payload.date || "").trim();
  const dueDate = type === "expense" ? String(payload.dueDate || "").trim() : "";
  const paymentDate = type === "expense" ? String(payload.paymentDate || "").trim() : "";
  const description = String(payload.description || "").trim();
  const category = String(payload.category || "").trim();
  const store = stores.includes(payload.store) ? payload.store : "Geral";
  const employeeName = type === "expense" ? String(payload.employeeName || "").trim() : "";
  const supplier = type === "expense" ? String(payload.supplier || "").trim() : "";

  if (!type) return { error: "Tipo invalido." };
  if (!Number.isFinite(value) || value <= 0) return { error: "Valor deve ser maior que zero." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Data invalida." };
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return { error: "Data de vencimento invalida." };
  if (paymentDate && !/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) return { error: "Data de pagamento invalida." };
  if (description.length < 2) return { error: "Descricao muito curta." };
  if (category.length < 2) return { error: "Categoria invalida." };
  if (supplier && !db.prepare("SELECT id FROM suppliers WHERE name = ?").get(supplier)) return { error: "Fornecedor invalido." };

  return {
    data: {
      type,
      value,
      date,
      description,
      category,
      store,
      dueDate: dueDate || null,
      paymentDate: paymentDate || null,
      employeeName,
      supplier
    }
  };
}

function parseRecurrence(payload) {
  const recurrence = Number(payload.recurrence || 1);
  const intervalDays = Number(payload.intervalDays || 0);

  if (!Number.isInteger(recurrence) || recurrence < 1 || recurrence > 12) {
    return { error: "Recorrencia deve ser um numero entre 1 e 12." };
  }

  if (recurrence > 1 && (!Number.isInteger(intervalDays) || intervalDays < 1)) {
    return { error: "Intervalo deve ser informado em dias quando a recorrencia for maior que 1." };
  }

  return { data: { recurrence, intervalDays } };
}

function parseCategory(payload) {
  const type = payload.type === "expense" ? "expense" : payload.type === "income" ? "income" : null;
  const name = String(payload.name || "").trim();
  const categorySubtype = String(payload.categorySubtype || "").trim();

  if (!type) return { error: "Tipo invalido." };
  if (name.length < 2) return { error: "Nome da categoria muito curto." };
  if (name.length > 40) return { error: "Nome da categoria muito longo." };
  if (!categorySubtypes[type]?.includes(categorySubtype)) return { error: "Tipo da categoria invalido." };

  return { data: { type, name, categorySubtype } };
}

function parseSupplier(payload) {
  const name = String(payload.name || "").trim();

  if (name.length < 2) return { error: "Nome do fornecedor muito curto." };
  if (name.length > 80) return { error: "Nome do fornecedor muito longo." };

  return { data: { name } };
}

function getGroupedCategories() {
  const rows = db.prepare("SELECT id, type, name, category_subtype as categorySubtype FROM categories ORDER BY type DESC, name ASC").all();
  return rows.reduce(
    (acc, category) => {
      acc[category.type].push(category.name);
      return acc;
    },
    { income: [], expense: [] }
  );
}

function parseMonth(value) {
  const month = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
}

function addDays(date, days) {
  if (!date) return null;
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/config", (_req, res) => {
  const env = readEnvFile();
  res.json({
    companyName: env.APP_COMPANY_NAME || process.env.APP_COMPANY_NAME || "Fluxo Simples"
  });
});

app.post("/api/login", (req, res) => {
  const password = String(req.body.password || "");
  const configuredPassword = getConfiguredPassword();

  if (!configuredPassword) {
    return res.status(500).json({ error: "Senha do aplicativo nao configurada." });
  }

  if (password !== configuredPassword) {
    return res.status(401).json({ error: "Senha invalida." });
  }

  res.json({ token: sessionToken });
});

app.use("/api", requireAuth);

app.get("/api/categories", (_req, res) => {
  res.json(getGroupedCategories());
});

app.get("/api/categories/list", (_req, res) => {
  const rows = db
    .prepare("SELECT id, type, name, category_subtype as categorySubtype, created_at as createdAt FROM categories ORDER BY type DESC, name ASC")
    .all();
  res.json(rows);
});

app.get("/api/suppliers", (_req, res) => {
  const rows = db.prepare("SELECT id, name, created_at as createdAt FROM suppliers ORDER BY name ASC").all();
  res.json(rows);
});

app.post("/api/suppliers", (req, res) => {
  const parsed = parseSupplier(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const result = db.prepare("INSERT INTO suppliers (name) VALUES (@name)").run(parsed.data);
    const supplier = db.prepare("SELECT id, name, created_at as createdAt FROM suppliers WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json(supplier);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Fornecedor ja cadastrado." });
    }
    throw err;
  }
});

app.delete("/api/suppliers/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });

  const supplier = db.prepare("SELECT id, name FROM suppliers WHERE id = ?").get(id);
  if (!supplier) return res.status(404).json({ error: "Fornecedor nao encontrado." });

  db.prepare("UPDATE entries SET supplier = '' WHERE supplier = ?").run(supplier.name);
  db.prepare("DELETE FROM suppliers WHERE id = ?").run(id);
  res.status(204).send();
});

app.post("/api/categories", (req, res) => {
  const parsed = parseCategory(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const result = db.prepare("INSERT INTO categories (type, name, category_subtype) VALUES (@type, @name, @categorySubtype)").run(parsed.data);
    const category = db
      .prepare("SELECT id, type, name, category_subtype as categorySubtype, created_at as createdAt FROM categories WHERE id = ?")
      .get(result.lastInsertRowid);
    res.status(201).json(category);
  } catch (err) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "Categoria ja cadastrada para este tipo." });
    }
    throw err;
  }
});

app.delete("/api/categories/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });

  const category = db.prepare("SELECT id, type, name FROM categories WHERE id = ?").get(id);
  if (!category) return res.status(404).json({ error: "Categoria nao encontrada." });

  const deleteCategory = db.transaction((currentCategory) => {
    const fallbackSubtype = currentCategory.type === "income" ? "Receita Nao-Operacional" : "Despesa Variavel";
    db.prepare("INSERT OR IGNORE INTO categories (type, name, category_subtype) VALUES (?, ?, ?)").run(currentCategory.type, "Outros", fallbackSubtype);
    db.prepare("UPDATE entries SET category = ? WHERE type = ? AND category = ?").run(
      "Outros",
      currentCategory.type,
      currentCategory.name
    );
    db.prepare("DELETE FROM categories WHERE id = ?").run(currentCategory.id);
  });

  deleteCategory(category);
  res.status(204).send();
});

app.get("/api/dashboard/category-summary", (req, res) => {
  const month = parseMonth(req.query.month);
  const rows = db
    .prepare(
      `
        SELECT
          type,
          category,
          SUM(value) as total
        FROM entries
        WHERE date >= date(? || '-01')
          AND date < date(? || '-01', '+1 month')
        GROUP BY type, category
        ORDER BY type DESC, total DESC
      `
    )
    .all(month, month);

  const summary = {
    month,
    income: { total: 0, categories: [] },
    expense: { total: 0, categories: [] }
  };

  for (const row of rows) {
    const item = {
      category: row.category,
      total: Number(row.total || 0)
    };
    summary[row.type].categories.push(item);
    summary[row.type].total += item.total;
  }

  res.json(summary);
});

app.get("/api/accounts-payable", (_req, res) => {
  const rows = db
    .prepare(
      `
        SELECT
          id,
          type,
          value,
          date,
          description,
          category,
          store,
          due_date as dueDate,
          payment_date as paymentDate,
          employee_name as employeeName,
          supplier,
          created_at as createdAt
        FROM entries
        WHERE type = 'expense'
          AND (payment_date IS NULL OR payment_date = '')
          AND due_date IS NOT NULL
          AND due_date != ''
          AND due_date <= date('now')
        ORDER BY due_date DESC, id DESC
      `
    )
    .all();

  res.json(rows);
});

app.get("/api/entries", (req, res) => {
  const { type = "all" } = req.query;
  const month = parseMonth(req.query.month);
  const params = [month, month];
  let sql = `
    SELECT
      id,
      type,
      value,
      date,
      description,
      category,
      store,
      due_date as dueDate,
      payment_date as paymentDate,
      employee_name as employeeName,
      supplier,
      created_at as createdAt
    FROM entries
    WHERE date >= date(? || '-01')
      AND date < date(? || '-01', '+1 month')
  `;

  if (type === "income" || type === "expense") {
    sql += " AND type = ?";
    params.push(type);
  }

  sql += " ORDER BY date DESC, id DESC";
  res.json(db.prepare(sql).all(...params));
});

app.post("/api/entries", (req, res) => {
  const parsed = parseEntry(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const recurrence = parsed.data.type === "expense" ? parseRecurrence(req.body) : { data: { recurrence: 1, intervalDays: 0 } };
  if (recurrence.error) return res.status(400).json({ error: recurrence.error });

  const insert = db.prepare(
    `
      INSERT INTO entries (
        type,
        value,
        date,
        description,
        category,
        store,
        due_date,
        payment_date,
        employee_name,
        supplier
      )
      VALUES (
        @type,
        @value,
        @date,
        @description,
        @category,
        @store,
        @dueDate,
        @paymentDate,
        @employeeName,
        @supplier
      )
    `
  );

  const createEntries = db.transaction((entry, options) => {
    const ids = [];
    for (let index = 0; index < options.recurrence; index += 1) {
      const offset = index * options.intervalDays;
      const result = insert.run({
        ...entry,
        date: addDays(entry.date, offset),
        dueDate: addDays(entry.dueDate, offset),
        paymentDate: addDays(entry.paymentDate, offset)
      });
      ids.push(result.lastInsertRowid);
    }
    return ids;
  });

  const ids = createEntries(parsed.data, recurrence.data);

  const entries = db
    .prepare(
      `
        SELECT
          id,
          type,
          value,
          date,
          description,
          category,
          store,
          due_date as dueDate,
          payment_date as paymentDate,
          employee_name as employeeName,
          supplier,
          created_at as createdAt
        FROM entries
        WHERE id IN (${ids.map(() => "?").join(",")})
        ORDER BY id ASC
      `
    )
    .all(...ids);
  res.status(201).json(recurrence.data.recurrence === 1 ? entries[0] : entries);
});

app.put("/api/entries/:id", (req, res) => {
  const id = Number(req.params.id);
  const parsed = parseEntry(req.body);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const result = db
    .prepare(
      `
        UPDATE entries
        SET
          type = @type,
          value = @value,
          date = @date,
          description = @description,
          category = @category,
          store = @store,
          due_date = @dueDate,
          payment_date = @paymentDate,
          employee_name = @employeeName,
          supplier = @supplier
        WHERE id = @id
      `
    )
    .run({ ...parsed.data, id });

  if (result.changes === 0) return res.status(404).json({ error: "Lancamento nao encontrado." });
  const entry = db
    .prepare(
      `
        SELECT
          id,
          type,
          value,
          date,
          description,
          category,
          store,
          due_date as dueDate,
          payment_date as paymentDate,
          employee_name as employeeName,
          supplier,
          created_at as createdAt
        FROM entries
        WHERE id = ?
      `
    )
    .get(id);
  res.json(entry);
});

app.delete("/api/entries/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });

  const result = db.prepare("DELETE FROM entries WHERE id = ?").run(id);
  if (result.changes === 0) return res.status(404).json({ error: "Lancamento nao encontrado." });
  res.status(204).send();
});

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
