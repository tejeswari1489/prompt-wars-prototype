/**
 * NOVA CART — SQLite Database Setup & Seed
 */

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const SEED_DB_PATH = path.join(__dirname, 'novacart.db');

// In Vercel / serverless environments with a read-only filesystem, copy database to /tmp
let DB_PATH = SEED_DB_PATH;
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.NOW_REGION ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);

if (isServerless) {
  const tmpPath = path.join('/tmp', 'novacart.db');
  try {
    if (!fs.existsSync(tmpPath) && fs.existsSync(SEED_DB_PATH)) {
      fs.copyFileSync(SEED_DB_PATH, tmpPath);
    }
    DB_PATH = tmpPath;
  } catch (err) {
    console.error('Failed to copy database to /tmp:', err.message);
  }
}

const db = new Database(DB_PATH);

// Configure journaling: avoid WAL mode in serverless to prevent filesystem/shared-memory issues
if (isServerless) {
  db.pragma('journal_mode = DELETE');
} else {
  db.pragma('journal_mode = WAL');
}

// ── CREATE TABLES ────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    sku          TEXT    NOT NULL UNIQUE,
    category     TEXT    NOT NULL DEFAULT 'grocery',
    qty          INTEGER NOT NULL DEFAULT 0,
    min_qty      INTEGER NOT NULL DEFAULT 5,
    price        REAL    NOT NULL DEFAULT 0,
    demand       TEXT    NOT NULL DEFAULT 'medium' CHECK(demand IN ('high','medium','low')),
    sold_today   INTEGER NOT NULL DEFAULT 0,
    last_updated TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_ref    TEXT    NOT NULL UNIQUE,
    customer     TEXT    NOT NULL,
    items        TEXT    NOT NULL,
    amount       REAL    NOT NULL DEFAULT 0,
    status       TEXT    NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','ready','delivered','cancelled')),
    cancel_reason TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT    NOT NULL DEFAULT 'info' CHECK(type IN ('critical','warning','opportunity','info')),
    emoji      TEXT    NOT NULL DEFAULT '🔔',
    title      TEXT    NOT NULL,
    description TEXT   NOT NULL,
    meta       TEXT,
    cta_label  TEXT    NOT NULL DEFAULT 'View',
    is_read    INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS stock_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    old_qty    INTEGER NOT NULL,
    new_qty    INTEGER NOT NULL,
    note       TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

