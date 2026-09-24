// ============================================================
// KKR Logistics — Expenses Module
// Categories: Diesel, Toll, Driver Allowance, Loading,
//   Unloading, Port Charges, Maintenance, Tyres, Repairs,
//   Weighbridge, Other
// Fields: date, category, vehicle, trip, driver, description,
//         amount, paidBy, receiptNo, notes
// Connected to vehicle and trip where applicable.
// Views: list, category breakdown, vehicle P&L
// ============================================================

// ── Module state ─────────────────────────────────────────────────────────────
let expFilter  = { q: '', category: '', vehicle: '', paidBy: '' };
let expTab     = 'list';    // 'list' | 'breakdown' | 'vehicle'
let editingExpId = null;

// ── Category definitions (single source of truth) ────────────────────────────
const EXP_CATEGORIES = [
  { name: 'Diesel',           color: '#f59e0b', icon: '⛽' },
  { name: 'Toll',             color: '#60a5fa', icon: '🛣️' },
  { name: 'Driver Allowance', color: '#34d399', icon: '👤' },
  { name: 'Loading',          color: '#a78bfa', icon: '⬆️' },
  { name: 'Unloading',        color: '#fb923c', icon: '⬇️' },
  { name: 'Port Charges',     color: '#67e8f9', icon: '⚓' },
  { name: 'Maintenance',      color: '#fbbf24', icon: '🔧' },
  { name: 'Tyres',            color: '#f87171', icon: '⭕' },
  { name: 'Repairs',          color: '#ef4444', icon: '🔨' },
  { name: 'Weighbridge',      color: '#94a3b8', icon: '⚖️' },
  { name: 'Other',            color: '#64748b', icon: '📋' },
];

const EXP_PAID_BY = ['Cash', 'Driver', 'Bank Transfer', 'UPI', 'Cheque', 'Company Account'];

// Colour by category name
function _expCatStyle(catName) {
  const c = EXP_CATEGORIES.find(x => x.name === catName);
  return c ? c : { name: catName, color: '#94a3b8', icon: '📋' };
}

