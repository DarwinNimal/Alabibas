// Drop-in admin: stock management + seller<->customer chat.
// Usage:  require('./admin-module')(app, httpServer)
const crypto = require('crypto');
const express = require('express');
const Database = require('better-sqlite3');
const { Server } = require('socket.io');

const SECRET = process.env.ADMIN_SECRET || 'change-me';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '12345';
const sign = v => crypto.createHmac('sha256', SECRET).update(v).digest('hex');

const parseCookies = h => Object.fromEntries((h || '').split(';').map(c => c.trim()).filter(Boolean)
  .map(c => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));

function isAdmin(cookies) {
  const [exp, sig] = (cookies.admin_token || '').split('.');
  return !!exp && sig === sign(exp) && Number(exp) > Date.now();
}

// TODO: replace with YOUR real login/session. Must return {id, name} or null.
function getCustomer(cookies) {
  return cookies.uid ? { id: String(cookies.uid), name: cookies.uname || 'Customer' } : null;
}

module.exports = function mountAdmin(app, httpServer) {
  const db = new Database(process.env.DB_PATH || 'alabibas.db');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products(
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      stock_type TEXT NOT NULL DEFAULT 'limited' CHECK(stock_type IN('limited','unlimited')),
      quantity INTEGER NOT NULL DEFAULT 0, sold_count INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT NOT NULL, customer_name TEXT,
      sender TEXT NOT NULL, text TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);`);

  // Call this from your checkout too. Returns false if not enough stock.
  const recordSale = (id, qty = 1) => {
    const p = db.prepare('SELECT stock_type FROM products WHERE id=?').get(id);
    if (!p) return false;
    if (p.stock_type === 'unlimited')
      return db.prepare('UPDATE products SET sold_count=sold_count+? WHERE id=?').run(qty, id).changes > 0;
    return db.prepare('UPDATE products SET quantity=quantity-?, sold_count=sold_count+? WHERE id=? AND quantity>=?')
      .run(qty, qty, id, qty).changes > 0;   // atomic: can't oversell
  };
  app.locals.recordSale = recordSale;

  const requireAdmin = (req, res, next) =>
    isAdmin(parseCookies(req.headers.cookie)) ? next() : res.status(401).json({ error: 'Admin login required' });

  // ---- auth ----
  app.post('/api/admin/login', express.json(), (req, res) => {
    const { user, pass } = req.body || {};
    if (user !== ADMIN_USER || pass !== ADMIN_PASS) return res.status(401).json({ error: 'Wrong username or password' });
    const exp = String(Date.now() + 12 * 3600 * 1000);
    res.cookie('admin_token', `${exp}.${sign(exp)}`, { httpOnly: true, sameSite: 'strict', secure: !!process.env.RAILWAY_ENVIRONMENT, maxAge: 12 * 3600 * 1000 });
    res.json({ ok: true });
  });
  app.post('/api/admin/logout', (req, res) => { res.clearCookie('admin_token'); res.json({ ok: true }); });

  // ---- guard the admin page itself (login.html stays public) ----
  const adminDir = require('path').join(__dirname, 'public', 'admin');
  app.get(['/admin', '/admin/', '/admin/index.html'], (req, res) =>
    isAdmin(parseCookies(req.headers.cookie)) ? res.sendFile(adminDir + '/index.html') : res.redirect('/admin/login.html'));
  app.use('/admin', express.static(adminDir, { index: false }));

  // ---- stock ----
  const api = express.Router(); api.use(requireAdmin, express.json());
  api.get('/products', (_, res) => res.json(db.prepare('SELECT * FROM products ORDER BY id DESC').all()));
  api.post('/products', (req, res) => {
    const { name, stock_type = 'limited', quantity = 0 } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const r = db.prepare('INSERT INTO products(name,stock_type,quantity) VALUES(?,?,?)')
      .run(name, stock_type === 'unlimited' ? 'unlimited' : 'limited', Math.max(0, +quantity || 0));
    res.json({ id: r.lastInsertRowid });
  });
  api.patch('/products/:id', (req, res) => {
    const { name, stock_type, quantity } = req.body;
    db.prepare('UPDATE products SET name=COALESCE(?,name), stock_type=COALESCE(?,stock_type), quantity=COALESCE(?,quantity) WHERE id=?')
      .run(name ?? null, stock_type ?? null, quantity == null ? null : Math.max(0, +quantity), req.params.id);
    res.json({ ok: true });
  });
  api.post('/products/:id/sold', (req, res) =>
    recordSale(req.params.id, Math.max(1, +req.body.qty || 1)) ? res.json({ ok: true }) : res.status(400).json({ error: 'Not enough stock' }));
  api.get('/conversations', (_, res) => res.json(db.prepare(`
    SELECT customer_id, MAX(customer_name) name, MAX(created_at) last_at,
      SUM(CASE WHEN sender='customer' AND read=0 THEN 1 ELSE 0 END) unread,
      (SELECT text FROM messages m2 WHERE m2.customer_id=m.customer_id ORDER BY id DESC LIMIT 1) last_text
    FROM messages m GROUP BY customer_id ORDER BY last_at DESC`).all()));
  app.use('/api/admin', api);

  // ---- chat (Socket.IO) ----
  const io = new Server(httpServer);
  const save = (cid, cname, sender, text) => {
    const r = db.prepare('INSERT INTO messages(customer_id,customer_name,sender,text) VALUES(?,?,?,?)').run(cid, cname, sender, text);
    return db.prepare('SELECT * FROM messages WHERE id=?').get(r.lastInsertRowid);
  };
  const history = cid => db.prepare('SELECT * FROM messages WHERE customer_id=? ORDER BY id').all(cid);

  io.on('connection', socket => {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    if (isAdmin(cookies)) {
      socket.join('admins');
      socket.on('open', cid => { db.prepare("UPDATE messages SET read=1 WHERE customer_id=? AND sender='customer'").run(cid); socket.emit('history', cid, history(cid)); });
      socket.on('reply', ({ cid, text }) => {
        text = String(text || '').trim().slice(0, 2000); if (!text) return;
        const m = save(cid, null, 'admin', text);
        io.to('c:' + cid).to('admins').emit('message', m);
      });
      return;
    }
    const me = getCustomer(cookies);
    if (!me) return socket.disconnect(true);            // customers can only ever reach THEIR OWN room
    socket.join('c:' + me.id);
    socket.emit('history', me.id, history(me.id));
    socket.on('send', text => {
      text = String(text || '').trim().slice(0, 2000); if (!text) return;
      const m = save(me.id, me.name, 'customer', text);
      io.to('c:' + me.id).to('admins').emit('message', m);
    });
  });
};
