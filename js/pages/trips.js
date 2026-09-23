// ============================================================
// KKR Logistics — Trips Module
// Fields: tripId, date, customer, vehicle, driver, material,
//         loadingPoint, destination, openingKM, closingKM,
//         quantity, rate, otherCharges, status, notes
// Auto-calc: totalKM = closingKM - openingKM
//            transportAmt = quantity × rate
//            grandTotal = transportAmt + otherCharges
// Backward-compat: old trips still render (missing fields default to 0/'')
// ============================================================

// ── Module state ───────────────────────────────────────────────────────────
let tripsFilter    = { q: '', status: '' };
let tripsSort      = { col: 'date', dir: 'desc' };
let editingTripId  = null;
let viewingTripId  = null;

// ── Status config (single source of truth) ────────────────────────────────
const TRIP_STATUSES = [
  { value: 'planned',    label: 'Planned',    color: '#cbd5e1' },
  { value: 'loading',    label: 'Loading',    color: '#fbbf24' },
  { value: 'in-transit', label: 'In Transit', color: '#60a5fa' },
  { value: 'delivered',  label: 'Delivered',  color: '#6ee7b7' },
  { value: 'completed',  label: 'Completed',  color: '#34d399' },
  { value: 'cancelled',  label: 'Cancelled',  color: '#f87171' },
];

// ── Computed fields (pure, no side effects) ────────────────────────────────
function _tripTotalKM(t)      { return Math.max(0, (t.closingKM || 0) - (t.openingKM || 0)); }
function _tripTransport(t)    { return (t.quantity || 0) * (t.rate || 0); }
function _tripGrandTotal(t)   { return _tripTransport(t) + (t.otherCharges || 0); }

// ── Summary stats for the strip ───────────────────────────────────────────
function _tripStats(trips) {
  const all       = trips;
  const active    = all.filter(t => t.status === 'in-transit').length;
  const planned   = all.filter(t => t.status === 'planned' || t.status === 'loading').length;
  const completed = all.filter(t => t.status === 'completed' || t.status === 'delivered').length;
  const cancelled = all.filter(t => t.status === 'cancelled').length;
  const totalTons = all.filter(t => t.status !== 'cancelled')
                       .reduce((s,t) => s + (t.quantity || t.billedWt || 0), 0);
  const totalRevenue = all.filter(t => t.status !== 'cancelled')
                          .reduce((s,t) => s + _tripGrandTotal(t), 0);
  return { total: all.length, active, planned, completed, cancelled, totalTons, totalRevenue };
}

