import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDb } from './db.js';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Mutex } from 'async-mutex';

dotenv.config();

const dbMutex = new Mutex();

const app = express();
app.set('trust proxy', 1);

// --- Erros em handlers assíncronos ---
// Encaminha para o middleware de erro global qualquer excepção ou Promise rejeitada
// num handler de rota, para que um erro numa query não derrube o processo Node.
const wrapAsync = (fn) => {
    if (typeof fn !== 'function' || fn.length === 4) return fn;
    return (req, res, next) => {
        try {
            const result = fn(req, res, next);
            if (result && typeof result.then === 'function') result.catch(next);
        } catch (err) {
            next(err);
        }
    };
};
for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const original = app[method].bind(app);
    app[method] = (path, ...handlers) => original(path, ...handlers.map(wrapAsync));
}
app.use(helmet());
const DEFAULT_CORS_ORIGINS = [
    'http://localhost:5174',
    'http://localhost:5173'
];
const CORS_ORIGINS = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : DEFAULT_CORS_ORIGINS;
console.log('CORS origins:', CORS_ORIGINS.join(', '));

app.use(cors({
    origin: CORS_ORIGINS,
    credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Para suportar imagens Base64

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('ERRO CRÍTICO: JWT_SECRET não está definido nas variáveis de ambiente.');
    process.exit(1);
}
const MAX_POS_TERMINALS = parseInt(process.env.MAX_POS_TERMINALS || '2');

const db = await initDb();

const withDb = async (fn) => {
    const release = await dbMutex.acquire();
    try {
        return await fn(db);
    } finally {
        release();
    }
};

// --- Helper de Auditoria ---
const logActionUnlocked = async (db, req, action, entity, entity_id, details, amount = null) => {
    const user = req.user;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    await db.run(
        'INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details, ip_address, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [user.id, user.username, action, entity, entity_id, details, ip, amount]
    );
};

const logAction = async (req, action, entity, entity_id, details, amount = null) => {
    await withDb(db => logActionUnlocked(db, req, action, entity, entity_id, details, amount));
};

// --- Middleware de Autenticação ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(401);
    req.user = user;
    next();
  });
};

const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado: permissões insuficientes.' });
    }
    next();
  };
};

// --- Autenticação ---
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas tentativas de login. Tente novamente em 15 minutos.' }
});

const failLogLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados pedidos.' }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username = ?', username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Utilizador desativado' });
  }

  // Lógica de Limite de Terminais para POS
  if (user.role === 'pos') {
    const terminal = await db.get('SELECT * FROM terminals WHERE id = ?', user.terminal_id);
    if (!terminal || !terminal.is_active) {
      return res.status(403).json({ error: 'Terminal associado não está ativo' });
    }

    const activePOSTerminals = await db.get('SELECT COUNT(DISTINCT terminal_id) as count FROM users WHERE role = "pos" AND is_active = 1');
    // Nota: Esta lógica é simplificada. Numa app real usaríamos uma tabela de sessões ativas.
    // Para este desafio, verificamos se o número de terminais configurados como ativos não excede o limite.
    const activeConfigs = await db.get('SELECT COUNT(*) as count FROM terminals WHERE is_active = 1');
    if (activeConfigs.count > MAX_POS_TERMINALS) {
      return res.status(403).json({ error: `Limite de terminais ativos excedido (Máx: ${MAX_POS_TERMINALS})` });
    }
  }

  const token = jwt.sign({
    id: user.id,
    username: user.username,
    role: user.role,
    terminal_id: user.terminal_id
  }, JWT_SECRET, { expiresIn: '8h' });

  // Log login (precisamos do IP e User ID, req.user ainda não existe aqui)
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  await withDb(db => db.run(
    'INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user.id, user.username, 'LOGIN_SUCCESS', 'user', user.id, 'Login efetuado com sucesso', ip]
  ));

  res.json({ token, user: { username: user.username, role: user.role, full_name: user.full_name } });
});

