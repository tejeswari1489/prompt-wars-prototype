const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../server');

let server;
let baseUrl;

before(() => new Promise((resolve) => {
  server = app.listen(0, () => {
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    resolve();
  });
}));

after(() => new Promise((resolve) => {
  server.close(resolve);
}));

describe('Security Headers', () => {
  it('should send standard security headers on all responses', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard`);
    assert.strictEqual(res.headers.get('x-content-type-options'), 'nosniff');
    assert.strictEqual(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(res.headers.get('content-security-policy'), 'CSP header must be present');
    assert.ok(res.headers.get('referrer-policy'), 'Referrer policy must be present');
  });
});

describe('Dashboard API', () => {
  it('GET /api/dashboard returns complete KPI and summary data', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();

    assert.ok(data.kpis, 'Dashboard must have kpis');
    assert.ok(typeof data.kpis.catalogAvailability === 'number');
    assert.ok(typeof data.kpis.inStock === 'number');
    assert.ok(typeof data.kpis.lowStock === 'number');
    assert.ok(typeof data.kpis.outOfStock === 'number');
    assert.ok(Array.isArray(data.topSellers), 'topSellers must be an array');
    assert.ok(Array.isArray(data.riskItems), 'riskItems must be an array');
  });
});

describe('Products API', () => {
  let createdId;
  const uniqueSku = 'AUTO-TEST-' + Date.now();

  it('GET /api/products returns product list with computed status', async () => {
    const res = await fetch(`${baseUrl}/api/products`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.products));
    assert.ok(data.products.length > 0);
    assert.ok(['in', 'low', 'out'].includes(data.products[0].status));
  });

  it('GET /api/products?filter=low returns only low stock items', async () => {
    const res = await fetch(`${baseUrl}/api/products?filter=low`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    data.products.forEach(p => {
      assert.strictEqual(p.status, 'low');
    });
  });

  it('POST /api/products validates required fields', async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'grocery' }),
    });
    assert.strictEqual(res.status, 400);
  });

  it('POST /api/products creates a new product', async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated Test Atta',
        sku: uniqueSku,
        category: 'grocery',
        qty: 15,
        min_qty: 5,
        price: 320,
        demand: 'high',
      }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.name, 'Automated Test Atta');
    assert.strictEqual(data.sku, uniqueSku);
    createdId = data.id;
  });

  it('POST /api/products rejects duplicate SKU with 409', async () => {
    const res = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Duplicate SKU Item',
        sku: uniqueSku,
      }),
    });
    assert.strictEqual(res.status, 409);
  });

  it('PATCH /api/products/:id updates stock quantity and logs history', async () => {
    const res = await fetch(`${baseUrl}/api/products/${createdId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty: 2 }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.qty, 2);
    assert.strictEqual(data.status, 'low');
  });

  it('PATCH /api/products/:id/status supports quick stockout toggle', async () => {
    const res = await fetch(`${baseUrl}/api/products/${createdId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_out' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.qty, 0);
    assert.strictEqual(data.status, 'out');
  });

  it('GET /api/products/:id/history returns audit log of stock changes', async () => {
    const res = await fetch(`${baseUrl}/api/products/${createdId}/history`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.history));
    assert.ok(data.history.length >= 2, 'Should record quantity changes in stock_history');
  });

  it('DELETE /api/products/:id removes the test product', async () => {
    const res = await fetch(`${baseUrl}/api/products/${createdId}`, { method: 'DELETE' });
    assert.strictEqual(res.status, 200);
  });
});

describe('Alerts & Orders API', () => {
  it('GET /api/alerts returns alerts list', async () => {
    const res = await fetch(`${baseUrl}/api/alerts`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.alerts));
  });

  it('PUT /api/alerts/read-all marks all alerts as read', async () => {
    const res = await fetch(`${baseUrl}/api/alerts/read-all`, { method: 'PUT' });
    assert.strictEqual(res.status, 200);
  });

  it('GET /api/orders returns recent order list', async () => {
    const res = await fetch(`${baseUrl}/api/orders`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.orders));
  });
});

describe('Analytics API', () => {
  it('GET /api/analytics/weekly returns order trend data', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/weekly`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.labels));
    assert.ok(Array.isArray(data.thisWeek));
    assert.ok(Array.isArray(data.lastWeek));
  });

  it('GET /api/analytics/forecast returns 7-day predictive forecast', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/forecast`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.forecast));
    assert.strictEqual(data.forecast.length, 7);
  });

  it('GET /api/analytics/cancellations returns cancellation reason breakdown', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/cancellations`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.enriched));
    assert.ok(data.enriched.some(e => e.label.includes('Unavailable')));
  });
});
