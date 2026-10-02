/**
 * NOVA CART — Smart Inventory Manager
 * Frontend: Fully connected to Express REST API
 */

'use strict';

const API = '';   // same origin — server serves the frontend

// ─── STATE ────────────────────────────────────────────────────────────────────
const STATE = {
  products:      [],
  orders:        [],
  alerts:        [],
  dashboard:     null,
  filter:        'all',
  categoryFilter:'all',
  searchQuery:   '',
  pendingChanges:{},
  currentPage:   'dashboard',
};

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  setupTopbar();
  setupInventoryControls();
  setupModal();
  setupSearch();
  startClock();

  // Load initial data
  await Promise.all([
    loadDashboard(),
    loadAlerts(),
  ]);

  scheduleSimulation();
});

// ─── API HELPERS ──────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.page);
      document.getElementById('sidebar').classList.remove('open');
    });
  });

  // Quick action buttons with data-page (but NOT qa-mark-unavailable)
  document.querySelectorAll('[data-page]').forEach(el => {
    if (el.tagName !== 'A') el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  document.getElementById('alert-goto-inventory')?.addEventListener('click', () => navigateTo('inventory'));
  document.getElementById('alert-close')?.addEventListener('click', () => {
    const b = document.getElementById('alert-banner');
    b.style.opacity = '0'; b.style.transform = 'translateX(-10px)';
    setTimeout(() => b.remove(), 300);
  });
  document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Mark Unavailable Quick Action
  document.getElementById('qa-mark-unavailable')?.addEventListener('click', openMarkUnavailableModal);
}

async function navigateTo(page) {
  STATE.currentPage = page;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const titles = { dashboard:'Dashboard', inventory:'Inventory', analytics:'Analytics', alerts:'Smart Alerts', orders:'Orders' };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Lazy-load page data
  if (page === 'dashboard') await loadDashboard();
  if (page === 'inventory') await loadInventory();
  if (page === 'analytics') { await loadAnalytics(); setTimeout(renderCharts, 60); }
  if (page === 'alerts')    await loadAlerts();
  if (page === 'orders')    await loadOrders();
}

// ─── TOPBAR ───────────────────────────────────────────────────────────────────
function setupTopbar() {
  document.getElementById('refresh-btn').addEventListener('click', async () => {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('spin');
    await navigateTo(STATE.currentPage);
    btn.classList.remove('spin');
    showToast('✅ Data refreshed!', 'success');
  });
}

function startClock() {
  const el = document.getElementById('topbar-time');
  const tick = () => el.textContent = new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
  tick();
  setInterval(tick, 60000);
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await apiFetch('/api/dashboard');
    STATE.dashboard = data;
    renderDashboard(data);
  } catch (err) {
    showToast('⚠️ Could not load dashboard', 'error');
  }
}

function renderDashboard(data) {
  const { kpis, topSellers, riskItems, alerts } = data;

  // KPIs
  document.getElementById('kpi-orders-val').textContent  = kpis.todayOrders;
  document.getElementById('kpi-revenue-val').textContent = '₹' + Number(kpis.todayRevenue).toLocaleString('en-IN');
  document.getElementById('kpi-cancel-val').textContent  = kpis.todayCancels;
  document.getElementById('kpi-avail-val').textContent   = kpis.catalogAvailability + '%';

  // Score ring
  updateScoreRing(kpis.catalogAvailability);

  // Alert badge
  document.getElementById('alert-badge').textContent = kpis.lowStock + kpis.outOfStock;

  // Risk items
  const riskContainer = document.getElementById('risk-list');
  if (riskItems.length === 0) {
    riskContainer.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem;padding:8px 0">🎉 No at-risk items right now!</p>';
  } else {
    riskContainer.innerHTML = riskItems.map(p => {
      const status  = p.qty === 0 ? 'critical' : 'medium';
      const detail  = p.qty === 0 ? `Out of stock · demand: ${p.demand}` : `${p.qty} units · below min (${p.min_qty})`;
      return `
        <div class="risk-item risk-${status}">
          <div class="risk-indicator"></div>
          <div class="risk-info">
            <div class="risk-name">${p.name}</div>
            <div class="risk-detail">${detail}</div>
          </div>
          <button class="risk-action" onclick="focusProduct(${p.id}, '${p.name}')">Fix</button>
        </div>`;
    }).join('');
  }

  // Top sellers
  const maxSold = topSellers[0]?.sold_today || 1;
  document.getElementById('top-sellers').innerHTML = topSellers.map((p, i) => `
    <div class="seller-item">
      <div class="seller-rank rank-${i < 3 ? i+1 : 'other'}">${i+1}</div>
      <div class="seller-info">
        <div class="seller-name">${p.name}</div>
        <div class="seller-count">${p.sold_today} units today</div>
      </div>
      <div class="seller-bar-wrap" style="max-width:80px">
        <div class="seller-bar-bg">
          <div class="seller-bar" style="width:${(p.sold_today/maxSold*100).toFixed(0)}%"></div>
        </div>
      </div>
    </div>`).join('');

  // AI Insights (static, derived from data)
  const insightData = [
    { type: kpis.outOfStock > 0 ? 'urgent' : 'info', text: `<strong>${kpis.outOfStock} item(s) out of stock</strong> and <strong>${kpis.lowStock} low</strong> — these are the #1 cause of cancellations on NOVA CART (35% of all cancellations).` },
    { type: 'opportunity', text: '<strong>Weekend opportunity:</strong> Snack demand rises 65% on Fridays. Consider restocking Kurkure & Haldiram\'s by tomorrow morning.' },
    { type: 'info',        text: '<strong>Behaviour insight:</strong> Customers who successfully order across 3+ categories show 72% higher retention. Cross-category availability matters.' },
    { type: 'default',     text: `<strong>Readiness score ${kpis.catalogAvailability}%</strong> — Target 90%+ to minimise cancellations and improve your store ranking on the platform.` },
  ];
  document.getElementById('insights-list').innerHTML = insightData.map(i => `<div class="insight-item ${i.type}">${i.text}</div>`).join('');
}