// ── Sortable column header ─────────────────────────────────────────────────
function _thSort(label, col) {
  const active = tripsSort.col === col;
  const arrow  = active ? (tripsSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return `<th style="cursor:pointer;user-select:none;white-space:nowrap"
              onclick="tripsSetSort('${col}')">${label}${arrow}</th>`;
}

function tripsSetSort(col) {
  if (tripsSort.col === col) {
    tripsSort.dir = tripsSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    tripsSort.col = col;
    tripsSort.dir = col === 'date' ? 'desc' : 'asc';
  }
  rerenderPage();
}

// ── Main render ────────────────────────────────────────────────────────────
function renderTrips() {
  const allTrips = KKR.getTrips();
  const st       = _tripStats(allTrips);

  // Filter
  let rows = [...allTrips];
  if (tripsFilter.status) rows = rows.filter(t => t.status === tripsFilter.status);
  if (tripsFilter.q) {
    const q = tripsFilter.q.toLowerCase();
    rows = rows.filter(t =>
      (t.id||'').toLowerCase().includes(q) ||
      (t.loadingPoint||t.from||'').toLowerCase().includes(q) ||
      (t.destination||t.to||'').toLowerCase().includes(q) ||
      KKR.customerName(t.customer).toLowerCase().includes(q) ||
      KKR.vehicleReg(t.vehicle).toLowerCase().includes(q) ||
      KKR.driverName(t.driver).toLowerCase().includes(q) ||
      KKR.materialName(t.material).toLowerCase().includes(q)
    );
  }

  // Sort
  rows.sort((a, b) => {
    let va, vb;
    switch (tripsSort.col) {
      case 'date':        va = a.date;    vb = b.date;    break;
      case 'id':          va = a.id;      vb = b.id;      break;
      case 'customer':    va = KKR.customerName(a.customer); vb = KKR.customerName(b.customer); break;
      case 'vehicle':     va = KKR.vehicleReg(a.vehicle);    vb = KKR.vehicleReg(b.vehicle);    break;
      case 'quantity':    va = a.quantity||a.billedWt||0; vb = b.quantity||b.billedWt||0; break;
      case 'grandTotal':  va = _tripGrandTotal(a); vb = _tripGrandTotal(b); break;
      case 'totalKM':     va = _tripTotalKM(a);    vb = _tripTotalKM(b);    break;
      case 'status':      va = a.status;  vb = b.status;  break;
      default:            va = a.date;    vb = b.date;
    }
    if (va < vb) return tripsSort.dir === 'asc' ? -1 :  1;
    if (va > vb) return tripsSort.dir === 'asc' ?  1 : -1;
    return 0;
  });

  return `
  <div class="page-content">

    <!-- ── Page header ────────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Trips</div>
        <div class="subtitle">${st.total} trips · ${fmtNum(st.totalTons,2)} MT · ${fmtCurrency(st.totalRevenue)} total freight</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportTripsCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-secondary" onclick="printTripsList()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print
        </button>
        <button class="btn btn-primary" onclick="openTripForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Trip
        </button>
      </div>
    </div>

    <!-- ── Status strip ───────────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px" class="trips-stat-strip">
      ${[
        { label:'Total',      val: st.total,     icon:'trips',    col:'',           cls:'blue'   },
        { label:'Planned',    val: st.planned,   icon:'calendar', col:'planned',    cls:'gray'   },
        { label:'In Transit', val: st.active,    icon:'vehicles', col:'in-transit', cls:'cyan'   },
        { label:'Delivered',  val: rows.filter(r=>r.status==='delivered').length, icon:'check', col:'delivered', cls:'teal' },
        { label:'Completed',  val: st.completed, icon:'check',    col:'completed',  cls:'green'  },
        { label:'Cancelled',  val: st.cancelled, icon:'close',    col:'cancelled',  cls:'red'    },
      ].map(s => `
        <div class="card card-sm trips-stat-card ${tripsFilter.status===s.col&&s.col?'trips-stat-active':''}"
             style="text-align:center;cursor:pointer;transition:all .15s"
             onclick="tripsFilter.status='${s.col}';tripsFilter.q='';rerenderPage()">
          <div style="font-size:22px;font-weight:800;color:var(--text-primary)">${s.val}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">${s.label}</div>
        </div>`).join('')}
    </div>

    <!-- ── Table card ─────────────────────────────────────────────────── -->
    <div class="card">

      <!-- Filter bar -->
      <div class="filter-bar" style="margin-bottom:16px">
        <div class="search-input-wrap" style="flex:1;min-width:220px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search trip ID, route, customer, vehicle, driver…"
            value="${tripsFilter.q}"
            oninput="tripsFilter.q=this.value; rerenderPage()">
        </div>
        <select class="form-control" style="width:155px"
          onchange="tripsFilter.status=this.value; rerenderPage()">
          <option value="">All Statuses</option>
          ${TRIP_STATUSES.map(s =>
            `<option value="${s.value}" ${tripsFilter.status===s.value?'selected':''}>${s.label}</option>`
          ).join('')}
        </select>
        ${tripsFilter.q || tripsFilter.status ? `
          <button class="btn btn-secondary btn-sm" onclick="tripsFilter={q:'',status:''};rerenderPage()">
            Clear filters
          </button>` : ''}
        <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;margin-left:4px">
          ${rows.length} of ${allTrips.length} trips
        </span>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${_thSort('Trip ID','id')}
              ${_thSort('Date','date')}
              ${_thSort('Customer','customer')}
              ${_thSort('Vehicle','vehicle')}
              <th>Driver</th>
              <th>Route</th>
              <th>Material</th>
              ${_thSort('Qty (MT)','quantity')}
              ${_thSort('Total KM','totalKM')}
              ${_thSort('Amount','grandTotal')}
              ${_thSort('Status','status')}
              <th style="text-align:center">Actions</th>
            </tr>
          </thead>
          <tbody>
          ${rows.length === 0 ? `
            <tr>
              <td colspan="12" style="padding:56px;text-align:center;color:var(--text-muted)">
                <div style="font-size:32px;margin-bottom:10px">🚛</div>
                <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No trips found</div>
                <div style="font-size:12px">
                  ${tripsFilter.q || tripsFilter.status
                    ? 'Try clearing your filters'
                    : 'Click "New Trip" to add the first one'}
                </div>
              </td>
            </tr>` :
            rows.map(t => {
              const qty      = t.quantity || t.billedWt || 0;
              const km       = _tripTotalKM(t);
              const grand    = _tripGrandTotal(t);
              const from     = t.loadingPoint || t.from || '—';
              const to       = t.destination  || t.to   || '—';
              return `
              <tr class="trip-row" style="cursor:default">
                <td>
                  <span class="font-bold text-blue" style="cursor:pointer" onclick="viewTrip('${t.id}')">${t.id}</span>
                </td>
                <td style="white-space:nowrap">${fmtDate(t.date)}</td>
                <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                    title="${KKR.customerName(t.customer)}">${KKR.customerName(t.customer)}</td>
                <td style="white-space:nowrap">${KKR.vehicleReg(t.vehicle)}</td>
                <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                    title="${KKR.driverName(t.driver)}">${KKR.driverName(t.driver)}</td>
                <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                    title="${from} → ${to}">${from} → ${to}</td>
                <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${KKR.materialName(t.material)}</td>
                <td class="text-right font-bold">${fmtNum(qty,2)}</td>
                <td class="text-right">${km > 0 ? fmtNum(km,0)+' km' : '—'}</td>
                <td class="font-bold" style="white-space:nowrap">${fmtCurrency(grand)}</td>
                <td>${statusBadge(t.status)}</td>
                <td>
                  <div class="flex gap-2" style="justify-content:center">
                    <button class="btn btn-xs btn-secondary" title="View details"
                      onclick="viewTrip('${t.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="btn btn-xs btn-secondary" title="Edit"
                      onclick="openTripForm('${t.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-xs btn-danger" title="Delete"
                      onclick="deleteTrip('${t.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>

          <!-- Totals footer (only when rows exist) -->
          ${rows.length > 0 ? `
          <tfoot>
            <tr style="border-top:2px solid var(--border);background:rgba(37,99,235,0.04)">
              <td colspan="7" style="padding:11px 16px;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">
                Totals (${rows.length} trip${rows.length!==1?'s':''})
              </td>
              <td class="text-right font-bold" style="padding:11px 16px;color:#60a5fa">
                ${fmtNum(rows.reduce((s,t)=>s+(t.quantity||t.billedWt||0),0),2)} MT
              </td>
              <td class="text-right font-bold" style="padding:11px 16px;color:#94a3b8">
                ${fmtNum(rows.reduce((s,t)=>s+_tripTotalKM(t),0),0)} km
              </td>
              <td class="font-bold" style="padding:11px 16px;color:#34d399;white-space:nowrap">
                ${fmtCurrency(rows.reduce((s,t)=>s+_tripGrandTotal(t),0))}
              </td>
              <td colspan="2"></td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
    </div>

  </div>

  <!-- ── Add / Edit modal ──────────────────────────────────────────────── -->
  <div class="modal-overlay" id="trip-form-modal">
    <div class="modal modal-lg" style="max-width:780px">
      <div class="modal-header">
        <div class="modal-title" id="trip-form-title">New Trip</div>
        <button class="modal-close" onclick="closeModal('trip-form-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="trip-form-body"></div>
    </div>
  </div>

  <!-- ── View / detail modal ───────────────────────────────────────────── -->
  <div class="modal-overlay" id="trip-view-modal">
    <div class="modal modal-lg" style="max-width:720px">
      <div class="modal-header">
        <div class="modal-title" id="trip-view-title">Trip Details</div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" id="trip-view-edit-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn btn-sm btn-secondary" onclick="printTripDetail()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <button class="modal-close" onclick="closeModal('trip-view-modal')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-body" id="trip-view-body"></div>
    </div>
  </div>

  <style>
    .trips-stat-card:hover { border-color:#475569!important; transform:translateY(-1px); }
    .trips-stat-active     { border-color:#2563eb!important; background:rgba(37,99,235,0.06)!important; }
    .trip-row:hover td     { background:rgba(51,65,85,0.2); }
    .trip-detail-grid      { display:grid; grid-template-columns:1fr 1fr; gap:0; }
    .trip-detail-row       { display:flex; flex-direction:column; padding:11px 16px; border-bottom:1px solid rgba(51,65,85,0.4); }
    .trip-detail-label     { font-size:10px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:3px; }
    .trip-detail-val       { font-size:14px; font-weight:600; color:var(--text-primary); }
    .trip-calc-box         { background:rgba(37,99,235,0.06); border:1px solid rgba(37,99,235,0.2); border-radius:10px; padding:16px 20px; margin-top:16px; }
    @media(max-width:640px){
      .trip-detail-grid { grid-template-columns:1fr; }
      .trips-stat-strip { grid-template-columns:repeat(3,1fr)!important; }
    }
    @media(max-width:400px){
      .trips-stat-strip { grid-template-columns:repeat(2,1fr)!important; }
    }
  </style>`;
}

// ── Add / Edit form ─────────────────────────────────────────────────────────
function openTripForm(id = null) {
  editingTripId = id;
  const trips    = KKR.getTrips();
  const t        = id ? (trips.find(x => x.id === id) || {}) : {};
  const vehicles  = KKR.getVehicles();
  const drivers   = KKR.getDrivers();
  const customers = KKR.getCustomers();
  const materials = KKR.getMaterials();

  document.getElementById('trip-form-title').textContent = id ? `Edit Trip — ${id}` : 'New Trip';

  // Auto-generate ID for new trips
  const nextId = 'TR' + String(KKR.getTrips().length + 1).padStart(3, '0');

  document.getElementById('trip-form-body').innerHTML = `
    <form id="trip-form" onsubmit="saveTrip(event)" autocomplete="off">

      <!-- Section: Identification -->
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
        Trip Information
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Trip ID <span style="color:#f87171">*</span></label>
          <input class="form-control" id="tf-id"
            value="${t.id || nextId}"
            ${id ? 'readonly style="opacity:.6;cursor:not-allowed"' : ''}
            placeholder="e.g. TR001" required>
        </div>
        <div class="form-group">
          <label class="form-label">Date <span style="color:#f87171">*</span></label>
          <input type="date" class="form-control" id="tf-date"
            value="${fmtDateInput(t.date || today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Status <span style="color:#f87171">*</span></label>
          <select class="form-control" id="tf-status">
            ${TRIP_STATUSES.map(s =>
              `<option value="${s.value}" ${(t.status||'planned')===s.value?'selected':''}>${s.label}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- Section: Parties -->
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin:18px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
        Customer, Vehicle &amp; Driver
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Customer <span style="color:#f87171">*</span></label>
          <select class="form-control" id="tf-customer" required>
            <option value="">— Select Customer —</option>
            ${customers.map(c =>
              `<option value="${c.id}" ${t.customer===c.id?'selected':''}>${c.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Vehicle <span style="color:#f87171">*</span></label>
          <select class="form-control" id="tf-vehicle" required onchange="tripAutoFillDriver(this.value)">
            <option value="">— Select Vehicle —</option>
            ${vehicles.map(v =>
              `<option value="${v.id}" ${t.vehicle===v.id?'selected':''}>${v.regNo} · ${v.make} ${v.model} (${v.capacity})</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Driver <span style="color:#f87171">*</span></label>
          <select class="form-control" id="tf-driver" required>
            <option value="">— Select Driver —</option>
            ${drivers.map(d =>
              `<option value="${d.id}" ${t.driver===d.id?'selected':''}>${d.name}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- Section: Route -->
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin:18px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
        Route &amp; Odometer
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Loading Point <span style="color:#f87171">*</span></label>
          <input class="form-control" id="tf-loading" list="loading-points-list"
            value="${t.loadingPoint || t.from || ''}" placeholder="City / plant / depot" required>
          <datalist id="loading-points-list">
            ${[...new Set(KKR.getTrips().map(x=>x.loadingPoint||x.from).filter(Boolean))].map(p=>`<option>${p}</option>`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Destination <span style="color:#f87171">*</span></label>
          <input class="form-control" id="tf-dest" list="dest-list"
            value="${t.destination || t.to || ''}" placeholder="City / plant / depot" required>
          <datalist id="dest-list">
            ${[...new Set(KKR.getTrips().map(x=>x.destination||x.to).filter(Boolean))].map(p=>`<option>${p}</option>`).join('')}
          </datalist>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Opening KM</label>
          <input type="number" class="form-control" id="tf-openKM"
            value="${t.openingKM ?? ''}" placeholder="Odometer at start"
            oninput="tripCalc()" min="0" step="1">
        </div>
        <div class="form-group">
          <label class="form-label">Closing KM</label>
          <input type="number" class="form-control" id="tf-closeKM"
            value="${t.closingKM ?? ''}" placeholder="Odometer at end"
            oninput="tripCalc()" min="0" step="1">
        </div>
        <div class="form-group">
          <label class="form-label">Total KM</label>
          <input type="number" class="form-control" id="tf-totalKM"
            value="${_tripTotalKM(t) || ''}"
            readonly style="background:rgba(37,99,235,0.05);cursor:not-allowed"
            placeholder="Auto-calculated">
        </div>
      </div>

      <!-- Section: Cargo & Rate -->
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin:18px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
        Cargo &amp; Freight
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Material <span style="color:#f87171">*</span></label>
          <select class="form-control" id="tf-material" required>
            <option value="">— Select Material —</option>
            ${materials.map(m =>
              `<option value="${m.id}" ${t.material===m.id?'selected':''}>${m.name} (${m.unit})</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT) <span style="color:#f87171">*</span></label>
          <input type="number" class="form-control" id="tf-qty"
            value="${t.quantity ?? t.billedWt ?? ''}"
            placeholder="0.00" step="0.01" min="0"
            oninput="tripCalc()" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Rate (₹/MT) <span style="color:#f87171">*</span></label>
          <input type="number" class="form-control" id="tf-rate"
            value="${t.rate ?? ''}"
            placeholder="0.00" step="0.01" min="0"
            oninput="tripCalc()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Other Charges (₹)</label>
          <input type="number" class="form-control" id="tf-other"
            value="${t.otherCharges ?? ''}"
            placeholder="Toll, loading, misc…" step="0.01" min="0"
            oninput="tripCalc()">
        </div>
      </div>

      <!-- Auto-calc display -->
      <div class="trip-calc-box">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Transportation Amt</div>
            <div style="font-size:20px;font-weight:800;color:#60a5fa" id="calc-transport">₹0</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Qty × Rate</div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Other Charges</div>
            <div style="font-size:20px;font-weight:800;color:#fbbf24" id="calc-other">₹0</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Toll, loading etc.</div>
          </div>
          <div style="border-left:2px solid rgba(37,99,235,0.3);padding-left:20px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Grand Total</div>
            <div style="font-size:22px;font-weight:900;color:#34d399" id="calc-total">₹0</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Transport + Other</div>
          </div>
        </div>
      </div>

      <!-- Section: Documents -->
      <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin:18px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
        Documents &amp; Notes
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">E-Way Bill No.</label>
          <input class="form-control" id="tf-eway"
            value="${t.ewayBill || ''}" placeholder="EW…">
        </div>
        <div class="form-group">
          <label class="form-label">Invoice No.</label>
          <input class="form-control" id="tf-invoice"
            value="${t.invoiceNo || ''}" placeholder="INV-…">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="tf-notes" rows="2"
          placeholder="Driver instructions, ETA, loading remarks…">${t.notes || t.remarks || ''}</textarea>
      </div>

      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('trip-form-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update Trip' : 'Save Trip'}
        </button>
      </div>
    </form>`;

  openModal('trip-form-modal');
  // Run calc immediately to show correct values for existing trips
  tripCalc();
}

// ── Auto-fill driver when vehicle changes ──────────────────────────────────
function tripAutoFillDriver(vehicleId) {
  const v = KKR.getVehicles().find(x => x.id === vehicleId);
  if (v && v.driver) {
    const dSel = document.getElementById('tf-driver');
    if (dSel && !dSel.value) dSel.value = v.driver;
  }
}

// ── Live calculation in form ───────────────────────────────────────────────
function tripCalc() {
  const openKM  = parseFloat(document.getElementById('tf-openKM')?.value)  || 0;
  const closeKM = parseFloat(document.getElementById('tf-closeKM')?.value) || 0;
  const qty     = parseFloat(document.getElementById('tf-qty')?.value)     || 0;
  const rate    = parseFloat(document.getElementById('tf-rate')?.value)    || 0;
  const other   = parseFloat(document.getElementById('tf-other')?.value)   || 0;

  const totalKM   = Math.max(0, closeKM - openKM);
  const transport = qty * rate;
  const grand     = transport + other;

  const kmEl = document.getElementById('tf-totalKM');
  if (kmEl) kmEl.value = totalKM > 0 ? totalKM : '';

  const cT = document.getElementById('calc-transport');
  const cO = document.getElementById('calc-other');
  const cG = document.getElementById('calc-total');
  if (cT) cT.textContent = fmtCurrency(transport);
  if (cO) cO.textContent = fmtCurrency(other);
  if (cG) cG.textContent = fmtCurrency(grand);
}

// ── Save (create or update) ────────────────────────────────────────────────
function saveTrip(e) {
  e.preventDefault();

  const openKM  = parseFloat(document.getElementById('tf-openKM').value)  || 0;
  const closeKM = parseFloat(document.getElementById('tf-closeKM').value) || 0;
  const qty     = parseFloat(document.getElementById('tf-qty').value)     || 0;
  const rate    = parseFloat(document.getElementById('tf-rate').value)    || 0;
  const other   = parseFloat(document.getElementById('tf-other').value)   || 0;

  // Validate closing >= opening if both provided
  if (openKM > 0 && closeKM > 0 && closeKM < openKM) {
    toast('Closing KM must be greater than Opening KM', 'error');
    document.getElementById('tf-closeKM').focus();
    return;
  }

  const trips    = KKR.getTrips();
  const idVal    = document.getElementById('tf-id').value.trim();
  const isNew    = !editingTripId;

  // Duplicate ID check for new trips
  if (isNew && trips.some(x => x.id === idVal)) {
    toast(`Trip ID "${idVal}" already exists. Use a different ID.`, 'error');
    document.getElementById('tf-id').focus();
    return;
  }

  const trip = {
    // ── Core fields ─────────────────────────────────────────────────────
    id:           idVal || ('TR' + Date.now().toString().slice(-6)),
    date:         document.getElementById('tf-date').value,
    status:       document.getElementById('tf-status').value,
    customer:     document.getElementById('tf-customer').value,
    vehicle:      document.getElementById('tf-vehicle').value,
    driver:       document.getElementById('tf-driver').value,
    material:     document.getElementById('tf-material').value,
    // ── Route ────────────────────────────────────────────────────────────
    loadingPoint: document.getElementById('tf-loading').value.trim(),
    destination:  document.getElementById('tf-dest').value.trim(),
    // Keep legacy fields in sync so old code / dashboard still works
    from:         document.getElementById('tf-loading').value.trim(),
    to:           document.getElementById('tf-dest').value.trim(),
    // ── Odometer ─────────────────────────────────────────────────────────
    openingKM:    openKM,
    closingKM:    closeKM,
    totalKM:      Math.max(0, closeKM - openKM),
    // ── Cargo & freight ──────────────────────────────────────────────────
    quantity:     qty,
    billedWt:     qty,       // keep legacy field in sync
    loadedWt:     qty,
    rate:         rate,
    otherCharges: other,
    transportAmt: qty * rate,
    freight:      qty * rate + other,  // legacy field = grand total
    grandTotal:   qty * rate + other,
    // ── Documents ────────────────────────────────────────────────────────
    ewayBill:     document.getElementById('tf-eway').value.trim(),
    invoiceNo:    document.getElementById('tf-invoice').value.trim(),
    // ── Notes ────────────────────────────────────────────────────────────
    notes:        document.getElementById('tf-notes').value.trim(),
    remarks:      document.getElementById('tf-notes').value.trim(), // legacy
  };

  const idx = trips.findIndex(x => x.id === editingTripId);
  if (idx >= 0) {
    trips[idx] = trip;
  } else {
    trips.unshift(trip);
  }

  KKR.saveTrips(trips);
  closeModal('trip-form-modal');
  toast(editingTripId ? `Trip ${trip.id} updated` : `Trip ${trip.id} created`, 'success');
  rerenderPage();
}

// ── View (read-only detail modal) ─────────────────────────────────────────
function viewTrip(id) {
  viewingTripId = id;
  const t = KKR.getTrips().find(x => x.id === id);
  if (!t) return;

  const from  = t.loadingPoint || t.from || '—';
  const to    = t.destination  || t.to   || '—';
  const qty   = t.quantity     || t.billedWt  || 0;
  const km    = _tripTotalKM(t);
  const trans = _tripTransport(t);
  const grand = _tripGrandTotal(t);

  document.getElementById('trip-view-title').textContent = `Trip ${t.id}`;
  document.getElementById('trip-view-edit-btn').onclick  = () => {
    closeModal('trip-view-modal');
    openTripForm(id);
  };

  document.getElementById('trip-view-body').innerHTML = `
    <div id="printable-trip-${id}">

      <!-- Status bar -->
      <div style="display:flex;align-items:center;gap:10px;padding:14px 0 18px;border-bottom:1px solid var(--border);margin-bottom:4px">
        ${statusBadge(t.status)}
        <span style="font-size:13px;color:var(--text-muted)">${fmtDate(t.date)}</span>
        <span style="margin-left:auto;font-size:13px;color:var(--text-muted)">
          ${t.ewayBill ? `E-Way: <strong style="color:var(--text-primary)">${t.ewayBill}</strong>` : ''}
          ${t.invoiceNo ? `&nbsp;·&nbsp; Invoice: <strong style="color:var(--text-primary)">${t.invoiceNo}</strong>` : ''}
        </span>
      </div>

      <!-- Detail grid -->
      <div class="trip-detail-grid">
        <div class="trip-detail-row">
          <span class="trip-detail-label">Customer</span>
          <span class="trip-detail-val">${KKR.customerName(t.customer)}</span>
        </div>
        <div class="trip-detail-row">
          <span class="trip-detail-label">Material</span>
          <span class="trip-detail-val">${KKR.materialName(t.material)}</span>
        </div>
        <div class="trip-detail-row">
          <span class="trip-detail-label">Vehicle</span>
          <span class="trip-detail-val">${KKR.vehicleReg(t.vehicle)}</span>
        </div>
        <div class="trip-detail-row">
          <span class="trip-detail-label">Driver</span>
          <span class="trip-detail-val">${KKR.driverName(t.driver)}</span>
        </div>
        <div class="trip-detail-row" style="grid-column:span 2">
          <span class="trip-detail-label">Route</span>
          <span class="trip-detail-val">${from} &nbsp;→&nbsp; ${to}</span>
        </div>
        <div class="trip-detail-row">
          <span class="trip-detail-label">Opening KM</span>
          <span class="trip-detail-val">${t.openingKM > 0 ? fmtNum(t.openingKM,0)+' km' : '—'}</span>
        </div>
        <div class="trip-detail-row">
          <span class="trip-detail-label">Closing KM</span>
          <span class="trip-detail-val">${t.closingKM > 0 ? fmtNum(t.closingKM,0)+' km' : '—'}</span>
        </div>
        <div class="trip-detail-row" style="background:rgba(37,99,235,0.04)">
          <span class="trip-detail-label">Total KM</span>
          <span class="trip-detail-val" style="color:#60a5fa">${km > 0 ? fmtNum(km,0)+' km' : '—'}</span>
        </div>
        <div class="trip-detail-row" style="background:rgba(37,99,235,0.04)">
          <span class="trip-detail-label">Quantity</span>
          <span class="trip-detail-val" style="color:#60a5fa">${fmtNum(qty,2)} MT</span>
        </div>
        <div class="trip-detail-row">
          <span class="trip-detail-label">Rate</span>
          <span class="trip-detail-val">${t.rate > 0 ? fmtCurrency(t.rate) + '/MT' : '—'}</span>
        </div>
        <div class="trip-detail-row">
          <span class="trip-detail-label">Other Charges</span>
          <span class="trip-detail-val">${fmtCurrency(t.otherCharges || 0)}</span>
        </div>
      </div>

      <!-- Calculated summary box -->
      <div class="trip-calc-box" style="margin-top:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Transportation</div>
            <div style="font-size:18px;font-weight:800;color:#60a5fa">${fmtCurrency(trans)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${fmtNum(qty,2)} MT × ${fmtCurrency(t.rate||0)}/MT</div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Other Charges</div>
            <div style="font-size:18px;font-weight:800;color:#fbbf24">${fmtCurrency(t.otherCharges||0)}</div>
          </div>
          <div style="border-left:2px solid rgba(37,99,235,0.3);padding-left:20px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Grand Total</div>
            <div style="font-size:22px;font-weight:900;color:#34d399">${fmtCurrency(grand)}</div>
          </div>
        </div>
      </div>

      <!-- Notes -->
      ${(t.notes || t.remarks) ? `
      <div style="margin-top:16px;padding:12px 16px;background:var(--bg-dark);border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Notes</div>
        <div style="font-size:13px;color:var(--text-primary)">${t.notes || t.remarks}</div>
      </div>` : ''}

    </div>`;

  openModal('trip-view-modal');
}

// ── Delete ─────────────────────────────────────────────────────────────────
function deleteTrip(id) {
  const t   = KKR.getTrips().find(x => x.id === id);
  const lbl = t ? `${t.id} (${t.loadingPoint||t.from||'?'} → ${t.destination||t.to||'?'})` : id;
  confirmDelete(lbl, () => {
    KKR.saveTrips(KKR.getTrips().filter(x => x.id !== id));
    toast(`Trip ${id} deleted`, 'error');
    rerenderPage();
  });
}

// ── Print current detail ───────────────────────────────────────────────────
function printTripDetail() {
  if (!viewingTripId) return;
  const t    = KKR.getTrips().find(x => x.id === viewingTripId);
  const s    = KKR.getSettings();
  const from = t.loadingPoint || t.from || '—';
  const to   = t.destination  || t.to   || '—';
  const qty  = t.quantity     || t.billedWt || 0;
  const km   = _tripTotalKM(t);
  const grand= _tripGrandTotal(t);

  const html = `
  <table style="width:100%;margin-bottom:20px;border-collapse:collapse">
    <tr><th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Trip ID</th><td style="padding:8px 10px;border:1px solid #ddd">${t.id}</td>
        <th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Date</th><td style="padding:8px 10px;border:1px solid #ddd">${fmtDate(t.date)}</td></tr>
    <tr><th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Customer</th><td style="padding:8px 10px;border:1px solid #ddd">${KKR.customerName(t.customer)}</td>
        <th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Status</th><td style="padding:8px 10px;border:1px solid #ddd">${t.status}</td></tr>
    <tr><th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Vehicle</th><td style="padding:8px 10px;border:1px solid #ddd">${KKR.vehicleReg(t.vehicle)}</td>
        <th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Driver</th><td style="padding:8px 10px;border:1px solid #ddd">${KKR.driverName(t.driver)}</td></tr>
    <tr><th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">From</th><td style="padding:8px 10px;border:1px solid #ddd">${from}</td>
        <th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">To</th><td style="padding:8px 10px;border:1px solid #ddd">${to}</td></tr>
    <tr><th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Material</th><td style="padding:8px 10px;border:1px solid #ddd">${KKR.materialName(t.material)}</td>
        <th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Quantity</th><td style="padding:8px 10px;border:1px solid #ddd">${fmtNum(qty,2)} MT</td></tr>
    <tr><th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Opening KM</th><td style="padding:8px 10px;border:1px solid #ddd">${fmtNum(t.openingKM||0,0)} km</td>
        <th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Closing KM</th><td style="padding:8px 10px;border:1px solid #ddd">${fmtNum(t.closingKM||0,0)} km</td></tr>
    <tr><th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Total KM</th><td style="padding:8px 10px;border:1px solid #ddd">${fmtNum(km,0)} km</td>
        <th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Rate</th><td style="padding:8px 10px;border:1px solid #ddd">${fmtCurrency(t.rate||0)}/MT</td></tr>
    <tr><th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Transport Amt</th><td style="padding:8px 10px;border:1px solid #ddd">${fmtCurrency(_tripTransport(t))}</td>
        <th style="text-align:left;padding:8px 10px;background:#f5f5f5;border:1px solid #ddd">Other Charges</th><td style="padding:8px 10px;border:1px solid #ddd">${fmtCurrency(t.otherCharges||0)}</td></tr>
    <tr style="background:#e8f5e9"><th colspan="2" style="text-align:left;padding:10px;border:1px solid #ddd;font-size:15px">GRAND TOTAL</th>
        <td colspan="2" style="padding:10px;border:1px solid #ddd;font-size:16px;font-weight:700">${fmtCurrency(grand)}</td></tr>
  </table>
  ${t.notes ? `<p><strong>Notes:</strong> ${t.notes}</p>` : ''}`;

  printSection(`Trip ${t.id} — ${s.businessName || 'KKR Logistics'}`, html);
}

// ── Export CSV ─────────────────────────────────────────────────────────────
function exportTripsCSV() {
  const rows = KKR.getTrips().map(t => ({
    'Trip ID':           t.id,
    'Date':              t.date,
    'Status':            t.status,
    'Customer':          KKR.customerName(t.customer),
    'Vehicle':           KKR.vehicleReg(t.vehicle),
    'Driver':            KKR.driverName(t.driver),
    'Material':          KKR.materialName(t.material),
    'Loading Point':     t.loadingPoint || t.from || '',
    'Destination':       t.destination  || t.to   || '',
    'Opening KM':        t.openingKM    || 0,
    'Closing KM':        t.closingKM    || 0,
    'Total KM':          _tripTotalKM(t),
    'Quantity (MT)':     t.quantity     || t.billedWt || 0,
    'Rate (₹/MT)':       t.rate         || 0,
    'Transport Amt (₹)': _tripTransport(t),
    'Other Charges (₹)': t.otherCharges || 0,
    'Grand Total (₹)':   _tripGrandTotal(t),
    'E-Way Bill':        t.ewayBill     || '',
    'Invoice No':        t.invoiceNo    || '',
    'Notes':             t.notes || t.remarks || '',
  }));
  const headers = Object.keys(rows[0] || {});
  exportCSV(headers, rows, `kkr-trips-${today()}.csv`);
  toast('Trips exported to CSV', 'success');
}

// ── Print full list ────────────────────────────────────────────────────────
function printTripsList() {
  const rows = KKR.getTrips();
  const html = `
  <table>
    <thead>
      <tr>
        <th>Trip ID</th><th>Date</th><th>Customer</th><th>Route</th>
        <th>Qty (MT)</th><th>Total KM</th><th>Grand Total</th><th>Status</th>
      </tr>
    </thead>
    <tbody>
    ${rows.map(t => `
      <tr>
        <td>${t.id}</td>
        <td>${fmtDate(t.date)}</td>
        <td>${KKR.customerName(t.customer)}</td>
        <td>${t.loadingPoint||t.from||'—'} → ${t.destination||t.to||'—'}</td>
        <td>${fmtNum(t.quantity||t.billedWt||0,2)}</td>
        <td>${_tripTotalKM(t)>0 ? fmtNum(_tripTotalKM(t),0)+' km' : '—'}</td>
        <td><strong>${fmtCurrency(_tripGrandTotal(t))}</strong></td>
        <td>${t.status}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4"><strong>TOTAL (${rows.length} trips)</strong></td>
        <td><strong>${fmtNum(rows.reduce((s,t)=>s+(t.quantity||t.billedWt||0),0),2)} MT</strong></td>
        <td></td>
        <td><strong>${fmtCurrency(rows.reduce((s,t)=>s+_tripGrandTotal(t),0))}</strong></td>
        <td></td>
      </tr>
    </tfoot>
  </table>`;
  printSection('Trips List', html);
}

// ── Backward-compat: keep old function name in case anything calls it ──────
function openTripModal(id = null) { openTripForm(id); }