app.post('/api/auth/login-fail-log', failLogLimiter, async (req, res) => {
  const { username } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  await withDb(db => db.run(
    'INSERT INTO audit_logs (user_id, username, action, entity, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [0, username || 'unknown', 'LOGIN_FAILED', 'auth', null, 'Tentativa de login falhada', ip]
  ));
  res.status(200).send();
});

// --- Utilizadores (Apenas Admin) ---
app.get('/api/users', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const users = await db.all('SELECT id, username, role, full_name, terminal_id, is_active FROM users');
  res.json(users);
});

app.post('/api/users', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { username, password, role, full_name, terminal_id } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const result = await withDb(db => db.run(
      'INSERT INTO users (username, password, role, full_name, terminal_id, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [username, hashedPassword, role, full_name, terminal_id]
    ));
    await logAction(req, 'CREATE', 'user', result.lastID, `Criado utilizador: ${username}`);
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.put('/api/users/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  const { full_name, role, terminal_id, is_active, password } = req.body;

  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    await withDb(db => db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]));
  }

  await withDb(db => db.run(
    'UPDATE users SET full_name = ?, role = ?, terminal_id = ?, is_active = ? WHERE id = ?',
    [full_name, role, terminal_id, is_active, id]
  ));
  await logAction(req, 'UPDATE', 'user', id, `Editado utilizador: ${full_name}`);
  res.json({ message: 'User updated' });
});

// --- Terminais (Apenas Admin) ---
app.get('/api/terminals', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const terminals = await db.all('SELECT * FROM terminals');
  res.json(terminals);
});

app.post('/api/terminals', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { name, location } = req.body;
  const result = await withDb(db => db.run('INSERT INTO terminals (name, location, is_active) VALUES (?, ?, 1)', [name, location]));
  await logAction(req, 'CREATE', 'terminal', result.lastID, `Criado terminal: ${name}`);
  res.status(201).json({ id: result.lastID, name, location, is_active: 1 });
});

app.put('/api/terminals/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  const { name, location, is_active } = req.body;

  if (is_active === 1) {
    const activeCount = await db.get('SELECT COUNT(*) as count FROM terminals WHERE is_active = 1 AND id != ?', id);
    if (activeCount.count >= MAX_POS_TERMINALS) {
      return res.status(400).json({ error: `Não é possível ativar. Limite de ${MAX_POS_TERMINALS} terminais atingido.` });
    }
  }

  await withDb(db => db.run('UPDATE terminals SET name = ?, location = ?, is_active = ? WHERE id = ?', [name, location, is_active, id]));
  await logAction(req, is_active ? 'UPDATE' : 'DEACTIVATE', 'terminal', id, `Terminal ${name} atualizado`);
  res.json({ message: 'Terminal updated' });
});

// --- Validation Helper ---
function validateCategory(body, partial = false) {
    const { name, color, sort_order } = body;

    if (!partial || 'name' in body) {
        if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 50) {
            return { error: 'O nome da categoria deve ter entre 1 e 50 caracteres.' };
        }
    }
    if ('color' in body && color !== undefined && color !== null) {
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
            return { error: 'A cor deve estar no formato hexadecimal (ex: #2563eb).' };
        }
    }
    if ('sort_order' in body && sort_order !== undefined && sort_order !== null) {
        const order = Number(sort_order);
        if (!Number.isInteger(order) || order < 0) {
            return { error: 'A ordem (sort_order) deve ser um número inteiro maior ou igual a 0.' };
        }
    }

    return null;
}

// --- Produtos (Gestão: Admin | Listagem: Todos) ---
app.get('/api/products', authenticateToken, async (req, res) => {
  const products = await db.all('SELECT * FROM products');
  res.json(products);
});

