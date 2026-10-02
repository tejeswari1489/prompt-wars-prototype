/**
 * NOVA CART — Analytics Routes
 * GET /api/analytics/weekly    — weekly order volume
 * GET /api/analytics/forecast  — 7-day demand forecast
 * GET /api/analytics/health    — catalog availability trend
 * GET /api/analytics/cancellations — cancellation breakdown
 */

const router = require('express').Router();
const db     = require('../db/database');

// Weekly order counts (last 7 days vs previous 7)
router.get('/weekly', (req, res) => {
  try {
    // Real data from DB grouped by day
    const rows = db.prepare(`
      SELECT
        date(created_at,'localtime') as day,
        COUNT(*) as orders,
        SUM(CASE WHEN status != 'cancelled' THEN amount ELSE 0 END) as revenue
      FROM orders
      WHERE created_at >= date('now','localtime','-13 days')
      GROUP BY date(created_at,'localtime')
      ORDER BY day ASC
    `).all();

    const days  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    // Generate simulated enriched data for demo
    const thisWeek = [18, 22, 19, 24, 31, 38, 28];
    const lastWeek = [14, 20, 16, 21, 28, 34, 26];

    res.json({ labels: days, thisWeek, lastWeek, rawRows: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancellation reasons breakdown
router.get('/cancellations', (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'cancelled'").get().c;
    const reasons = db.prepare(`
      SELECT COALESCE(cancel_reason,'Other') as reason, COUNT(*) as count
      FROM orders WHERE status = 'cancelled'
      GROUP BY cancel_reason ORDER BY count DESC
    `).all();

    // Enrich with platform-level data for demo (from the case study)
    const enriched = [
      { label: 'Product Unavailable', value: 35, color: '#e11d48' },
      { label: 'Delivery Delay',      value: 27, color: '#f59e0b' },
      { label: 'Store Rejected',      value: 18, color: '#d97706' },
      { label: 'No Delivery Partner', value: 12, color: '#0284c7' },
      { label: 'Other',               value: 8,  color: '#64748b' },
    ];

    res.json({ total, reasons, enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Catalog health over last 7 weeks (simulated trend)
router.get('/health', (req, res) => {
  try {
    const inStock   = db.prepare("SELECT COUNT(*) as c FROM products WHERE qty >= min_qty AND qty > 0").get().c;
    const total     = db.prepare("SELECT COUNT(*) as c FROM products").get().c;
    const current   = total > 0 ? Math.round(inStock / total * 100) : 0;

    const labels       = ['6 wks ago','5 wks','4 wks','3 wks','2 wks','Last wk','Now'];
    const availability = [92, 88, 85, 79, 82, 76, current];

    res.json({ labels, availability, currentScore: current });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7-day demand forecast
router.get('/forecast', (req, res) => {
  try {
    const today = new Date();
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    // Base demand from sold_today
    const avgDaily = db.prepare("SELECT COALESCE(SUM(sold_today),0) as s FROM products").get().s;

    const forecast = Array.from({ length: 7 }, (_, i) => {
      const d    = new Date(today);
      d.setDate(d.getDate() + i + 1);
      const dow  = d.getDay();
      const isWknd = dow === 0 || dow === 6;
      const isFri  = dow === 5;
      const mult   = isWknd ? 1.65 : isFri ? 1.35 : 1.0;
      const orders = Math.round((25 + Math.random() * 8) * mult);
      return {
        day:    dayNames[dow],
        date:   d.toISOString().split('T')[0],
        orders,
        trend:  mult > 1 ? 'up' : 'avg',
        color:  isWknd ? '#e11d48' : isFri ? '#f59e0b' : '#059669',
      };
    });

    res.json({ forecast });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stock history for a specific product
router.get('/stock-history/:productId', (req, res) => {
  try {
    const history = db.prepare(`
      SELECT sh.*, p.name as product_name
      FROM stock_history sh
      JOIN products p ON sh.product_id = p.id
      WHERE sh.product_id = ?
      ORDER BY sh.created_at DESC LIMIT 20
    `).all(req.params.productId);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
