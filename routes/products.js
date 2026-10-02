/**
 * NOVA CART — Products / Inventory Routes
 * GET    /api/products          — list all (with filters)
 * GET    /api/products/:id      — single product
 * POST   /api/products          — create
 * PATCH  /api/products/:id      — update qty / fields
 * DELETE /api/products/:id      — delete
 * PATCH  /api/products/:id/status — mark in/out of stock quickly
 */

const router = require('express').Router();
const db     = require('../db/database');

// ── LIST ─────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const { filter, category, q } = req.query;

    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (q) {
      sql += ' AND (LOWER(name) LIKE ? OR LOWER(sku) LIKE ?)';
      params.push(`%${q.toLowerCase()}%`, `%${q.toLowerCase()}%`);
    }

    if (filter === 'low')  sql += ' AND qty > 0 AND qty < min_qty';
    if (filter === 'out')  sql += ' AND qty = 0';
    if (filter === 'in')   sql += ' AND qty >= min_qty AND qty > 0';

    sql += ' ORDER BY sold_today DESC';

    const products = db.prepare(sql).all(...params);

    // Add computed status
    const withStatus = products.map(p => ({
      ...p,
      status: p.qty === 0 ? 'out' : p.qty < p.min_qty ? 'low' : 'in',
    }));

    res.json({ products: withStatus, total: withStatus.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SINGLE ────────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  try {
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).json({ error: 'Product not found' });
    res.json({ ...p, status: p.qty === 0 ? 'out' : p.qty < p.min_qty ? 'low' : 'in' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CREATE ────────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  try {
    const { name, sku, category = 'grocery', qty = 0, min_qty = 5, price = 0, demand = 'medium' } = req.body;

    if (!name || !sku) return res.status(400).json({ error: 'name and sku are required' });

    const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku);
    if (existing) return res.status(409).json({ error: 'SKU already exists' });

    const result = db.prepare(`
      INSERT INTO products (name, sku, category, qty, min_qty, price, demand)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, sku, category, qty, min_qty, price, demand);

    const newProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ ...newProduct, status: newProduct.qty === 0 ? 'out' : newProduct.qty < newProduct.min_qty ? 'low' : 'in' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { name, category, qty, min_qty, price, demand } = req.body;

    // Log stock history if qty changed
    if (qty !== undefined && qty !== product.qty) {
      db.prepare(`
        INSERT INTO stock_history (product_id, old_qty, new_qty, note)
        VALUES (?, ?, ?, ?)
      `).run(id, product.qty, qty, req.body.note || 'Manual update');
    }

    const updates = [];
    const params  = [];

    if (name      !== undefined) { updates.push('name = ?');      params.push(name);     }
    if (category  !== undefined) { updates.push('category = ?');  params.push(category); }
    if (qty       !== undefined) { updates.push('qty = ?');       params.push(qty);      }
    if (min_qty   !== undefined) { updates.push('min_qty = ?');   params.push(min_qty);  }
    if (price     !== undefined) { updates.push('price = ?');     params.push(price);    }
    if (demand    !== undefined) { updates.push('demand = ?');    params.push(demand);   }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push("last_updated = datetime('now','localtime')");
    params.push(id);

    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json({ ...updated, status: updated.qty === 0 ? 'out' : updated.qty < updated.min_qty ? 'low' : 'in' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── QUICK STATUS ──────────────────────────────────────────────────────────────
router.patch('/:id/status', (req, res) => {
  try {
    const id = req.params.id;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const { action } = req.body; // 'mark_out' | 'mark_in'
    let newQty = product.qty;

    if (action === 'mark_out') newQty = 0;
    if (action === 'mark_in')  newQty = product.min_qty;

    db.prepare("UPDATE products SET qty = ?, last_updated = datetime('now','localtime') WHERE id = ?").run(newQty, id);
    db.prepare('INSERT INTO stock_history (product_id, old_qty, new_qty, note) VALUES (?, ?, ?, ?)').run(id, product.qty, newQty, action);

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json({ ...updated, status: updated.qty === 0 ? 'out' : updated.qty < updated.min_qty ? 'low' : 'in' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: `Deleted: ${product.name}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── STOCK HISTORY ─────────────────────────────────────────────────────────────
router.get('/:id/history', (req, res) => {
  try {
    const history = db.prepare(
      'SELECT * FROM stock_history WHERE product_id = ? ORDER BY created_at DESC LIMIT 20'
    ).all(req.params.id);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