app.post('/api/products', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { name, price, stock_quantity, image_base64, stock_minimum, category_id } = req.body;
  let finalCategoryId = null;

  if (category_id !== undefined && category_id !== null && category_id !== '') {
      finalCategoryId = Number(category_id);
      if (!Number.isInteger(finalCategoryId)) {
          return res.status(400).json({ error: 'Categoria inválida.' });
      }
  }

  try {
      const result = await withDb(async (db) => {
          if (finalCategoryId !== null) {
              const category = await db.get('SELECT id FROM categories WHERE id = ?', finalCategoryId);
              if (!category) {
                  throw { status: 400, message: 'Categoria inválida.' };
              }
          }

          const resDb = await db.run(
              'INSERT INTO products (name, price, stock_quantity, image_base64, stock_minimum, category_id) VALUES (?, ?, ?, ?, ?, ?)',
              [name, price, stock_quantity, image_base64, stock_minimum || 5, finalCategoryId]
          );
          await logActionUnlocked(db, req, 'CREATE', 'product', resDb.lastID, `Criado produto: ${name}`);
          return resDb;
      });
      res.status(201).json({ id: result.lastID, name, price, stock_quantity, category_id: finalCategoryId });
  } catch (error) {
      if (error.status) {
          return res.status(error.status).json({ error: error.message });
      }
      res.status(500).json({ error: 'Erro interno' });
  }
});

app.put('/api/products/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  const { name, price, stock_quantity, image_base64, stock_minimum } = req.body;

  try {
      await withDb(async (db) => {
          let updateQuery = 'UPDATE products SET name = ?, price = ?, stock_minimum = ?, image_base64 = ?';
          const queryParams = [name, price, stock_minimum, image_base64];

          if ('category_id' in req.body) {
              const { category_id } = req.body;
              let finalCategoryId = null;

              if (category_id !== undefined && category_id !== null && category_id !== '') {
                  finalCategoryId = Number(category_id);
                  if (!Number.isInteger(finalCategoryId)) {
                      throw { status: 400, message: 'Categoria inválida.' };
                  }
                  const category = await db.get('SELECT id FROM categories WHERE id = ?', finalCategoryId);
                  if (!category) {
                      throw { status: 400, message: 'Categoria inválida.' };
                  }
              }
              updateQuery += ', category_id = ?';
              queryParams.push(finalCategoryId);
          }

          updateQuery += ' WHERE id = ?';
          queryParams.push(id);

          await db.run(updateQuery, queryParams);
          await logActionUnlocked(db, req, 'UPDATE', 'product', id, `Produto ${name} atualizado`);
      });

      const updatedProduct = await withDb(db => db.get('SELECT * FROM products WHERE id = ?', id));
      res.json(updatedProduct);
  } catch (error) {
      if (error.status) {
          return res.status(error.status).json({ error: error.message });
      }
      res.status(500).json({ error: 'Erro interno' });
  }
});

app.delete('/api/products/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  const product = await db.get('SELECT name FROM products WHERE id = ?', id);
  await withDb(db => db.run('DELETE FROM products WHERE id = ?', [id]));
  await logAction(req, 'DELETE', 'product', id, `Eliminado produto: ${product?.name}`);
  res.status(204).send();
});

app.post('/api/products/:id/stock', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    const { id } = req.params;
    const delta = req.body.delta;

    if (!Number.isInteger(delta) || delta === 0) {
        return res.status(400).json({ error: 'delta deve ser um número inteiro diferente de zero' });
    }

    try {
        await withDb(async db => {
            const product = await db.get('SELECT * FROM products WHERE id = ?', id);
            if (!product) {
                const err = new Error('Produto não encontrado');
                err.status = 404;
                throw err;
            }

            const newStock = product.stock_quantity + delta;
            if (newStock < 0) {
                const err = new Error('Stock não pode ficar negativo');
                err.status = 400;
                throw err;
            }

            await db.run('UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?', [delta, id]);
        });
    } catch (err) {
        return res.status(err.status || 500).json({ error: err.message || 'Erro ao ajustar stock' });
    }

    const updatedProduct = await db.get('SELECT * FROM products WHERE id = ?', id);
    await logAction(req, 'STOCK_ADJUST', 'product', id, `Ajuste de stock: ${delta > 0 ? '+' : ''}${delta} un.`);
    res.json(updatedProduct);
});

