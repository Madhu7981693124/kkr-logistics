// ============================================================
// KKR Logistics — E-Way Bill Module
//
// Fields (new over old):
//   billNo, issueDate (was 'date'), validUpto
//   tripId, invoiceId (NEW), vehicle, customer (NEW)
//   material, quantity (NEW), value (consignment value)
//   pickup (was 'from'), destination (was 'to')
//   transMode (Road/Rail/Air/Ship), docType (Tax Invoice/Bill of Supply/…)
//   docNo, docDate
//   docImage (base64 — document upload)
//   remarks, status
//
// Status is AUTO-DERIVED from validUpto:
//   Expired     → validUpto < today
//   Expiring Soon → validUpto within 3 days from today
//   Active      → validUpto >= today + 3 days
//   (Cancelled  → manually set)
//
// Legacy fields kept:  date = issueDate, from = pickup, to = destination
// so all existing seed data and dashboard code continue to work.
//
// Dashboard e-way panel reads KKR.getEwayBills() — no change needed there.
// ============================================================

// ── Module state ────────────────────────────────────────────────────────────
let ewayFilter   = { q: '', status: '', customer: '' };
let ewayTab      = 'list';   // 'list' | 'alerts'
let editingEwayId = null;
let viewingEwayId = null;

// ── Status thresholds ────────────────────────────────────────────────────────
const EWAY_EXPIRY_WARN_DAYS = 3;    // "Expiring Soon" window

// ── Auto-derive status from expiry date ──────────────────────────────────────
function _ewayComputedStatus(bill) {
  if (bill.status === 'cancelled') return 'cancelled';
  const d = daysFromNow(bill.validUpto);
  if (d === null) return bill.status || 'active';
  if (d < 0)                          return 'expired';
  if (d <= EWAY_EXPIRY_WARN_DAYS)     return 'expiring';
  return 'active';
}

// Colour / label per derived status
function _ewayStatusStyle(status) {
  switch (status) {
    case 'active':    return { color: '#34d399', bg: 'rgba(16,185,129,0.12)',  label: 'Active'        };
    case 'expiring':  return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  label: 'Expiring Soon' };
    case 'expired':   return { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   label: 'Expired'       };
    case 'cancelled': return { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: 'Cancelled'     };
    default:          return { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: status          };
  }
}

