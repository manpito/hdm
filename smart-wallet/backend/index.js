import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDb } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Para suportar imagens Base64

const JWT_SECRET = process.env.JWT_SECRET || 'smart-wallet-secret-key-123';
const MAX_POS_TERMINALS = parseInt(process.env.MAX_POS_TERMINALS || '2');

const db = await initDb();

// --- Middleware de Autenticação ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
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
app.post('/api/auth/login', async (req, res) => {
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
  }, JWT_SECRET);

  res.json({ token, user: { username: user.username, role: user.role, full_name: user.full_name } });
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
    await db.run(
      'INSERT INTO users (username, password, role, full_name, terminal_id, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [username, hashedPassword, role, full_name, terminal_id]
    );
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
    await db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
  }

  await db.run(
    'UPDATE users SET full_name = ?, role = ?, terminal_id = ?, is_active = ? WHERE id = ?',
    [full_name, role, terminal_id, is_active, id]
  );
  res.json({ message: 'User updated' });
});

// --- Terminais (Apenas Admin) ---
app.get('/api/terminals', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const terminals = await db.all('SELECT * FROM terminals');
  res.json(terminals);
});

app.post('/api/terminals', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { name, location } = req.body;
  const result = await db.run('INSERT INTO terminals (name, location, is_active) VALUES (?, ?, 1)', [name, location]);
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

  await db.run('UPDATE terminals SET name = ?, location = ?, is_active = ? WHERE id = ?', [name, location, is_active, id]);
  res.json({ message: 'Terminal updated' });
});

// --- Produtos (Gestão: Admin | Listagem: Todos) ---
app.get('/api/products', authenticateToken, async (req, res) => {
  const products = await db.all('SELECT * FROM products');
  res.json(products);
});

app.post('/api/products', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { name, price, stock_quantity, image_base64 } = req.body;
  const result = await db.run(
    'INSERT INTO products (name, price, stock_quantity, image_base64) VALUES (?, ?, ?, ?)',
    [name, price, stock_quantity, image_base64]
  );
  res.status(201).json({ id: result.lastID, name, price, stock_quantity });
});

app.put('/api/products/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  const { name, price, stock_quantity, image_base64 } = req.body;
  await db.run(
    'UPDATE products SET name = ?, price = ?, stock_quantity = ?, image_base64 = ? WHERE id = ?',
    [name, price, stock_quantity, image_base64, id]
  );
  res.json({ id, name, price, stock_quantity });
});

app.delete('/api/products/:id', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  const { id } = req.params;
  await db.run('DELETE FROM products WHERE id = ?', id);
  res.status(204).send();
});

// --- Cartões (Admin e Financeiro) ---
app.get('/api/cards/:id', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { id } = req.params;
  const card = await db.get('SELECT * FROM cards WHERE id = ?', id);
  if (card) res.json(card);
  else res.status(404).json({ error: 'Cartão não encontrado' });
});

app.post('/api/cards/recharge', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const { id, amount } = req.body;
  const card = await db.get('SELECT * FROM cards WHERE id = ?', id);
  if (card) {
    const newBalance = card.balance + amount;
    await db.run('UPDATE cards SET balance = ? WHERE id = ?', [newBalance, id]);
    res.json({ id, balance: newBalance });
  } else {
    await db.run('INSERT INTO cards (id, balance) VALUES (?, ?)', [id, amount]);
    res.json({ id, balance: amount });
  }
});

// --- Vendas (POS e Admin) ---
app.post('/api/sales', authenticateToken, authorizeRoles(['pos', 'admin']), async (req, res) => {
  const { card_id, items } = req.body;
  const terminal_id = req.user.terminal_id;

  try {
    await db.run('BEGIN TRANSACTION');
    const card = await db.get('SELECT * FROM cards WHERE id = ?', card_id);
    if (!card) {
      await db.run('ROLLBACK');
      return res.status(404).json({ error: 'Cartão não encontrado' });
    }

    let totalCartPrice = 0;
    for (const item of items) {
      const product = await db.get('SELECT * FROM products WHERE id = ?', item.product_id);
      if (!product || product.stock_quantity < item.quantity) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Stock insuficiente para ${product?.name || 'produto'}` });
      }
      const itemPrice = product.price * item.quantity;
      totalCartPrice += itemPrice;
      await db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.quantity, item.product_id]);
      await db.run(
        'INSERT INTO sales (card_id, product_id, quantity, total_price, terminal_id) VALUES (?, ?, ?, ?, ?)',
        [card_id, item.product_id, item.quantity, itemPrice, terminal_id]
      );
    }

    if (card.balance < totalCartPrice) {
      await db.run('ROLLBACK');
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    await db.run('UPDATE cards SET balance = balance - ? WHERE id = ?', [totalCartPrice, card_id]);
    await db.run('COMMIT');
    res.status(201).json({ message: 'Venda realizada com sucesso' });
  } catch (error) {
    await db.run('ROLLBACK');
    res.status(500).json({ error: 'Erro no processamento da venda' });
  }
});

// --- Relatórios (Admin e Financeiro) ---
app.get('/api/reports/dashboard', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const salesToday = await db.get("SELECT SUM(total_price) as total FROM sales WHERE date(timestamp) = date('now')");
  const lowStock = await db.get("SELECT COUNT(*) as count FROM products WHERE stock_quantity < 10");
  const activeTerminals = await db.get("SELECT COUNT(*) as count FROM terminals WHERE is_active = 1");
  const rechargeToday = await db.get("SELECT COUNT(*) as count FROM cards WHERE balance > 0"); // Simplificado

  res.json({
    salesToday: salesToday.total || 0,
    lowStock: lowStock.count,
    activeTerminals: activeTerminals.count,
    maxTerminals: MAX_POS_TERMINALS,
    rechargeToday: rechargeToday.count
  });
});

app.get('/api/reports/sales-general', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const sales = await db.all(`
    SELECT s.*, p.name as product_name, t.name as terminal_name
    FROM sales s
    JOIN products p ON s.product_id = p.id
    LEFT JOIN terminals t ON s.terminal_id = t.id
    ORDER BY s.timestamp DESC
  `);
  res.json(sales);
});

app.get('/api/reports/sales-by-product', authenticateToken, authorizeRoles(['admin', 'financeiro']), async (req, res) => {
  const sales = await db.all(`
    SELECT p.name, SUM(s.quantity) as quantity, SUM(s.total_price) as total
    FROM sales s
    JOIN products p ON s.product_id = p.id
    GROUP BY p.id
    ORDER BY total DESC
  `);
  res.json(sales);
});

app.get('/api/settings', authenticateToken, authorizeRoles(['admin']), async (req, res) => {
  res.json({
    installationName: 'SmartWallet Central',
    stockThreshold: 10,
    maxPosTerminals: MAX_POS_TERMINALS
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
