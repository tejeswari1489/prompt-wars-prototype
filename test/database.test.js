const { describe, it } = require('node:test');
const assert = require('node:assert');
const db = require('../db/database');

describe('Database Schema & Seed Integrity', () => {
  it('should have all required tables created', () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).all().map(t => t.name);

    assert.ok(tables.includes('products'), 'products table must exist');
    assert.ok(tables.includes('orders'), 'orders table must exist');
    assert.ok(tables.includes('alerts'), 'alerts table must exist');
    assert.ok(tables.includes('stock_history'), 'stock_history table must exist');
  });

  it('should have seed products loaded', () => {
    const count = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
    assert.ok(count >= 20, `Expected at least 20 seed products, got ${count}`);
  });

  it('should correctly calculate inventory availability metrics', () => {
    const total = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
    const inStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE qty >= min_qty AND qty > 0').get().c;
    const lowStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE qty > 0 AND qty < min_qty').get().c;
    const outOfStock = db.prepare('SELECT COUNT(*) as c FROM products WHERE qty = 0').get().c;

    assert.strictEqual(inStock + lowStock + outOfStock, total, 'In-stock + low-stock + out-of-stock must equal total');
    const score = Math.round((inStock / total) * 100);
    assert.ok(score >= 0 && score <= 100, 'Score must be between 0 and 100');
  });

  it('should insert, update, and track stock changes in stock_history', () => {
    const testSku = 'TEST-SKU-' + Date.now();
    const insertRes = db.prepare(`
      INSERT INTO products (name, sku, category, qty, min_qty, price, demand)
      VALUES (?, ?, 'grocery', 10, 5, 99.5, 'high')
    `).run('Test Biscuit', testSku);

    const productId = insertRes.lastInsertRowid;
    assert.ok(productId > 0, 'Inserted product must have a valid ID');

    // Update quantity
    db.prepare('UPDATE products SET qty = 2 WHERE id = ?').run(productId);
    db.prepare(`
      INSERT INTO stock_history (product_id, old_qty, new_qty, note)
      VALUES (?, 10, 2, 'Test update')
    `).run(productId);

    // Verify history recorded
    const history = db.prepare('SELECT * FROM stock_history WHERE product_id = ?').all(productId);
    assert.strictEqual(history.length, 1);
    assert.strictEqual(history[0].old_qty, 10);
    assert.strictEqual(history[0].new_qty, 2);

    // Cleanup test record
    db.prepare('DELETE FROM stock_history WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
  });

  it('should maintain alert read status updates', () => {
    const alert = db.prepare('SELECT * FROM alerts LIMIT 1').get();
    assert.ok(alert, 'At least one alert should exist');

    db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(alert.id);
    const updated = db.prepare('SELECT is_read FROM alerts WHERE id = ?').get(alert.id);
    assert.strictEqual(updated.is_read, 1);

    // Reset status
    db.prepare('UPDATE alerts SET is_read = ? WHERE id = ?').run(alert.is_read, alert.id);
  });
});
