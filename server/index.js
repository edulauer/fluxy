import crypto from "node:crypto";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getEnvValue, loadEnv } from "./env.js";
import { initDatabase } from "./storage.js";

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3333);
const db = await initDatabase();
const sessionToken = crypto.randomBytes(32).toString("base64url");
const stores = ["Geral", "Loja 1", "Loja 2"];
const categorySubtypes = {
  income: ["Receita Operacional", "Receita Nao-Operacional"],
  expense: ["Despesa Fixa", "Despesa Variavel"]
};

app.use(express.json());

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function getConfiguredPassword() {
  const encoded = getEnvValue("APP_PASSWORD_BASE64");
  return Buffer.from(encoded, "base64").toString("utf8");
}

function requireAuth(req, res, next) {
  const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token !== sessionToken) {
    return res.status(401).json({ error: "Sessao expirada. Faca login novamente." });
  }
  next();
}

async function parseEntry(payload) {
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
  if (supplier && !(await db.get("SELECT id FROM suppliers WHERE name = $1", [supplier]))) return { error: "Fornecedor invalido." };

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

async function getGroupedCategories() {
  const rows = await db.all('SELECT id, type, name, category_subtype as "categorySubtype" FROM categories ORDER BY type DESC, name ASC');
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
  res.json({
    companyName: getEnvValue("APP_COMPANY_NAME", "Fluxo Simples")
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

app.get("/api/categories", asyncHandler(async (_req, res) => {
  res.json(await getGroupedCategories());
}));

app.get("/api/categories/list", asyncHandler(async (_req, res) => {
  const rows = await db.all('SELECT id, type, name, category_subtype as "categorySubtype", created_at as "createdAt" FROM categories ORDER BY type DESC, name ASC');
  res.json(rows);
}));

app.get("/api/suppliers", asyncHandler(async (_req, res) => {
  const rows = await db.all('SELECT id, name, created_at as "createdAt" FROM suppliers ORDER BY name ASC');
  res.json(rows);
}));

app.post("/api/suppliers", asyncHandler(async (req, res) => {
  const parsed = parseSupplier(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const supplier = await db.get('INSERT INTO suppliers (name) VALUES ($1) RETURNING id, name, created_at as "createdAt"', [parsed.data.name]);
    res.status(201).json(supplier);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Fornecedor ja cadastrado." });
    }
    throw err;
  }
}));

app.delete("/api/suppliers/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });

  const supplier = await db.get("SELECT id, name FROM suppliers WHERE id = $1", [id]);
  if (!supplier) return res.status(404).json({ error: "Fornecedor nao encontrado." });

  await db.transaction(async (tx) => {
    await tx.run("UPDATE entries SET supplier = '' WHERE supplier = $1", [supplier.name]);
    await tx.run("DELETE FROM suppliers WHERE id = $1", [id]);
  });
  res.status(204).send();
}));

app.post("/api/categories", asyncHandler(async (req, res) => {
  const parsed = parseCategory(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  try {
    const category = await db.get(
      'INSERT INTO categories (type, name, category_subtype) VALUES ($1, $2, $3) RETURNING id, type, name, category_subtype as "categorySubtype", created_at as "createdAt"',
      [parsed.data.type, parsed.data.name, parsed.data.categorySubtype]
    );
    res.status(201).json(category);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Categoria ja cadastrada para este tipo." });
    }
    throw err;
  }
}));

app.delete("/api/categories/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });

  const category = await db.get("SELECT id, type, name FROM categories WHERE id = $1", [id]);
  if (!category) return res.status(404).json({ error: "Categoria nao encontrada." });

  await db.transaction(async (tx) => {
    const fallbackSubtype = category.type === "income" ? "Receita Nao-Operacional" : "Despesa Variavel";
    await tx.run(
      "INSERT INTO categories (type, name, category_subtype) VALUES ($1, $2, $3) ON CONFLICT (type, name) DO NOTHING",
      [category.type, "Outros", fallbackSubtype]
    );
    await tx.run("UPDATE entries SET category = $1 WHERE type = $2 AND category = $3", ["Outros", category.type, category.name]);
    await tx.run("DELETE FROM categories WHERE id = $1", [category.id]);
  });

  res.status(204).send();
}));

app.get("/api/dashboard/category-summary", asyncHandler(async (req, res) => {
  const month = parseMonth(req.query.month);
  const rows = await db.all(
    `
        SELECT
          type,
          category,
          SUM(value)::float as total
        FROM entries
        WHERE date >= ($1 || '-01')::date
          AND date < (($2 || '-01')::date + interval '1 month')
        GROUP BY type, category
        ORDER BY type DESC, total DESC
      `,
    [month, month]
  );

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
}));

