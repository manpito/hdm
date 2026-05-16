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

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.exec(schema);

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