function _ewayBadge(status) {
  const s = _ewayStatusStyle(status);
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${s.bg};color:${s.color};border:1px solid ${s.color}30">
    <span style="width:6px;height:6px;border-radius:50%;background:${s.color};flex-shrink:0"></span>
    ${s.label}
  </span>`;
}

// ── Expiry cell (colour-coded) ────────────────────────────────────────────────
function _ewayExpiryCell(dateStr) {
  if (!dateStr) return '<span style="color:var(--text-muted)">—</span>';
  const d   = daysFromNow(dateStr);
  const fmt = fmtDate(dateStr);
  if (d === null) return fmt;
  if (d < 0)  return `<span style="color:#f87171;font-weight:700">${fmt} <small>(expired ${Math.abs(d)}d ago)</small></span>`;
  if (d === 0) return `<span style="color:#f87171;font-weight:800">${fmt} <small>(TODAY)</small></span>`;
  if (d <= 1)  return `<span style="color:#f87171;font-weight:700">${fmt} <small>(${d}d left)</small></span>`;
  if (d <= 3)  return `<span style="color:#fbbf24;font-weight:700">${fmt} <small>(${d}d)</small></span>`;
  if (d <= 7)  return `<span style="color:#fb923c">${fmt} <small>(${d}d)</small></span>`;
  return `<span>${fmt}</span>`;
}

// ── Aggregate stats ───────────────────────────────────────────────────────────
function _ewayStats(bills) {
  const active     = bills.filter(b => _ewayComputedStatus(b) === 'active').length;
  const expiring   = bills.filter(b => _ewayComputedStatus(b) === 'expiring').length;
  const expired    = bills.filter(b => _ewayComputedStatus(b) === 'expired').length;
  const cancelled  = bills.filter(b => b.status === 'cancelled').length;
  const totalValue = bills.reduce((s, b) => s + (b.value || 0), 0);
  return { active, expiring, expired, cancelled, total: bills.length, totalValue };
}

// ── Dashboard alert builder (called from dashboard.js _dashStats) ────────────
// Returns bills expiring within N days (active only, sorted soonest first)
function getEwayExpiryAlerts(days = 3) {
  return KKR.getEwayBills()
    .filter(b => {
      if (b.status === 'cancelled') return false;
      const d = daysFromNow(b.validUpto);
      return d !== null && d >= 0 && d <= days;
    })
    .sort((a, b) => a.validUpto.localeCompare(b.validUpto));
}

// ── Main render ───────────────────────────────────────────────────────────────
function renderEway() {
  const allBills  = KKR.getEwayBills();
  const st        = _ewayStats(allBills);
  const customers = KKR.getCustomers();

  let rows = [...allBills];

  // Apply status filter using computed status
  if (ewayFilter.status) {
    rows = rows.filter(b => {
      const cs = _ewayComputedStatus(b);
      if (ewayFilter.status === 'active')    return cs === 'active';
      if (ewayFilter.status === 'expiring')  return cs === 'expiring';
      if (ewayFilter.status === 'expired')   return cs === 'expired';
      if (ewayFilter.status === 'cancelled') return b.status === 'cancelled';
      return true;
    });
  }
  if (ewayFilter.customer) rows = rows.filter(b => b.customer === ewayFilter.customer);
  if (ewayFilter.q) {
    const q = ewayFilter.q.toLowerCase();
    rows = rows.filter(b =>
      (b.billNo     || '').toLowerCase().includes(q) ||
      (b.tripId     || '').toLowerCase().includes(q) ||
      (b.invoiceId  || '').toLowerCase().includes(q) ||
      (b.pickup     || b.from || '').toLowerCase().includes(q) ||
      (b.destination|| b.to   || '').toLowerCase().includes(q) ||
      KKR.vehicleReg(b.vehicle).toLowerCase().includes(q) ||
      KKR.customerName(b.customer).toLowerCase().includes(q)
    );
  }
  rows = [...rows].sort((a, b) => {
    // Active/expiring first, then by expiry date ascending
    const sa = _ewayComputedStatus(a);
    const sb = _ewayComputedStatus(b);
    const order = { expiring: 0, active: 1, expired: 2, cancelled: 3 };
    const oa = order[sa] ?? 4;
    const ob = order[sb] ?? 4;
    if (oa !== ob) return oa - ob;
    return (a.validUpto || '').localeCompare(b.validUpto || '');
  });

  return `
  <div class="page-content">

    <!-- ── Header ────────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">E-Way Bills</div>
        <div class="subtitle">${st.total} bill${st.total!==1?'s':''} · ${st.active} active · ${fmtCurrency(st.totalValue)} total consignment value</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportEwayCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-primary" onclick="openEwayForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New E-Way Bill
        </button>
      </div>
    </div>

    <!-- ── KPI strip ─────────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px" class="eway-kpi-strip">
      ${[
        { label:'Total',         val: st.total,     col:'#60a5fa', filter:'' },
        { label:'Active',        val: st.active,    col:'#34d399', filter:'active' },
        { label:'Expiring Soon', val: st.expiring,  col:'#fbbf24', filter:'expiring' },
        { label:'Expired',       val: st.expired,   col:'#f87171', filter:'expired' },
        { label:'Cancelled',     val: st.cancelled, col:'#64748b', filter:'cancelled' },
      ].map(s => `
        <div class="card card-sm eway-kpi-card ${ewayFilter.status===s.filter&&(s.filter||ewayFilter.status==='')?'eway-kpi-active':''}"
          style="text-align:center;cursor:pointer;transition:all .15s"
          onclick="ewayFilter.status='${s.filter}';ewayTab='list';rerenderPage()">
          <div style="font-size:22px;font-weight:800;color:${s.col}">${s.val}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.label}</div>
        </div>`).join('')}
    </div>

    <!-- ── Tabs ────────────────────────────────────────────────── -->
    <div class="tabs" style="margin-bottom:0">
      <div class="tab ${ewayTab==='list'?'active':''}" onclick="ewayTab='list';rerenderPage()">All Bills</div>
      <div class="tab ${ewayTab==='alerts'?'active':''}" onclick="ewayTab='alerts';rerenderPage()">
        Expiry Alerts
        ${(st.expiring + st.expired) > 0
          ? `<span style="margin-left:6px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px">${st.expiring + st.expired}</span>`
          : ''}
      </div>
    </div>

    ${ewayTab === 'alerts' ? _renderEwayAlerts(allBills) : _renderEwayList(rows, allBills, customers)}

  </div>

  <!-- ── Add / Edit modal ─────────────────────────────────────────── -->
  <div class="modal-overlay" id="eway-form-modal">
    <div class="modal" style="max-width:800px">
      <div class="modal-header">
        <div class="modal-title" id="eway-form-title">New E-Way Bill</div>
        <button class="modal-close" onclick="closeModal('eway-form-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="eway-form-body"></div>
    </div>
  </div>

  <!-- ── View / detail modal ──────────────────────────────────────── -->
  <div class="modal-overlay" id="eway-view-modal">
    <div class="modal" style="max-width:700px">
      <div class="modal-header">
        <div class="modal-title" id="eway-view-title">E-Way Bill Details</div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" id="eway-view-edit-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn btn-sm btn-secondary" onclick="ewayPrint()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <button class="modal-close" onclick="closeModal('eway-view-modal')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-body" id="eway-view-body"></div>
    </div>
  </div>

  <style>
    .eway-kpi-card:hover { border-color:#475569!important;transform:translateY(-1px); }
    .eway-kpi-active      { border-color:#2563eb!important;background:rgba(37,99,235,0.06)!important; }
    .eway-det-grid        { display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden; }
    .eway-det-grid .eway-det-row:nth-child(odd) { border-right:1px solid rgba(51,65,85,0.4); }
    .eway-det-row         { display:flex;flex-direction:column;padding:10px 14px;border-bottom:1px solid rgba(51,65,85,0.4); }
    .eway-det-label       { font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px; }
    .eway-det-val         { font-size:13.5px;font-weight:600;color:var(--text-primary); }
    .eway-sec-hdr         { font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;padding:10px 14px;background:rgba(51,65,85,0.2);border-bottom:1px solid var(--border); }
    @media(max-width:640px){ .eway-det-grid{grid-template-columns:1fr!important} .eway-det-grid .eway-det-row:nth-child(odd){border-right:none} }
    @media(max-width:900px) { .eway-kpi-strip{grid-template-columns:repeat(3,1fr)!important} }
    @media(max-width:500px) { .eway-kpi-strip{grid-template-columns:repeat(2,1fr)!important} }
  </style>`;
}

// ── List tab ──────────────────────────────────────────────────────────────────
function _renderEwayList(rows, allBills, customers) {
  const vehicles  = KKR.getVehicles();
  const materials = KKR.getMaterials();

  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div class="filter-bar" style="margin-bottom:16px;flex-wrap:wrap">
      <div class="search-input-wrap" style="flex:1;min-width:180px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search bill no., trip, invoice, route…"
          value="${ewayFilter.q}" oninput="ewayFilter.q=this.value;rerenderPage()">
      </div>
      <select class="form-control" style="width:160px" onchange="ewayFilter.status=this.value;rerenderPage()">
        <option value="">All Statuses</option>
        <option value="active"    ${ewayFilter.status==='active'?'selected':''}>Active</option>
        <option value="expiring"  ${ewayFilter.status==='expiring'?'selected':''}>Expiring Soon</option>
        <option value="expired"   ${ewayFilter.status==='expired'?'selected':''}>Expired</option>
        <option value="cancelled" ${ewayFilter.status==='cancelled'?'selected':''}>Cancelled</option>
      </select>
      <select class="form-control" style="width:175px" onchange="ewayFilter.customer=this.value;rerenderPage()">
        <option value="">All Customers</option>
        ${customers.map(c => `<option value="${c.id}" ${ewayFilter.customer===c.id?'selected':''}>${c.name}</option>`).join('')}
      </select>
      ${ewayFilter.q||ewayFilter.status||ewayFilter.customer
        ? `<button class="btn btn-secondary btn-sm" onclick="ewayFilter={q:'',status:'',customer:''};rerenderPage()">Clear</button>` : ''}
      <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${rows.length} of ${allBills.length}</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>E-Way Bill No.</th>
            <th>Issue Date</th>
            <th>Valid Until</th>
            <th>Customer</th>
            <th>Trip</th>
            <th>Invoice</th>
            <th>Vehicle</th>
            <th>Route</th>
            <th>Material</th>
            <th style="text-align:right">Qty (MT)</th>
            <th style="text-align:right">Value</th>
            <th>Status</th>
            <th>Doc</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
        ${rows.length === 0 ? `
          <tr><td colspan="14" style="padding:56px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:8px">📋</div>
            <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No E-Way Bills found</div>
            <div style="font-size:12px">${ewayFilter.q||ewayFilter.status||ewayFilter.customer?'Try clearing filters':'Click "New E-Way Bill" to add one'}</div>
          </td></tr>` :
          rows.map(b => {
            const cs      = _ewayComputedStatus(b);
            const pickup  = b.pickup      || b.from || '—';
            const dest    = b.destination || b.to   || '—';
            return `
            <tr style="cursor:pointer" onclick="viewEway('${b.id}')">
              <td>
                <span class="font-bold text-blue" style="cursor:pointer">${b.billNo}</span>
              </td>
              <td style="white-space:nowrap">${fmtDate(b.issueDate || b.date)}</td>
              <td onclick="event.stopPropagation()">${_ewayExpiryCell(b.validUpto)}</td>
              <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${b.customer ? KKR.customerName(b.customer) : '—'}
              </td>
              <td>${b.tripId    ? `<span class="font-bold text-blue">${b.tripId}</span>`   : '—'}</td>
              <td>${b.invoiceId ? `<span class="font-bold" style="color:#a78bfa">${b.invoiceId}</span>` : '—'}</td>
              <td style="white-space:nowrap">${KKR.vehicleReg(b.vehicle)}</td>
              <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${pickup} → ${dest}">${pickup} → ${dest}</td>
              <td>${KKR.materialName(b.material)}</td>
              <td class="text-right">${b.quantity > 0 ? fmtNum(b.quantity,2) : '—'}</td>
              <td class="text-right font-bold">${fmtCurrency(b.value)}</td>
              <td onclick="event.stopPropagation()">${_ewayBadge(cs)}</td>
              <td style="text-align:center" onclick="event.stopPropagation()">
                ${b.docImage
                  ? `<button class="btn btn-xs btn-secondary" title="View document" onclick="viewEway('${b.id}')">
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                     </button>`
                  : '<span style="color:var(--text-muted);font-size:11px">—</span>'}
              </td>
              <td onclick="event.stopPropagation()">
                <div class="flex gap-2" style="justify-content:center">
                  <button class="btn btn-xs btn-secondary" title="View" onclick="viewEway('${b.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button class="btn btn-xs btn-secondary" title="Edit" onclick="openEwayForm('${b.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-xs btn-danger" title="Delete" onclick="deleteEway('${b.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── Expiry Alerts tab ─────────────────────────────────────────────────────────
function _renderEwayAlerts(allBills) {
  // Group: expired and expiring-soon
  const expiring = allBills
    .filter(b => _ewayComputedStatus(b) === 'expiring')
    .sort((a, b) => a.validUpto.localeCompare(b.validUpto));
  const expired = allBills
    .filter(b => _ewayComputedStatus(b) === 'expired')
    .sort((a, b) => b.validUpto.localeCompare(a.validUpto))
    .slice(0, 10);

  if (!expiring.length && !expired.length) return `
    <div class="card" style="border-radius:0 12px 12px 12px;padding:60px;text-align:center;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">✅</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px">All E-Way Bills are valid</div>
      <div style="font-size:13px">No bills expiring within ${EWAY_EXPIRY_WARN_DAYS} days</div>
    </div>`;

  const _alertCard = (b, cs) => {
    const d      = daysFromNow(b.validUpto);
    const s      = _ewayStatusStyle(cs);
    const pickup = b.pickup || b.from || '—';
    const dest   = b.destination || b.to || '—';
    return `
    <div style="display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--bg-dark);border:1px solid ${s.color}30;border-radius:10px;transition:all .15s"
      onmouseenter="this.style.borderColor='${s.color}60'" onmouseleave="this.style.borderColor='${s.color}30'">
      <!-- Day badge -->
      <div style="width:52px;height:52px;border-radius:10px;background:${s.bg};border:2px solid ${s.color}50;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0">
        <span style="font-size:18px;font-weight:900;color:${s.color};line-height:1">${d < 0 ? Math.abs(d) : d}</span>
        <span style="font-size:9px;color:${s.color};font-weight:600;text-transform:uppercase">${d < 0 ? 'days ago' : d === 0 ? 'today' : 'days'}</span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
          <span style="font-size:15px;font-weight:800;color:var(--text-primary)">${b.billNo}</span>
          ${_ewayBadge(cs)}
          ${b.tripId ? `<span style="font-size:11px;padding:2px 7px;border-radius:20px;background:rgba(37,99,235,0.12);color:#60a5fa;font-weight:600">${b.tripId}</span>` : ''}
        </div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.6">
          <span>${pickup} → ${dest}</span>
          ${KKR.vehicleReg(b.vehicle) !== b.vehicle ? ` · ${KKR.vehicleReg(b.vehicle)}` : ''}
          ${b.customer ? ` · ${KKR.customerName(b.customer)}` : ''}
          <br>
          <span style="color:${s.color};font-weight:600">
            ${d < 0 ? `Expired on ${fmtDate(b.validUpto)}` : d === 0 ? `Expires TODAY (${fmtDate(b.validUpto)})` : `Expires ${fmtDate(b.validUpto)} · ${d} day${d!==1?'s':''} remaining`}
          </span>
          ${fmtCurrency(b.value) ? ` · Value: ${fmtCurrency(b.value)}` : ''}
        </div>
      </div>
      <div class="flex gap-2" style="flex-shrink:0">
        <button class="btn btn-xs btn-secondary" onclick="viewEway('${b.id}')">View</button>
        <button class="btn btn-xs btn-primary btn-sm" onclick="openEwayForm('${b.id}')">Update</button>
      </div>
    </div>`;
  };

  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <div style="font-size:15px;font-weight:700">${expiring.length + expired.length} expiry alert${(expiring.length+expired.length)!==1?'s':''}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Bills expiring within ${EWAY_EXPIRY_WARN_DAYS} days + recently expired</div>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="exportEwayAlerts()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export Alerts
      </button>
    </div>
    ${expiring.length > 0 ? `
    <div style="margin-bottom:24px">
      <div style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:#fbbf24;flex-shrink:0"></span>
        Expiring Within ${EWAY_EXPIRY_WARN_DAYS} Days (${expiring.length})
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${expiring.map(b => _alertCard(b,'expiring')).join('')}
      </div>
    </div>` : ''}

    ${expired.length > 0 ? `
    <div>
      <div style="font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:#f87171;flex-shrink:0"></span>
        Recently Expired (last 10)
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${expired.map(b => _alertCard(b,'expired')).join('')}
      </div>
    </div>` : ''}
  </div>`;
}

// ── Add / Edit form ───────────────────────────────────────────────────────────
function openEwayForm(id = null) {
  editingEwayId = id;
  const b        = id ? (KKR.getEwayBills().find(x => x.id === id) || {}) : {};
  const vehicles  = KKR.getVehicles();
  const materials = KKR.getMaterials();
  const trips     = KKR.getTrips().filter(t => t.status !== 'cancelled');
  const invoices  = KKR.getInvoices();
  const customers = KKR.getCustomers();

  document.getElementById('eway-form-title').textContent = id ? `Edit — ${b.billNo}` : 'New E-Way Bill';

  document.getElementById('eway-form-body').innerHTML = `
    <form onsubmit="saveEway(event)" autocomplete="off">

      <!-- ─ Bill identification ────────────────────────────────── -->
      <div class="eway-form-sec">Bill Identification</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">E-Way Bill No. <span style="color:#f87171">*</span></label>
          <input class="form-control" id="ewf-no"
            value="${b.billNo || ''}" placeholder="EW…" required>
        </div>
        <div class="form-group">
          <label class="form-label">Issue Date <span style="color:#f87171">*</span></label>
          <input type="date" class="form-control" id="ewf-issue"
            value="${fmtDateInput(b.issueDate || b.date || today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Valid Until <span style="color:#f87171">*</span></label>
          <input type="date" class="form-control" id="ewf-valid"
            value="${fmtDateInput(b.validUpto || '')}" required>
        </div>
      </div>
      <!-- Live expiry countdown -->
      <div id="ewf-expiry-display" style="margin-top:-8px;margin-bottom:14px;font-size:12px;color:var(--text-muted)">
        ${b.validUpto ? _ewayExpiryCell(b.validUpto) : ''}
      </div>

      <!-- ─ Connections ────────────────────────────────────────── -->
      <div class="eway-form-sec" style="margin-top:10px">Trip, Invoice &amp; Vehicle</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Link Trip</label>
          <select class="form-control" id="ewf-trip" onchange="ewayAutoFillFromTrip(this.value)">
            <option value="">— None —</option>
            ${trips.map(t => {
              const from = t.loadingPoint || t.from || '';
              const to   = t.destination  || t.to   || '';
              return `<option value="${t.id}" ${b.tripId===t.id?'selected':''}>${t.id}${from?' · '+from+'→'+to:''}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Link Invoice</label>
          <select class="form-control" id="ewf-invoice">
            <option value="">— None —</option>
            ${invoices.map(i =>
              `<option value="${i.id}" ${b.invoiceId===i.id?'selected':''}>${i.id} · ${KKR.customerName(i.customer)}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Vehicle <span style="color:#f87171">*</span></label>
          <select class="form-control" id="ewf-vehicle" required>
            <option value="">— Select —</option>
            ${vehicles.map(v =>
              `<option value="${v.id}" ${b.vehicle===v.id?'selected':''}>${v.regNo} · ${v.make} ${v.model}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Customer</label>
          <select class="form-control" id="ewf-customer">
            <option value="">— None —</option>
            ${customers.map(c =>
              `<option value="${c.id}" ${b.customer===c.id?'selected':''}>${c.name}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- ─ Route ──────────────────────────────────────────────── -->
      <div class="eway-form-sec" style="margin-top:18px">Route</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Pickup / Origin <span style="color:#f87171">*</span></label>
          <input class="form-control" id="ewf-pickup"
            value="${b.pickup || b.from || ''}"
            placeholder="City / plant / depot" required
            list="ewf-pickup-list">
          <datalist id="ewf-pickup-list">
            ${[...new Set(KKR.getEwayBills().map(x=>x.pickup||x.from).filter(Boolean))].map(p=>`<option>${p}</option>`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Destination <span style="color:#f87171">*</span></label>
          <input class="form-control" id="ewf-dest"
            value="${b.destination || b.to || ''}"
            placeholder="City / plant / depot" required
            list="ewf-dest-list">
          <datalist id="ewf-dest-list">
            ${[...new Set(KKR.getEwayBills().map(x=>x.destination||x.to).filter(Boolean))].map(p=>`<option>${p}</option>`).join('')}
          </datalist>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Transport Mode</label>
          <select class="form-control" id="ewf-transmode">
            ${['Road','Rail','Air','Ship'].map(m =>
              `<option value="${m}" ${(b.transMode||'Road')===m?'selected':''}>${m}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- ─ Goods ──────────────────────────────────────────────── -->
      <div class="eway-form-sec" style="margin-top:18px">Goods &amp; Document</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Material <span style="color:#f87171">*</span></label>
          <select class="form-control" id="ewf-material" required>
            <option value="">— Select —</option>
            ${materials.map(m =>
              `<option value="${m.id}" ${b.material===m.id?'selected':''}>${m.name} (${m.unit})</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT)</label>
          <input type="number" step="0.01" class="form-control" id="ewf-qty"
            value="${b.quantity ?? ''}" placeholder="0.00" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Consignment Value (₹) <span style="color:#f87171">*</span></label>
          <input type="number" step="0.01" class="form-control" id="ewf-value"
            value="${b.value || ''}" placeholder="0.00" min="0" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Document Type</label>
          <select class="form-control" id="ewf-doctype">
            ${['Tax Invoice','Bill of Supply','Delivery Challan','Credit Note','Others'].map(t =>
              `<option value="${t}" ${(b.docType||'Tax Invoice')===t?'selected':''}>${t}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Document No.</label>
          <input class="form-control" id="ewf-docno"
            value="${b.docNo || ''}" placeholder="Invoice / challan no.">
        </div>
        <div class="form-group">
          <label class="form-label">Document Date</label>
          <input type="date" class="form-control" id="ewf-docdate"
            value="${fmtDateInput(b.docDate || '')}">
        </div>
      </div>

      <!-- ─ Document upload ────────────────────────────────────── -->
      <div class="eway-form-sec" style="margin-top:18px">Document Upload (optional)</div>
      <div class="form-group">
        <label class="form-label">Attach E-Way Bill / Invoice PDF or Image</label>
        <input type="file" class="form-control" id="ewf-docfile"
          accept="image/*,application/pdf"
          style="padding:8px;cursor:pointer"
          onchange="ewayPreviewDoc(this)">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">JPG, PNG, PDF accepted · max 2 MB · stored locally</div>
        ${b.docImage ? `
          <div style="margin-top:10px;display:flex;align-items:center;gap:10px">
            ${b.docImage.startsWith('data:image')
              ? `<img src="${b.docImage}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">`
              : `<div style="width:80px;height:60px;background:rgba(37,99,235,0.1);border-radius:6px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:#60a5fa;font-size:11px;font-weight:700">PDF</div>`}
            <div>
              <div style="font-size:12px;font-weight:600;color:#34d399">Document attached</div>
              <button type="button" class="btn btn-xs btn-danger" style="margin-top:4px" onclick="ewayClearDoc()">Remove</button>
            </div>
          </div>` : ''}
        <div id="ewf-doc-preview" style="margin-top:8px"></div>
        <input type="hidden" id="ewf-doc-data" value="${b.docImage ? 'keep' : ''}">
      </div>

      <!-- ─ Status & Notes ─────────────────────────────────────── -->
      <div class="eway-form-sec" style="margin-top:18px">Status &amp; Notes</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Manual Status Override</label>
          <select class="form-control" id="ewf-status">
            <option value="">Auto (from expiry date)</option>
            <option value="cancelled" ${b.status==='cancelled'?'selected':''}>Cancelled</option>
          </select>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Status is derived from Valid Until date unless you set Cancelled</div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Remarks</label>
        <textarea class="form-control" id="ewf-remarks" rows="2"
          placeholder="Optional notes…">${b.remarks || ''}</textarea>
      </div>

      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('eway-form-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update Bill' : 'Save Bill'}
        </button>
      </div>
    </form>
    <style>
      .eway-form-sec{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
    </style>`;

  openModal('eway-form-modal');

  // Wire validity display to live update
  document.getElementById('ewf-valid')?.addEventListener('change', function() {
    const d = document.getElementById('ewf-expiry-display');
    if (d) d.innerHTML = this.value ? _ewayExpiryCell(this.value) : '';
  });
}

// ── Auto-fill from trip ────────────────────────────────────────────────────────
function ewayAutoFillFromTrip(tripId) {
  if (!tripId) return;
  const t = KKR.getTrips().find(x => x.id === tripId);
  if (!t) return;
  const force = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  const set   = (id, val) => { const el = document.getElementById(id); if (el && val && !el.value) el.value = val; };
  force('ewf-vehicle',   t.vehicle);
  force('ewf-material',  t.material);
  set('ewf-pickup',      t.loadingPoint || t.from || '');
  set('ewf-dest',        t.destination  || t.to   || '');
  set('ewf-qty',         t.quantity     || t.billedWt || '');
  set('ewf-customer',    t.customer);
  // Auto-fill invoice if linked
  const inv = KKR.getInvoices().find(i => (i.tripIds||[]).includes(tripId) || i.tripId === tripId);
  if (inv) set('ewf-invoice', inv.id);
  if (inv && !document.getElementById('ewf-value')?.value) {
    const el = document.getElementById('ewf-value');
    if (el) el.value = inv.total || '';
  }
}

// ── Document preview & clear ───────────────────────────────────────────────────
function ewayPreviewDoc(input) {
  const file    = input.files[0];
  const preview = document.getElementById('ewf-doc-preview');
  const dataIn  = document.getElementById('ewf-doc-data');
  if (!file || !preview) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('File too large (max 2 MB)', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    dataIn.value = ev.target.result;
    if (file.type.startsWith('image/')) {
      preview.innerHTML = `<img src="${ev.target.result}" style="max-width:200px;max-height:160px;object-fit:contain;border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:11px;color:#34d399;margin-top:4px">✓ ${file.name} (${(file.size/1024).toFixed(0)} KB)</div>`;
    } else {
      preview.innerHTML = `<div style="font-size:12px;color:#34d399;margin-top:4px">✓ ${file.name} (PDF, ${(file.size/1024).toFixed(0)} KB)</div>`;
    }
  };
  reader.readAsDataURL(file);
}

function ewayClearDoc() {
  const d = document.getElementById('ewf-doc-data');
  const p = document.getElementById('ewf-doc-preview');
  if (d) d.value = '';
  if (p) p.innerHTML = '';
  toast('Document removed', 'info');
}

// ── Save ──────────────────────────────────────────────────────────────────────
function saveEway(e) {
  e.preventDefault();
  const bills = KKR.getEwayBills();

  const docDataEl   = document.getElementById('ewf-doc-data');
  const existingDoc = editingEwayId ? (bills.find(x=>x.id===editingEwayId)||{}).docImage : null;
  const docDataVal  = docDataEl?.value;
  let   docImage    = null;
  if      (docDataVal === 'keep')             docImage = existingDoc;
  else if (docDataVal?.startsWith('data:'))   docImage = docDataVal;

  const statusOverride = document.getElementById('ewf-status').value;
  const issueDate      = document.getElementById('ewf-issue').value;
  const validUpto      = document.getElementById('ewf-valid').value;

  const entry = {
    id:          editingEwayId || 'EW' + Date.now().toString().slice(-6),
    billNo:      document.getElementById('ewf-no').value.trim(),
    issueDate,
    date:        issueDate,    // legacy alias
    validUpto,
    // Connections
    tripId:      document.getElementById('ewf-trip').value,
    invoiceId:   document.getElementById('ewf-invoice').value,
    vehicle:     document.getElementById('ewf-vehicle').value,
    customer:    document.getElementById('ewf-customer').value,
    // Route
    pickup:      document.getElementById('ewf-pickup').value.trim(),
    destination: document.getElementById('ewf-dest').value.trim(),
    from:        document.getElementById('ewf-pickup').value.trim(),   // legacy
    to:          document.getElementById('ewf-dest').value.trim(),     // legacy
    transMode:   document.getElementById('ewf-transmode').value,
    // Goods
    material:    document.getElementById('ewf-material').value,
    quantity:    parseFloat(document.getElementById('ewf-qty').value)    || 0,
    value:       parseFloat(document.getElementById('ewf-value').value)  || 0,
    // Document
    docType:     document.getElementById('ewf-doctype').value,
    docNo:       document.getElementById('ewf-docno').value.trim(),
    docDate:     document.getElementById('ewf-docdate').value,
    docImage,
    // Status
    status:      statusOverride || 'active', // stored but computed on read
    remarks:     document.getElementById('ewf-remarks').value.trim(),
  };

  const idx = bills.findIndex(x => x.id === editingEwayId);
  if (idx >= 0) bills[idx] = entry; else bills.unshift(entry);
  KKR.saveEwayBills(bills);
  closeModal('eway-form-modal');
  toast(editingEwayId ? `${entry.billNo} updated` : `${entry.billNo} saved`, 'success');
  rerenderPage();
}

// ── View / detail ─────────────────────────────────────────────────────────────
function viewEway(id) {
  viewingEwayId = id;
  const b = KKR.getEwayBills().find(x => x.id === id);
  if (!b) return;
  const cs     = _ewayComputedStatus(b);
  const pickup = b.pickup || b.from || '—';
  const dest   = b.destination || b.to || '—';
  const d      = daysFromNow(b.validUpto);

  document.getElementById('eway-view-title').textContent  = `E-Way Bill — ${b.billNo}`;
  document.getElementById('eway-view-edit-btn').onclick   = () => { closeModal('eway-view-modal'); openEwayForm(id); };

  document.getElementById('eway-view-body').innerHTML = `
    <div id="printable-eway-${id}">

      <!-- Status header -->
      <div style="display:flex;align-items:center;gap:12px;padding:0 0 16px;border-bottom:1px solid var(--border);margin-bottom:16px">
        <div style="flex:1">
          <div style="font-size:18px;font-weight:800">${b.billNo}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:3px">Issued ${fmtDate(b.issueDate || b.date)}</div>
        </div>
        ${_ewayBadge(cs)}
        ${d !== null
          ? `<div style="text-align:right;font-size:13px;font-weight:700;color:${cs==='expired'?'#f87171':cs==='expiring'?'#fbbf24':'#34d399'}">
               ${d < 0 ? `Expired ${Math.abs(d)}d ago` : d === 0 ? 'Expires TODAY' : `${d}d left`}
             </div>`
          : ''}
      </div>

      <!-- Connections row -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${[
          { label:'Trip ID',    val: b.tripId    ? `<span style="color:#60a5fa;font-weight:700">${b.tripId}</span>`   : '—' },
          { label:'Invoice',    val: b.invoiceId ? `<span style="color:#a78bfa;font-weight:700">${b.invoiceId}</span>` : '—' },
          { label:'Customer',   val: b.customer  ? KKR.customerName(b.customer) : '—' },
        ].map(r => `
          <div style="background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.15);border-radius:8px;padding:12px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${r.label}</div>
            <div style="font-size:13px;font-weight:600">${r.val}</div>
          </div>`).join('')}
      </div>

      <!-- Details grid -->
      <div class="eway-det-grid" style="margin-bottom:14px">
        <div class="eway-sec-hdr" style="grid-column:span 2">Dates</div>
        <div class="eway-det-row"><span class="eway-det-label">Issue Date</span><span class="eway-det-val">${fmtDate(b.issueDate||b.date)}</span></div>
        <div class="eway-det-row"><span class="eway-det-label">Valid Until</span><span class="eway-det-val">${_ewayExpiryCell(b.validUpto)}</span></div>

        <div class="eway-sec-hdr" style="grid-column:span 2">Route</div>
        <div class="eway-det-row"><span class="eway-det-label">Pickup / Origin</span><span class="eway-det-val">${pickup}</span></div>
        <div class="eway-det-row"><span class="eway-det-label">Destination</span><span class="eway-det-val">${dest}</span></div>
        <div class="eway-det-row"><span class="eway-det-label">Vehicle</span><span class="eway-det-val">${KKR.vehicleReg(b.vehicle)}</span></div>
        <div class="eway-det-row"><span class="eway-det-label">Transport Mode</span><span class="eway-det-val">${b.transMode || '—'}</span></div>

        <div class="eway-sec-hdr" style="grid-column:span 2">Goods</div>
        <div class="eway-det-row"><span class="eway-det-label">Material</span><span class="eway-det-val">${KKR.materialName(b.material)}</span></div>
        <div class="eway-det-row"><span class="eway-det-label">Quantity</span><span class="eway-det-val" style="color:#60a5fa">${b.quantity > 0 ? fmtNum(b.quantity,2)+' MT' : '—'}</span></div>
        <div class="eway-det-row" style="grid-column:span 2"><span class="eway-det-label">Consignment Value</span><span class="eway-det-val" style="color:#34d399;font-size:16px">${fmtCurrency(b.value)}</span></div>

        <div class="eway-sec-hdr" style="grid-column:span 2">Reference Document</div>
        <div class="eway-det-row"><span class="eway-det-label">Document Type</span><span class="eway-det-val">${b.docType || '—'}</span></div>
        <div class="eway-det-row"><span class="eway-det-label">Document No.</span><span class="eway-det-val">${b.docNo || '—'}</span></div>
        ${b.docDate ? `<div class="eway-det-row"><span class="eway-det-label">Document Date</span><span class="eway-det-val">${fmtDate(b.docDate)}</span></div><div class="eway-det-row"></div>` : ''}
      </div>

      <!-- Remarks -->
      ${b.remarks ? `
      <div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Remarks</div>
        <div style="font-size:13px">${b.remarks}</div>
      </div>` : ''}

      <!-- Document image -->
      ${b.docImage ? `
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Attached Document</div>
        ${b.docImage.startsWith('data:image')
          ? `<img src="${b.docImage}" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:8px;border:1px solid var(--border);display:block">`
          : `<div style="padding:16px;background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;text-align:center;color:#60a5fa;font-size:13px;font-weight:600">📄 PDF document attached</div>`}
      </div>` : `
      <div style="padding:16px;text-align:center;border:1px dashed var(--border);border-radius:8px;color:var(--text-muted);font-size:12px">
        No document attached · <button class="btn btn-xs btn-secondary" onclick="closeModal('eway-view-modal');openEwayForm('${id}')">Add Document</button>
      </div>`}

    </div>`;

  openModal('eway-view-modal');
}

// ── Print ─────────────────────────────────────────────────────────────────────
function ewayPrint() {
  if (!viewingEwayId) return;
  const b   = KKR.getEwayBills().find(x => x.id === viewingEwayId);
  const s   = KKR.getSettings();
  if (!b) return;
  const pickup = b.pickup || b.from || '—';
  const dest   = b.destination || b.to || '—';
  const cs     = _ewayComputedStatus(b);

  const html = `
    <div style="border:2px solid #333;border-radius:8px;padding:24px;max-width:680px;margin:auto;font-family:Arial,sans-serif">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <div>
          <div style="font-size:18px;font-weight:800">${s.businessName || 'KKR Logistics'}</div>
          <div style="font-size:12px;color:#666">${s.address || ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:900;color:#1d4ed8">E-WAY BILL</div>
          <div style="font-size:16px;font-weight:700">${b.billNo}</div>
          <div style="font-size:12px;color:${cs==='expired'?'#dc2626':cs==='expiring'?'#d97706':'#16a34a'};font-weight:700;margin-top:4px">${_ewayStatusStyle(cs).label.toUpperCase()}</div>
        </div>
      </div>
      <hr style="margin:12px 0">
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
        <tr><td style="padding:7px 8px;color:#666">Issue Date</td><td style="padding:7px 8px;font-weight:600">${fmtDate(b.issueDate||b.date)}</td>
            <td style="padding:7px 8px;color:#666">Valid Until</td><td style="padding:7px 8px;font-weight:600;color:${cs==='expired'?'#dc2626':cs==='expiring'?'#d97706':'#111'}">${fmtDate(b.validUpto)}</td></tr>
        <tr><td style="padding:7px 8px;color:#666">Vehicle</td><td style="padding:7px 8px;font-weight:600">${KKR.vehicleReg(b.vehicle)}</td>
            <td style="padding:7px 8px;color:#666">Transport Mode</td><td style="padding:7px 8px;font-weight:600">${b.transMode || '—'}</td></tr>
        <tr><td style="padding:7px 8px;color:#666">From</td><td style="padding:7px 8px;font-weight:600">${pickup}</td>
            <td style="padding:7px 8px;color:#666">To</td><td style="padding:7px 8px;font-weight:600">${dest}</td></tr>
        <tr><td style="padding:7px 8px;color:#666">Material</td><td style="padding:7px 8px;font-weight:600">${KKR.materialName(b.material)}</td>
            <td style="padding:7px 8px;color:#666">Quantity</td><td style="padding:7px 8px;font-weight:600">${b.quantity > 0 ? fmtNum(b.quantity,2)+' MT' : '—'}</td></tr>
        <tr><td style="padding:7px 8px;color:#666">Trip ID</td><td style="padding:7px 8px;font-weight:600">${b.tripId || '—'}</td>
            <td style="padding:7px 8px;color:#666">Invoice</td><td style="padding:7px 8px;font-weight:600">${b.invoiceId || '—'}</td></tr>
        <tr><td style="padding:7px 8px;color:#666">Document Type</td><td style="padding:7px 8px;font-weight:600">${b.docType || '—'}</td>
            <td style="padding:7px 8px;color:#666">Document No.</td><td style="padding:7px 8px;font-weight:600">${b.docNo || '—'}</td></tr>
        <tr style="background:#f0fdf4">
          <td style="padding:10px 8px;font-weight:700">Consignment Value</td>
          <td colspan="3" style="padding:10px 8px;font-size:18px;font-weight:900;color:#16a34a">${fmtCurrency(b.value)}</td>
        </tr>
      </table>
      ${b.remarks ? `<p style="font-size:12px;color:#666;margin-top:8px"><strong>Remarks:</strong> ${b.remarks}</p>` : ''}
    </div>`;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>E-Way Bill ${b.billNo}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px}@media print{button{display:none}@page{margin:10mm}}</style>
    </head><body>${html}
    <div style="margin:20px;text-align:center">
      <button onclick="window.print()" style="padding:10px 24px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer">🖨 Print</button>
    </div></body></html>`);
  win.document.close();
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteEway(id) {
  const b = KKR.getEwayBills().find(x => x.id === id);
  confirmDelete(b ? b.billNo : id, () => {
    KKR.saveEwayBills(KKR.getEwayBills().filter(x => x.id !== id));
    toast('E-Way Bill deleted', 'error');
    rerenderPage();
  });
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportEwayCSV() {
  const rows = KKR.getEwayBills().map(b => ({
    'Bill No':            b.billNo,
    'Issue Date':         b.issueDate || b.date,
    'Valid Until':        b.validUpto,
    'Status':             _ewayComputedStatus(b),
    'Trip':               b.tripId    || '',
    'Invoice':            b.invoiceId || '',
    'Customer':           KKR.customerName(b.customer) || '',
    'Vehicle':            KKR.vehicleReg(b.vehicle),
    'Pickup':             b.pickup    || b.from || '',
    'Destination':        b.destination || b.to || '',
    'Transport Mode':     b.transMode || '',
    'Material':           KKR.materialName(b.material),
    'Quantity (MT)':      b.quantity  || 0,
    'Value (₹)':          b.value,
    'Doc Type':           b.docType   || '',
    'Doc No':             b.docNo     || '',
    'Doc Date':           b.docDate   || '',
    'Remarks':            b.remarks   || '',
  }));
  exportCSV(Object.keys(rows[0] || {}), rows, `kkr-eway-bills-${today()}.csv`);
  toast('E-Way Bills exported', 'success');
}

// ── Backward-compat alias ─────────────────────────────────────────────────────
function openEwayModal(id = null) { openEwayForm(id); }
