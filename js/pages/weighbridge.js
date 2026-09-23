// ============================================================
// KKR Logistics — Weighbridge Module
// Fields: slip, date+time, tripId, vehicle, driver, material,
//         loadingPoint, destination, gross, tare, net (auto),
//         operator, slipImage (base64), remarks
// Net Weight = Gross − Tare (auto-calculated live)
// Linked to trips: selecting a trip auto-fills vehicle/driver/
//   material/route; trip panel shows weighbridge slip count.
// Slip image: stored as base64 in localStorage.
// ============================================================

// ── Module state ────────────────────────────────────────────────────────────
let wbFilter      = { q: '', material: '', vehicle: '' };
let wbSort        = { col: 'date', dir: 'desc' };
let editingWbId   = null;
let viewingWbId   = null;
let wbTab         = 'records';   // 'records' | 'linked'

// ── Helpers ──────────────────────────────────────────────────────────────────
function _wbStats(records) {
  const totalGross = records.reduce((s, r) => s + (r.gross || 0), 0);
  const totalTare  = records.reduce((s, r) => s + (r.tare  || 0), 0);
  const totalNet   = records.reduce((s, r) => s + (r.net   || 0), 0);
  const linkedCount = records.filter(r => r.tripId).length;
  return { totalGross, totalTare, totalNet, linkedCount, count: records.length };
}

function _wbSortRows(rows) {
  return [...rows].sort((a, b) => {
    let va, vb;
    switch (wbSort.col) {
      case 'date':     va = a.date;    vb = b.date;    break;
      case 'slip':     va = a.slip;    vb = b.slip;    break;
      case 'vehicle':  va = KKR.vehicleReg(a.vehicle);  vb = KKR.vehicleReg(b.vehicle);  break;
      case 'material': va = KKR.materialName(a.material); vb = KKR.materialName(b.material); break;
      case 'gross':    va = a.gross;   vb = b.gross;   break;
      case 'tare':     va = a.tare;    vb = b.tare;    break;
      case 'net':      va = a.net;     vb = b.net;     break;
      default:         va = a.date;    vb = b.date;
    }
    if (va < vb) return wbSort.dir === 'asc' ? -1 : 1;
    if (va > vb) return wbSort.dir === 'asc' ?  1 : -1;
    return 0;
  });
}

