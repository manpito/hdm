import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  const db = await open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });

  // Apply schema
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.exec(schema);

  // Migration: Safe Column Addition
  const tableInfos = {
    products: await db.all('PRAGMA table_info(products)'),
    cards: await db.all('PRAGMA table_info(cards)'),
    audit_logs: await db.all('PRAGMA table_info(audit_logs)')
  };

  const addColumnIfNotExists = async (table, column, type) => {
    if (!tableInfos[table].some(c => c.name === column)) {
      await db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  };

  await addColumnIfNotExists('products', 'stock_minimum', 'INTEGER DEFAULT 5');
  await addColumnIfNotExists('cards', 'owner_name', 'TEXT');
  await addColumnIfNotExists('cards', 'is_active', 'INTEGER DEFAULT 1');
  await addColumnIfNotExists('cards', 'price_paid', 'REAL DEFAULT 0');
  await addColumnIfNotExists('cards', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfNotExists('audit_logs', 'amount', 'REAL');

  // Seed Settings
  const settings = [
    { key: 'installationName', value: 'SmartWallet Central' },
    { key: 'stockThreshold', value: '10' },
    { key: 'nfcCardPrice', value: '500' }
  ];

  for (const s of settings) {
    const exists = await db.get('SELECT 1 FROM settings WHERE key = ?', s.key);
    if (!exists) {
      await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [s.key, s.value]);
    }
  }

  // Seed Initial Data
  const adminExists = await db.get('SELECT * FROM users WHERE username = ?', 'admin');
  if (!adminExists) {
    // Terminais
    const t1 = await db.run('INSERT INTO terminals (name, location, is_active) VALUES (?, ?, ?)', ['Terminal 1', 'Entrada Norte', 1]);
    const t2 = await db.run('INSERT INTO terminals (name, location, is_active) VALUES (?, ?, ?)', ['Terminal 2', 'Zona Food', 1]);

    const hashedAdmin = await bcrypt.hash('admin123', 10);
    const hashedFin = await bcrypt.hash('fin123', 10);
    const hashedPos1 = await bcrypt.hash('pos123', 10);
    const hashedPos2 = await bcrypt.hash('pos456', 10);

    await db.run('INSERT INTO users (username, password, role, full_name, is_active) VALUES (?, ?, ?, ?, ?)',
      ['admin', hashedAdmin, 'admin', 'Administrador Sistema', 1]);

    await db.run('INSERT INTO users (username, password, role, full_name, is_active) VALUES (?, ?, ?, ?, ?)',
      ['financeiro', hashedFin, 'financeiro', 'Gestor Financeiro', 1]);

    await db.run('INSERT INTO users (username, password, role, full_name, terminal_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      ['pos1', hashedPos1, 'pos', 'Operador 1', t1.lastID, 1]);

    await db.run('INSERT INTO users (username, password, role, full_name, terminal_id, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      ['pos2', hashedPos2, 'pos', 'Operador 2', t2.lastID, 1]);
  }

  return db;
}

export { initDb };