app.get("/api/accounts-payable", asyncHandler(async (_req, res) => {
  const rows = await db.all(
    `
        SELECT
          id,
          type,
          value::float as value,
          date::text as date,
          description,
          category,
          store,
          due_date::text as "dueDate",
          payment_date::text as "paymentDate",
          employee_name as "employeeName",
          supplier,
          created_at as "createdAt"
        FROM entries
        WHERE type = 'expense'
          AND payment_date IS NULL
          AND due_date IS NOT NULL
          AND due_date <= CURRENT_DATE
        ORDER BY due_date DESC, id DESC
      `
  );

  res.json(rows);
}));

app.get("/api/entries", asyncHandler(async (req, res) => {
  const { type = "all" } = req.query;
  const month = parseMonth(req.query.month);
  const params = [month, month];
  let sql = `
    SELECT
      id,
      type,
      value::float as value,
      date::text as date,
      description,
      category,
      store,
      due_date::text as "dueDate",
      payment_date::text as "paymentDate",
      employee_name as "employeeName",
      supplier,
      created_at as "createdAt"
    FROM entries
    WHERE date >= ($1 || '-01')::date
      AND date < (($2 || '-01')::date + interval '1 month')
  `;

  if (type === "income" || type === "expense") {
    sql += " AND type = $3";
    params.push(type);
  }

  sql += " ORDER BY date DESC, id DESC";
  res.json(await db.all(sql, params));
}));

app.post("/api/entries", asyncHandler(async (req, res) => {
  const parsed = await parseEntry(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const recurrence = parsed.data.type === "expense" ? parseRecurrence(req.body) : { data: { recurrence: 1, intervalDays: 0 } };
  if (recurrence.error) return res.status(400).json({ error: recurrence.error });

  const ids = await db.transaction(async (tx) => {
    const ids = [];
    for (let index = 0; index < recurrence.data.recurrence; index += 1) {
      const offset = index * recurrence.data.intervalDays;
      const result = await tx.get(
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
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `,
        [
          parsed.data.type,
          parsed.data.value,
          addDays(parsed.data.date, offset),
          parsed.data.description,
          parsed.data.category,
          parsed.data.store,
          addDays(parsed.data.dueDate, offset),
          addDays(parsed.data.paymentDate, offset),
          parsed.data.employeeName,
          parsed.data.supplier
        ]
      );
      ids.push(result.id);
    }
    return ids;
  });

  const entries = await db.all(
    `
        SELECT
          id,
          type,
          value::float as value,
          date::text as date,
          description,
          category,
          store,
          due_date::text as "dueDate",
          payment_date::text as "paymentDate",
          employee_name as "employeeName",
          supplier,
          created_at as "createdAt"
        FROM entries
        WHERE id = ANY($1::int[])
        ORDER BY id ASC
      `,
    [ids]
  );
  res.status(201).json(recurrence.data.recurrence === 1 ? entries[0] : entries);
}));

app.put("/api/entries/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const parsed = await parseEntry(req.body);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const entry = await db.get(
    `
        UPDATE entries
        SET
          type = $1,
          value = $2,
          date = $3,
          description = $4,
          category = $5,
          store = $6,
          due_date = $7,
          payment_date = $8,
          employee_name = $9,
          supplier = $10
        WHERE id = $11
        RETURNING
          id,
          type,
          value::float as value,
          date::text as date,
          description,
          category,
          store,
          due_date::text as "dueDate",
          payment_date::text as "paymentDate",
          employee_name as "employeeName",
          supplier,
          created_at as "createdAt"
      `,
    [
      parsed.data.type,
      parsed.data.value,
      parsed.data.date,
      parsed.data.description,
      parsed.data.category,
      parsed.data.store,
      parsed.data.dueDate,
      parsed.data.paymentDate,
      parsed.data.employeeName,
      parsed.data.supplier,
      id
    ]
  );

  if (!entry) return res.status(404).json({ error: "Lancamento nao encontrado." });
  res.json(entry);
}));

app.delete("/api/entries/:id", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });

  const result = await db.run("DELETE FROM entries WHERE id = $1", [id]);
  if (result.changes === 0) return res.status(404).json({ error: "Lancamento nao encontrado." });
  res.status(204).send();
}));

if (process.env.NODE_ENV === "production") {
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
}

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