function _wbThSort(label, col) {
  const active = wbSort.col === col;
  const arrow  = active ? (wbSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
  return `<th style="cursor:pointer;user-select:none;white-space:nowrap"
    onclick="wbSort.col='${col}';wbSort.dir=wbSort.col==='${col}'&&wbSort.dir==='asc'?'desc':'asc';wbSort.col='${col}';rerenderPage()">${label}${arrow}</th>`;
}

// Trips that do NOT yet have a weighbridge record
function _tripsWithoutWB() {
  const linked = new Set(KKR.getWeighbridge().map(r => r.tripId).filter(Boolean));
  return KKR.getTrips().filter(t => !linked.has(t.id) && t.status !== 'cancelled');
}

// ── Main render ────────────────────────────────────────────────────────────
function renderWeighbridge() {
  const allRecords  = KKR.getWeighbridge();
  const allSt       = _wbStats(allRecords);

  // Apply filters
  let rows = [...allRecords];
  if (wbFilter.material) rows = rows.filter(r => r.material === wbFilter.material);
  if (wbFilter.vehicle)  rows = rows.filter(r => r.vehicle  === wbFilter.vehicle);
  if (wbFilter.q) {
    const q = wbFilter.q.toLowerCase();
    rows = rows.filter(r =>
      (r.slip    || '').toLowerCase().includes(q) ||
      (r.tripId  || '').toLowerCase().includes(q) ||
      (r.loadingPoint || r.from || '').toLowerCase().includes(q) ||
      (r.destination  || r.to  || '').toLowerCase().includes(q) ||
      (r.operator || '').toLowerCase().includes(q) ||
      KKR.vehicleReg(r.vehicle).toLowerCase().includes(q) ||
      KKR.materialName(r.material).toLowerCase().includes(q)
    );
  }
  rows = _wbSortRows(rows);
  const filtSt = _wbStats(rows);

  // Trips with no linked WB record
  const unlinked = _tripsWithoutWB();

  return `
  <div class="page-content">

    <!-- ── Header ────────────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Weighbridge</div>
        <div class="subtitle">${allRecords.length} slip${allRecords.length !== 1 ? 's' : ''} · ${fmtNum(allSt.totalNet, 2)} MT total net weight</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="printWbReport()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print
        </button>
        <button class="btn btn-secondary" onclick="exportWbCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-primary" onclick="openWbForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Entry
        </button>
      </div>
    </div>

    <!-- ── KPI strip ─────────────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px">
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:22px;font-weight:800;color:#60a5fa">${allRecords.length}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Total Slips</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:22px;font-weight:800;color:#f87171">${fmtNum(allSt.totalGross,2)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Gross (MT)</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:22px;font-weight:800;color:#fbbf24">${fmtNum(allSt.totalTare,2)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Tare (MT)</div>
      </div>
      <div class="card card-sm" style="text-align:center;cursor:pointer" onclick="wbTab='records';rerenderPage()">
        <div style="font-size:22px;font-weight:800;color:#34d399">${fmtNum(allSt.totalNet,2)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Net (MT)</div>
      </div>
      <div class="card card-sm ${wbTab==='linked'?'wb-tab-active':''}" style="text-align:center;cursor:pointer"
        onclick="wbTab='linked';rerenderPage()">
        <div style="font-size:22px;font-weight:800;color:${unlinked.length>0?'#f59e0b':'#34d399'}">${unlinked.length}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Trips Unlinked</div>
      </div>
    </div>

    <!-- ── Tabs ────────────────────────────────────────────────────── -->
    <div class="tabs" style="margin-bottom:0">
      <div class="tab ${wbTab==='records'?'active':''}" onclick="wbTab='records';rerenderPage()">
        Weighbridge Records
      </div>
      <div class="tab ${wbTab==='linked'?'active':''}" onclick="wbTab='linked';rerenderPage()">
        Trips Without Slip
        ${unlinked.length > 0
          ? `<span style="margin-left:6px;background:#f59e0b;color:#000;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px">${unlinked.length}</span>`
          : ''}
      </div>
    </div>

    ${wbTab === 'linked' ? _renderUnlinkedTrips(unlinked) : _renderWbRecords(rows, allRecords, filtSt)}

  </div>

  <!-- ── Add / Edit modal ─────────────────────────────────────────────── -->
  <div class="modal-overlay" id="wb-form-modal">
    <div class="modal" style="max-width:760px">
      <div class="modal-header">
        <div class="modal-title" id="wb-form-title">New Weighbridge Entry</div>
        <button class="modal-close" onclick="closeModal('wb-form-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="wb-form-body"></div>
    </div>
  </div>

  <!-- ── View modal ────────────────────────────────────────────────────── -->
  <div class="modal-overlay" id="wb-view-modal">
    <div class="modal" style="max-width:680px">
      <div class="modal-header">
        <div class="modal-title" id="wb-view-title">Weighbridge Slip</div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" id="wb-view-edit-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="btn btn-sm btn-secondary" onclick="printSlip()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print
          </button>
          <button class="modal-close" onclick="closeModal('wb-view-modal')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-body" id="wb-view-body"></div>
    </div>
  </div>

  <style>
    .wb-tab-active { border-color:#f59e0b!important;background:rgba(245,158,11,0.06)!important; }
    .wb-weight-box { background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:16px 20px; }
    .wb-slip-img   { max-width:100%;border-radius:8px;border:1px solid var(--border);margin-top:12px; }
    .wb-detail-row { display:flex;flex-direction:column;padding:10px 14px;border-bottom:1px solid rgba(51,65,85,0.4); }
    .wb-detail-grid{ display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden; }
    .wb-detail-grid .wb-detail-row:nth-child(odd) { border-right:1px solid rgba(51,65,85,0.4); }
    .wb-det-lbl    { font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px; }
    .wb-det-val    { font-size:13.5px;font-weight:600;color:var(--text-primary); }
    .wb-section-hdr{ font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;padding:10px 14px;background:rgba(51,65,85,0.2);border-bottom:1px solid var(--border); }
    @media(max-width:640px){ .wb-detail-grid{grid-template-columns:1fr!important} .wb-detail-grid .wb-detail-row:nth-child(odd){border-right:none} }
  </style>`;
}

// ── Records tab ───────────────────────────────────────────────────────────
function _renderWbRecords(rows, allRecords, filtSt) {
  const vehicles  = KKR.getVehicles();
  const materials = KKR.getMaterials();

  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div class="filter-bar" style="margin-bottom:16px">
      <div class="search-input-wrap" style="flex:1;min-width:180px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search slip, trip, vehicle, operator…"
          value="${wbFilter.q}" oninput="wbFilter.q=this.value;rerenderPage()">
      </div>
      <select class="form-control" style="width:160px"
        onchange="wbFilter.material=this.value;rerenderPage()">
        <option value="">All Materials</option>
        ${materials.map(m =>
          `<option value="${m.id}" ${wbFilter.material===m.id?'selected':''}>${m.name}</option>`
        ).join('')}
      </select>
      <select class="form-control" style="width:160px"
        onchange="wbFilter.vehicle=this.value;rerenderPage()">
        <option value="">All Vehicles</option>
        ${vehicles.map(v =>
          `<option value="${v.id}" ${wbFilter.vehicle===v.id?'selected':''}>${v.regNo}</option>`
        ).join('')}
      </select>
      ${wbFilter.q||wbFilter.material||wbFilter.vehicle ? `
        <button class="btn btn-secondary btn-sm" onclick="wbFilter={q:'',material:'',vehicle:''};rerenderPage()">Clear</button>` : ''}
      <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">
        ${rows.length} of ${allRecords.length}
      </span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            ${_wbThSort('Date','date')}
            ${_wbThSort('Slip No.','slip')}
            <th>Trip</th>
            ${_wbThSort('Vehicle','vehicle')}
            <th>Driver</th>
            ${_wbThSort('Material','material')}
            <th>Route</th>
            ${_wbThSort('Gross (MT)','gross')}
            ${_wbThSort('Tare (MT)','tare')}
            ${_wbThSort('Net (MT)','net')}
            <th>Operator</th>
            <th>Slip</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
        ${rows.length === 0 ? `
          <tr><td colspan="13" style="padding:56px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:8px">⚖️</div>
            <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No weighbridge records</div>
            <div style="font-size:12px">${wbFilter.q||wbFilter.material||wbFilter.vehicle?'Try clearing filters':'Click "New Entry" to record the first slip'}</div>
          </td></tr>` :
          rows.map(r => {
            const from = r.loadingPoint || r.from || '—';
            const to   = r.destination  || r.to   || '—';
            const tripLinked = r.tripId && KKR.getTrips().find(t => t.id === r.tripId);
            return `
            <tr style="cursor:pointer" onclick="viewWbRecord('${r.id}')">
              <td style="white-space:nowrap" onclick="event.stopPropagation()">
                <div>${fmtDate(r.date)}</div>
                ${r.time ? `<div style="font-size:11px;color:var(--text-muted)">${r.time}</div>` : ''}
              </td>
              <td class="font-bold text-blue" style="cursor:pointer" onclick="viewWbRecord('${r.id}')">${r.slip}</td>
              <td onclick="event.stopPropagation()">
                ${tripLinked
                  ? `<span class="font-bold text-blue" style="cursor:pointer" onclick="viewWbRecord('${r.id}')">${r.tripId}</span>`
                  : `<span style="color:var(--text-muted)">—</span>`}
              </td>
              <td style="white-space:nowrap">${KKR.vehicleReg(r.vehicle)}</td>
              <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${KKR.driverName(r.driver) || '—'}</td>
              <td>${KKR.materialName(r.material)}</td>
              <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${from} → ${to}">${from} → ${to}</td>
              <td class="text-right">${fmtNum(r.gross,3)}</td>
              <td class="text-right">${fmtNum(r.tare,3)}</td>
              <td class="font-bold text-right" style="color:#34d399">${fmtNum(r.net,3)}</td>
              <td style="color:var(--text-muted)">${r.operator || '—'}</td>
              <td style="text-align:center" onclick="event.stopPropagation()">
                ${r.slipImage
                  ? `<button class="btn btn-xs btn-secondary" onclick="viewSlipImage('${r.id}')" title="View slip image">
                       <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                     </button>`
                  : `<span style="color:var(--text-muted);font-size:11px">—</span>`}
              </td>
              <td onclick="event.stopPropagation()">
                <div class="flex gap-2" style="justify-content:center">
                  <button class="btn btn-xs btn-secondary" title="View" onclick="viewWbRecord('${r.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button class="btn btn-xs btn-secondary" title="Edit" onclick="openWbForm('${r.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-xs btn-danger" title="Delete" onclick="deleteWb('${r.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        ${rows.length > 0 ? `
        <tfoot>
          <tr style="border-top:2px solid var(--border);background:rgba(16,185,129,0.04)">
            <td colspan="7" style="padding:11px 16px;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">
              Totals (${rows.length} slip${rows.length!==1?'s':''})
            </td>
            <td class="text-right font-bold" style="padding:11px 16px">${fmtNum(filtSt.totalGross,3)}</td>
            <td class="text-right font-bold" style="padding:11px 16px">${fmtNum(filtSt.totalTare,3)}</td>
            <td class="font-bold text-right" style="padding:11px 16px;color:#34d399">${fmtNum(filtSt.totalNet,3)}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>` : ''}
      </table>
    </div>
  </div>`;
}

// ── Unlinked trips tab ────────────────────────────────────────────────────
function _renderUnlinkedTrips(unlinked) {
  if (unlinked.length === 0) return `
    <div class="card" style="border-radius:0 12px 12px 12px;padding:60px;text-align:center;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">✅</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px">All trips have weighbridge slips</div>
      <div style="font-size:13px">Every active trip is linked to a weighbridge record</div>
    </div>`;

  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
      These trips do not have a linked weighbridge slip. Click <strong style="color:var(--text-primary)">Add Slip</strong> to create one.
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trip ID</th><th>Date</th><th>Vehicle</th><th>Driver</th>
            <th>Customer</th><th>Route</th><th>Material</th><th>Qty (MT)</th><th>Status</th><th style="text-align:center">Action</th>
          </tr>
        </thead>
        <tbody>
        ${unlinked.map(t => `
          <tr>
            <td class="font-bold text-blue">${t.id}</td>
            <td style="white-space:nowrap">${fmtDate(t.date)}</td>
            <td>${KKR.vehicleReg(t.vehicle)}</td>
            <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${KKR.driverName(t.driver)}</td>
            <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${KKR.customerName(t.customer)}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${(t.loadingPoint||t.from||'?')} → ${(t.destination||t.to||'?')}
            </td>
            <td>${KKR.materialName(t.material)}</td>
            <td class="text-right">${fmtNum(t.quantity||t.billedWt||0,2)}</td>
            <td>${statusBadge(t.status)}</td>
            <td style="text-align:center">
              <button class="btn btn-xs btn-primary" onclick="openWbForm(null,'${t.id}')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Slip
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ── Add / Edit form ───────────────────────────────────────────────────────
function openWbForm(id = null, prefillTripId = null) {
  editingWbId = id;
  const r         = id ? (KKR.getWeighbridge().find(x => x.id === id) || {}) : {};
  const vehicles  = KKR.getVehicles();
  const drivers   = KKR.getDrivers();
  const materials = KKR.getMaterials();
  const trips     = KKR.getTrips().filter(t => t.status !== 'cancelled');

  // If prefilling from a trip, auto-load trip data
  const prefillTrip = prefillTripId ? trips.find(t => t.id === prefillTripId) : null;
  const ef = prefillTrip ? {
    tripId:       prefillTrip.id,
    vehicle:      prefillTrip.vehicle,
    driver:       prefillTrip.driver || '',
    material:     prefillTrip.material,
    loadingPoint: prefillTrip.loadingPoint || prefillTrip.from || '',
    destination:  prefillTrip.destination  || prefillTrip.to   || '',
  } : {};

  document.getElementById('wb-form-title').textContent = id
    ? `Edit Slip — ${r.slip}`
    : prefillTrip ? `New Slip — Trip ${prefillTrip.id}` : 'New Weighbridge Entry';

  document.getElementById('wb-form-body').innerHTML = `
    <form onsubmit="saveWb(event)" autocomplete="off">

      <!-- ─ Slip info ──────────────────────────────────────────────────── -->
      <div class="wb-form-section-hdr">Slip Information</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Slip Number <span style="color:#f87171">*</span></label>
          <input class="form-control" id="wbf-slip" value="${r.slip || ''}"
            placeholder="WS-001" required>
        </div>
        <div class="form-group">
          <label class="form-label">Date <span style="color:#f87171">*</span></label>
          <input type="date" class="form-control" id="wbf-date"
            value="${fmtDateInput(r.date || today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Time</label>
          <input type="time" class="form-control" id="wbf-time"
            value="${r.time || ''}">
        </div>
      </div>

      <!-- ─ Trip linkage ───────────────────────────────────────────────── -->
      <div class="wb-form-section-hdr" style="margin-top:18px">Trip Linkage</div>
      <div class="form-group">
        <label class="form-label">Link to Trip</label>
        <select class="form-control" id="wbf-trip" onchange="wbAutoFillFromTrip(this.value)">
          <option value="">— Not linked to a trip —</option>
          ${trips.map(t => {
            const from = t.loadingPoint || t.from || '';
            const to   = t.destination  || t.to   || '';
            const sel  = (r.tripId || ef.tripId) === t.id ? 'selected' : '';
            return `<option value="${t.id}" ${sel}>${t.id} · ${from}→${to} · ${KKR.vehicleReg(t.vehicle)}</option>`;
          }).join('')}
        </select>
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Selecting a trip auto-fills vehicle, driver, material and route below</div>
      </div>

      <!-- ─ Vehicle / Driver ───────────────────────────────────────────── -->
      <div class="wb-form-section-hdr" style="margin-top:18px">Vehicle &amp; Material</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Vehicle <span style="color:#f87171">*</span></label>
          <select class="form-control" id="wbf-vehicle" required>
            <option value="">— Select —</option>
            ${vehicles.map(v =>
              `<option value="${v.id}" ${(r.vehicle||ef.vehicle)===v.id?'selected':''}>${v.regNo} · ${v.make} ${v.model}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Driver</label>
          <select class="form-control" id="wbf-driver">
            <option value="">— Select —</option>
            ${drivers.map(d =>
              `<option value="${d.id}" ${(r.driver||ef.driver)===d.id?'selected':''}>${d.name}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Material <span style="color:#f87171">*</span></label>
          <select class="form-control" id="wbf-material" required>
            <option value="">— Select —</option>
            ${materials.map(m =>
              `<option value="${m.id}" ${(r.material||ef.material)===m.id?'selected':''}>${m.name} (${m.unit})</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- ─ Route ──────────────────────────────────────────────────────── -->
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Loading Point</label>
          <input class="form-control" id="wbf-loading"
            value="${r.loadingPoint || ef.loadingPoint || r.from || ''}"
            placeholder="Source location" list="wb-loading-list">
          <datalist id="wb-loading-list">
            ${[...new Set(KKR.getWeighbridge().map(x=>x.loadingPoint||x.from).filter(Boolean))].map(p=>`<option>${p}</option>`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Destination</label>
          <input class="form-control" id="wbf-dest"
            value="${r.destination || ef.destination || r.to || ''}"
            placeholder="Delivery location" list="wb-dest-list">
          <datalist id="wb-dest-list">
            ${[...new Set(KKR.getWeighbridge().map(x=>x.destination||x.to).filter(Boolean))].map(p=>`<option>${p}</option>`).join('')}
          </datalist>
        </div>
      </div>

      <!-- ─ Weights ─────────────────────────────────────────────────────── -->
      <div class="wb-form-section-hdr" style="margin-top:18px">Weight Measurements</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Gross Weight (MT) <span style="color:#f87171">*</span></label>
          <input type="number" step="0.001" class="form-control" id="wbf-gross"
            value="${r.gross || ''}" placeholder="0.000"
            oninput="wbCalcNet()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tare Weight (MT) <span style="color:#f87171">*</span></label>
          <input type="number" step="0.001" class="form-control" id="wbf-tare"
            value="${r.tare || ''}" placeholder="0.000"
            oninput="wbCalcNet()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Net Weight (MT)</label>
          <input type="number" step="0.001" class="form-control" id="wbf-net"
            value="${r.net || ''}" readonly
            style="background:rgba(16,185,129,0.07);border-color:rgba(16,185,129,0.3);cursor:not-allowed;font-weight:700">
        </div>
      </div>

      <!-- Weight summary box (shown live) -->
      <div class="wb-weight-box" id="wb-weight-summary" style="margin-bottom:18px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;text-align:center">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Gross</div>
            <div style="font-size:18px;font-weight:800;color:#f87171" id="wb-disp-gross">${r.gross ? fmtNum(r.gross,3) : '—'}</div>
            <div style="font-size:10px;color:var(--text-muted)">MT</div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Tare</div>
            <div style="font-size:18px;font-weight:800;color:#fbbf24" id="wb-disp-tare">${r.tare ? fmtNum(r.tare,3) : '—'}</div>
            <div style="font-size:10px;color:var(--text-muted)">MT</div>
          </div>
          <div style="border-left:2px solid rgba(16,185,129,0.3);padding-left:16px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">Net</div>
            <div style="font-size:22px;font-weight:900;color:#34d399" id="wb-disp-net">${r.net ? fmtNum(r.net,3) : '—'}</div>
            <div style="font-size:10px;color:var(--text-muted)">MT = Gross − Tare</div>
          </div>
        </div>
      </div>

      <!-- ─ Operator & Remarks ──────────────────────────────────────────── -->
      <div class="wb-form-section-hdr">Operator &amp; Notes</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Weighbridge Operator</label>
          <input class="form-control" id="wbf-operator"
            value="${r.operator || ''}" placeholder="Name of operator"
            list="wb-op-list">
          <datalist id="wb-op-list">
            ${[...new Set(KKR.getWeighbridge().map(x=>x.operator).filter(Boolean))].map(o=>`<option>${o}</option>`).join('')}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Remarks</label>
          <input class="form-control" id="wbf-remarks"
            value="${r.remarks || ''}" placeholder="Optional notes">
        </div>
      </div>

      <!-- ─ Slip image ─────────────────────────────────────────────────── -->
      <div class="wb-form-section-hdr" style="margin-top:18px">Slip Image (optional)</div>
      <div class="form-group">
        <label class="form-label">Upload Weighbridge Slip Photo</label>
        <input type="file" class="form-control" id="wbf-slip-file"
          accept="image/*,application/pdf"
          style="padding:8px;cursor:pointer"
          onchange="wbPreviewSlip(this)">
        <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
          Accepts JPG, PNG, GIF, WebP, PDF · Stored locally in browser
        </div>
        ${r.slipImage ? `
          <div style="margin-top:10px;display:flex;align-items:center;gap:10px">
            <img src="${r.slipImage}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
            <div>
              <div style="font-size:12px;font-weight:600;color:#34d399">Slip image attached</div>
              <button type="button" class="btn btn-xs btn-danger" style="margin-top:4px" onclick="wbClearSlipImage()">Remove</button>
            </div>
          </div>` : ''}
        <div id="wb-slip-preview" style="margin-top:10px"></div>
        <input type="hidden" id="wbf-slip-data" value="${r.slipImage ? 'keep' : ''}">
      </div>

      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('wb-form-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update Record' : 'Save Record'}
        </button>
      </div>
    </form>
    <style>
      .wb-form-section-hdr{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
    </style>`;

  openModal('wb-form-modal');
  wbCalcNet(); // refresh display for existing record
}

// ── Auto-fill from trip selection ─────────────────────────────────────────
function wbAutoFillFromTrip(tripId) {
  if (!tripId) return;
  const t = KKR.getTrips().find(x => x.id === tripId);
  if (!t) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  set('wbf-vehicle',  t.vehicle);
  set('wbf-driver',   t.driver);
  set('wbf-material', t.material);
  set('wbf-loading',  t.loadingPoint || t.from || '');
  set('wbf-dest',     t.destination  || t.to   || '');
}

// ── Net weight live calculation ───────────────────────────────────────────
function wbCalcNet() {
  const gross = parseFloat(document.getElementById('wbf-gross')?.value) || 0;
  const tare  = parseFloat(document.getElementById('wbf-tare')?.value)  || 0;
  const net   = Math.max(0, gross - tare);

  const netEl = document.getElementById('wbf-net');
  if (netEl) netEl.value = net > 0 ? net.toFixed(3) : '';

  const dg = document.getElementById('wb-disp-gross');
  const dt = document.getElementById('wb-disp-tare');
  const dn = document.getElementById('wb-disp-net');
  if (dg) dg.textContent = gross > 0 ? fmtNum(gross,3) : '—';
  if (dt) dt.textContent = tare  > 0 ? fmtNum(tare,3)  : '—';
  if (dn) dn.textContent = net   > 0 ? fmtNum(net,3)   : '—';

  // Warn if tare > gross
  const warnEl = document.getElementById('wbf-net');
  if (warnEl) {
    warnEl.style.borderColor = (gross > 0 && tare > gross) ? '#f87171' : 'rgba(16,185,129,0.3)';
  }
}

// ── Slip image preview ────────────────────────────────────────────────────
function wbPreviewSlip(input) {
  const file    = input.files[0];
  const preview = document.getElementById('wb-slip-preview');
  const dataIn  = document.getElementById('wbf-slip-data');
  if (!file || !preview) return;

  if (file.size > 2 * 1024 * 1024) {
    toast('Image too large (max 2 MB). Please resize before uploading.', 'error');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    dataIn.value = e.target.result;
    if (file.type.startsWith('image/')) {
      preview.innerHTML = `
        <img src="${e.target.result}" style="max-width:200px;max-height:160px;object-fit:contain;border-radius:8px;border:1px solid var(--border)">
        <div style="font-size:11px;color:#34d399;margin-top:4px">✓ ${file.name} (${(file.size/1024).toFixed(0)} KB)</div>`;
    } else {
      preview.innerHTML = `<div style="font-size:12px;color:#34d399">✓ ${file.name} attached (PDF)</div>`;
    }
  };
  reader.readAsDataURL(file);
}

function wbClearSlipImage() {
  const dataIn = document.getElementById('wbf-slip-data');
  const preview = document.getElementById('wb-slip-preview');
  if (dataIn)  dataIn.value = '';
  if (preview) preview.innerHTML = '';
  toast('Slip image removed', 'info');
}

// ── Save ─────────────────────────────────────────────────────────────────────
function saveWb(e) {
  e.preventDefault();
  const wb = KKR.getWeighbridge();

  const gross = parseFloat(document.getElementById('wbf-gross').value) || 0;
  const tare  = parseFloat(document.getElementById('wbf-tare').value)  || 0;
  const net   = parseFloat(document.getElementById('wbf-net').value)   || Math.max(0, gross - tare);

  if (gross > 0 && tare > gross) {
    toast('Tare weight cannot exceed gross weight', 'error');
    return;
  }

  // Handle slip image
  const slipDataEl   = document.getElementById('wbf-slip-data');
  const existingImg  = editingWbId ? (wb.find(x => x.id === editingWbId) || {}).slipImage : null;
  const slipData     = slipDataEl?.value;
  let   slipImage    = null;
  if      (slipData === 'keep') slipImage = existingImg;   // unchanged
  else if (slipData && slipData.startsWith('data:')) slipImage = slipData;

  const entry = {
    id:           editingWbId || 'WB' + Date.now().toString().slice(-6),
    slip:         document.getElementById('wbf-slip').value.trim(),
    date:         document.getElementById('wbf-date').value,
    time:         document.getElementById('wbf-time').value,
    tripId:       document.getElementById('wbf-trip').value,
    vehicle:      document.getElementById('wbf-vehicle').value,
    driver:       document.getElementById('wbf-driver').value,
    material:     document.getElementById('wbf-material').value,
    loadingPoint: document.getElementById('wbf-loading').value.trim(),
    destination:  document.getElementById('wbf-dest').value.trim(),
    // legacy aliases so old code still works
    from:         document.getElementById('wbf-loading').value.trim(),
    to:           document.getElementById('wbf-dest').value.trim(),
    gross,
    tare,
    net,
    operator:     document.getElementById('wbf-operator').value.trim(),
    remarks:      document.getElementById('wbf-remarks').value.trim(),
    slipImage,
  };

  const idx = wb.findIndex(r => r.id === editingWbId);
  if (idx >= 0) wb[idx] = entry; else wb.unshift(entry);
  KKR.saveWeighbridge(wb);
  closeModal('wb-form-modal');
  toast(editingWbId ? `Slip ${entry.slip} updated` : `Slip ${entry.slip} saved`, 'success');
  rerenderPage();
}

// ── View record ────────────────────────────────────────────────────────────
function viewWbRecord(id) {
  viewingWbId = id;
  const r  = KKR.getWeighbridge().find(x => x.id === id);
  if (!r) return;
  const trip     = r.tripId ? KKR.getTrips().find(t => t.id === r.tripId) : null;
  const from     = r.loadingPoint || r.from || '—';
  const to       = r.destination  || r.to   || '—';

  document.getElementById('wb-view-title').textContent = `Slip — ${r.slip}`;
  document.getElementById('wb-view-edit-btn').onclick   = () => { closeModal('wb-view-modal'); openWbForm(id); };

  document.getElementById('wb-view-body').innerHTML = `
    <div id="printable-slip-${id}">

      <!-- Weight hero ─────────────────────────────────────────────────── -->
      <div class="wb-weight-box" style="margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;text-align:center">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Gross Weight</div>
            <div style="font-size:28px;font-weight:900;color:#f87171">${fmtNum(r.gross,3)}</div>
            <div style="font-size:11px;color:var(--text-muted)">MT</div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Tare Weight</div>
            <div style="font-size:28px;font-weight:900;color:#fbbf24">${fmtNum(r.tare,3)}</div>
            <div style="font-size:11px;color:var(--text-muted)">MT</div>
          </div>
          <div style="border-left:2px solid rgba(16,185,129,0.3);padding-left:20px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Net Weight</div>
            <div style="font-size:32px;font-weight:900;color:#34d399">${fmtNum(r.net,3)}</div>
            <div style="font-size:11px;color:var(--text-muted)">MT = Gross − Tare</div>
          </div>
        </div>
      </div>

      <!-- Details grid ─────────────────────────────────────────────────── -->
      <div class="wb-detail-grid" style="margin-bottom:14px">
        <div class="wb-section-hdr" style="grid-column:span 2">Slip Details</div>
        <div class="wb-detail-row"><span class="wb-det-lbl">Slip Number</span><span class="wb-det-val">${r.slip}</span></div>
        <div class="wb-detail-row">
          <span class="wb-det-lbl">Date &amp; Time</span>
          <span class="wb-det-val">${fmtDate(r.date)}${r.time ? ' · ' + r.time : ''}</span>
        </div>
        <div class="wb-detail-row"><span class="wb-det-lbl">Vehicle</span><span class="wb-det-val">${KKR.vehicleReg(r.vehicle)}</span></div>
        <div class="wb-detail-row"><span class="wb-det-lbl">Driver</span><span class="wb-det-val">${KKR.driverName(r.driver) || '—'}</span></div>
        <div class="wb-detail-row"><span class="wb-det-lbl">Material</span><span class="wb-det-val">${KKR.materialName(r.material)}</span></div>
        <div class="wb-detail-row"><span class="wb-det-lbl">Operator</span><span class="wb-det-val">${r.operator || '—'}</span></div>
        <div class="wb-detail-row" style="grid-column:span 2">
          <span class="wb-det-lbl">Route</span>
          <span class="wb-det-val">${from} &nbsp;→&nbsp; ${to}</span>
        </div>
      </div>

      <!-- Linked trip ─────────────────────────────────────────────────── -->
      ${trip ? `
      <div style="background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:10px;padding:14px 16px;margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🔗 Linked Trip</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div>
            <div style="font-size:11px;color:var(--text-muted)">Trip ID</div>
            <div style="font-size:13px;font-weight:700;color:#60a5fa">${trip.id}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted)">Customer</div>
            <div style="font-size:13px;font-weight:600">${KKR.customerName(trip.customer)}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--text-muted)">Status</div>
            <div>${statusBadge(trip.status)}</div>
          </div>
        </div>
      </div>` : `
      <div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span style="font-size:12px;color:#fbbf24">Not linked to any trip. Edit this record to link it.</span>
      </div>`}

      <!-- Remarks ─────────────────────────────────────────────────────── -->
      ${r.remarks ? `
      <div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:14px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Remarks</div>
        <div style="font-size:13px;color:var(--text-primary)">${r.remarks}</div>
      </div>` : ''}

      <!-- Slip image ──────────────────────────────────────────────────── -->
      ${r.slipImage ? `
      <div>
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Weighbridge Slip Image</div>
        <img src="${r.slipImage}" class="wb-slip-img" alt="Weighbridge Slip" style="max-height:360px;width:auto;display:block">
      </div>` : `
      <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;border:1px dashed var(--border);border-radius:8px">
        No slip image attached · <button class="btn btn-xs btn-secondary" onclick="closeModal('wb-view-modal');openWbForm('${id}')">Add Image</button>
      </div>`}

    </div>`;

  openModal('wb-view-modal');
}

// ── View slip image full-screen ───────────────────────────────────────────
function viewSlipImage(id) {
  viewWbRecord(id);
}

// ── Delete ────────────────────────────────────────────────────────────────
function deleteWb(id) {
  const r = KKR.getWeighbridge().find(x => x.id === id);
  confirmDelete(r ? `Slip ${r.slip}` : id, () => {
    KKR.saveWeighbridge(KKR.getWeighbridge().filter(x => x.id !== id));
    toast('Weighbridge record deleted', 'error');
    rerenderPage();
  });
}

// ── Print slip ────────────────────────────────────────────────────────────
function printSlip() {
  if (!viewingWbId) return;
  const r = KKR.getWeighbridge().find(x => x.id === viewingWbId);
  if (!r) return;
  const s    = KKR.getSettings();
  const from = r.loadingPoint || r.from || '—';
  const to   = r.destination  || r.to   || '—';

  const html = `
    <div style="border:2px solid #333;border-radius:8px;padding:20px;max-width:600px;margin:auto">
      <div style="display:flex;justify-content:space-between;margin-bottom:16px">
        <div>
          <div style="font-size:18px;font-weight:800">${s.businessName || 'KKR Logistics'}</div>
          <div style="font-size:12px;color:#666">${s.address || ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:800">WEIGHBRIDGE SLIP</div>
          <div style="font-size:14px;font-weight:700;color:#333">${r.slip}</div>
        </div>
      </div>
      <hr style="margin:12px 0">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:6px 8px;color:#666">Date</td><td style="padding:6px 8px;font-weight:600">${fmtDate(r.date)}${r.time?' '+r.time:''}</td>
            <td style="padding:6px 8px;color:#666">Trip ID</td><td style="padding:6px 8px;font-weight:600">${r.tripId||'—'}</td></tr>
        <tr><td style="padding:6px 8px;color:#666">Vehicle</td><td style="padding:6px 8px;font-weight:600">${KKR.vehicleReg(r.vehicle)}</td>
            <td style="padding:6px 8px;color:#666">Driver</td><td style="padding:6px 8px;font-weight:600">${KKR.driverName(r.driver)||'—'}</td></tr>
        <tr><td style="padding:6px 8px;color:#666">Material</td><td style="padding:6px 8px;font-weight:600">${KKR.materialName(r.material)}</td>
            <td style="padding:6px 8px;color:#666">Operator</td><td style="padding:6px 8px;font-weight:600">${r.operator||'—'}</td></tr>
        <tr><td style="padding:6px 8px;color:#666">From</td><td colspan="3" style="padding:6px 8px;font-weight:600">${from} → ${to}</td></tr>
      </table>
      <hr style="margin:12px 0">
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#f9f9f9">
          <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:14px">Gross Weight</th>
          <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:14px">Tare Weight</th>
          <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:16px;background:#e8f5e9">Net Weight</th>
        </tr>
        <tr>
          <td style="padding:14px;border:1px solid #ddd;text-align:center;font-size:20px;font-weight:700">${fmtNum(r.gross,3)} MT</td>
          <td style="padding:14px;border:1px solid #ddd;text-align:center;font-size:20px;font-weight:700">${fmtNum(r.tare,3)} MT</td>
          <td style="padding:14px;border:1px solid #ddd;text-align:center;font-size:22px;font-weight:900;color:#2e7d32;background:#e8f5e9">${fmtNum(r.net,3)} MT</td>
        </tr>
      </table>
      ${r.slipImage ? `<div style="margin-top:16px;text-align:center"><img src="${r.slipImage}" style="max-height:200px;border:1px solid #ddd;border-radius:4px"></div>` : ''}
      ${r.remarks ? `<p style="margin-top:12px;font-size:12px;color:#666">Remarks: ${r.remarks}</p>` : ''}
      <div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
        <div style="border-top:1px solid #999;padding-top:6px;text-align:center;font-size:11px;color:#666">Vehicle Driver Signature</div>
        <div style="border-top:1px solid #999;padding-top:6px;text-align:center;font-size:11px;color:#666">Weighbridge Operator</div>
      </div>
    </div>`;
  printSection(`Weighbridge Slip ${r.slip}`, html);
}

// ── Print full report ─────────────────────────────────────────────────────
function printWbReport() {
  const rows = KKR.getWeighbridge();
  const html = `
    <table>
      <thead>
        <tr><th>Date</th><th>Slip</th><th>Trip</th><th>Vehicle</th><th>Material</th><th>Route</th><th>Gross</th><th>Tare</th><th>Net</th><th>Operator</th></tr>
      </thead>
      <tbody>
      ${rows.map(r => `
        <tr>
          <td>${fmtDate(r.date)}${r.time?' '+r.time:''}</td>
          <td><strong>${r.slip}</strong></td>
          <td>${r.tripId||'—'}</td>
          <td>${KKR.vehicleReg(r.vehicle)}</td>
          <td>${KKR.materialName(r.material)}</td>
          <td>${(r.loadingPoint||r.from||'—')} → ${(r.destination||r.to||'—')}</td>
          <td>${r.gross}</td><td>${r.tare}</td>
          <td><strong>${r.net}</strong></td>
          <td>${r.operator||'—'}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="6"><strong>TOTAL (${rows.length} records)</strong></td>
          <td><strong>${fmtNum(rows.reduce((s,r)=>s+r.gross,0),3)}</strong></td>
          <td><strong>${fmtNum(rows.reduce((s,r)=>s+r.tare,0),3)}</strong></td>
          <td><strong>${fmtNum(rows.reduce((s,r)=>s+r.net,0),3)}</strong></td>
          <td></td>
        </tr>
      </tfoot>
    </table>`;
  printSection('Weighbridge Report', html);
}

// ── Export CSV ────────────────────────────────────────────────────────────
function exportWbCSV() {
  const rows = KKR.getWeighbridge().map(r => ({
    'Slip No':      r.slip,
    'Date':         r.date,
    'Time':         r.time || '',
    'Trip ID':      r.tripId || '',
    'Vehicle':      KKR.vehicleReg(r.vehicle),
    'Driver':       KKR.driverName(r.driver) || '',
    'Material':     KKR.materialName(r.material),
    'Loading Point':r.loadingPoint || r.from || '',
    'Destination':  r.destination  || r.to   || '',
    'Gross (MT)':   r.gross,
    'Tare (MT)':    r.tare,
    'Net (MT)':     r.net,
    'Operator':     r.operator || '',
    'Remarks':      r.remarks  || '',
  }));
  exportCSV(Object.keys(rows[0] || {}), rows, `kkr-weighbridge-${today()}.csv`);
  toast('Weighbridge records exported', 'success');
}

// ── Backward-compat aliases ───────────────────────────────────────────────
function openWbModal(id = null) { openWbForm(id); }
function calcWbNet()            { wbCalcNet(); }
