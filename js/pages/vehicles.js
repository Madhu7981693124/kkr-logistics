// ============================================================
// KKR Logistics — Vehicles Module
// Fields: regNo, type, make, model, year, capacity, fuelType,
//         driver, kmReading, rc, insurance, fitness, permit,
//         puc (pollution), lastService, nextService,
//         serviceNotes, status, notes
// Alerts: insurance / fitness / permit / puc / next-service
//         expiring within 90 days
// ============================================================

// ── Module state ───────────────────────────────────────────────────────────
let vehiclesFilter  = { q: '', status: '' };
let vehiclesTab     = 'list';          // 'list' | 'alerts'
let editingVehicleId = null;
let viewingVehicleId = null;

// ── Alert thresholds (days) ────────────────────────────────────────────────
const VEH_ALERT_DAYS = 90;

const VEH_DOC_FIELDS = [
  { key: 'rc',          label: 'RC',                icon: '📄', color: '#60a5fa'  },
  { key: 'insurance',   label: 'Insurance',          icon: '🛡️', color: '#f87171'  },
  { key: 'fitness',     label: 'Fitness',            icon: '✅', color: '#34d399'  },
  { key: 'permit',      label: 'Permit',             icon: '📋', color: '#fbbf24'  },
  { key: 'puc',         label: 'Pollution (PUC)',    icon: '🌿', color: '#a78bfa'  },
  { key: 'nextService', label: 'Next Service',       icon: '🔧', color: '#06b6d4'  },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function _vehAlerts(vehicles) {
  const alerts = [];
  vehicles.forEach(v => {
    VEH_DOC_FIELDS.forEach(f => {
      if (!v[f.key]) return;
      const d = daysFromNow(v[f.key]);
      if (d === null) return;
      const priority = d < 0 ? 'expired' : d <= 15 ? 'critical' : d <= 30 ? 'high' : d <= 60 ? 'medium' : d <= VEH_ALERT_DAYS ? 'low' : null;
      if (!priority) return;
      alerts.push({ vehicleId: v.id, regNo: v.regNo, make: v.make, model: v.model, field: f.key, label: f.label, icon: f.icon, color: f.color, date: v[f.key], days: d, priority });
    });
  });
  alerts.sort((a, b) => a.days - b.days);
  return alerts;
}

function _expiryCell(dateStr) {
  if (!dateStr) return '<span style="color:var(--text-muted)">—</span>';
  const d = daysFromNow(dateStr);
  const fmt = fmtDate(dateStr);
  if (d === null) return fmt;
  if (d < 0)   return `<span style="color:#f87171;font-weight:700">${fmt} <small>(expired)</small></span>`;
  if (d <= 15)  return `<span style="color:#f87171;font-weight:700">${fmt} <small>(${d}d)</small></span>`;
  if (d <= 30)  return `<span style="color:#fb923c;font-weight:600">${fmt} <small>(${d}d)</small></span>`;
  if (d <= 60)  return `<span style="color:#fbbf24;font-weight:600">${fmt} <small>(${d}d)</small></span>`;
  if (d <= 90)  return `<span style="color:#a3e635">${fmt} <small>(${d}d)</small></span>`;
  return `<span>${fmt}</span>`;
}

function _alertPriorityColor(p) {
  return { expired:'#f87171', critical:'#f87171', high:'#fb923c', medium:'#fbbf24', low:'#a3e635' }[p] || '#94a3b8';
}

function _alertBadge(p) {
  const col = _alertPriorityColor(p);
  const label = { expired:'Expired', critical:'Critical', high:'High', medium:'Medium', low:'Low' }[p] || p;
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${col}20;color:${col};border:1px solid ${col}40;text-transform:uppercase;letter-spacing:.4px">${label}</span>`;
}

// ── Vehicle trip count ────────────────────────────────────────────────────
function _vehTripCount(vehicleId) {
  return KKR.getTrips().filter(t => t.vehicle === vehicleId).length;
}

function _vehTotalKM(vehicleId) {
  return KKR.getTrips()
    .filter(t => t.vehicle === vehicleId && (t.totalKM || t.distance))
    .reduce((s, t) => s + (t.totalKM || t.distance || 0), 0);
}

// ── Main render ────────────────────────────────────────────────────────────
function renderVehicles() {
  const allVehicles = KKR.getVehicles();
  const allAlerts   = _vehAlerts(allVehicles);
  const unread      = allAlerts.length;

  let rows = [...allVehicles];
  if (vehiclesFilter.status) rows = rows.filter(v => v.status === vehiclesFilter.status);
  if (vehiclesFilter.q) {
    const q = vehiclesFilter.q.toLowerCase();
    rows = rows.filter(v =>
      (v.regNo  || '').toLowerCase().includes(q) ||
      (v.make   || '').toLowerCase().includes(q) ||
      (v.model  || '').toLowerCase().includes(q) ||
      (v.type   || '').toLowerCase().includes(q) ||
      KKR.driverName(v.driver).toLowerCase().includes(q)
    );
  }

  return `
  <div class="page-content">

    <!-- ── Page header ─────────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Vehicles</div>
        <div class="subtitle">${allVehicles.length} vehicles registered · ${allVehicles.filter(v=>v.status==='active').length} active</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportVehiclesCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-primary" onclick="openVehicleForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Vehicle
        </button>
      </div>
    </div>

    <!-- ── Stat strip ──────────────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px">
      ${[
        { label:'Total Fleet',    val: allVehicles.length,                                      col:'#60a5fa', filter:''             },
        { label:'Active',         val: allVehicles.filter(v=>v.status==='active').length,        col:'#34d399', filter:'active'       },
        { label:'Maintenance',    val: allVehicles.filter(v=>v.status==='maintenance').length,   col:'#fbbf24', filter:'maintenance'   },
        { label:'Inactive',       val: allVehicles.filter(v=>v.status==='inactive').length,      col:'#f87171', filter:'inactive'      },
        { label:'Doc Alerts',     val: unread,                                                   col: unread>0?'#f87171':'#34d399', filter:'_alerts' },
      ].map(s => `
        <div class="card card-sm veh-stat-card ${vehiclesFilter.status===s.filter&&s.filter&&s.filter!=='_alerts'?'veh-stat-active':''} ${s.filter==='_alerts'&&vehiclesTab==='alerts'?'veh-stat-active':''}"
          style="text-align:center;cursor:pointer;transition:all .15s"
          onclick="${s.filter==='_alerts'?"vehiclesTab='alerts';vehiclesFilter.status='';rerenderPage()":"vehiclesTab='list';vehiclesFilter.status='"+s.filter+"';rerenderPage()"}">
          <div style="font-size:22px;font-weight:800;color:${s.col}">${s.val}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">${s.label}</div>
        </div>`).join('')}
    </div>

    <!-- ── Tabs ────────────────────────────────────────────────────────── -->
    <div class="tabs" style="margin-bottom:0">
      <div class="tab ${vehiclesTab==='list'?'active':''}"
        onclick="vehiclesTab='list';rerenderPage()">Fleet List</div>
      <div class="tab ${vehiclesTab==='alerts'?'active':''}"
        onclick="vehiclesTab='alerts';rerenderPage()">
        Document Alerts
        ${unread > 0 ? `<span style="margin-left:6px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px">${unread}</span>` : ''}
      </div>
    </div>

    ${vehiclesTab === 'alerts' ? _renderVehicleAlerts(allAlerts) : _renderVehicleList(rows, allVehicles)}

  </div>

  <!-- ── Add / Edit modal ────────────────────────────────────────────── -->
  <div class="modal-overlay" id="veh-form-modal">
    <div class="modal" style="max-width:820px">
      <div class="modal-header">
        <div class="modal-title" id="veh-form-title">Add Vehicle</div>
        <button class="modal-close" onclick="closeModal('veh-form-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="veh-form-body"></div>
    </div>
  </div>

  <!-- ── View modal ──────────────────────────────────────────────────── -->
  <div class="modal-overlay" id="veh-view-modal">
    <div class="modal" style="max-width:700px">
      <div class="modal-header">
        <div class="modal-title" id="veh-view-title">Vehicle Details</div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" id="veh-view-edit-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="modal-close" onclick="closeModal('veh-view-modal')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-body" id="veh-view-body"></div>
    </div>
  </div>

  <style>
    .veh-stat-card:hover  { border-color:#475569!important;transform:translateY(-1px); }
    .veh-stat-active      { border-color:#2563eb!important;background:rgba(37,99,235,0.06)!important; }
    .veh-card             { background:var(--bg-dark);border:1px solid var(--border);border-radius:12px;padding:18px;transition:all .15s;cursor:pointer; }
    .veh-card:hover       { border-color:#475569;transform:translateY(-1px); }
    .veh-doc-pill         { display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:600;border:1px solid transparent; }
    .veh-detail-row       { display:flex;flex-direction:column;padding:10px 14px;border-bottom:1px solid rgba(51,65,85,0.4); }
    .veh-detail-label     { font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px; }
    .veh-detail-val       { font-size:13.5px;font-weight:600;color:var(--text-primary); }
    .veh-detail-grid      { display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden; }
    .veh-detail-grid .veh-detail-row:nth-child(odd)  { border-right:1px solid rgba(51,65,85,0.4); }
    .veh-section-hdr      { font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;padding:10px 14px;background:rgba(51,65,85,0.2);border-bottom:1px solid var(--border); }
    @media(max-width:700px){
      .veh-detail-grid { grid-template-columns:1fr!important; }
      .veh-detail-grid .veh-detail-row:nth-child(odd) { border-right:none; }
    }
  </style>`;
}

function _renderVehicleList(rows, allVehicles) {
  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div class="filter-bar" style="margin-bottom:16px">
      <div class="search-input-wrap" style="flex:1;min-width:200px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search reg. no, make, model, driver…"
          value="${vehiclesFilter.q}" oninput="vehiclesFilter.q=this.value;rerenderPage()">
      </div>
      <select class="form-control" style="width:155px"
        onchange="vehiclesFilter.status=this.value;rerenderPage()">
        <option value="">All Status</option>
        <option value="active"      ${vehiclesFilter.status==='active'?'selected':''}>Active</option>
        <option value="maintenance" ${vehiclesFilter.status==='maintenance'?'selected':''}>Maintenance</option>
        <option value="inactive"    ${vehiclesFilter.status==='inactive'?'selected':''}>Inactive</option>
      </select>
      ${vehiclesFilter.q||vehiclesFilter.status?`
        <button class="btn btn-secondary btn-sm" onclick="vehiclesFilter={q:'',status:''};rerenderPage()">Clear</button>`:``}
      <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${rows.length} of ${allVehicles.length}</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Type</th>
            <th>Capacity / Fuel</th>
            <th>Driver</th>
            <th>Current KM</th>
            <th>Insurance</th>
            <th>Fitness</th>
            <th>PUC</th>
            <th>Permit</th>
            <th>Next Service</th>
            <th>Status</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
        ${rows.length === 0 ? `
          <tr><td colspan="12" style="padding:56px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:8px">🚛</div>
            <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No vehicles found</div>
            <div style="font-size:12px">${vehiclesFilter.q||vehiclesFilter.status?'Try clearing your filters':'Click "Add Vehicle" to register your first vehicle'}</div>
          </td></tr>` :
          rows.map(v => `
          <tr style="cursor:pointer" onclick="viewVehicle('${v.id}')">
            <td>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:36px;height:36px;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
                  background:${v.status==='active'?'rgba(16,185,129,0.12)':v.status==='maintenance'?'rgba(245,158,11,0.12)':'rgba(239,68,68,0.12)'}">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${v.status==='active'?'#34d399':v.status==='maintenance'?'#fbbf24':'#f87171'}" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
                </div>
                <div>
                  <div class="font-bold text-blue">${v.regNo}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${v.make} ${v.model} · ${v.year}</div>
                </div>
              </div>
            </td>
            <td>${v.type}</td>
            <td>
              <div style="font-size:13px">${v.capacity}</div>
              <div style="font-size:11px;color:var(--text-muted)">${v.fuelType}</div>
            </td>
            <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${KKR.driverName(v.driver)}</td>
            <td class="text-right">${v.kmReading ? fmtNum(v.kmReading,0)+' km' : '—'}</td>
            <td onclick="event.stopPropagation()">${_expiryCell(v.insurance)}</td>
            <td onclick="event.stopPropagation()">${_expiryCell(v.fitness)}</td>
            <td onclick="event.stopPropagation()">${_expiryCell(v.puc)}</td>
            <td onclick="event.stopPropagation()">${_expiryCell(v.permit)}</td>
            <td onclick="event.stopPropagation()">${_expiryCell(v.nextService)}</td>
            <td onclick="event.stopPropagation()">${statusBadge(v.status)}</td>
            <td onclick="event.stopPropagation()">
              <div class="flex gap-2" style="justify-content:center">
                <button class="btn btn-xs btn-secondary" title="View" onclick="viewVehicle('${v.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="btn btn-xs btn-secondary" title="Edit" onclick="openVehicleForm('${v.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="btn btn-xs btn-danger" title="Delete" onclick="deleteVehicle('${v.id}')">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function _renderVehicleAlerts(alerts) {
  if (alerts.length === 0) return `
    <div class="card" style="border-radius:0 12px 12px 12px;padding:60px;text-align:center;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">✅</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px">All documents are up to date</div>
      <div style="font-size:13px">No vehicles have documents expiring within ${VEH_ALERT_DAYS} days</div>
    </div>`;

  // Group by priority
  const groups = {};
  alerts.forEach(a => {
    const g = a.priority === 'expired' || a.priority === 'critical' ? 'critical' :
              a.priority === 'high'    ? 'high' :
              a.priority === 'medium'  ? 'medium' : 'low';
    if (!groups[g]) groups[g] = [];
    groups[g].push(a);
  });

  const sections = [
    { key:'critical', label:'Expired / Critical (within 15 days)', col:'#f87171' },
    { key:'high',     label:'High Priority (16–30 days)',           col:'#fb923c' },
    { key:'medium',   label:'Medium Priority (31–60 days)',         col:'#fbbf24' },
    { key:'low',      label:'Low Priority (61–90 days)',            col:'#a3e635' },
  ].filter(s => groups[s.key]);

  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <div style="font-size:15px;font-weight:700">${alerts.length} document alert${alerts.length!==1?'s':''}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Documents expiring within ${VEH_ALERT_DAYS} days across all vehicles</div>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="exportVehicleAlerts()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export Alerts
      </button>
    </div>

    ${sections.map(sec => `
      <div style="margin-bottom:24px">
        <div style="font-size:11px;font-weight:700;color:${sec.col};text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;display:flex;align-items:center;gap:8px">
          <span style="width:8px;height:8px;border-radius:50%;background:${sec.col};flex-shrink:0"></span>
          ${sec.label}
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${groups[sec.key].map(a => `
            <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--bg-dark);border:1px solid ${a.days<0?'rgba(239,68,68,0.25)':'var(--border)'};border-radius:10px;transition:all .15s"
              onmouseenter="this.style.borderColor='${_alertPriorityColor(a.priority)}40'"
              onmouseleave="this.style.borderColor='${a.days<0?'rgba(239,68,68,0.25)':'var(--border)'}'">
              <div style="width:40px;height:40px;border-radius:10px;background:${_alertPriorityColor(a.priority)}15;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">
                ${a.icon}
              </div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
                  <span style="font-size:14px;font-weight:700;color:var(--text-primary)">${a.regNo}</span>
                  <span style="font-size:12px;color:var(--text-muted)">·</span>
                  <span style="font-size:12px;font-weight:600;color:var(--text-muted)">${a.label}</span>
                  ${_alertBadge(a.priority)}
                </div>
                <div style="font-size:12px;color:var(--text-muted)">
                  ${a.make} ${a.model} ·
                  ${a.days < 0
                    ? `<span style="color:#f87171;font-weight:600">Expired ${Math.abs(a.days)} day${Math.abs(a.days)!==1?'s':''} ago</span>`
                    : `Expires <strong style="color:${_alertPriorityColor(a.priority)}">${fmtDate(a.date)}</strong> · ${a.days} day${a.days!==1?'s':''} left`}
                </div>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-xs btn-secondary" onclick="viewVehicle('${a.vehicleId}')">View</button>
                <button class="btn btn-xs btn-primary btn-sm" onclick="openVehicleForm('${a.vehicleId}')">Update</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Add / Edit form ─────────────────────────────────────────────────────────
function openVehicleForm(id = null) {
  editingVehicleId = id;
  const v        = id ? (KKR.getVehicles().find(x => x.id === id) || {}) : {};
  const drivers  = KKR.getDrivers();
  document.getElementById('veh-form-title').textContent = id ? `Edit — ${v.regNo || id}` : 'Add Vehicle';

  document.getElementById('veh-form-body').innerHTML = `
    <form onsubmit="saveVehicle(event)" autocomplete="off">

      <!-- ─ Basic info ─────────────────────────────────────────────────── -->
      <div class="veh-form-section-hdr">Vehicle Information</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Registration Number <span style="color:#f87171">*</span></label>
          <input class="form-control" id="vf-reg" value="${v.regNo||''}"
            placeholder="PB-10-AB-1234" style="text-transform:uppercase"
            oninput="this.value=this.value.toUpperCase()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Vehicle Type <span style="color:#f87171">*</span></label>
          <select class="form-control" id="vf-type" required>
            ${['Truck','Tipper','Tanker','Container','Trailer','Mini Truck','Pickup','Other']
              .map(t => `<option value="${t}" ${(v.type||'')==t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status <span style="color:#f87171">*</span></label>
          <select class="form-control" id="vf-status">
            <option value="active"      ${(v.status||'active')==='active'?'selected':''}>Active</option>
            <option value="maintenance" ${v.status==='maintenance'?'selected':''}>Maintenance</option>
            <option value="inactive"    ${v.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Make <span style="color:#f87171">*</span></label>
          <input class="form-control" id="vf-make" value="${v.make||''}"
            placeholder="Tata / Ashok Leyland / Mahindra…" list="make-list" required>
          <datalist id="make-list">
            <option>Tata</option><option>Ashok Leyland</option><option>Mahindra</option>
            <option>Eicher</option><option>TATA Motors</option><option>BharatBenz</option>
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Model <span style="color:#f87171">*</span></label>
          <input class="form-control" id="vf-model" value="${v.model||''}"
            placeholder="LPT 2518 / 3520 8x2…" required>
        </div>
        <div class="form-group">
          <label class="form-label">Year</label>
          <input type="number" class="form-control" id="vf-year"
            value="${v.year||new Date().getFullYear()}" min="1990" max="2030">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Load Capacity</label>
          <input class="form-control" id="vf-cap" value="${v.capacity||''}" placeholder="25 Ton">
        </div>
        <div class="form-group">
          <label class="form-label">Fuel Type</label>
          <select class="form-control" id="vf-fuel">
            ${['Diesel','Petrol','CNG','LNG','Electric']
              .map(f => `<option ${(v.fuelType||'Diesel')===f?'selected':''}>${f}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Current KM Reading</label>
          <input type="number" class="form-control" id="vf-km"
            value="${v.kmReading||''}" placeholder="0" min="0">
        </div>
      </div>

      <!-- ─ Assignment ────────────────────────────────────────────────── -->
      <div class="veh-form-section-hdr" style="margin-top:18px">Assignment</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Assigned Driver</label>
          <select class="form-control" id="vf-driver">
            <option value="">— Unassigned —</option>
            ${drivers.map(d =>
              `<option value="${d.id}" ${v.driver===d.id?'selected':''}>${d.name} (${d.phone})</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- ─ Document dates ─────────────────────────────────────────────── -->
      <div class="veh-form-section-hdr" style="margin-top:18px">Document Expiry Dates</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">RC Expiry</label>
          <input type="date" class="form-control" id="vf-rc"
            value="${fmtDateInput(v.rc||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Insurance Expiry</label>
          <input type="date" class="form-control" id="vf-ins"
            value="${fmtDateInput(v.insurance||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Fitness Expiry</label>
          <input type="date" class="form-control" id="vf-fit"
            value="${fmtDateInput(v.fitness||'')}">
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Permit Expiry</label>
          <input type="date" class="form-control" id="vf-per"
            value="${fmtDateInput(v.permit||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Pollution (PUC) Expiry</label>
          <input type="date" class="form-control" id="vf-puc"
            value="${fmtDateInput(v.puc||'')}">
        </div>
      </div>

      <!-- ─ Service ────────────────────────────────────────────────────── -->
      <div class="veh-form-section-hdr" style="margin-top:18px">Service Details</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Last Service Date</label>
          <input type="date" class="form-control" id="vf-lsvc"
            value="${fmtDateInput(v.lastService||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Last Service KM</label>
          <input type="number" class="form-control" id="vf-lsvcKM"
            value="${v.lastServiceKM||''}" placeholder="KM at last service">
        </div>
        <div class="form-group">
          <label class="form-label">Next Service Due</label>
          <input type="date" class="form-control" id="vf-nsvc"
            value="${fmtDateInput(v.nextService||'')}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Service Notes</label>
        <textarea class="form-control" id="vf-svcnotes" rows="2"
          placeholder="Oil change, tyre rotation, engine check…">${v.serviceNotes||''}</textarea>
      </div>

      <!-- ─ General notes ──────────────────────────────────────────────── -->
      <div class="veh-form-section-hdr" style="margin-top:18px">Notes</div>
      <div class="form-group">
        <textarea class="form-control" id="vf-notes" rows="2"
          placeholder="Any other information…">${v.notes||''}</textarea>
      </div>

      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('veh-form-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update Vehicle' : 'Save Vehicle'}
        </button>
      </div>
    </form>
    <style>
      .veh-form-section-hdr{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
    </style>`;

  openModal('veh-form-modal');
}

// ── Save vehicle ────────────────────────────────────────────────────────────
function saveVehicle(e) {
  e.preventDefault();
  const vehicles = KKR.getVehicles();
  const veh = {
    id:           editingVehicleId || 'V' + Date.now().toString().slice(-5),
    regNo:        document.getElementById('vf-reg').value.trim().toUpperCase(),
    type:         document.getElementById('vf-type').value,
    make:         document.getElementById('vf-make').value.trim(),
    model:        document.getElementById('vf-model').value.trim(),
    year:         parseInt(document.getElementById('vf-year').value) || new Date().getFullYear(),
    capacity:     document.getElementById('vf-cap').value.trim(),
    fuelType:     document.getElementById('vf-fuel').value,
    kmReading:    parseInt(document.getElementById('vf-km').value) || 0,
    driver:       document.getElementById('vf-driver').value,
    status:       document.getElementById('vf-status').value,
    // Documents
    rc:           document.getElementById('vf-rc').value,
    insurance:    document.getElementById('vf-ins').value,
    fitness:      document.getElementById('vf-fit').value,
    permit:       document.getElementById('vf-per').value,
    puc:          document.getElementById('vf-puc').value,
    // Service
    lastService:  document.getElementById('vf-lsvc').value,
    lastServiceKM:parseInt(document.getElementById('vf-lsvcKM').value) || 0,
    nextService:  document.getElementById('vf-nsvc').value,
    serviceNotes: document.getElementById('vf-svcnotes').value.trim(),
    notes:        document.getElementById('vf-notes').value.trim(),
  };

  const idx = vehicles.findIndex(v => v.id === editingVehicleId);
  if (idx >= 0) vehicles[idx] = veh; else vehicles.push(veh);
  KKR.saveVehicles(vehicles);
  closeModal('veh-form-modal');
  toast(editingVehicleId ? `${veh.regNo} updated` : `${veh.regNo} added`, 'success');
  rerenderPage();
}

// ── View detail ─────────────────────────────────────────────────────────────
function viewVehicle(id) {
  viewingVehicleId = id;
  const v     = KKR.getVehicles().find(x => x.id === id);
  if (!v) return;
  const trips = KKR.getTrips().filter(t => t.vehicle === id);
  const fuel  = KKR.getFuel().filter(f => f.vehicle === id);

  document.getElementById('veh-view-title').textContent = v.regNo;
  document.getElementById('veh-view-edit-btn').onclick  = () => { closeModal('veh-view-modal'); openVehicleForm(id); };

  document.getElementById('veh-view-body').innerHTML = `
    <!-- Status header -->
    <div style="display:flex;align-items:center;gap:10px;padding:0 0 16px;border-bottom:1px solid var(--border);margin-bottom:16px">
      <div style="width:48px;height:48px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;
        background:${v.status==='active'?'rgba(16,185,129,0.12)':v.status==='maintenance'?'rgba(245,158,11,0.12)':'rgba(239,68,68,0.12)'}">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${v.status==='active'?'#34d399':v.status==='maintenance'?'#fbbf24':'#f87171'}" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
      </div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800">${v.regNo}</div>
        <div style="font-size:13px;color:var(--text-muted)">${v.make} ${v.model} · ${v.year} · ${v.type}</div>
      </div>
      ${statusBadge(v.status)}
    </div>

    <!-- Stats row -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
      <div style="background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.18);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#60a5fa">${trips.length}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Total Trips</div>
      </div>
      <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.18);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#34d399">${v.kmReading ? fmtNum(v.kmReading,0) : '—'}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Current KM</div>
      </div>
      <div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.18);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#fbbf24">${fmtCurrency(fuel.reduce((s,f)=>s+f.amount,0))}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Fuel Spent</div>
      </div>
    </div>

    <!-- Details grid -->
    <div class="veh-detail-grid" style="margin-bottom:14px">
      <div class="veh-section-hdr" style="grid-column:span 2">Vehicle Details</div>
      <div class="veh-detail-row"><span class="veh-detail-label">Capacity</span><span class="veh-detail-val">${v.capacity||'—'}</span></div>
      <div class="veh-detail-row"><span class="veh-detail-label">Fuel Type</span><span class="veh-detail-val">${v.fuelType||'—'}</span></div>
      <div class="veh-detail-row"><span class="veh-detail-label">Assigned Driver</span><span class="veh-detail-val">${KKR.driverName(v.driver)}</span></div>
      <div class="veh-detail-row"><span class="veh-detail-label">KM Reading</span><span class="veh-detail-val">${v.kmReading ? fmtNum(v.kmReading,0)+' km' : '—'}</span></div>
    </div>

    <!-- Document expiry grid -->
    <div class="veh-detail-grid" style="margin-bottom:14px">
      <div class="veh-section-hdr" style="grid-column:span 2">Document Expiry</div>
      ${VEH_DOC_FIELDS.map(f => `
        <div class="veh-detail-row">
          <span class="veh-detail-label">${f.icon} ${f.label}</span>
          <span class="veh-detail-val">${_expiryCell(v[f.key])}</span>
        </div>`).join('')}
    </div>

    <!-- Service -->
    <div class="veh-detail-grid" style="margin-bottom:14px">
      <div class="veh-section-hdr" style="grid-column:span 2">Service</div>
      <div class="veh-detail-row"><span class="veh-detail-label">Last Service</span><span class="veh-detail-val">${fmtDate(v.lastService)||'—'}</span></div>
      <div class="veh-detail-row"><span class="veh-detail-label">Last Service KM</span><span class="veh-detail-val">${v.lastServiceKM ? fmtNum(v.lastServiceKM,0)+' km' : '—'}</span></div>
      <div class="veh-detail-row" style="grid-column:span 2"><span class="veh-detail-label">Next Service</span><span class="veh-detail-val">${_expiryCell(v.nextService)}</span></div>
      ${v.serviceNotes ? `<div class="veh-detail-row" style="grid-column:span 2"><span class="veh-detail-label">Service Notes</span><span class="veh-detail-val" style="font-weight:500;color:var(--text-muted)">${v.serviceNotes}</span></div>` : ''}
    </div>

    ${v.notes ? `
    <div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;padding:12px 16px">
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Notes</div>
      <div style="font-size:13px;color:var(--text-primary)">${v.notes}</div>
    </div>` : ''}`;

  openModal('veh-view-modal');
}

// ── Delete ──────────────────────────────────────────────────────────────────
function deleteVehicle(id) {
  const v = KKR.getVehicles().find(x => x.id === id);
  confirmDelete(v ? v.regNo : id, () => {
    KKR.saveVehicles(KKR.getVehicles().filter(x => x.id !== id));
    toast('Vehicle removed', 'error');
    rerenderPage();
  });
}

// ── Export CSV ──────────────────────────────────────────────────────────────
function exportVehiclesCSV() {
  const rows = KKR.getVehicles().map(v => ({
    'Reg No':         v.regNo,
    'Type':           v.type,
    'Make':           v.make,
    'Model':          v.model,
    'Year':           v.year,
    'Capacity':       v.capacity,
    'Fuel Type':      v.fuelType,
    'KM Reading':     v.kmReading||0,
    'Assigned Driver':KKR.driverName(v.driver),
    'Status':         v.status,
    'RC Expiry':      v.rc||'',
    'Insurance':      v.insurance||'',
    'Fitness':        v.fitness||'',
    'Permit':         v.permit||'',
    'PUC':            v.puc||'',
    'Last Service':   v.lastService||'',
    'Next Service':   v.nextService||'',
  }));
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-vehicles-${today()}.csv`);
  toast('Vehicles exported', 'success');
}

// ── Export alerts CSV ────────────────────────────────────────────────────────
function exportVehicleAlerts() {
  const alerts = _vehAlerts(KKR.getVehicles());
  const rows = alerts.map(a => ({
    'Reg No':   a.regNo,
    'Vehicle':  `${a.make} ${a.model}`,
    'Document': a.label,
    'Expiry':   a.date,
    'Days':     a.days,
    'Priority': a.priority,
  }));
  exportCSV(['Reg No','Vehicle','Document','Expiry','Days','Priority'], rows, `kkr-vehicle-alerts-${today()}.csv`);
  toast('Alerts exported', 'success');
}

// Backward-compat alias
function openVehicleModal(id = null) { openVehicleForm(id); }
