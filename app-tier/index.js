require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./DbConfig');
const { ddb, GetCommand, PutCommand, DeleteCommand, notify } = require('./AwsClients');

const app = express();
app.use(express.json());

// --- Helpers ---
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Please log in again' }); }
}

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

// --- Health check for the ALB target group ---
app.get('/health', (_req, res) => res.send('ok'));

// --- Auth ---
app.post('/api/register', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a 6+ character password are required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await db.query('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', [name, email, hash]);
    notify({ type: 'USER_REGISTERED', userId: r.insertId, name, email });
    const token = jwt.sign({ id: r.insertId, name, email }, process.env.JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, name });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'That email is already registered' });
    throw e;
  }
}));

app.post('/api/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  const token = jwt.sign({ id: u.id, name: u.name, email: u.email }, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, name: u.name });
}));

// --- Products (RDS MySQL) ---
app.get('/api/products', wrap(async (_req, res) => {
  const [rows] = await db.query('SELECT id, name, description, price, image_url FROM products');
  res.json(rows);
}));

// --- Cart (DynamoDB: fast key-value, one item per user) ---
app.get('/api/cart', auth, wrap(async (req, res) => {
  const out = await ddb.send(new GetCommand({ TableName: process.env.CART_TABLE, Key: { userId: req.user.id } }));
  res.json(out.Item?.items || []);
}));

app.put('/api/cart', auth, wrap(async (req, res) => {
  const items = (req.body.items || []).map((i) => ({ productId: Number(i.productId), qty: Number(i.qty) })).filter((i) => i.qty > 0);
  await ddb.send(new PutCommand({ TableName: process.env.CART_TABLE, Item: { userId: req.user.id, items, updatedAt: new Date().toISOString() } }));
  res.json(items);
}));

// --- Orders (cart from DynamoDB -> order saved in MySQL) ---
app.post('/api/orders', auth, wrap(async (req, res) => {
  const cart = await ddb.send(new GetCommand({ TableName: process.env.CART_TABLE, Key: { userId: req.user.id } }));
  const items = cart.Item?.items || [];
  if (!items.length) return res.status(400).json({ error: 'Your cart is empty' });

  // Prices come from MySQL, never from the browser
  const [products] = await db.query('SELECT id, price FROM products WHERE id IN (?)', [items.map((i) => i.productId)]);
  const price = Object.fromEntries(products.map((p) => [p.id, Number(p.price)]));
  const lines = items.filter((i) => price[i.productId]);
  if (!lines.length) return res.status(400).json({ error: 'Your cart is empty' });
  const total = lines.reduce((s, i) => s + price[i.productId] * i.qty, 0);

  const conn = await db.getConnection();
  let orderId;
  try {
    await conn.beginTransaction();
    const [o] = await conn.query('INSERT INTO orders (user_id, total) VALUES (?, ?)', [req.user.id, total]);
    orderId = o.insertId;
    await conn.query('INSERT INTO order_items (order_id, product_id, qty, price) VALUES ?',
      [lines.map((i) => [orderId, i.productId, i.qty, price[i.productId]])]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

  await ddb.send(new DeleteCommand({ TableName: process.env.CART_TABLE, Key: { userId: req.user.id } }));
  notify({ type: 'ORDER_PLACED', userId: req.user.id, name: req.user.name, email: req.user.email, orderId, total });
  res.json({ orderId, total });
}));

app.get('/api/orders', auth, wrap(async (req, res) => {
  const [rows] = await db.query('SELECT id, total, created_at FROM orders WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
  res.json(rows);
}));

app.listen(process.env.PORT || 4000, () => console.log('App tier listening on', process.env.PORT || 4000));
