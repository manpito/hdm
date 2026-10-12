// Envio cifrado da cópia diária para o servidor central (Hetzner), por SFTP.
// Uso:  node scripts/offsite.js                 -> cifra e envia a cópia diária mais recente
//       node scripts/offsite.js --generate-key  -> gera uma chave nova (guardar no .env e no gestor de senhas)
//
// A cópia é comprimida (gzip) e cifrada (AES-256-GCM) AQUI, antes de sair do servidor.
// A chave OFFSITE_KEY nunca é enviada para o servidor central: sem ela, os ficheiros lá guardados são ilegíveis.
// Formato .swbk: "SWBK" + versão (1 byte) + IV (12 bytes) + dados cifrados + tag GCM (16 bytes).
//
// Configuração no .env do backend:
//   BACKUP_DIR            pasta das cópias locais (a mesma de scripts/backup.js)
//   OFFSITE_KEY           chave em base64 (32 bytes), gerada com --generate-key
//   OFFSITE_HOST          endereço do servidor central
//   OFFSITE_PORT          porta SSH (22)
//   OFFSITE_USER          conta de depósito deste cliente (só SFTP, sem shell)
//   OFFSITE_SSH_KEY       caminho da chave privada SSH desta conta
//   OFFSITE_KNOWN_HOSTS   caminho do ficheiro known_hosts com a chave do servidor central
//   OFFSITE_TENANT        identificador do cliente no nome do ficheiro (ex.: soyo)
//   OFFSITE_SFTP          caminho do executável sftp (opcional)
import crypto from 'crypto';
import zlib from 'zlib';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.join(__dirname, '..');
dotenv.config({ path: path.join(BACKEND_DIR, '.env'), quiet: true });

export const MAGIC = Buffer.from('SWBK');
export const VERSION = 1;
export const IV_LEN = 12;
export const TAG_LEN = 16;
export const HEADER_LEN = MAGIC.length + 1 + IV_LEN;

const ATTEMPTS = 3;
const RETRY_WAIT_MS = 60_000;

export function parseKey(value) {
  if (!value) throw new Error('OFFSITE_KEY não está definida no .env do backend');
  const key = Buffer.from(String(value).trim(), 'base64');
  if (key.length !== 32) throw new Error('OFFSITE_KEY inválida: tem de ser base64 de 32 bytes (usar --generate-key)');
  return key;
}

function log(dir, message) {
  const line = `${new Date().toISOString()} OFFSITE ${message}`;
  console.log(line);
  try { fs.appendFileSync(path.join(dir, 'backup.log'), line + '\n'); } catch { /* sem log em ficheiro */ }
}

export async function encryptFile(src, dest, key) {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const out = fs.createWriteStream(dest);
  out.write(Buffer.concat([MAGIC, Buffer.from([VERSION]), iv]));
  await pipeline(fs.createReadStream(src), zlib.createGzip({ level: 9 }), cipher, out, { end: false });
  await new Promise((resolve, reject) => {
    out.end(cipher.getAuthTag(), (err) => (err ? reject(err) : resolve()));
  });
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`${name} não está definido no .env do backend`);
  return String(v).trim();
}

function sftpCommand() {
  if (process.env.OFFSITE_SFTP) return process.env.OFFSITE_SFTP;
  if (process.platform === 'win32') {
    const win = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'OpenSSH', 'sftp.exe');
    if (fs.existsSync(win)) return win;
  }
  return 'sftp';
}

