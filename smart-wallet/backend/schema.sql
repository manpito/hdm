CREATE TABLE IF NOT EXISTS terminals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL, -- 'admin', 'financeiro', 'pos'
  full_name TEXT,
  terminal_id INTEGER,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  image_base64 TEXT
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY, -- NFC UID
  balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  total_price REAL NOT NULL,
  terminal_id INTEGER,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES cards(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (terminal_id) REFERENCES terminals(id)
);
