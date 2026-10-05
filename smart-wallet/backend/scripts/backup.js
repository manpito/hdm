// Backup da base de dados SmartWallet (SQLite) com VACUUM INTO.
// Uso: node scripts/backup.js --type=hourly   |   node scripts/backup.js --type=daily
// Configuração no .env do backend: BACKUP_DIR (obrigatório), BACKUP_KEEP_HOURLY (48), BACKUP_KEEP_DAILY (30)
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.join(__dirname, '..');
dotenv.config({ path: path.join(BACKEND_DIR, '.env'), quiet: true });

const DB_PATH = path.join(BACKEND_DIR, 'database.sqlite');
const TYPES = { hourly: 'BACKUP_KEEP_HOURLY', daily: 'BACKUP_KEEP_DAILY' };
const DEFAULT_KEEP = { hourly: 48, daily: 30 };

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

function log(dir, message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  try { fs.appendFileSync(path.join(dir, 'backup.log'), line + '\n'); } catch { /* sem log em ficheiro */ }
}

async function main() {
  const typeArg = process.argv.find((a) => a.startsWith('--type='));
  const type = typeArg ? typeArg.split('=')[1] : '';
  if (!TYPES[type]) {
    console.error('ERRO: indicar --type=hourly ou --type=daily');
    process.exit(2);
  }

  const baseDir = process.env.BACKUP_DIR;
  if (!baseDir) {
    console.error('ERRO: BACKUP_DIR não está definido no .env do backend');
    process.exit(2);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error(`ERRO: base de dados não encontrada em ${DB_PATH}`);
    process.exit(2);
  }

  const keep = parseInt(process.env[TYPES[type]] || DEFAULT_KEEP[type], 10);
  const dir = path.join(baseDir, type);
  fs.mkdirSync(dir, { recursive: true });

  const finalPath = path.join(dir, `database_${type}_${stamp(new Date())}.sqlite`);
  const tmpPath = finalPath + '.tmp';

  try {
    const src = await open({ filename: DB_PATH, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });
    await src.run('PRAGMA busy_timeout = 10000');
    await src.run(`VACUUM INTO '${tmpPath.replace(/'/g, "''")}'`);
    await src.close();

    const copy = await open({ filename: tmpPath, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });
    const check = await copy.get('PRAGMA integrity_check');
    await copy.close();
    if (!check || check.integrity_check !== 'ok') {
      fs.rmSync(tmpPath, { force: true });
      throw new Error(`integrity_check falhou: ${JSON.stringify(check)}`);
    }

    fs.renameSync(tmpPath, finalPath);
    const size = fs.statSync(finalPath).size;

    const files = fs.readdirSync(dir)
      .filter((f) => f.startsWith(`database_${type}_`) && f.endsWith('.sqlite'))
      .sort();
    const toDelete = files.slice(0, Math.max(0, files.length - keep));
    for (const f of toDelete) fs.rmSync(path.join(dir, f), { force: true });

    log(baseDir, `OK ${type} ${path.basename(finalPath)} ${size} bytes; mantidas ${files.length - toDelete.length}, removidas ${toDelete.length}`);
  } catch (err) {
    fs.rmSync(tmpPath, { force: true });
    log(baseDir, `ERRO ${type} ${err.message}`);
    process.exit(1);
  }
}

main();
