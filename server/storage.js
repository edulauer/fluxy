import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "server", "data");
const dbPath = path.join(dataDir, "finance.sqlite");

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

function hasColumn(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((field) => field.name === column);
}

export function initDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      value REAL NOT NULL CHECK(value > 0),
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      store TEXT NOT NULL DEFAULT 'Geral',
      due_date TEXT,
      payment_date TEXT,
      employee_name TEXT,
      supplier TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      name TEXT NOT NULL,
      category_subtype TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, name)
    );
  `);

  if (!hasColumn(db, "categories", "category_subtype")) {
    db.exec("ALTER TABLE categories ADD COLUMN category_subtype TEXT NOT NULL DEFAULT ''");
  }

  for (const [column, definition] of [
    ["store", "TEXT NOT NULL DEFAULT 'Geral'"],
    ["due_date", "TEXT"],
    ["payment_date", "TEXT"],
    ["employee_name", "TEXT"],
    ["supplier", "TEXT"]
  ]) {
    if (!hasColumn(db, "entries", column)) {
      db.exec(`ALTER TABLE entries ADD COLUMN ${column} ${definition}`);
    }
  }

  const categoryCount = db.prepare("SELECT COUNT(*) as total FROM categories").get().total;
  if (categoryCount === 0) {
    const insertCategory = db.prepare("INSERT OR IGNORE INTO categories (type, name, category_subtype) VALUES (?, ?, ?)");
    const seedCategories = db.transaction((categories) => categories.forEach((category) => insertCategory.run(...category)));
    seedCategories(defaultCategories);
  } else {
    const updateSubtype = db.prepare("UPDATE categories SET category_subtype = ? WHERE type = ? AND name = ? AND category_subtype = ''");
    const fillSubtypes = db.transaction((categories) => categories.forEach(([type, name, categorySubtype]) => updateSubtype.run(categorySubtype, type, name)));
    fillSubtypes(defaultCategories);
    db.prepare("UPDATE categories SET category_subtype = ? WHERE type = 'income' AND category_subtype = ''").run("Receita Operacional");
    db.prepare("UPDATE categories SET category_subtype = ? WHERE type = 'expense' AND category_subtype = ''").run("Despesa Variavel");
  }

  const count = db.prepare("SELECT COUNT(*) as total FROM entries").get().total;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO entries (type, value, date, description, category, store, due_date, payment_date, employee_name, supplier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const seed = db.transaction((entries) => entries.forEach((entry) => insert.run(...entry)));
    seed(mockEntries);
  }

  return db;
}