// --- Cartões (Admin e Financeiro) ---
app.get('/api/cards', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { owner_name, is_active, entity } = req.query;
  let query = 'SELECT * FROM cards WHERE 1=1';
  const params = [];

  if (owner_name) {
    query += ' AND owner_name LIKE ?';
    params.push(`%${owner_name}%`);
  }
  if (is_active !== undefined && is_active !== '') {
    query += ' AND is_active = ?';
    params.push(is_active);
  }
  if (entity) {
    query += ' AND entity = ?';
    params.push(entity);
  }

  const cards = await db.all(query, params);
  res.json(cards);
});

app.get('/api/cards/:id', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { id } = req.params;
  const card = await db.get('SELECT * FROM cards WHERE id = ?', id);
  if (card) res.json(card);
  else res.status(404).json({ error: 'Cartão não encontrado' });
});

app.post('/api/cards', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { id, owner_name, entity, price_paid } = req.body;
  try {
    await withDb(db => db.run(
      'INSERT INTO cards (id, owner_name, entity, price_paid, balance, is_active) VALUES (?, ?, ?, ?, 0, 1)',
      [id, owner_name, entity, price_paid]
    ));
    await logAction(req, 'ISSUE_CARD', 'card', id, `Emissão de cartão para ${owner_name}`);
    res.status(201).json({ id, owner_name, entity, price_paid });
  } catch (err) {
    res.status(400).json({ error: 'Erro ao emitir cartão (UID duplicado?)' });
  }
});

app.put('/api/cards/:id/cancel', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { id } = req.params;
  const card = await db.get('SELECT * FROM cards WHERE id = ?', id);
  if (!card) return res.status(404).json({ error: 'Cartão não encontrado' });

  await withDb(db => db.run('UPDATE cards SET is_active = 0, balance = 0 WHERE id = ?', [id]));
  await logAction(req, 'CANCEL_CARD', 'card', id, `Cartão de ${card.owner_name} cancelado`);
  res.json({ message: 'Cartão cancelado' });
});

app.put('/api/cards/:id/edit', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
    const { id } = req.params;
    const { owner_name, entity } = req.body;
    const card = await db.get('SELECT * FROM cards WHERE id = ?', id);
    if (!card) return res.status(404).json({ error: 'Cartão não encontrado' });
    await withDb(db => db.run('UPDATE cards SET owner_name = ?, entity = ? WHERE id = ?', [owner_name, entity, id]));
    await logAction(req, 'UPDATE_CARD', 'card', id, `Cartão actualizado: nome="${owner_name}", entidade="${entity}"`);
    res.json({ message: 'Cartão actualizado' });
});

app.post('/api/cards/transfer', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
    const { old_id, new_id } = req.body;

    const release = await dbMutex.acquire();
    try {
        await db.run('BEGIN TRANSACTION');

        const oldCard = await db.get('SELECT * FROM cards WHERE id = ?', [old_id]);
        if (!oldCard || oldCard.is_active !== 1) {
            await db.run('ROLLBACK');
            return res.status(400).json({ error: 'Cartão antigo não encontrado ou não está activo' });
        }

        const newCard = await db.get('SELECT * FROM cards WHERE id = ?', [new_id]);
        if (!newCard || newCard.is_active !== 1) {
            await db.run('ROLLBACK');
            return res.status(400).json({ error: 'Cartão novo não encontrado ou não está activo' });
        }

        if (old_id === new_id) {
            await db.run('ROLLBACK');
            return res.status(400).json({ error: 'Os cartões devem ser diferentes' });
        }

        const transferred_balance = oldCard.balance;
        const new_balance = newCard.balance + transferred_balance;

        await db.run('UPDATE cards SET is_active = 0, balance = 0 WHERE id = ?', [old_id]);
        await db.run('UPDATE cards SET balance = ? WHERE id = ?', [new_balance, new_id]);

        await logActionUnlocked(db, req, 'TRANSFER_OUT', 'card', old_id, transferred_balance);
        await logActionUnlocked(db, req, 'TRANSFER_IN', 'card', new_id, transferred_balance);

        await db.run('COMMIT');
        res.json({ message: 'Saldo transferido', transferred_balance, new_balance });
    } catch (err) {
        await db.run('ROLLBACK');
        res.status(500).json({ error: 'Erro na transferência' });
    } finally {
        release();
    }
});