// ── Aggregates ────────────────────────────────────────────────────────────────
function _expStats(rows) {
  const total    = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const byCat    = {};
  const byVeh    = {};
  rows.forEach(r => {
    byCat[r.category] = (byCat[r.category] || 0) + (r.amount || 0);
    const vid = r.vehicle || 'general';
    if (!byVeh[vid]) byVeh[vid] = { total: 0, cats: {} };
    byVeh[vid].total += (r.amount || 0);
    byVeh[vid].cats[r.category] = (byVeh[vid].cats[r.category] || 0) + (r.amount || 0);
  });
  return { total, byCat, byVeh };
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderExpenses() {
  const allExpenses = KKR.getExpenses();
  const allStats    = _expStats(allExpenses);

  let rows = [...allExpenses];
  if (expFilter.category) rows = rows.filter(e => e.category === expFilter.category);
  if (expFilter.vehicle)  rows = rows.filter(e => e.vehicle  === expFilter.vehicle);
  if (expFilter.paidBy)   rows = rows.filter(e => (e.paidBy||'').toLowerCase() === expFilter.paidBy.toLowerCase());
  if (expFilter.q) {
    const q = expFilter.q.toLowerCase();
    rows = rows.filter(e =>
      (e.description || '').toLowerCase().includes(q) ||
      (e.receiptNo   || '').toLowerCase().includes(q) ||
      (e.tripId      || '').toLowerCase().includes(q) ||
      (e.category    || '').toLowerCase().includes(q) ||
      KKR.vehicleReg(e.vehicle).toLowerCase().includes(q) ||
      KKR.driverName(e.driver || '').toLowerCase().includes(q)
    );
  }
  rows = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  const filtStats = _expStats(rows);

  const vehicles = KKR.getVehicles();

  return `
  <div class="page-content">

    <!-- ── Header ────────────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Expenses</div>
        <div class="subtitle">${allExpenses.length} record${allExpenses.length !== 1 ? 's' : ''} · Total: ${fmtCurrency(allStats.total)}</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportExpCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-primary" onclick="openExpForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Expense
        </button>
      </div>
    </div>

    <!-- ── KPI strip ─────────────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px" class="exp-kpi-strip">
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:20px;font-weight:800;color:#f87171">${fmtCurrency(allStats.total)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Total Expenses</div>
      </div>
      ${(() => {
        // Top 4 categories by amount
        const sorted = Object.entries(allStats.byCat).sort((a,b) => b[1]-a[1]).slice(0,4);
        return sorted.map(([cat, amt]) => {
          const cs = _expCatStyle(cat);
          return `
          <div class="card card-sm ${expFilter.category===cat?'exp-active-kpi':''}"
            style="text-align:center;cursor:pointer;transition:all .15s"
            onclick="expFilter.category=expFilter.category==='${cat.replace(/'/g,"\\'")}' ? '' : '${cat.replace(/'/g,"\\'")}'; expTab='list'; rerenderPage()">
            <div style="font-size:18px;margin-bottom:2px">${cs.icon}</div>
            <div style="font-size:16px;font-weight:800;color:${cs.color}">${fmtCurrency(amt)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cat}</div>
          </div>`;
        }).join('');
      })()}
    </div>

    <!-- ── Tabs ──────────────────────────────────────────────────────── -->
    <div class="tabs" style="margin-bottom:0">
      <div class="tab ${expTab==='list'?'active':''}" onclick="expTab='list';rerenderPage()">All Expenses</div>
      <div class="tab ${expTab==='breakdown'?'active':''}" onclick="expTab='breakdown';rerenderPage()">Category Breakdown</div>
      <div class="tab ${expTab==='vehicle'?'active':''}" onclick="expTab='vehicle';rerenderPage()">By Vehicle</div>
    </div>

    ${expTab === 'breakdown' ? _renderExpBreakdown(allStats, allExpenses)
      : expTab === 'vehicle' ? _renderExpByVehicle(allStats, allExpenses, vehicles)
      : _renderExpList(rows, allExpenses, filtStats, vehicles)}

  </div>

  <!-- ── Add / Edit modal ─────────────────────────────────────────── -->
  <div class="modal-overlay" id="exp-form-modal">
    <div class="modal" style="max-width:700px">
      <div class="modal-header">
        <div class="modal-title" id="exp-form-title">Add Expense</div>
        <button class="modal-close" onclick="closeModal('exp-form-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="exp-form-body"></div>
    </div>
  </div>

  <style>
    .exp-active-kpi { border-color:#2563eb!important;background:rgba(37,99,235,0.06)!important; }
    @media(max-width:900px){ .exp-kpi-strip{grid-template-columns:repeat(3,1fr)!important} }
    @media(max-width:540px){ .exp-kpi-strip{grid-template-columns:repeat(2,1fr)!important} }
  </style>`;
}