function focusProduct(id, name) {
  navigateTo('inventory');
  setTimeout(() => {
    const s = document.getElementById('global-search');
    s.value = name.split(' ')[0];
    STATE.searchQuery = s.value;
    renderInventoryTable();
    showToast(`📦 Showing "${name.split(' ')[0]}"`, 'info');
  }, 200);
}

// ─── INVENTORY ────────────────────────────────────────────────────────────────
async function loadInventory() {
  try {
    setLoadingState('inventory-tbody', 8);
    const params = new URLSearchParams();
    if (STATE.filter !== 'all')        params.set('filter',   STATE.filter);
    if (STATE.categoryFilter !== 'all') params.set('category', STATE.categoryFilter);
    if (STATE.searchQuery)             params.set('q',        STATE.searchQuery);

    const data = await apiFetch('/api/products?' + params.toString());
    STATE.products = data.products;
    renderInventoryTable();
    updateFilterCounts();
  } catch (err) {
    showToast('⚠️ Could not load inventory: ' + err.message, 'error');
  }
}

function renderInventoryTable() {
  let products = STATE.products;

  // Client-side filter if we already have data
  if (STATE.searchQuery) {
    const q = STATE.searchQuery.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }

  const tbody = document.getElementById('inventory-tbody');
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">No products found</td></tr>`;
    return;
  }

  tbody.innerHTML = products.map(p => {
    const statusLabel  = { in:'In Stock', low:'Low Stock', out:'Out of Stock' }[p.status];
    const demandLabel  = { high:'High', medium:'Medium', low:'Low' }[p.demand];
    const demandPct    = { high:85, medium:50, low:20 }[p.demand];

    return `
    <tr id="row-${p.id}">
      <td><input type="checkbox" class="row-check" data-id="${p.id}" /></td>
      <td>
        <div class="product-cell">
          <span class="product-name">${p.name}</span>
          <span class="product-sku">${p.sku} · ₹${p.price}</span>
        </div>
      </td>
      <td><span style="text-transform:capitalize;font-size:0.78rem;color:var(--text-muted)">${p.category.replace('_',' ')}</span></td>
      <td>
        <span class="status-pill status-${p.status}">
          <span class="status-dot"></span>${statusLabel}
        </span>
      </td>
      <td>
        <div class="qty-control">
          <button class="qty-btn" data-id="${p.id}" data-action="dec">−</button>
          <input type="number" class="qty-input" id="qty-${p.id}" value="${p.qty}" min="0" data-id="${p.id}" data-original="${p.qty}" />
          <button class="qty-btn" data-id="${p.id}" data-action="inc">+</button>
        </div>
      </td>
      <td>
        <div class="demand-signal demand-${p.demand}">
          <div class="demand-bar-wrap"><div class="demand-bar" style="width:${demandPct}%"></div></div>
          <span style="font-weight:600;font-size:0.72rem">${demandLabel}</span>
        </div>
      </td>
      <td><span class="time-ago">${formatTime(p.last_updated)}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="table-action" onclick="saveProduct(${p.id})">Save</button>
          ${p.status !== 'out'
            ? `<button class="table-action mark-out" onclick="quickStatus(${p.id},'mark_out')">Mark Out</button>`
            : `<button class="table-action" onclick="quickStatus(${p.id},'mark_in')">Mark In</button>`}
          <button class="table-action" style="background:rgba(108,99,255,0.1);border-color:rgba(108,99,255,0.3);color:var(--purple)" onclick="showStockHistory(${p.id},'${p.name.replace(/'/g,"\\'")}')">History</button>
          <button class="table-action" style="background:rgba(255,83,112,0.08);border-color:rgba(255,83,112,0.25);color:var(--red)" onclick="deleteProduct(${p.id},'${p.name.replace(/'/g,"\\'")}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Attach qty events
  tbody.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = parseInt(btn.dataset.id);
      const inp = document.getElementById('qty-' + id);
      let v = parseInt(inp.value) || 0;
      if (btn.dataset.action === 'inc') v++;
      if (btn.dataset.action === 'dec' && v > 0) v--;
      inp.value = v;
      markChanged(inp, id, v);
    });
  });

  tbody.querySelectorAll('.qty-input').forEach(inp => {
    inp.addEventListener('change', () => markChanged(inp, parseInt(inp.dataset.id), parseInt(inp.value) || 0));
  });
}

function markChanged(input, id, val) {
  const orig = parseInt(input.dataset.original);
  if (val !== orig) {
    input.classList.add('changed');
    STATE.pendingChanges[id] = val;
  } else {
    input.classList.remove('changed');
    delete STATE.pendingChanges[id];
  }
  document.getElementById('bulk-save-btn').style.display = Object.keys(STATE.pendingChanges).length ? '' : 'none';
}

async function saveProduct(id) {
  const input = document.getElementById('qty-' + id);
  const qty   = parseInt(input.value) || 0;
  try {
    const updated = await apiFetch(`/api/products/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify({ qty }),
    });
    // Update local state
    const idx = STATE.products.findIndex(p => p.id === id);
    if (idx !== -1) STATE.products[idx] = { ...updated, status: updated.qty === 0 ? 'out' : updated.qty < updated.min_qty ? 'low' : 'in' };
    input.dataset.original = qty;
    input.classList.remove('changed');
    delete STATE.pendingChanges[id];
    document.getElementById('bulk-save-btn').style.display = Object.keys(STATE.pendingChanges).length ? '' : 'none';
    renderInventoryTable();
    updateScoreFromProducts();
    showToast(`✅ ${updated.name} updated to ${qty} units`, 'success');
  } catch (err) {
    showToast('❌ Save failed: ' + err.message, 'error');
  }
}