app.post('/api/cards/recharge', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { id } = req.body;
  const amount = Number(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'O valor de carregamento deve ser um número positivo' });
  }

  const release = await dbMutex.acquire();
  try {
    const card = await db.get('SELECT * FROM cards WHERE id = ?', id);
    if (card) {
      await db.run('UPDATE cards SET balance = balance + ?, is_active = 1 WHERE id = ?', [amount, id]);
      const updatedCard = await db.get('SELECT balance FROM cards WHERE id = ?', id);
      await logActionUnlocked(db, req, 'RECHARGE', 'card', id, `Carregamento de ${amount} un.`, amount);
      res.json({ id, balance: updatedCard.balance });
    } else {
      // Caso de uso: Carregamento de cartão não emitido previamente (legado ou simplificado)
      await db.run('INSERT INTO cards (id, balance, is_active) VALUES (?, ?, 1)', [id, amount]);
      await logActionUnlocked(db, req, 'CREATE_RECHARGE', 'card', id, `Novo cartão carregado com ${amount} un.`, amount);
      res.json({ id, balance: amount });
    }
  } catch (err) {
      res.status(500).json({ error: 'Erro no carregamento' });
  } finally {
      release();
  }
});

app.post('/api/cards/bulk-import', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { cards } = req.body;
  if (!Array.isArray(cards)) {
    return res.status(400).json({ error: 'Lista de cartões inválida' });
  }

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  const release = await dbMutex.acquire();
  try {
    await db.run('BEGIN TRANSACTION');
    for (const card of cards) {
      try {
        const { uid, owner_name, entity, balance, price_paid } = card;
        await db.run(
          'INSERT INTO cards (id, owner_name, entity, price_paid, balance, is_active) VALUES (?, ?, ?, ?, ?, 1)',
          [uid, owner_name, entity, price_paid, balance]
        );
        // Regista nos audit_logs como "Migração de Sistema"
        await logActionUnlocked(db, req, 'RECHARGE', 'card', uid, 'Migração de Sistema', balance);
        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({ uid: card.uid, error: 'UID duplicado ou erro na BD' });
      }
    }
    await db.run('COMMIT');
    res.json(results);
  } catch (err) {
    await db.run('ROLLBACK');
    res.status(500).json({ error: 'Erro na importação' });
  } finally {
    release();
  }
});