function runSftp(batchFile, cwd) {
  const args = [
    '-b', batchFile,
    '-P', process.env.OFFSITE_PORT || '22',
    '-i', requireEnv('OFFSITE_SSH_KEY'),
    '-o', 'BatchMode=yes',
    '-o', 'IdentitiesOnly=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', `UserKnownHostsFile=${requireEnv('OFFSITE_KNOWN_HOSTS')}`,
    '-o', 'ConnectTimeout=30',
    '-o', 'ServerAliveInterval=15',
    `${requireEnv('OFFSITE_USER')}@${requireEnv('OFFSITE_HOST')}`,
  ];
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(sftpCommand(), args, { cwd, windowsHide: true });
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    child.on('error', (err) => resolve({ code: -1, output: err.message }));
    child.on('close', (code) => resolve({ code, output }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (process.argv.includes('--generate-key')) {
    console.log(crypto.randomBytes(32).toString('base64'));
    return;
  }

  const baseDir = process.env.BACKUP_DIR;
  if (!baseDir) {
    console.error('ERRO: BACKUP_DIR não está definido no .env do backend');
    process.exit(2);
  }

  const workDir = path.join(baseDir, 'offsite');
  const statePath = path.join(workDir, 'state.json');
  let encPath = null;
  let batchPath = null;

  try {
    const key = parseKey(process.env.OFFSITE_KEY);
    const tenant = requireEnv('OFFSITE_TENANT');
    if (!/^[a-z0-9-]{2,32}$/.test(tenant)) throw new Error('OFFSITE_TENANT inválido: só minúsculas, dígitos e hífen');
    requireEnv('OFFSITE_HOST');
    requireEnv('OFFSITE_USER');
    for (const name of ['OFFSITE_SSH_KEY', 'OFFSITE_KNOWN_HOSTS']) {
      if (!fs.existsSync(requireEnv(name))) throw new Error(`${name} aponta para um ficheiro que não existe`);
    }

    const dailyDir = path.join(baseDir, 'daily');
    const dailies = fs.existsSync(dailyDir)
      ? fs.readdirSync(dailyDir).filter((f) => /^database_daily_\d{8}_\d{6}\.sqlite$/.test(f)).sort()
      : [];
    if (dailies.length === 0) throw new Error(`nenhuma cópia diária encontrada em ${dailyDir}`);
    const latest = dailies[dailies.length - 1];

    fs.mkdirSync(workDir, { recursive: true });
    let state = {};
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { /* primeira execução */ }
    if (state.lastUploaded === latest) {
      log(baseDir, `nada a enviar: ${latest} já foi enviado em ${state.uploadedAt}`);
      return;
    }

    const remoteName = `${tenant}_${latest.replace(/\.sqlite$/, '')}.swbk`;
    encPath = path.join(workDir, remoteName);
    await encryptFile(path.join(dailyDir, latest), encPath, key);
    const size = fs.statSync(encPath).size;

    batchPath = path.join(workDir, 'upload.batch');
    fs.writeFileSync(batchPath, [
      `put "${remoteName}" "/incoming/${remoteName}.part"`,
      `rename "/incoming/${remoteName}.part" "/incoming/${remoteName}"`,
      '',
    ].join('\n'));

    let result;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      result = await runSftp(batchPath, workDir);
      if (result.code === 0) break;
      log(baseDir, `tentativa ${attempt}/${ATTEMPTS} falhou (código ${result.code}): ${result.output.trim().replace(/\s+/g, ' ').slice(0, 300)}`);
      if (attempt < ATTEMPTS) await sleep(RETRY_WAIT_MS);
    }
    if (result.code !== 0) throw new Error('envio falhou depois de todas as tentativas');

    fs.writeFileSync(statePath, JSON.stringify({ lastUploaded: latest, remoteName, size, uploadedAt: new Date().toISOString() }, null, 2));
    log(baseDir, `OK ${remoteName} ${size} bytes`);
  } catch (err) {
    log(baseDir, `ERRO ${err.message}`);
    process.exitCode = 1;
  } finally {
    if (encPath) fs.rmSync(encPath, { force: true });
    if (batchPath) fs.rmSync(batchPath, { force: true });
  }
}

const sameFile = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
if (process.argv[1] && sameFile(path.resolve(process.argv[1]), fileURLToPath(import.meta.url))) {
  main();
}
