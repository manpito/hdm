import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDb } from './db.js';

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'smart-wallet-secret-key-123';
const db = await initDb();

// Middleware de Autenticação
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

// --- Autenticação ---
app.post('/api/auth/register', async (req, res) => {
  const { username, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    await db.run(
      'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
      [username, hashedPassword, role || 'operator']
    );
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await db.get('SELECT * FROM users WHERE username = ?', username);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET);
  res.json({ token, user: { username: user.username, role: user.role } });
});

// Criar utilizador admin padrão se não existir
const adminExists = await db.get('SELECT * FROM users WHERE username = ?', 'admin');
if (!adminExists) {
  const hashedAdminPassword = await bcrypt.hash('admin123', 10);
  await db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedAdminPassword, 'admin']);
}

// --- Produtos ---
app.get('/api/products', async (req, res) => {
  const products = await db.all('SELECT * FROM products');
  res.json(products);
});

app.post('/api/products', authenticateToken, async (req, res) => {
  const { name, price, stock_quantity } = req.body;
  const result = await db.run(
    'INSERT INTO products (name, price, stock_quantity) VALUES (?, ?, ?)',
    [name, price, stock_quantity]
  );
  res.status(201).json({ id: result.lastID, name, price, stock_quantity });
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, price, stock_quantity } = req.body;
  await db.run(
    'UPDATE products SET name = ?, price = ?, stock_quantity = ? WHERE id = ?',
    [name, price, stock_quantity, id]
  );
  res.json({ id, name, price, stock_quantity });
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  await db.run('DELETE FROM products WHERE id = ?', id);
  res.status(204).send();
});

// --- Cartões ---
app.get('/api/cards/:id', async (req, res) => {
  const { id } = req.params;
  const card = await db.get('SELECT * FROM cards WHERE id = ?', id);
  if (card) {
    res.json(card);
  } else {
    res.status(404).json({ error: 'Card not found' });
  }
});

app.post('/api/cards/recharge', authenticateToken, async (req, res) => {
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

// --- Transações ---
app.post('/api/transactions/bulk', authenticateToken, async (req, res) => {
  const { card_id, items } = req.body;

  try {
    await db.run('BEGIN TRANSACTION');

    const card = await db.get('SELECT * FROM cards WHERE id = ?', card_id);
    if (!card) {
      await db.run('ROLLBACK');
      return res.status(404).json({ error: 'Card not found' });
    }

    let totalCartPrice = 0;

    for (const item of items) {
      const product = await db.get('SELECT * FROM products WHERE id = ?', item.product_id);
      if (!product) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: `Product ${item.product_id} not found` });
      }

      if (product.stock_quantity < item.quantity) {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      const itemPrice = product.price * item.quantity;
      totalCartPrice += itemPrice;

      // Update stock
      await db.run('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?', [item.quantity, item.product_id]);

      // Record individual transaction
      await db.run(
        'INSERT INTO transactions (card_id, product_id, quantity, total_price) VALUES (?, ?, ?, ?)',
        [card_id, item.product_id, item.quantity, itemPrice]
      );
    }

    if (card.balance < totalCartPrice) {
      await db.run('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Update card balance
    await db.run('UPDATE cards SET balance = balance - ? WHERE id = ?', [totalCartPrice, card_id]);

    await db.run('COMMIT');
    res.status(201).json({ message: 'Transaction successful', total: totalCartPrice });

  } catch (error) {
    if (db) await db.run('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Transaction failed' });
  }
});

// --- Relatórios ---
app.get('/api/reports/sales', authenticateToken, async (req, res) => {
  const sales = await db.all(`
    SELECT t.*, p.name as product_name
    FROM transactions t
    JOIN products p ON t.product_id = p.id
    ORDER BY t.timestamp DESC
  `);
  res.json(sales);
});

app.get('/api/reports/low-stock', authenticateToken, async (req, res) => {
  const lowStock = await db.all('SELECT * FROM products WHERE stock_quantity < 5');
  res.json(lowStock);
});

app.get('/api/reports/consumption', authenticateToken, async (req, res) => {
  const daily = await db.all(`
    SELECT date(timestamp) as period, SUM(total_price) as total
    FROM transactions
    WHERE timestamp > date('now', '-30 days')
    GROUP BY period
    ORDER BY period DESC
  `);

  const weekly = await db.all(`
    SELECT strftime('%Y-W%W', timestamp) as period, SUM(total_price) as total
    FROM transactions
    WHERE timestamp > date('now', '-12 weeks')
    GROUP BY period
    ORDER BY period DESC
  `);

  const monthly = await db.all(`
    SELECT strftime('%Y-%m', timestamp) as period, SUM(total_price) as total
    FROM transactions
    WHERE timestamp > date('now', '-12 months')
    GROUP BY period
    ORDER BY period DESC
  `);

  res.json({ daily, weekly, monthly });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