// --- Vendas (POS e Admin) ---
app.post('/api/sales', authenticateToken, authorizeRoles(['pos', 'admin']), async (req, res) => {
  const { card_id, items } = req.body;
  const terminal_id = req.user.terminal_id;

  // Validação dos items
  if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items deve ser um array não vazio' });
  }

  for (const item of items) {
      if (!Number.isInteger(item.product_id) || item.product_id <= 0) {
          return res.status(400).json({ error: 'Cada item deve ter um product_id numérico válido' });
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          return res.status(400).json({ error: 'A quantidade de cada item deve ser um número inteiro positivo' });
      }
  }

  if (!card_id || typeof card_id !== 'string' || card_id.trim() === '') {
      return res.status(400).json({ error: 'card_id inválido' });
  }

  const release = await dbMutex.acquire();
  try {
    await db.run('BEGIN TRANSACTION');
    const card = await db.get('SELECT * FROM cards WHERE id = ?', card_id);
    if (!card) {
      await db.run('ROLLBACK');
      return res.status(404).json({ error: 'Cartão não encontrado' });
    }

    let totalCartPrice = 0;
    let lastSaleId = null;
    for (const item of items) {
      const product = await db.get('SELECT * FROM products WHERE id = ?', item.product_id);
      if (!product || product.stock_quantity < item.quantity) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Stock insuficiente para ${product?.name || 'produto'}` });
      }
      const itemPrice = product.price * item.quantity;
      totalCartPrice += itemPrice;
      await db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.quantity, item.product_id]);
      const result = await db.run(
        'INSERT INTO sales (card_id, product_id, quantity, total_price, terminal_id) VALUES (?, ?, ?, ?, ?)',
        [card_id, item.product_id, item.quantity, itemPrice, terminal_id]
      );
      lastSaleId = result.lastID;
    }

    if (card.balance < totalCartPrice) {
      await db.run('ROLLBACK');
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    const newBalance = card.balance - totalCartPrice;
    await db.run('UPDATE cards SET balance = ? WHERE id = ?', [newBalance, card_id]);
    await db.run('COMMIT');
    await logActionUnlocked(db, req, 'SALE', 'sale', card_id, `Venda realizada: ${totalCartPrice.toFixed(2)} un. no cartão ${card_id}`, totalCartPrice);
    res.status(201).json({
      message: 'Venda realizada com sucesso',
      id: lastSaleId,
      total_charged: totalCartPrice,
      remaining_balance: newBalance
    });
  } catch (error) {
    await db.run('ROLLBACK');
    res.status(500).json({ error: 'Erro no processamento da venda' });
  } finally {
    release();
  }
});

// --- Categorias ---
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const categories = await db.all('SELECT * FROM categories ORDER BY sort_order ASC, name ASC');
        res.json(categories);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro interno ao processar categoria.' });
    }
});

app.post('/api/categories', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const validationError = validateCategory(req.body);
        if (validationError) {
            return res.status(400).json(validationError);
        }

        const { name, color, sort_order } = req.body;
        const trimmedName = name.trim();
        const finalColor = color || '#2563eb';
        const finalSortOrder = sort_order !== undefined ? Number(sort_order) : 0;

        await withDb(async (db) => {
            const existing = await db.get('SELECT id FROM categories WHERE name = ? COLLATE NOCASE', trimmedName);
            if (existing) {
                throw { status: 409, message: 'Já existe uma categoria com esse nome.' };
            }

            const result = await db.run(
                'INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)',
                [trimmedName, finalColor, finalSortOrder]
            );
            await logActionUnlocked(db, req, 'CREATE', 'category', result.lastID, `Criada categoria: ${trimmedName}`);

            res.status(201).json({ id: result.lastID, name: trimmedName, color: finalColor, sort_order: finalSortOrder });
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro interno ao processar categoria.' });
    }
});

app.put('/api/categories/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const validationError = validateCategory(req.body, true);
        if (validationError) {
            return res.status(400).json(validationError);
        }

        await withDb(async (db) => {
            const category = await db.get('SELECT * FROM categories WHERE id = ?', id);
            if (!category) {
                throw { status: 404, message: 'Categoria não encontrada.' };
            }

            const { name, color, sort_order } = req.body;
            const newName = name !== undefined ? name.trim() : category.name;
            const newColor = color !== undefined ? color : category.color;
            const newSortOrder = sort_order !== undefined ? Number(sort_order) : category.sort_order;

            if (name !== undefined) {
                const duplicate = await db.get('SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id <> ?', [newName, id]);
                if (duplicate) {
                    throw { status: 409, message: 'Já existe outra categoria com esse nome.' };
                }
            }

            await db.run(
                'UPDATE categories SET name = ?, color = ?, sort_order = ? WHERE id = ?',
                [newName, newColor, newSortOrder, id]
            );
            await logActionUnlocked(db, req, 'UPDATE', 'category', id, `Categoria ${newName} actualizada`);

            const updatedCategory = await db.get('SELECT * FROM categories WHERE id = ?', id);
            res.json(updatedCategory);
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro interno ao processar categoria.' });
    }
});

app.delete('/api/categories/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
    try {
        const { id } = req.params;

        await withDb(async (db) => {
            const category = await db.get('SELECT * FROM categories WHERE id = ?', id);
            if (!category) {
                throw { status: 404, message: 'Categoria não encontrada.' };
            }

            const countResult = await db.get('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', id);
            const n = countResult.n;

            if (n > 0) {
                throw { status: 409, message: `A categoria tem ${n} produto(s) associado(s). Reatribua-os antes de eliminar.` };
            }

            await db.run('DELETE FROM categories WHERE id = ?', id);
            await logActionUnlocked(db, req, 'DELETE', 'category', id, `Eliminada categoria: ${category.name}`);

            res.status(204).send();
        });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ error: error.message });
        }
        console.error(error);
        res.status(500).json({ error: 'Erro interno ao processar categoria.' });
    }
});

// --- Relatórios (Admin e Financeiro) ---
app.get('/api/reports/dashboard', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const salesToday = await db.get("SELECT SUM(total_price) as total FROM sales WHERE date(timestamp) = date('now')");
  // Dashboard low stock now checks product-specific threshold
  const lowStock = await db.get("SELECT COUNT(*) as count FROM products WHERE stock_quantity < stock_minimum");
  const activeTerminals = await db.get("SELECT COUNT(*) as count FROM terminals WHERE is_active = 1");
  const rechargeToday = await db.get("SELECT COUNT(*) as count FROM cards WHERE date(created_at) = date('now')"); // Emissões hoje (ou usar logs)

  res.json({
    salesToday: salesToday.total || 0,
    lowStock: lowStock.count,
    activeTerminals: activeTerminals.count,
    maxTerminals: MAX_POS_TERMINALS,
    rechargeToday: rechargeToday.count
  });
});

app.get('/api/reports/sales-general', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { dateFrom, dateTo, terminalId, productId } = req.query;
  let query = `
    SELECT s.*, p.name as product_name, t.name as terminal_name
    FROM sales s
    JOIN products p ON s.product_id = p.id
    LEFT JOIN terminals t ON s.terminal_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (dateFrom) { query += ' AND s.timestamp >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND s.timestamp <= ?'; params.push(dateTo + ' 23:59:59'); }
  if (terminalId) { query += ' AND s.terminal_id = ?'; params.push(terminalId); }
  if (productId) { query += ' AND s.product_id = ?'; params.push(productId); }

  query += ' ORDER BY s.timestamp DESC';
  const sales = await db.all(query, params);
  res.json(sales);
});

app.get('/api/reports/sales-by-product', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  let query = `
    SELECT p.name, SUM(s.quantity) as quantity, SUM(s.total_price) as total
    FROM sales s
    JOIN products p ON s.product_id = p.id
    WHERE 1=1
  `;
  const params = [];

  if (dateFrom) { query += ' AND s.timestamp >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND s.timestamp <= ?'; params.push(dateTo + ' 23:59:59'); }

  query += ' GROUP BY p.id ORDER BY total DESC';
  const sales = await db.all(query, params);
  res.json(sales);
});