// ── SEED DATA ────────────────────────────────────────────────────────────────
const seedProducts = [
  { name: 'Amul Butter 500g',           sku: 'AMB-500',  category: 'dairy',         qty: 4,  min_qty: 5,  price: 268,  demand: 'high',   sold_today: 32 },
  { name: 'Aashirvaad Atta 5kg',         sku: 'ASH-ATT',  category: 'grocery',       qty: 12, min_qty: 8,  price: 285,  demand: 'high',   sold_today: 28 },
  { name: 'Maggi Noodles 12pk',          sku: 'MAG-12',   category: 'snacks',        qty: 0,  min_qty: 6,  price: 168,  demand: 'high',   sold_today: 44 },
  { name: 'Tata Salt 1kg',               sku: 'TTS-001',  category: 'grocery',       qty: 28, min_qty: 10, price: 28,   demand: 'medium', sold_today: 18 },
  { name: 'Amul Gold Milk 1L',           sku: 'AMG-1L',   category: 'dairy',         qty: 3,  min_qty: 10, price: 66,   demand: 'high',   sold_today: 51 },
  { name: "Lay's Classic Salted 26g",    sku: 'LYS-CLK',  category: 'snacks',        qty: 22, min_qty: 8,  price: 20,   demand: 'medium', sold_today: 23 },
  { name: 'Bisleri Water 1L',            sku: 'BIS-1L',   category: 'beverages',     qty: 0,  min_qty: 12, price: 20,   demand: 'high',   sold_today: 38 },
  { name: 'Ariel Powder 1kg',            sku: 'ARI-1KG',  category: 'personal_care', qty: 15, min_qty: 5,  price: 199,  demand: 'low',    sold_today: 8  },
  { name: 'Nescafe Classic 50g',         sku: 'NES-50G',  category: 'beverages',     qty: 7,  min_qty: 5,  price: 170,  demand: 'medium', sold_today: 14 },
  { name: 'Parle-G Biscuits 800g',       sku: 'PAR-800',  category: 'snacks',        qty: 18, min_qty: 8,  price: 60,   demand: 'medium', sold_today: 20 },
  { name: 'Dove Soap Bar 100g',          sku: 'DOV-100',  category: 'personal_care', qty: 10, min_qty: 5,  price: 60,   demand: 'low',    sold_today: 6  },
  { name: 'Sunflower Oil 1L',            sku: 'SNF-OIL',  category: 'grocery',       qty: 8,  min_qty: 5,  price: 148,  demand: 'medium', sold_today: 16 },
  { name: "Haldiram's Bhujia 400g",      sku: 'HAL-400',  category: 'snacks',        qty: 14, min_qty: 5,  price: 120,  demand: 'medium', sold_today: 19 },
  { name: 'Colgate MaxFresh 150g',       sku: 'COL-150',  category: 'personal_care', qty: 9,  min_qty: 5,  price: 88,   demand: 'low',    sold_today: 9  },
  { name: 'Tropicana Orange 1L',         sku: 'TRO-OR1',  category: 'beverages',     qty: 6,  min_qty: 5,  price: 120,  demand: 'medium', sold_today: 12 },
  { name: 'Tata Tea Premium 500g',       sku: 'TAT-TEA',  category: 'beverages',     qty: 11, min_qty: 6,  price: 235,  demand: 'medium', sold_today: 17 },
  { name: 'Lays Magic Masala 26g',       sku: 'LYS-MM',   category: 'snacks',        qty: 30, min_qty: 10, price: 20,   demand: 'high',   sold_today: 29 },
  { name: 'Dettol Soap 75g',             sku: 'DET-75G',  category: 'personal_care', qty: 16, min_qty: 8,  price: 42,   demand: 'medium', sold_today: 15 },
  { name: 'Kurkure Masala Munch 90g',    sku: 'KUR-090',  category: 'snacks',        qty: 25, min_qty: 8,  price: 30,   demand: 'high',   sold_today: 33 },
  { name: 'Lifebuoy Handwash 190ml',     sku: 'LIF-190',  category: 'personal_care', qty: 8,  min_qty: 5,  price: 95,   demand: 'low',    sold_today: 7  },
  { name: 'Surf Excel Easy Wash 1kg',    sku: 'SRF-EW1',  category: 'personal_care', qty: 6,  min_qty: 5,  price: 200,  demand: 'medium', sold_today: 11 },
  { name: 'Sprite 750ml',               sku: 'SPR-750',  category: 'beverages',     qty: 20, min_qty: 10, price: 40,   demand: 'high',   sold_today: 37 },
  { name: 'Britannia 5050 Sweet & Salt', sku: 'BRI-550',  category: 'snacks',        qty: 17, min_qty: 6,  price: 40,   demand: 'medium', sold_today: 13 },
];

const seedOrders = [
  { order_ref: 'NC-8821', customer: 'Rohan Mehta',    items: 'Amul Butter, Aashirvaad Atta',       amount: 553,  status: 'preparing'  },
  { order_ref: 'NC-8820', customer: 'Priya Sharma',   items: "Maggi 12pk, Lay's Classic x3",        amount: 228,  status: 'ready'      },
  { order_ref: 'NC-8819', customer: 'Amit Kumar',     items: 'Tata Salt, Sunflower Oil, Dove Soap', amount: 256,  status: 'delivered'  },
  { order_ref: 'NC-8818', customer: 'Sneha R.',       items: 'Amul Gold Milk x2, Nescafe 50g',      amount: 302,  status: 'delivered'  },
  { order_ref: 'NC-8817', customer: 'Vikas Nair',     items: 'Bisleri Water x6',                    amount: 120,  status: 'cancelled',  cancel_reason: 'Product unavailable' },
  { order_ref: 'NC-8816', customer: 'Ritu Jain',      items: 'Tata Tea, Kurkure, Parle-G',          amount: 325,  status: 'delivered'  },
  { order_ref: 'NC-8815', customer: 'Deepak S.',      items: 'Sprite 750ml x4, Tropicana',          amount: 280,  status: 'delivered'  },
  { order_ref: 'NC-8814', customer: 'Kavya M.',       items: 'Colgate MaxFresh, Dove Soap',         amount: 148,  status: 'delivered'  },
  { order_ref: 'NC-8813', customer: 'Arjun Singh',    items: 'Aashirvaad Atta, Tata Salt x2',       amount: 341,  status: 'cancelled',  cancel_reason: 'Store rejected order' },
  { order_ref: 'NC-8812', customer: 'Meera P.',       items: "Haldiram's Bhujia, Lays MM",          amount: 150,  status: 'delivered'  },
];

