import pg from "pg";

const { Pool } = pg;

const mockEntries = [
  ["income", 12400, "2026-05-02", "Vendas no balcao", "Vendas", "Geral", "2026-05-02", "2026-05-02", "", ""],
  ["expense", 3150, "2026-05-02", "Compra de insumos", "Fornecedores", "Loja 1", "2026-05-05", "", "", "Distribuidora Alfa"],
  ["income", 6800, "2026-04-29", "Contrato mensal", "Servicos", "Geral", "2026-04-30", "2026-04-29", "", ""],
  ["expense", 1420, "2026-04-28", "Campanha local", "Marketing", "Loja 2", "2026-05-03", "2026-05-02", "", "Agencia Beta"],
  ["expense", 2600, "2026-04-25", "Aluguel da loja", "Aluguel", "Loja 1", "2026-05-01", "2026-05-01", "", "Imobiliaria Central"],
  ["income", 3900, "2026-04-23", "Pedido corporativo", "Vendas", "Geral", "2026-04-23", "2026-04-23", "", ""]
];

const defaultCategories = [
  ["income", "Vendas", "Receita Operacional"],
  ["income", "Servicos", "Receita Operacional"],
  ["income", "Outros", "Receita Nao-Operacional"],
  ["expense", "Fornecedores", "Despesa Variavel"],
  ["expense", "Marketing", "Despesa Variavel"],
  ["expense", "Aluguel", "Despesa Fixa"],
  ["expense", "Folha", "Despesa Fixa"],
  ["expense", "Impostos", "Despesa Variavel"],
  ["expense", "Outros", "Despesa Variavel"]
];

const defaultSuppliers = ["Distribuidora Alfa", "Agencia Beta", "Imobiliaria Central"];

function normalizeEntryDates(entry) {
  return entry.map((value, index) => ([6, 7].includes(index) && value === "" ? null : value));
}

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    throw new Error("Configure DATABASE_URL com a string de conexao do Postgres.");
  }
  return url;
}

function createStore(client) {
  return {
    async query(sql, params = []) {
      return client.query(sql, params);
    },
    async all(sql, params = []) {
      const result = await client.query(sql, params);
      return result.rows;
    },
    async get(sql, params = []) {
      const result = await client.query(sql, params);
      return result.rows[0];
    },
    async run(sql, params = []) {
      const result = await client.query(sql, params);
      return { changes: result.rowCount, rowCount: result.rowCount, rows: result.rows };
    },
    async transaction(callback) {
      const transactionClient = await client.connect();
      const tx = createStore(transactionClient);
      try {
        await transactionClient.query("BEGIN");
        const result = await callback(tx);
        await transactionClient.query("COMMIT");
        return result;
      } catch (err) {
        await transactionClient.query("ROLLBACK");
        throw err;
      } finally {
        transactionClient.release();
      }
    },
    async close() {
      await client.end();
    }
  };
}

async function hasColumn(db, table, column) {
  const row = await db.get(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    `,
    [table, column]
  );
  return Boolean(row);
}

async function seedCategories(db) {
  const row = await db.get("SELECT COUNT(*)::int as total FROM categories");
  if (row.total === 0) {
    await db.transaction(async (tx) => {
      for (const category of defaultCategories) {
        await tx.run(
          "INSERT INTO categories (type, name, category_subtype) VALUES ($1, $2, $3) ON CONFLICT (type, name) DO NOTHING",
          category
        );
      }
    });
    return;
  }

  await db.transaction(async (tx) => {
    for (const [type, name, categorySubtype] of defaultCategories) {
      await tx.run(
        "UPDATE categories SET category_subtype = $1 WHERE type = $2 AND name = $3 AND category_subtype = ''",
        [categorySubtype, type, name]
      );
    }
    await tx.run("UPDATE categories SET category_subtype = $1 WHERE type = 'income' AND category_subtype = ''", ["Receita Operacional"]);
    await tx.run("UPDATE categories SET category_subtype = $1 WHERE type = 'expense' AND category_subtype = ''", ["Despesa Variavel"]);
  });
}

async function seedEntries(db) {
  const row = await db.get("SELECT COUNT(*)::int as total FROM entries");
  if (row.total > 0) return;

  await db.transaction(async (tx) => {
    for (const entry of mockEntries) {
      await tx.run(
        `
          INSERT INTO entries (type, value, date, description, category, store, due_date, payment_date, employee_name, supplier)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        normalizeEntryDates(entry)
      );
    }
  });
}

async function seedSuppliers(db) {
  const row = await db.get("SELECT COUNT(*)::int as total FROM suppliers");
  if (row.total > 0) return;

  await db.transaction(async (tx) => {
    for (const supplier of defaultSuppliers) {
      await tx.run("INSERT INTO suppliers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [supplier]);
    }

    const existingSuppliers = await tx.all("SELECT DISTINCT supplier FROM entries WHERE supplier IS NOT NULL AND supplier != ''");
    for (const { supplier } of existingSuppliers) {
      await tx.run("INSERT INTO suppliers (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [supplier]);
    }
  });
}

export async function initDatabase() {
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
  });
  const db = createStore(pool);

  await db.query(`
    CREATE TABLE IF NOT EXISTS entries (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      value NUMERIC(12, 2) NOT NULL CHECK(value > 0),
      date DATE NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      store TEXT NOT NULL DEFAULT 'Geral',
      due_date DATE,
      payment_date DATE,
      employee_name TEXT,
      supplier TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      name TEXT NOT NULL,
      category_subtype TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, name)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (!(await hasColumn(db, "categories", "category_subtype"))) {
    await db.query("ALTER TABLE categories ADD COLUMN category_subtype TEXT NOT NULL DEFAULT ''");
  }

  for (const [column, definition] of [
    ["store", "TEXT NOT NULL DEFAULT 'Geral'"],
    ["due_date", "DATE"],
    ["payment_date", "DATE"],
    ["employee_name", "TEXT"],
    ["supplier", "TEXT"]
  ]) {
    if (!(await hasColumn(db, "entries", column))) {
      await db.query(`ALTER TABLE entries ADD COLUMN ${column} ${definition}`);
    }
  }

  await seedCategories(db);
  await seedEntries(db);
  await seedSuppliers(db);

  return db;
}