app.get('/api/reports/card-statement', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { cardId, dateFrom, dateTo } = req.query;
  if (!cardId) return res.status(400).json({ error: 'UID do cartão é obrigatório' });

  const card = await db.get('SELECT * FROM cards WHERE id = ?', cardId);
  if (!card) return res.status(404).json({ error: 'Cartão não encontrado' });

  let query = `
    SELECT s.*, p.name as product_name, t.name as terminal_name
    FROM sales s
    JOIN products p ON s.product_id = p.id
    LEFT JOIN terminals t ON s.terminal_id = t.id
    WHERE s.card_id = ?
  `;
  const params = [cardId];

  if (dateFrom) { query += ' AND s.timestamp >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND s.timestamp <= ?'; params.push(dateTo + ' 23:59:59'); }

  query += ' ORDER BY s.timestamp DESC';
  const sales = await db.all(query, params);

  res.json({
    card,
    sales
  });
});

app.get('/api/reports/reconciliation', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  // Total carregado (Histórico nos audit_logs para RECHARGE e CREATE_RECHARGE usando coluna amount)
  const recharges = await db.get(`
    SELECT SUM(amount) as total
    FROM audit_logs
    WHERE action IN ('RECHARGE', 'CREATE_RECHARGE')
  `);
  // Total vendido
  const sales = await db.get('SELECT SUM(total_price) as total FROM sales');
  // Soma dos saldos atuais
  const balances = await db.get('SELECT SUM(balance) as total FROM cards WHERE is_active = 1');

  const totalRecharged = recharges.total || 0;
  const totalSold = sales.total || 0;
  const currentBalances = balances.total || 0;
  const discrepancy = totalRecharged - (totalSold + currentBalances);

  res.json({
    totalRecharged,
    totalSold,
    currentBalances,
    discrepancy,
    isBalanced: Math.abs(discrepancy) < 0.01
  });
});