async function quickStatus(id, action) {
  try {
    const updated = await apiFetch(`/api/products/${id}/status`, {
      method: 'PATCH',
      body:   JSON.stringify({ action }),
    });
    const idx = STATE.products.findIndex(p => p.id === id);
    if (idx !== -1) STATE.products[idx] = { ...updated, status: updated.qty === 0 ? 'out' : updated.qty < updated.min_qty ? 'low' : 'in' };
    renderInventoryTable();
    updateScoreFromProducts();
    const msg = action === 'mark_out' ? '🚫 Marked as out of stock' : '✅ Marked as in stock';
    showToast(`${msg}: ${updated.name}`, action === 'mark_out' ? 'error' : 'success');
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function bulkSave() {
  const entries = Object.entries(STATE.pendingChanges);
  if (!entries.length) return;
  try {
    await Promise.all(entries.map(([id, qty]) =>
      apiFetch(`/api/products/${id}`, { method:'PATCH', body: JSON.stringify({ qty }) })
    ));
    STATE.pendingChanges = {};
    document.getElementById('bulk-save-btn').style.display = 'none';
    await loadInventory();
    updateScoreFromProducts();
    showToast(`✅ ${entries.length} products updated!`, 'success');
  } catch (err) {
    showToast('❌ Bulk save failed: ' + err.message, 'error');
  }
}

function updateFilterCounts() {
  const low = STATE.products.filter(p => p.status === 'low').length;
  const out = STATE.products.filter(p => p.status === 'out').length;
  const ins = STATE.products.filter(p => p.status === 'in').length;
  document.querySelector('.tab-count.low').textContent = low;
  document.querySelector('.tab-count.out').textContent = out;
  document.querySelector('.tab-count.in').textContent  = ins;
  document.getElementById('alert-badge').textContent   = low + out;
}

function updateScoreFromProducts() {
  const total = STATE.products.length;
  const good  = STATE.products.filter(p => p.status === 'in').length;
  updateScoreRing(total > 0 ? Math.round(good/total*100) : 0);
}

function updateScoreRing(score) {
  document.getElementById('score-number').textContent = score + '%';
  const offset = 201 - (201 * score / 100);
  document.getElementById('score-arc')?.setAttribute('stroke-dashoffset', offset.toFixed(1));
  const lowCount = STATE.products.filter(p => p.status === 'low').length + STATE.products.filter(p => p.status === 'out').length;
  document.querySelector('.score-hint').textContent = lowCount > 0 ? `${lowCount} items need attention` : 'All items in stock! 🎉';
}

function setupInventoryControls() {
  document.getElementById('filter-tabs')?.addEventListener('click', async e => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    STATE.filter = tab.dataset.filter;
    await loadInventory();
  });

  document.getElementById('category-filter')?.addEventListener('change', async e => {
    STATE.categoryFilter = e.target.value;
    await loadInventory();
  });

  document.getElementById('select-all')?.addEventListener('change', e => {
    document.querySelectorAll('.row-check').forEach(c => c.checked = e.target.checked);
  });

  document.getElementById('bulk-save-btn')?.addEventListener('click', bulkSave);
  document.getElementById('fab-add-product')?.addEventListener('click', openModal);
  document.getElementById('qa-add-product')?.addEventListener('click', openModal);
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
let analyticsData = null;

async function loadAnalytics() {
  try {
    const [weekly, cancels, health, forecast] = await Promise.all([
      apiFetch('/api/analytics/weekly'),
      apiFetch('/api/analytics/cancellations'),
      apiFetch('/api/analytics/health'),
      apiFetch('/api/analytics/forecast'),
    ]);
    analyticsData = { weekly, cancels, health, forecast };
    renderForecastGrid(forecast.forecast);
  } catch (err) {
    showToast('⚠️ Analytics load failed', 'error');
  }
}

function renderCharts() {
  if (!analyticsData) return;
  renderWeeklyChart(analyticsData.weekly);
  renderDonutChart(analyticsData.cancels.enriched);
  renderHealthChart(analyticsData.health);
}

function renderWeeklyChart(data) {
  const canvas = document.getElementById('weekly-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = canvas.parentElement.clientWidth;
  const H = canvas.height = canvas.parentElement.clientHeight || 200;
  const pad = { top:20, right:20, bottom:30, left:40 };
  const cW = W-pad.left-pad.right, cH = H-pad.top-pad.bottom;
  const max = Math.max(...data.thisWeek, ...data.lastWeek) * 1.15;
  const xStep = cW / (data.labels.length - 1);

  ctx.clearRect(0, 0, W, H);

  // Gridlines
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.12)'; ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + cH - cH*i/4;
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+cW, y); ctx.stroke();
    ctx.fillStyle = '#64748b'; ctx.font = '700 10px Plus Jakarta Sans'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max*i/4), pad.left-4, y+4);
  }
  ctx.fillStyle = '#0f172a'; ctx.font = '700 11px Plus Jakarta Sans'; ctx.textAlign = 'center';
  data.labels.forEach((l,i) => ctx.fillText(l, pad.left+i*xStep, H-8));

  const drawLine = (vals, color) => {
    const g = ctx.createLinearGradient(0,pad.top,0,pad.top+cH);
    g.addColorStop(0, color+'55'); g.addColorStop(1, color+'00');
    ctx.beginPath();
    vals.forEach((v,i) => { const x=pad.left+i*xStep, y=pad.top+cH-(v/max*cH); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.lineTo(pad.left+(vals.length-1)*xStep, pad.top+cH);
    ctx.lineTo(pad.left, pad.top+cH); ctx.closePath(); ctx.fillStyle=g; ctx.fill();
    ctx.beginPath(); ctx.strokeStyle=color; ctx.lineWidth=3; ctx.lineJoin='round';
    vals.forEach((v,i) => { const x=pad.left+i*xStep, y=pad.top+cH-(v/max*cH); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.stroke();
    vals.forEach((v,i) => {
      const x=pad.left+i*xStep, y=pad.top+cH-(v/max*cH);
      ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fillStyle=color; ctx.fill();
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.5; ctx.stroke();
    });
  };
  drawLine(data.lastWeek, '#e11d48');
  drawLine(data.thisWeek, '#d97706');
}

function renderDonutChart(enriched) {
  const canvas = document.getElementById('donut-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.height = 165;
  const cx=82.5,cy=82.5,r=64,inner=42, total=enriched.reduce((s,d)=>s+d.value,0);
  ctx.clearRect(0,0,165,165);
  let start = -Math.PI/2;
  enriched.forEach(d => {
    const sweep = d.value/total*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+sweep); ctx.closePath();
    ctx.fillStyle=d.color; ctx.fill(); start+=sweep;
  });
  ctx.beginPath(); ctx.arc(cx,cy,inner,0,Math.PI*2); ctx.fillStyle='#ffffff'; ctx.fill();
  ctx.strokeStyle='#ebd99f'; ctx.lineWidth=1.5; ctx.stroke();
  ctx.fillStyle='#0f172a'; ctx.font='bold 15px Outfit'; ctx.textAlign='center';
  ctx.fillText('11%',cx,cy-2);
  ctx.fillStyle='#d97706'; ctx.font='800 9px Plus Jakarta Sans'; ctx.fillText('Cancel Rate',cx,cy+12);

  document.getElementById('donut-legend').innerHTML = enriched.map(d => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${d.color}"></span>${d.label} (${d.value}%)
    </div>`).join('');
}

function renderHealthChart(data) {
  const canvas = document.getElementById('health-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.parentElement.clientWidth;
  const H = canvas.height = canvas.parentElement.clientHeight || 200;
  const pad={top:20,right:20,bottom:30,left:45};
  const cW=W-pad.left-pad.right, cH=H-pad.top-pad.bottom;
  const max=100, xStep=cW/(data.labels.length-1);
  ctx.clearRect(0,0,W,H);
  [70,80,90,100].forEach(v => {
    const y=pad.top+cH-(cH*v/max);
    ctx.strokeStyle='rgba(217, 119, 6, 0.12)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+cW,y); ctx.stroke();
    ctx.fillStyle='#64748b'; ctx.font='700 10px Plus Jakarta Sans'; ctx.textAlign='right';
    ctx.fillText(v+'%',pad.left-4,y+4);
  });
  ctx.fillStyle='#0f172a'; ctx.font='700 11px Plus Jakarta Sans'; ctx.textAlign='center';
  data.labels.forEach((l,i)=>ctx.fillText(l,pad.left+i*xStep,H-8));
  const g=ctx.createLinearGradient(0,pad.top,0,pad.top+cH);
  g.addColorStop(0,'#05966955'); g.addColorStop(1,'#05966900');
  ctx.beginPath();
  data.availability.forEach((v,i)=>{ const x=pad.left+i*xStep,y=pad.top+cH-(v/max*cH); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
  ctx.lineTo(pad.left+(data.availability.length-1)*xStep,pad.top+cH);
  ctx.lineTo(pad.left,pad.top+cH); ctx.closePath(); ctx.fillStyle=g; ctx.fill();
  ctx.beginPath(); ctx.strokeStyle='#059669'; ctx.lineWidth=3; ctx.lineJoin='round';
  data.availability.forEach((v,i)=>{ const x=pad.left+i*xStep,y=pad.top+cH-(v/max*cH); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
  ctx.stroke();
  data.availability.forEach((v,i)=>{
    const x=pad.left+i*xStep,y=pad.top+cH-(v/max*cH);
    ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fillStyle='#059669'; ctx.fill();
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.5; ctx.stroke();
  });
}

function renderForecastGrid(forecast) {
  const max = Math.max(...forecast.map(f=>f.orders));
  document.getElementById('forecast-grid').innerHTML = forecast.map(f => `
    <div class="forecast-day">
      <div class="forecast-day-label">${f.day}</div>
      <div class="forecast-day-orders" style="color:${f.color}">${f.orders}</div>
      <div class="forecast-day-trend" style="color:${f.trend==='up'?'var(--green)':'var(--text-muted)'}">${f.trend==='up'?'↑ High':'↓ Avg'}</div>
      <div style="margin-top:8px;height:4px;background:var(--bg-base);border-radius:10px;overflow:hidden">
        <div style="height:100%;width:${(f.orders/max*100).toFixed(0)}%;background:${f.color};border-radius:10px;transition:width 1s"></div>
      </div>
    </div>`).join('');
}

// ─── ALERTS ───────────────────────────────────────────────────────────────────
async function loadAlerts() {
  try {
    const data = await apiFetch('/api/alerts');
    STATE.alerts = data.alerts;
    renderAlerts(data.alerts);
    // Update badge dynamically
    const unread = data.alerts.filter(a => !a.is_read).length;
    const alertBadge = document.querySelector('#nav-alerts .nav-badge');
    if (alertBadge) {
      alertBadge.textContent = unread;
      alertBadge.style.display = unread > 0 ? '' : 'none';
    }
  } catch (err) {
    console.error('Alerts load error:', err);
  }
}

function renderAlerts(alerts) {
  const unread = alerts.filter(a => !a.is_read).length;
  const markAllBtn = unread > 0
    ? `<button onclick="markAllAlertsRead()" style="background:rgba(108,99,255,0.12);border:1px solid rgba(108,99,255,0.3);color:var(--purple);border-radius:8px;padding:7px 16px;font-size:0.78rem;font-weight:600;cursor:pointer;font-family:Inter,sans-serif;margin-bottom:16px;display:block">✓ Mark all as read (${unread})</button>`
    : '';

  document.getElementById('alerts-container').innerHTML = markAllBtn + alerts.map(a => `
    <div class="alert-card ${a.type}" id="alert-card-${a.id}" style="${a.is_read ? 'opacity:0.65;' : ''}">
      <div class="alert-emoji">${a.emoji}</div>
      <div class="alert-main">
        <div class="alert-title">${a.title}</div>
        <div class="alert-desc">${a.description}</div>
        <div class="alert-meta">${a.meta || ''}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <button class="alert-cta" onclick="handleAlertCta(${a.id},'${a.type}')">${a.cta_label}</button>
        ${!a.is_read
          ? `<button onclick="markAlertRead(${a.id})" style="background:none;border:none;font-size:0.68rem;color:var(--text-muted);cursor:pointer;font-family:Inter,sans-serif">Mark read</button>`
          : `<span style="font-size:0.65rem;color:var(--text-muted)">✓ Read</span>`}
      </div>
    </div>`).join('');
}

async function markAllAlertsRead() {
  try {
    await apiFetch('/api/alerts/read-all', { method: 'PATCH' });
    STATE.alerts.forEach(a => a.is_read = 1);
    renderAlerts(STATE.alerts);
    const alertBadge = document.querySelector('#nav-alerts .nav-badge');
    if (alertBadge) alertBadge.style.display = 'none';
    showToast('✓ All alerts marked as read', 'success');
  } catch (err) {
    showToast('❌ Could not mark all read', 'error');
  }
}

async function markAlertRead(id) {
  try {
    await apiFetch(`/api/alerts/${id}/read`, { method: 'PATCH' });
    const card = document.getElementById('alert-card-' + id);
    if (card) card.style.opacity = '0.6';
    const a = STATE.alerts.find(x => x.id === id);
    if (a) a.is_read = 1;
    showToast('✓ Alert marked as read', 'info');
  } catch (err) { /* silent */ }
}

function handleAlertCta(id, type) {
  markAlertRead(id);
  if (type === 'critical' || type === 'warning') { navigateTo('inventory'); showToast('📦 Opening inventory to fix this', 'info'); }
  else if (type === 'opportunity')               { navigateTo('analytics');  showToast('📊 Opening demand forecast', 'info');    }
  else                                           { showToast('✅ Action noted!', 'success'); }
}

// ─── ORDERS ───────────────────────────────────────────────────────────────────
async function loadOrders() {
  try {
    setLoadingState('orders-list', 5, 'order-card');
    const data = await apiFetch('/api/orders');
    STATE.orders = data.orders;
    renderOrders(data.orders);
  } catch (err) {
    showToast('⚠️ Could not load orders', 'error');
  }
}

function renderOrders(orders) {
  const statusClass = { preparing:'os-preparing', ready:'os-ready', delivered:'os-delivered', cancelled:'os-cancelled' };
  const statusLabel = { preparing:'🍳 Preparing', ready:'✅ Ready', delivered:'🚀 Delivered', cancelled:'✕ Cancelled' };
  document.getElementById('orders-list').innerHTML = orders.map(o => `
    <div class="order-card">
      <div>
        <div class="order-id">#${o.order_ref}</div>
        <div style="font-size:0.68rem;color:var(--text-muted);margin-top:2px">${formatTime(o.created_at)}</div>
      </div>
      <div class="order-items">
        <div class="order-name">${o.customer}</div>
        <div class="order-detail">${o.items}</div>
      </div>
      <div class="order-amount">₹${Number(o.amount).toLocaleString('en-IN')}</div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="order-status ${statusClass[o.status]}">${statusLabel[o.status]}</span>
        ${o.status === 'preparing' ? `
          <div style="display:flex;gap:4px">
            <button onclick="updateOrderStatus(${o.id},'ready')" style="background:rgba(0,212,200,0.1);border:1px solid rgba(0,212,200,0.3);color:var(--teal);border-radius:5px;padding:3px 8px;font-size:0.68rem;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">Ready</button>
            <button onclick="updateOrderStatus(${o.id},'cancelled','Store busy')" style="background:rgba(255,83,112,0.1);border:1px solid rgba(255,83,112,0.3);color:var(--red);border-radius:5px;padding:3px 8px;font-size:0.68rem;font-weight:600;cursor:pointer;font-family:Inter,sans-serif">Cancel</button>
          </div>` : ''}
      </div>
    </div>`).join('');
}

async function updateOrderStatus(id, status, cancel_reason = null) {
  try {
    const updated = await apiFetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      body:   JSON.stringify({ status, cancel_reason }),
    });
    const idx = STATE.orders.findIndex(o => o.id === id);
    if (idx !== -1) STATE.orders[idx] = updated;
    renderOrders(STATE.orders);
    showToast(`✅ Order #${updated.order_ref} → ${status}`, 'success');
  } catch (err) {
    showToast('❌ Update failed: ' + err.message, 'error');
  }
}

// ─── DELETE PRODUCT ───────────────────────────────────────────────────────────
async function deleteProduct(id, name) {
  if (!confirm(`Delete "${name}" from your catalog? This cannot be undone.`)) return;
  try {
    await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    STATE.products = STATE.products.filter(p => p.id !== id);
    renderInventoryTable();
    updateFilterCounts();
    updateScoreFromProducts();
    showToast(`🗑️ "${name}" removed from catalog`, 'info');
  } catch (err) {
    showToast('❌ Delete failed: ' + err.message, 'error');
  }
}

// ─── STOCK HISTORY MODAL ──────────────────────────────────────────────────────
async function showStockHistory(productId, productName) {
  try {
    const data = await apiFetch(`/api/products/${productId}/history`);
    const history = data.history;

    const rows = history.length === 0
      ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">No history yet — updates will appear here.</td></tr>`
      : history.map(h => {
          const delta = h.new_qty - h.old_qty;
          const sign  = delta > 0 ? '+' : '';
          const color = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--text-muted)';
          return `
            <tr>
              <td style="font-size:0.78rem;color:var(--text-muted)">${formatTime(h.created_at)}</td>
              <td style="font-size:0.85rem">${h.old_qty} → ${h.new_qty}</td>
              <td style="font-size:0.82rem;color:${color};font-weight:700">${sign}${delta}</td>
              <td style="font-size:0.75rem;color:var(--text-muted);text-transform:capitalize">${h.note || '—'}</td>
            </tr>`;
        }).join('');

    document.getElementById('modal-title').textContent = `📦 Stock History — ${productName}`;
    document.getElementById('modal-body').innerHTML = `
      <div style="max-height:380px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:left;padding:8px 4px;font-size:0.72rem;color:var(--text-muted);font-weight:600">TIME</th>
              <th style="text-align:left;padding:8px 4px;font-size:0.72rem;color:var(--text-muted);font-weight:600">QTY CHANGE</th>
              <th style="text-align:left;padding:8px 4px;font-size:0.72rem;color:var(--text-muted);font-weight:600">DELTA</th>
              <th style="text-align:left;padding:8px 4px;font-size:0.72rem;color:var(--text-muted);font-weight:600">NOTE</th>
            </tr>
          </thead>
          <tbody style="font-family:Inter,sans-serif">${rows}</tbody>
        </table>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-primary" id="modal-cancel" onclick="closeModal()">Close</button>
      </div>`;
    document.getElementById('modal-overlay').classList.add('open');
  } catch (err) {
    showToast('❌ Could not load history: ' + err.message, 'error');
  }
}

// ─── MARK UNAVAILABLE MODAL ────────────────────────────────────────────────────
async function openMarkUnavailableModal() {
  try {
    // Ensure products are loaded
    if (!STATE.products.length) {
      await apiFetch('/api/products').then(d => { STATE.products = d.products; });
    }
    const inStock = STATE.products.filter(p => p.status !== 'out');
    if (inStock.length === 0) {
      showToast('All products already marked as unavailable', 'info');
      return;
    }

    document.getElementById('modal-title').textContent = '🚫 Mark Products Unavailable';
    document.getElementById('modal-body').innerHTML = `
      <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:14px">Select products to mark as out of stock right now:</p>
      <div style="max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:8px" id="unavail-list">
        ${inStock.map(p => `
          <label style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:border-color 0.2s" 
                 onmouseover="this.style.borderColor='rgba(255,83,112,0.4)'" onmouseout="this.style.borderColor='var(--border)'">
            <input type="checkbox" value="${p.id}" style="width:16px;height:16px;accent-color:var(--red);flex-shrink:0">
            <div style="flex:1">
              <div style="font-size:0.85rem;font-weight:600">${p.name}</div>
              <div style="font-size:0.72rem;color:var(--text-muted)">${p.qty} units · ${p.demand} demand</div>
            </div>
            <span class="status-pill status-${p.status}" style="font-size:0.7rem"><span class="status-dot"></span>${{ in:'In Stock', low:'Low Stock' }[p.status]}</span>
          </label>`).join('')}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button type="button" class="btn-primary" style="background:var(--grad-danger);border:none" onclick="confirmMarkUnavailable()">🚫 Mark Selected Unavailable</button>
      </div>`;
    document.getElementById('modal-overlay').classList.add('open');
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

async function confirmMarkUnavailable() {
  const checked = [...document.querySelectorAll('#unavail-list input[type=checkbox]:checked')];
  if (checked.length === 0) { showToast('No products selected', 'info'); return; }
  try {
    await Promise.all(checked.map(c => apiFetch(`/api/products/${c.value}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'mark_out' }),
    })));
    closeModal();
    await loadInventory();
    updateScoreFromProducts();
    showToast(`🚫 ${checked.length} product(s) marked as unavailable`, 'error');
  } catch (err) {
    showToast('❌ Update failed: ' + err.message, 'error');
  }
}

// ─── ADD PRODUCT MODAL ────────────────────────────────────────────────────────
function setupModal() {
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.getElementById('product-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await addNewProduct();
  });
}

function openModal() {
  // Always restore the Add Product form when opening via the normal flow
  document.getElementById('modal-title').textContent = 'Add New Product';
  document.getElementById('modal-body').innerHTML = `
    <form id="product-form">
      <div class="form-group">
        <label for="p-name">Product Name</label>
        <input type="text" id="p-name" placeholder="e.g. Amul Butter 500g" required />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="p-category">Category</label>
          <select id="p-category">
            <option value="grocery">Grocery</option>
            <option value="dairy">Dairy</option>
            <option value="snacks">Snacks</option>
            <option value="beverages">Beverages</option>
            <option value="personal_care">Personal Care</option>
          </select>
        </div>
        <div class="form-group">
          <label for="p-price">Price (\u20b9)</label>
          <input type="number" id="p-price" placeholder="0.00" min="0" step="0.5" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label for="p-qty">Current Stock (units)</label>
          <input type="number" id="p-qty" placeholder="0" min="0" required />
        </div>
        <div class="form-group">
          <label for="p-min">Low Stock Threshold</label>
          <input type="number" id="p-min" placeholder="5" min="1" value="5" />
        </div>
      </div>
      <div class="form-group">
        <label for="p-sku">SKU / Barcode (optional)</label>
        <input type="text" id="p-sku" placeholder="e.g. AMB-500-WH" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-secondary" id="modal-cancel">Cancel</button>
        <button type="submit" class="btn-primary" id="modal-submit">Add Product</button>
      </div>
    </form>`;
  // Re-attach form listener
  document.getElementById('product-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await addNewProduct();
  });
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

async function addNewProduct() {
  const payload = {
    name:     document.getElementById('p-name').value.trim(),
    category: document.getElementById('p-category').value,
    price:    parseFloat(document.getElementById('p-price').value) || 0,
    qty:      parseInt(document.getElementById('p-qty').value)     || 0,
    min_qty:  parseInt(document.getElementById('p-min').value)     || 5,
    sku:      document.getElementById('p-sku').value.trim() || 'NEW-' + Date.now(),
  };

  try {
    const submitBtn = document.getElementById('modal-submit');
    submitBtn.textContent = 'Adding…'; submitBtn.disabled = true;

    const created = await apiFetch('/api/products', { method:'POST', body: JSON.stringify(payload) });
    closeModal();
    showToast(`✅ "${created.name}" added to catalog!`, 'success');
    await loadInventory();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  } finally {
    const submitBtn = document.getElementById('modal-submit');
    if (submitBtn) { submitBtn.textContent = 'Add Product'; submitBtn.disabled = false; }
  }
}

// ─── SEARCH ───────────────────────────────────────────────────────────────────
function setupSearch() {
  let debounceTimer;
  document.getElementById('global-search').addEventListener('input', e => {
    STATE.searchQuery = e.target.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      if (!document.getElementById('page-inventory').classList.contains('active')) {
        await navigateTo('inventory');
      } else {
        await loadInventory();
      }
    }, 300);
  });
}

// ─── SIMULATION ───────────────────────────────────────────────────────────────
function scheduleSimulation() {
  const addOrder = async () => {
    const names   = ['Anjali T.','Suresh P.','Nisha Reddy','Rahul V.','Pooja M.','Kiran B.'];
    const itemSets= ['Amul Butter, Tata Salt','Sprite x3, Kurkure','Aashirvaad Atta, Sunflower Oil','Lays MM x2, Parle-G','Nescafe, Tata Tea'];
    const customer = names[Math.floor(Math.random()*names.length)];
    const items    = itemSets[Math.floor(Math.random()*itemSets.length)];
    const amount   = Math.floor(Math.random()*400)+80;

    try {
      const newOrder = await apiFetch('/api/orders', {
        method: 'POST',
        body:   JSON.stringify({ customer, items, amount, status:'preparing' }),
      });
      STATE.orders.unshift(newOrder);
      if (document.getElementById('page-orders').classList.contains('active')) renderOrders(STATE.orders);

      showToast(`🛒 New order #${newOrder.order_ref} from ${customer.split(' ')[0]}!`, 'info');

      // Update KPI live
      const el = document.getElementById('kpi-orders-val');
      if (el) el.textContent = parseInt(el.textContent) + 1;
    } catch (err) { /* silent */ }

    setTimeout(addOrder, 25000 + Math.random()*20000);
  };

  setTimeout(addOrder, 30000);
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function showToast(message, type='info') {
  const container = document.getElementById('toast-container');
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]||'💬'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

function setLoadingState(containerId, rows, type='tr') {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (type === 'tr') {
    el.innerHTML = Array(rows).fill(`<tr>${Array(8).fill('<td><div class="skel"></div></td>').join('')}</tr>`).join('');
  } else {
    el.innerHTML = Array(rows).fill(`<div class="${type} skel" style="height:72px;border-radius:14px"></div>`).join('');
  }
}

function formatTime(ts) {
  if (!ts) return 'Unknown';
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)  return 'Just now';
  if (diff < 3600) return Math.floor(diff/60) + ' min ago';
  if (diff < 86400) return Math.floor(diff/3600) + ' hr ago';
  return Math.floor(diff/86400) + ' days ago';
}
