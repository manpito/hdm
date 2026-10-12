// Decifra uma cópia .swbk enviada para o servidor central e verifica a base de dados resultante.
// Uso: node scripts/offsite-decrypt.js <ficheiro.swbk> <destino.sqlite>
// Precisa da mesma OFFSITE_KEY usada no envio (no .env do backend ou na variável de ambiente).
// Não toca na base de dados em uso: o destino tem de ser um ficheiro novo.
import crypto from 'crypto';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { MAGIC, VERSION, IV_LEN, TAG_LEN, HEADER_LEN, parseKey } from './offsite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

export async function decryptFile(src, dest, key) {
  const size = fs.statSync(src).size;
  if (size < HEADER_LEN + TAG_LEN) throw new Error('ficheiro demasiado pequeno para ser uma cópia .swbk');

  const fd = fs.openSync(src, 'r');
  const header = Buffer.alloc(HEADER_LEN);
  const tag = Buffer.alloc(TAG_LEN);
  fs.readSync(fd, header, 0, HEADER_LEN, 0);
  fs.readSync(fd, tag, 0, TAG_LEN, size - TAG_LEN);
  fs.closeSync(fd);

  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('não é um ficheiro .swbk do SmartWallet');
  if (header[MAGIC.length] !== VERSION) throw new Error(`versão de ficheiro não suportada: ${header[MAGIC.length]}`);
  const iv = header.subarray(MAGIC.length + 1, MAGIC.length + 1 + IV_LEN);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const tmp = dest + '.tmp';
  try {
    await pipeline(
      fs.createReadStream(src, { start: HEADER_LEN, end: size - TAG_LEN - 1 }),
      decipher,
      zlib.createGunzip(),
      fs.createWriteStream(tmp),
    );
  } catch (err) {
    fs.rmSync(tmp, { force: true });
    if (/auth/i.test(err.message)) throw new Error('chave errada ou ficheiro alterado/corrompido (autenticação GCM falhou)');
    throw err;
  }
  fs.renameSync(tmp, dest);
}

async function main() {
  const [src, dest] = process.argv.slice(2);
  if (!src || !dest) {
    console.error('Uso: node scripts/offsite-decrypt.js <ficheiro.swbk> <destino.sqlite>');
    process.exit(2);
  }
  try {
    if (!fs.existsSync(src)) throw new Error(`ficheiro não encontrado: ${src}`);
    if (fs.existsSync(dest)) throw new Error(`o destino já existe, escolha outro nome: ${dest}`);
    await decryptFile(src, dest, parseKey(process.env.OFFSITE_KEY));

    const db = await open({ filename: dest, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });
    const check = await db.get('PRAGMA integrity_check');
    const cards = await db.get('SELECT COUNT(*) AS n FROM cards');
    const sales = await db.get('SELECT COUNT(*) AS n, MAX(timestamp) AS last FROM sales');
    await db.close();
    if (!check || check.integrity_check !== 'ok') throw new Error(`integrity_check falhou: ${JSON.stringify(check)}`);

    console.log(`OK ${dest}`);
    console.log(`integrity_check: ok | cartões: ${cards.n} | vendas: ${sales.n} | última venda: ${sales.last ?? '—'}`);
  } catch (err) {
    console.error(`ERRO ${err.message}`);
    process.exit(1);
  }
}

const sameFile = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
if (process.argv[1] && sameFile(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  main();
}
