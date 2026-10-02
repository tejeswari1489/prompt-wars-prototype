/**
 * NOVA CART — Alerts Routes
 * GET   /api/alerts          — list all alerts
 * PATCH /api/alerts/:id/read — mark as read
 * PATCH /api/alerts/read-all — mark all as read
 * POST  /api/alerts          — create alert (internal use)
 */

const router = require('express').Router();
const db     = require('../db/database');

router.get('/', (req, res) => {
  try {
    const { unread } = req.query;
    let sql = 'SELECT * FROM alerts';
    if (unread === 'true') sql += ' WHERE is_read = 0';
    sql += ` ORDER BY CASE type WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 WHEN 'opportunity' THEN 3 ELSE 4 END, created_at DESC`;

    const alerts = db.prepare(sql).all();
    res.json({ alerts, total: alerts.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', (req, res) => {
  try {
    db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/read-all', (req, res) => {
  try {
    db.prepare('UPDATE alerts SET is_read = 1').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT alias so both HTTP verbs work
router.put('/read-all', (req, res) => {
  try {
    db.prepare('UPDATE alerts SET is_read = 1').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { type = 'info', emoji = '🔔', title, description, meta, cta_label = 'View' } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'title and description required' });
    const result = db.prepare(`
      INSERT INTO alerts (type, emoji, title, description, meta, cta_label)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(type, emoji, title, description, meta || null, cta_label);
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