app.get('/api/audit-logs', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { page = 1, limit = 20, dateFrom, dateTo, username, action } = req.query;
  const offset = (page - 1) * limit;

  let query = 'FROM audit_logs WHERE 1=1';
  const params = [];

  if (dateFrom) { query += ' AND timestamp >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND timestamp <= ?'; params.push(dateTo + ' 23:59:59'); }
  if (username) { query += ' AND username = ?'; params.push(username); }
  if (action) { query += ' AND action = ?'; params.push(action); }

  const total = await db.get('SELECT COUNT(*) as count ' + query, params);
  const logs = await db.all('SELECT * ' + query + ' ORDER BY timestamp DESC LIMIT ? OFFSET ?', [...params, limit, offset]);

  res.json({
    logs,
    total: total.count,
    pages: Math.ceil(total.count / limit)
  });
});

app.get('/api/reports/recharges', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { dateFrom, dateTo, userId, entity } = req.query;
  let query = `
    SELECT al.timestamp, al.entity_id as card_id, c.owner_name, al.amount, al.username, c.entity
    FROM audit_logs al
    JOIN cards c ON al.entity_id = c.id
    WHERE al.action IN ('RECHARGE', 'CREATE_RECHARGE')
  `;
  const params = [];

  if (dateFrom) { query += ' AND al.timestamp >= ?'; params.push(dateFrom); }
  if (dateTo) { query += ' AND al.timestamp <= ?'; params.push(dateTo + ' 23:59:59'); }
  if (userId) { query += ' AND al.user_id = ?'; params.push(userId); }
  if (entity) { query += ' AND c.entity = ?'; params.push(entity); }

  query += ' ORDER BY al.timestamp DESC';
  const recharges = await db.all(query, params);
  res.json(recharges);
});

app.get('/api/settings', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const settings = await db.all('SELECT * FROM settings');
  const config = {};
  settings.forEach(s => config[s.key] = s.value);
  config.maxPosTerminals = MAX_POS_TERMINALS;
  res.json(config);
});

app.put('/api/settings', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    if (key !== 'maxPosTerminals') { // Protegido via ENV
      await withDb(db => db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]));
    }
  }
  await logAction(req, 'UPDATE', 'settings', 'global', 'Definições do sistema atualizadas');
  res.json({ message: 'Settings updated' });
});

// --- Middleware de erro global (tem de ficar depois de todas as rotas) ---
app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Pedido inválido (JSON mal formado).' });
    }
    console.error(`[ERRO] ${req.method} ${req.originalUrl}:`, err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Erro interno do servidor.' });
});

process.on('unhandledRejection', (reason) => {
    console.error('[ERRO] Promise rejeitada sem tratamento:', reason);
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});