// ── List tab ─────────────────────────────────────────────────────────────────
function _renderExpList(rows, allExpenses, filtStats, vehicles) {
  const catNames = EXP_CATEGORIES.map(c => c.name);

  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div class="filter-bar" style="margin-bottom:16px;flex-wrap:wrap">
      <div class="search-input-wrap" style="flex:1;min-width:180px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search description, trip, vehicle, receipt…"
          value="${expFilter.q}" oninput="expFilter.q=this.value;rerenderPage()">
      </div>
      <select class="form-control" style="width:165px" onchange="expFilter.category=this.value;rerenderPage()">
        <option value="">All Categories</option>
        ${catNames.map(c => `<option value="${c}" ${expFilter.category===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <select class="form-control" style="width:155px" onchange="expFilter.vehicle=this.value;rerenderPage()">
        <option value="">All Vehicles</option>
        ${vehicles.map(v => `<option value="${v.id}" ${expFilter.vehicle===v.id?'selected':''}>${v.regNo}</option>`).join('')}
      </select>
      <select class="form-control" style="width:135px" onchange="expFilter.paidBy=this.value;rerenderPage()">
        <option value="">All Payments</option>
        ${EXP_PAID_BY.map(p => `<option value="${p}" ${expFilter.paidBy===p?'selected':''}>${p}</option>`).join('')}
      </select>
      ${expFilter.q||expFilter.category||expFilter.vehicle||expFilter.paidBy
        ? `<button class="btn btn-secondary btn-sm" onclick="expFilter={q:'',category:'',vehicle:'',paidBy:''};rerenderPage()">Clear</button>` : ''}
      <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${rows.length} of ${allExpenses.length}</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Category</th>
            <th>Vehicle</th>
            <th>Driver</th>
            <th>Trip</th>
            <th>Description</th>
            <th>Paid By</th>
            <th>Receipt</th>
            <th style="text-align:right">Amount</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
        ${rows.length === 0 ? `
          <tr><td colspan="10" style="padding:56px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:8px">📋</div>
            <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No expenses found</div>
            <div style="font-size:12px">${expFilter.q||expFilter.category||expFilter.vehicle||expFilter.paidBy?'Try clearing filters':'Click "Add Expense" to start tracking'}</div>
          </td></tr>` :
          rows.map(e => {
            const cs  = _expCatStyle(e.category);
            const vid = e.vehicle ? KKR.vehicleReg(e.vehicle) : '—';
            const did = e.driver  ? KKR.driverName(e.driver)  : '—';
            return `
            <tr>
              <td style="white-space:nowrap">${fmtDate(e.date)}</td>
              <td>
                <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
                  background:${cs.color}18;color:${cs.color};border:1px solid ${cs.color}30">
                  ${cs.icon} ${e.category}
                </span>
              </td>
              <td style="white-space:nowrap">${vid}</td>
              <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${did}</td>
              <td>${e.tripId ? `<span class="font-bold text-blue">${e.tripId}</span>` : '—'}</td>
              <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.description||''}">${e.description || '—'}</td>
              <td>
                <span style="font-size:11px;padding:2px 8px;border-radius:20px;background:rgba(51,65,85,0.4);color:var(--text-muted);font-weight:600;text-transform:capitalize">
                  ${e.paidBy || '—'}
                </span>
              </td>
              <td style="color:var(--text-muted);font-size:11px">${e.receiptNo || e.receipt || '—'}</td>
              <td class="text-right font-bold" style="color:#f87171">${fmtCurrency(e.amount)}</td>
              <td>
                <div class="flex gap-2" style="justify-content:center">
                  <button class="btn btn-xs btn-secondary" title="Edit" onclick="openExpForm('${e.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-xs btn-danger" title="Delete" onclick="deleteExp('${e.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        ${rows.length > 0 ? `
        <tfoot>
          <tr style="border-top:2px solid var(--border);background:rgba(239,68,68,0.04)">
            <td colspan="8" style="padding:11px 16px;font-weight:700;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">
              Total (${rows.length} record${rows.length!==1?'s':''})
            </td>
            <td class="text-right font-bold" style="padding:11px 16px;color:#f87171">${fmtCurrency(filtStats.total)}</td>
            <td></td>
          </tr>
        </tfoot>` : ''}
      </table>
    </div>
  </div>`;
}

// ── Category Breakdown tab ────────────────────────────────────────────────────
function _renderExpBreakdown(allStats, allExpenses) {
  const sorted = EXP_CATEGORIES
    .map(c => ({ ...c, amount: allStats.byCat[c.name] || 0, count: allExpenses.filter(e=>e.category===c.name).length }))
    .filter(c => c.amount > 0)
    .sort((a,b) => b.amount - a.amount);

  if (!sorted.length) return `
    <div class="card" style="border-radius:0 12px 12px 12px;padding:60px;text-align:center;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary)">No expenses yet</div>
    </div>`;

  const maxAmt = sorted[0].amount;

  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px">
        Breakdown · Total: ${fmtCurrency(allStats.total)}
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" onclick="printExpBreakdown()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print
        </button>
        <button class="btn btn-sm btn-secondary" onclick="exportExpBreakdownCSV()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>
    </div>

    <!-- Bar chart -->
    <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:28px">
      ${sorted.map(c => {
        const pct = Math.round(c.amount / allStats.total * 100);
        const bar = Math.round(c.amount / maxAmt * 100);
        return `
        <div style="cursor:pointer" onclick="expTab='list';expFilter.category='${c.name.replace(/'/g,"\\'")}';rerenderPage()">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:16px">${c.icon}</span>
              <span style="font-size:13px;font-weight:700">${c.name}</span>
              <span style="font-size:11px;padding:2px 7px;border-radius:20px;background:${c.color}15;color:${c.color};font-weight:600">${c.count} record${c.count!==1?'s':''}</span>
            </div>
            <div style="text-align:right">
              <span style="font-size:15px;font-weight:800;color:${c.color}">${fmtCurrency(c.amount)}</span>
              <span style="font-size:11px;color:var(--text-muted);margin-left:6px">${pct}%</span>
            </div>
          </div>
          <div style="background:var(--bg-dark);border-radius:99px;height:8px;overflow:hidden">
            <div style="height:100%;border-radius:99px;background:${c.color};width:${bar}%;transition:width .4s ease"></div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- Grid cards -->
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">All Categories</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
      ${EXP_CATEGORIES.map(c => {
        const amt   = allStats.byCat[c.name] || 0;
        const count = allExpenses.filter(e=>e.category===c.name).length;
        const pct   = allStats.total > 0 ? Math.round(amt/allStats.total*100) : 0;
        return `
        <div style="background:var(--bg-dark);border:1px solid ${amt>0?c.color+'25':'var(--border)'};border-radius:10px;padding:14px;cursor:${amt>0?'pointer':'default'};transition:all .15s"
          ${amt>0?`onclick="expTab='list';expFilter.category='${c.name.replace(/'/g,"\\'")}';rerenderPage()"`:''}>
          <div style="font-size:20px;margin-bottom:6px">${c.icon}</div>
          <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${c.name}</div>
          <div style="font-size:16px;font-weight:800;color:${amt>0?c.color:'var(--text-muted)'};margin-top:4px">${fmtCurrency(amt)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${count} record${count!==1?'s':''} · ${pct}%</div>
          ${amt>0?`<div style="background:rgba(255,255,255,0.06);border-radius:99px;height:3px;margin-top:8px;overflow:hidden">
            <div style="height:100%;background:${c.color};width:${pct}%;transition:width .4s"></div>
          </div>`:''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── By Vehicle tab ────────────────────────────────────────────────────────────
function _renderExpByVehicle(allStats, allExpenses, vehicles) {
  // Build vehicle-level totals
  const vehMap = {};
  allExpenses.forEach(e => {
    const vid = e.vehicle || '__general__';
    if (!vehMap[vid]) vehMap[vid] = { total: 0, cats: {}, count: 0 };
    vehMap[vid].total += (e.amount || 0);
    vehMap[vid].cats[e.category] = (vehMap[vid].cats[e.category] || 0) + (e.amount || 0);
    vehMap[vid].count++;
  });

  // Revenue (gross freight) per vehicle from trips
  const vehRevenue = {};
  KKR.getTrips().filter(t => t.status !== 'cancelled').forEach(t => {
    const v   = t.vehicle;
    const rev = t.grandTotal || t.freight || 0;
    vehRevenue[v] = (vehRevenue[v] || 0) + rev;
  });

  const rows = [
    ...vehicles.map(v => ({
      vid:     v.id,
      regNo:   v.regNo,
      make:    `${v.make} ${v.model}`,
      exp:     (vehMap[v.id] || {}).total   || 0,
      count:   (vehMap[v.id] || {}).count   || 0,
      cats:    (vehMap[v.id] || {}).cats    || {},
      rev:     vehRevenue[v.id]             || 0,
    })),
    // General (no vehicle)
    vehMap['__general__'] ? {
      vid:     '__general__',
      regNo:   'General',
      make:    'Not vehicle-specific',
      exp:     vehMap['__general__'].total,
      count:   vehMap['__general__'].count,
      cats:    vehMap['__general__'].cats,
      rev:     0,
    } : null,
  ].filter(Boolean).sort((a,b) => b.exp - a.exp);

  if (!rows.some(r => r.exp > 0)) return `
    <div class="card" style="border-radius:0 12px 12px 12px;padding:60px;text-align:center;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">🚛</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary)">No vehicle expenses recorded yet</div>
    </div>`;

  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px">
        Vehicle-wise Expenses &amp; P&amp;L
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" onclick="printExpByVehicle()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print
        </button>
        <button class="btn btn-sm btn-secondary" onclick="exportExpByVehicleCSV()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
      </div>
    </div>
    <div class="table-wrap" style="margin-bottom:28px">
      <table>
        <thead>
          <tr>
            <th>Vehicle</th>
            <th style="text-align:center">Records</th>
            <th style="text-align:right">Total Expenses</th>
            <th style="text-align:right">Revenue (Freight)</th>
            <th style="text-align:right">Net Margin</th>
            <th>Top Expense</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
        ${rows.filter(r=>r.exp>0).map(r => {
          const margin    = r.rev - r.exp;
          const mColor    = margin >= 0 ? '#34d399' : '#f87171';
          const topCat    = Object.entries(r.cats).sort((a,b)=>b[1]-a[1])[0];
          const topCs     = topCat ? _expCatStyle(topCat[0]) : null;
          const sharePct  = allStats.total > 0 ? Math.round(r.exp / allStats.total * 100) : 0;
          return `
          <tr style="cursor:pointer" onclick="expFilter.vehicle='${r.vid==='__general__'?'':r.vid}';expTab='list';rerenderPage()">
            <td>
              <div class="font-bold">${r.regNo}</div>
              <div style="font-size:11px;color:var(--text-muted)">${r.make}</div>
            </td>
            <td style="text-align:center">${r.count}</td>
            <td class="text-right font-bold" style="color:#f87171">${fmtCurrency(r.exp)}</td>
            <td class="text-right font-bold" style="color:#60a5fa">${r.rev > 0 ? fmtCurrency(r.rev) : '—'}</td>
            <td class="text-right font-bold" style="color:${mColor}">${r.rev > 0 ? fmtCurrency(margin) : '—'}</td>
            <td>
              ${topCat ? `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;border-radius:20px;background:${topCs.color}15;color:${topCs.color};font-weight:700">
                ${topCs.icon} ${topCat[0]} (${fmtCurrency(topCat[1])})
              </span>` : '—'}
            </td>
            <td style="min-width:90px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="flex:1;background:var(--bg-dark);border-radius:99px;height:5px;overflow:hidden">
                  <div style="height:100%;background:#ef4444;border-radius:99px;width:${sharePct}%"></div>
                </div>
                <span style="font-size:11px;color:var(--text-muted)">${sharePct}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid var(--border)">
            <td style="padding:10px 16px;font-weight:700">Fleet Total</td>
            <td style="text-align:center;padding:10px 16px;font-weight:700">${allExpenses.length}</td>
            <td class="text-right font-bold" style="padding:10px 16px;color:#f87171">${fmtCurrency(allStats.total)}</td>
            <td class="text-right font-bold" style="padding:10px 16px;color:#60a5fa">${fmtCurrency(Object.values(vehRevenue).reduce((s,v)=>s+v,0))}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Per-vehicle bar chart -->
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">
      Expense Distribution by Vehicle
    </div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${rows.filter(r=>r.exp>0).map(r => {
        const maxExp = Math.max(...rows.map(x=>x.exp), 1);
        const pct = Math.round(r.exp / maxExp * 100);
        return `
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:13px;font-weight:600">${r.regNo}</span>
            <span style="font-size:13px;font-weight:700;color:#f87171">${fmtCurrency(r.exp)}</span>
          </div>
          <div style="background:var(--bg-dark);border-radius:99px;height:7px;overflow:hidden">
            <div style="height:100%;border-radius:99px;background:#ef4444;width:${pct}%;transition:width .4s"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ── Add / Edit form ───────────────────────────────────────────────────────────
function openExpForm(id = null) {
  editingExpId = id;
  const e       = id ? (KKR.getExpenses().find(x => x.id === id) || {}) : {};
  const vehicles = KKR.getVehicles();
  const drivers  = KKR.getDrivers();
  const trips    = KKR.getTrips().filter(t => t.status !== 'cancelled');
  document.getElementById('exp-form-title').textContent = id ? `Edit Expense` : 'Add Expense';

  document.getElementById('exp-form-body').innerHTML = `
    <form onsubmit="saveExp(event)" autocomplete="off">

      <!-- ─ Core ─────────────────────────────────────────────────────── -->
      <div class="exp-section-hdr">Expense Details</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Date <span style="color:#f87171">*</span></label>
          <input type="date" class="form-control" id="ef-date"
            value="${fmtDateInput(e.date || today())}" required>
        </div>
        <div class="form-group" style="grid-column:span 2">
          <label class="form-label">Category <span style="color:#f87171">*</span></label>
          <div style="display:flex;gap:6px;flex-wrap:wrap" id="exp-cat-pills">
            ${EXP_CATEGORIES.map(c => {
              const selected = (e.category || 'Toll') === c.name;
              return `<button type="button"
                id="exp-cat-${c.name.replace(/\s+/g,'-')}"
                class="btn btn-sm exp-cat-pill ${selected?'active':''}"
                style="padding:5px 12px;font-size:12px;border:1.5px solid ${selected?c.color:'var(--border)'};background:${selected?c.color+'20':'transparent'};color:${selected?c.color:'var(--text-muted)'};transition:all .12s"
                onclick="expSelectCat('${c.name.replace(/'/g,"\\'")}','${c.color}')">
                ${c.icon} ${c.name}
              </button>`;
            }).join('')}
          </div>
          <input type="hidden" id="ef-cat" value="${e.category || 'Toll'}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description <span style="color:#f87171">*</span></label>
        <input class="form-control" id="ef-desc"
          value="${e.description || ''}"
          placeholder="Brief description of this expense…" required>
      </div>

      <!-- ─ Connections ────────────────────────────────────────────── -->
      <div class="exp-section-hdr" style="margin-top:18px">Vehicle, Driver &amp; Trip</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Vehicle</label>
          <select class="form-control" id="ef-vehicle" onchange="expAutoFillFromVehicle(this.value)">
            <option value="">— None —</option>
            ${vehicles.map(v =>
              `<option value="${v.id}" ${e.vehicle===v.id?'selected':''}>${v.regNo} · ${v.make}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Driver</label>
          <select class="form-control" id="ef-driver">
            <option value="">— None —</option>
            ${drivers.map(d =>
              `<option value="${d.id}" ${e.driver===d.id?'selected':''}>${d.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Trip</label>
          <select class="form-control" id="ef-trip" onchange="expAutoFillFromTrip(this.value)">
            <option value="">— None —</option>
            ${trips.map(t => {
              const from = t.loadingPoint || t.from || '';
              const to   = t.destination  || t.to   || '';
              return `<option value="${t.id}" ${e.tripId===t.id?'selected':''}>${t.id}${from?' · '+from+'→'+to:''}</option>`;
            }).join('')}
          </select>
        </div>
      </div>

      <!-- ─ Amount & Payment ───────────────────────────────────────── -->
      <div class="exp-section-hdr" style="margin-top:18px">Amount &amp; Payment</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Amount (₹) <span style="color:#f87171">*</span></label>
          <input type="number" step="0.01" class="form-control" id="ef-amount"
            value="${e.amount || ''}" placeholder="0.00"
            min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Paid By</label>
          <select class="form-control" id="ef-paidby">
            <option value="">— Select —</option>
            ${EXP_PAID_BY.map(p =>
              `<option value="${p}" ${(e.paidBy||'')==p?'selected':''}>${p}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Receipt No.</label>
          <input class="form-control" id="ef-receipt"
            value="${e.receiptNo || e.receipt || ''}" placeholder="Optional">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="ef-notes" rows="2"
          placeholder="Any additional details…">${e.notes || ''}</textarea>
      </div>

      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('exp-form-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update Expense' : 'Save Expense'}
        </button>
      </div>
    </form>
    <style>
      .exp-section-hdr{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
    </style>`;

  openModal('exp-form-modal');
}

// ── Category pill selection in form ──────────────────────────────────────────
function expSelectCat(catName, color) {
  document.getElementById('ef-cat').value = catName;
  // Update all pills
  EXP_CATEGORIES.forEach(c => {
    const btn = document.getElementById('exp-cat-' + c.name.replace(/\s+/g, '-'));
    if (!btn) return;
    if (c.name === catName) {
      btn.style.borderColor = color;
      btn.style.background  = color + '20';
      btn.style.color       = color;
    } else {
      btn.style.borderColor = 'var(--border)';
      btn.style.background  = 'transparent';
      btn.style.color       = 'var(--text-muted)';
    }
  });
}

// ── Auto-fill driver from vehicle ────────────────────────────────────────────
function expAutoFillFromVehicle(vehicleId) {
  const v   = KKR.getVehicles().find(x => x.id === vehicleId);
  const dEl = document.getElementById('ef-driver');
  if (v && v.driver && dEl && !dEl.value) dEl.value = v.driver;
}

// ── Auto-fill vehicle/driver from trip ───────────────────────────────────────
function expAutoFillFromTrip(tripId) {
  if (!tripId) return;
  const t = KKR.getTrips().find(x => x.id === tripId);
  if (!t) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val && !el.value) el.value = val; };
  set('ef-vehicle', t.vehicle);
  set('ef-driver',  t.driver);
  expAutoFillFromVehicle(t.vehicle);
}

// ── Save ─────────────────────────────────────────────────────────────────────
function saveExp(e) {
  e.preventDefault();
  const expenses = KKR.getExpenses();
  const entry = {
    id:          editingExpId || 'EX' + Date.now().toString().slice(-6),
    date:        document.getElementById('ef-date').value,
    category:    document.getElementById('ef-cat').value,
    description: document.getElementById('ef-desc').value.trim(),
    vehicle:     document.getElementById('ef-vehicle').value,
    driver:      document.getElementById('ef-driver').value,
    tripId:      document.getElementById('ef-trip').value,
    amount:      parseFloat(document.getElementById('ef-amount').value) || 0,
    paidBy:      document.getElementById('ef-paidby').value,
    receiptNo:   document.getElementById('ef-receipt').value.trim(),
    receipt:     document.getElementById('ef-receipt').value.trim(), // legacy alias
    notes:       document.getElementById('ef-notes').value.trim(),
  };
  const idx = expenses.findIndex(x => x.id === editingExpId);
  if (idx >= 0) expenses[idx] = entry; else expenses.unshift(entry);
  KKR.saveExpenses(expenses);
  closeModal('exp-form-modal');
  toast(editingExpId ? 'Expense updated' : 'Expense saved', 'success');
  rerenderPage();
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteExp(id) {
  const e   = KKR.getExpenses().find(x => x.id === id);
  const lbl = e ? `${e.category} — ${fmtCurrency(e.amount)} (${fmtDate(e.date)})` : id;
  confirmDelete(lbl, () => {
    KKR.saveExpenses(KKR.getExpenses().filter(x => x.id !== id));
    toast('Expense deleted', 'error');
    rerenderPage();
  });
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportExpCSV() {
  const rows = KKR.getExpenses().map(e => ({
    'Date':        e.date,
    'Category':    e.category,
    'Description': e.description || '',
    'Vehicle':     KKR.vehicleReg(e.vehicle) || '',
    'Driver':      KKR.driverName(e.driver)  || '',
    'Trip':        e.tripId   || '',
    'Amount (₹)':  e.amount,
    'Paid By':     e.paidBy   || '',
    'Receipt No':  e.receiptNo || e.receipt || '',
    'Notes':       e.notes    || '',
  }));
  exportCSV(Object.keys(rows[0] || {}), rows, `kkr-expenses-${today()}.csv`);
  toast('Expenses exported', 'success');
}

// ── Backward-compat alias ────────────────────────────────────────────────────
function openExpModal(id = null) { openExpForm(id); }
