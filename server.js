/**
 * NOVA CART — Smart Inventory Manager
 * Backend: Express + SQLite
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./db/database');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── ROUTES ──────────────────────────────────────────────────────────────────

// Products / Inventory
app.use('/api/products', require('./routes/products'));

// Orders
app.use('/api/orders',   require('./routes/orders'));

// Alerts
app.use('/api/alerts',   require('./routes/alerts'));

// Analytics
app.use('/api/analytics', require('./routes/analytics'));

// Dashboard summary
app.get('/api/dashboard', (req, res) => {
  try {
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const inStock       = db.prepare("SELECT COUNT(*) as count FROM products WHERE qty >= min_qty AND qty > 0").get().count;
    const lowStock      = db.prepare("SELECT COUNT(*) as count FROM products WHERE qty > 0 AND qty < min_qty").get().count;
    const outOfStock    = db.prepare("SELECT COUNT(*) as count FROM products WHERE qty = 0").get().count;

    const todayOrders   = db.prepare("SELECT COUNT(*) as count FROM orders WHERE date(created_at) = date('now','localtime')").get().count;
    const todayRevenue  = db.prepare("SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE status != 'cancelled' AND date(created_at) = date('now','localtime')").get().total;
    const todayCancels  = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'cancelled' AND date(created_at) = date('now','localtime')").get().count;
    const unreadAlerts  = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE is_read = 0").get().count;

    const availScore    = totalProducts > 0 ? Math.round((inStock / totalProducts) * 100) : 0;

    const topSellers    = db.prepare(
      "SELECT id, name, sku, sold_today FROM products ORDER BY sold_today DESC LIMIT 5"
    ).all();

    const riskItems     = db.prepare(
      "SELECT id, name, qty, min_qty, demand FROM products WHERE qty = 0 OR qty < min_qty ORDER BY demand DESC, qty ASC LIMIT 4"
    ).all();

    res.json({
      kpis: {
        todayOrders, todayRevenue, todayCancels,
        catalogAvailability: availScore,
        inStock, lowStock, outOfStock, totalProducts,
      },
      alerts:  { unread: unreadAlerts },
      topSellers,
      riskItems,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend for any non-API route (Express 5 compatible wildcard)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 NOVA CART Server running at http://localhost:${PORT}`);
  console.log(`📦 Database ready — SQLite`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