const seedAlerts = [
  { type: 'critical',    emoji: '🚨', title: 'Maggi Noodles OUT OF STOCK — 8 pending searches today',          description: "Maggi Noodles 12pk is your #2 most-searched item. 8 customers searched for it in the last 3 hours and couldn't order. Restock now to capture these lost sales.", meta: 'Estimated lost revenue: ₹1,344 today',                   cta_label: 'Restock Now' },
  { type: 'critical',    emoji: '⚠️', title: 'Amul Butter critically LOW — will run out in ~2 hrs',            description: 'At current sell-through (4 units/hr), Amul Butter 500g will hit zero by 1 PM. It has already caused 1 cancellation today.',                                  meta: 'Demand signal: VERY HIGH · Weekend demand +40%',         cta_label: 'Update Stock' },
  { type: 'critical',    emoji: '⚠️', title: 'Amul Gold Milk critically LOW — only 3 units left',             description: 'Milk is your highest daily-demand item. With 3 units left, any new order risks a cancellation. Update your catalog now.',                                    meta: 'Daily avg demand: 12 units · Stock lasts ~30 min',       cta_label: 'Update Stock' },
  { type: 'warning',     emoji: '📦', title: 'Bisleri Water OUT OF STOCK — 6 hrs since last update',          description: '5 customer orders for Bisleri 1L were cancelled last week due to stock discrepancy. If you have stock, mark it as available.',                               meta: 'Cancellation cost this week: ₹600 from water orders',    cta_label: 'Add Stock' },
  { type: 'opportunity', emoji: '📈', title: 'Weekend Demand Spike — Restock Snacks by Tomorrow',             description: 'Based on your last 4 weekends, Kurkure, Bhujia, and Lays see a 60-80% demand spike on Saturdays. Current stock is below the recommended weekend threshold.', meta: 'Recommended: Kurkure +20, Bhujia +15, Lays +25',         cta_label: 'View Forecast' },
  { type: 'opportunity', emoji: '💡', title: '19% of customers repeatedly search for items you don\'t carry', description: 'NOVA CART data shows "Bonn Sandwich Bread", "Epigamia Greek Yogurt", and "Paper Boat Aam Panna" are frequently searched near your store.',                     meta: 'Potential revenue: ₹8,000–12,000/month from 3 items',    cta_label: 'Add to Catalog' },
  { type: 'info',        emoji: '🕐', title: 'Catalog not updated in 6+ hours — Availability Score dropping', description: 'Stores with outdated catalogs have 2.3x higher cancellation rates. A quick 2-minute update can significantly improve your score.',                          meta: 'Your readiness score: 70% · Target: 90%+',              cta_label: 'Quick Update' },
  { type: 'info',        emoji: '🎯', title: 'Your repeat order rate is 68% — above platform average!',       description: 'Customers who successfully receive full orders from your store return 68% of the time within 30 days, vs the platform average of 27%.',                      meta: 'Keep it up: consistent availability = loyal customers',  cta_label: 'See Report' },
];

// Only seed if tables are empty
const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
if (productCount === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (name, sku, category, qty, min_qty, price, demand, sold_today)
    VALUES (@name, @sku, @category, @qty, @min_qty, @price, @demand, @sold_today)
  `);
  const insertMany = db.transaction((rows) => rows.forEach(r => insertProduct.run(r)));
  insertMany(seedProducts);
  console.log(`✅ Seeded ${seedProducts.length} products`);
}

const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
if (orderCount === 0) {
  const insertOrder = db.prepare(`
    INSERT INTO orders (order_ref, customer, items, amount, status, cancel_reason)
    VALUES (@order_ref, @customer, @items, @amount, @status, @cancel_reason)
  `);
  const insertMany = db.transaction((rows) => rows.forEach(r => insertOrder.run({ cancel_reason: null, ...r })));
  insertMany(seedOrders);
  console.log(`✅ Seeded ${seedOrders.length} orders`);
}

const alertCount = db.prepare('SELECT COUNT(*) as c FROM alerts').get().c;
if (alertCount === 0) {
  const insertAlert = db.prepare(`
    INSERT INTO alerts (type, emoji, title, description, meta, cta_label)
    VALUES (@type, @emoji, @title, @description, @meta, @cta_label)
  `);
  const insertMany = db.transaction((rows) => rows.forEach(r => insertAlert.run(r)));
  insertMany(seedAlerts);
  console.log(`✅ Seeded ${seedAlerts.length} alerts`);
}

module.exports = db;
