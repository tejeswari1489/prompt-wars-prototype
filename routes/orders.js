/**
 * NOVA CART — Orders Routes
 * GET  /api/orders          — list with optional status filter
 * GET  /api/orders/:id      — single order
 * POST /api/orders          — create new order
 * PATCH /api/orders/:id/status — update status
 */

const router = require('express').Router();
const db     = require('../db/database');

// ── LIST ─────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const orders = db.prepare(sql).all(...params);
    const total  = db.prepare('SELECT COUNT(*) as c FROM orders' + (status && status !== 'all' ? ' WHERE status = ?' : '')).get(...(status && status !== 'all' ? [status] : [])).c;

    res.json({ orders, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SINGLE ────────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { customer, items, amount, status = 'preparing' } = req.body;

    if (!customer || !items || amount === undefined) {
      return res.status(400).json({ error: 'customer, items, and amount are required' });
    }

    // Generate order ref
    const lastOrder  = db.prepare("SELECT order_ref FROM orders ORDER BY id DESC LIMIT 1").get();
    const lastNum    = lastOrder ? parseInt(lastOrder.order_ref.replace('NC-', '')) : 8820;
    const order_ref  = `NC-${lastNum + 1}`;

    const result = db.prepare(`
      INSERT INTO orders (order_ref, customer, items, amount, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(order_ref, customer, items, amount, status);

    const newOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
router.patch('/:id/status', (req, res) => {
  try {
    const { status, cancel_reason } = req.body;
    const validStatuses = ['preparing', 'ready', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    db.prepare('UPDATE orders SET status = ?, cancel_reason = ? WHERE id = ?')
      .run(status, cancel_reason || null, req.params.id);

    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── STATS ─────────────────────────────────────────────────────────────────────
router.get('/stats/summary', (req, res) => {
  try {
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount),0) as revenue
      FROM orders GROUP BY status
    `).all();

    const cancelReasons = db.prepare(`
      SELECT cancel_reason, COUNT(*) as count
      FROM orders WHERE status = 'cancelled' AND cancel_reason IS NOT NULL
      GROUP BY cancel_reason ORDER BY count DESC
    `).all();

    res.json({ byStatus, cancelReasons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
