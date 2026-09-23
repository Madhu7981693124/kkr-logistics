// ============================================================
// KKR Logistics — Drivers Module
// Fields: name, phone, altPhone, dob, address, joinDate,
//         license, licenseType, licenseExpiry,
//         badgeNo, badgeExpiry, vehicle,
//         allowancePerDay, allowanceType, notes, status
// Alerts: license expiry, badge expiry within 90 days
// ============================================================

// ── Module state ────────────────────────────────────────────────────────────
let driversFilter   = { q: '', status: '' };
let driversTab      = 'list';    // 'list' | 'alerts'
let editingDriverId = null;
let viewingDriverId = null;

const DRV_ALERT_DAYS = 90;

const DRV_DOC_FIELDS = [
  { key: 'licenseExpiry', label: 'Driving License', icon: '🪪', color: '#f87171' },
  { key: 'badgeExpiry',   label: 'Driver Badge',    icon: '🏷️', color: '#fbbf24' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function _drvAlerts(drivers) {
  const alerts = [];
  drivers.forEach(d => {
    DRV_DOC_FIELDS.forEach(f => {
      if (!d[f.key]) return;
      const days = daysFromNow(d[f.key]);
      if (days === null) return;
      const priority = days < 0 ? 'expired' : days <= 15 ? 'critical' : days <= 30 ? 'high' : days <= 60 ? 'medium' : days <= DRV_ALERT_DAYS ? 'low' : null;
      if (!priority) return;
      alerts.push({ driverId: d.id, name: d.name, phone: d.phone, field: f.key, label: f.label, icon: f.icon, color: f.color, date: d[f.key], days, priority });
    });
  });
  alerts.sort((a, b) => a.days - b.days);
  return alerts;
}

function _drvExpiryCell(dateStr) {
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

function _drvAlertPriorityColor(p) {
  return { expired:'#f87171', critical:'#f87171', high:'#fb923c', medium:'#fbbf24', low:'#a3e635' }[p] || '#94a3b8';
}

// ── Trip stats per driver ─────────────────────────────────────────────────
function _drvTripStats(driverId) {
  const trips = KKR.getTrips().filter(t => t.driver === driverId);
  const completed = trips.filter(t => t.status === 'completed' || t.status === 'delivered').length;
  const totalKM   = trips.reduce((s, t) => s + (t.totalKM || t.distance || 0), 0);
  const earnings  = trips.reduce((s, t) => s + (t.grandTotal || t.freight || 0), 0);
  return { total: trips.length, completed, totalKM, earnings };
}

// ── Main render ────────────────────────────────────────────────────────────
function renderDrivers() {
  const allDrivers = KKR.getDrivers();
  const allAlerts  = _drvAlerts(allDrivers);
  const unread     = allAlerts.length;

  let rows = [...allDrivers];
  if (driversFilter.status) rows = rows.filter(d => d.status === driversFilter.status);
  if (driversFilter.q) {
    const q = driversFilter.q.toLowerCase();
    rows = rows.filter(d =>
      (d.name    || '').toLowerCase().includes(q) ||
      (d.phone   || '').toLowerCase().includes(q) ||
      (d.license || '').toLowerCase().includes(q) ||
      (d.address || '').toLowerCase().includes(q) ||
      KKR.vehicleReg(d.vehicle).toLowerCase().includes(q)
    );
  }

  return `
  <div class="page-content">

    <!-- ── Page header ─────────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Drivers</div>
        <div class="subtitle">${allDrivers.length} drivers · ${allDrivers.filter(d=>d.status==='active').length} active</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportDriversCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-primary" onclick="openDriverForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Driver
        </button>
      </div>
    </div>

    <!-- ── Stat strip ──────────────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px">
      ${[
        { label:'Total',      val: allDrivers.length,                                    col:'#60a5fa', filter:''         },
        { label:'Active',     val: allDrivers.filter(d=>d.status==='active').length,      col:'#34d399', filter:'active'   },
        { label:'On Leave',   val: allDrivers.filter(d=>d.status==='on-leave').length,    col:'#fbbf24', filter:'on-leave' },
        { label:'Inactive',   val: allDrivers.filter(d=>d.status==='inactive').length,    col:'#f87171', filter:'inactive' },
        { label:'Doc Alerts', val: unread, col: unread>0?'#f87171':'#34d399', filter:'_alerts' },
      ].map(s => `
        <div class="card card-sm drv-stat-card ${driversFilter.status===s.filter&&s.filter&&s.filter!=='_alerts'?'drv-stat-active':''} ${s.filter==='_alerts'&&driversTab==='alerts'?'drv-stat-active':''}"
          style="text-align:center;cursor:pointer;transition:all .15s"
          onclick="${s.filter==='_alerts'?"driversTab='alerts';driversFilter.status='';rerenderPage()":"driversTab='list';driversFilter.status='"+s.filter+"';rerenderPage()"}">
          <div style="font-size:22px;font-weight:800;color:${s.col}">${s.val}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">${s.label}</div>
        </div>`).join('')}
    </div>

    <!-- ── Tabs ────────────────────────────────────────────────────────── -->
    <div class="tabs" style="margin-bottom:0">
      <div class="tab ${driversTab==='list'?'active':''}" onclick="driversTab='list';rerenderPage()">Driver List</div>
      <div class="tab ${driversTab==='alerts'?'active':''}" onclick="driversTab='alerts';rerenderPage()">
        License &amp; Doc Alerts
        ${unread > 0 ? `<span style="margin-left:6px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px">${unread}</span>` : ''}
      </div>
    </div>

    ${driversTab === 'alerts' ? _renderDriverAlerts(allAlerts) : _renderDriverList(rows, allDrivers)}

  </div>

  <!-- ── Add / Edit modal ─────────────────────────────────────────────── -->
  <div class="modal-overlay" id="drv-form-modal">
    <div class="modal" style="max-width:760px">
      <div class="modal-header">
        <div class="modal-title" id="drv-form-title">Add Driver</div>
        <button class="modal-close" onclick="closeModal('drv-form-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="drv-form-body"></div>
    </div>
  </div>

  <!-- ── View modal ───────────────────────────────────────────────────── -->
  <div class="modal-overlay" id="drv-view-modal">
    <div class="modal" style="max-width:680px">
      <div class="modal-header">
        <div class="modal-title" id="drv-view-title">Driver Details</div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" id="drv-view-edit-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="modal-close" onclick="closeModal('drv-view-modal')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-body" id="drv-view-body"></div>
    </div>
  </div>

  <style>
    .drv-stat-card:hover { border-color:#475569!important;transform:translateY(-1px); }
    .drv-stat-active     { border-color:#2563eb!important;background:rgba(37,99,235,0.06)!important; }
    .drv-detail-grid     { display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden; }
    .drv-detail-row      { display:flex;flex-direction:column;padding:10px 14px;border-bottom:1px solid rgba(51,65,85,0.4); }
    .drv-detail-row:nth-child(odd)  { border-right:1px solid rgba(51,65,85,0.4); }
    .drv-detail-label    { font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px; }
    .drv-detail-val      { font-size:13.5px;font-weight:600;color:var(--text-primary); }
    .drv-section-hdr     { font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;padding:10px 14px;background:rgba(51,65,85,0.2);border-bottom:1px solid var(--border); }
    @media(max-width:600px){
      .drv-detail-grid { grid-template-columns:1fr!important; }
      .drv-detail-row:nth-child(odd) { border-right:none; }
    }
  </style>`;
}

function _renderDriverList(rows, allDrivers) {
  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div class="filter-bar" style="margin-bottom:16px">
      <div class="search-input-wrap" style="flex:1;min-width:200px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search name, phone, license, vehicle…"
          value="${driversFilter.q}" oninput="driversFilter.q=this.value;rerenderPage()">
      </div>
      <select class="form-control" style="width:155px"
        onchange="driversFilter.status=this.value;rerenderPage()">
        <option value="">All Status</option>
        <option value="active"   ${driversFilter.status==='active'?'selected':''}>Active</option>
        <option value="on-leave" ${driversFilter.status==='on-leave'?'selected':''}>On Leave</option>
        <option value="inactive" ${driversFilter.status==='inactive'?'selected':''}>Inactive</option>
      </select>
      ${driversFilter.q||driversFilter.status?`
        <button class="btn btn-secondary btn-sm" onclick="driversFilter={q:'',status:''};rerenderPage()">Clear</button>`:``}
      <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${rows.length} of ${allDrivers.length}</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Phone</th>
            <th>License No.</th>
            <th>License Type</th>
            <th>License Expiry</th>
            <th>Badge Expiry</th>
            <th>Vehicle</th>
            <th>Join Date</th>
            <th>Allowance</th>
            <th>Trips</th>
            <th>Status</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
        ${rows.length === 0 ? `
          <tr><td colspan="12" style="padding:56px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:8px">👤</div>
            <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No drivers found</div>
            <div style="font-size:12px">${driversFilter.q||driversFilter.status?'Try clearing filters':'Click "Add Driver" to add your first driver'}</div>
          </td></tr>` :
          rows.map(d => {
            const ts   = _drvTripStats(d.id);
            const dAllowance = d.allowancePerDay
              ? `₹${fmtNum(d.allowancePerDay,0)}/${d.allowanceType||'day'}`
              : '—';
            return `
            <tr style="cursor:pointer" onclick="viewDriver('${d.id}')">
              <td onclick="event.stopPropagation()">
                <div style="display:flex;align-items:center;gap:10px">
                  <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;
                    background:linear-gradient(135deg,${d.status==='active'?'#2563eb,#7c3aed':d.status==='on-leave'?'#f59e0b,#d97706':'#64748b,#475569'})">
                    ${d.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div class="font-bold" style="cursor:pointer" onclick="viewDriver('${d.id}')">${d.name}</div>
                    <div style="font-size:11px;color:var(--text-muted);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.address||'—'}</div>
                  </div>
                </div>
              </td>
              <td>
                <div>${d.phone}</div>
                ${d.altPhone ? `<div style="font-size:11px;color:var(--text-muted)">${d.altPhone}</div>` : ''}
              </td>
              <td class="font-medium">${d.license||'—'}</td>
              <td style="color:var(--text-muted)">${d.licenseType||'—'}</td>
              <td onclick="event.stopPropagation()">${_drvExpiryCell(d.licenseExpiry)}</td>
              <td onclick="event.stopPropagation()">${_drvExpiryCell(d.badgeExpiry)}</td>
              <td style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${KKR.vehicleReg(d.vehicle)}</td>
              <td style="white-space:nowrap">${fmtDate(d.joinDate)}</td>
              <td>${dAllowance}</td>
              <td class="font-bold text-blue">${ts.total}</td>
              <td onclick="event.stopPropagation()">${statusBadge(d.status)}</td>
              <td onclick="event.stopPropagation()">
                <div class="flex gap-2" style="justify-content:center">
                  <button class="btn btn-xs btn-secondary" title="View" onclick="viewDriver('${d.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <button class="btn btn-xs btn-secondary" title="Edit" onclick="openDriverForm('${d.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-xs btn-danger" title="Delete" onclick="deleteDriver('${d.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>`;}).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function _renderDriverAlerts(alerts) {
  if (alerts.length === 0) return `
    <div class="card" style="border-radius:0 12px 12px 12px;padding:60px;text-align:center;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">✅</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:6px">All licenses are up to date</div>
      <div style="font-size:13px">No drivers have documents expiring within ${DRV_ALERT_DAYS} days</div>
    </div>`;

  const groups = {};
  alerts.forEach(a => {
    const g = a.priority==='expired'||a.priority==='critical' ? 'critical' :
              a.priority==='high' ? 'high' : a.priority==='medium' ? 'medium' : 'low';
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
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Driver licenses &amp; badges expiring within ${DRV_ALERT_DAYS} days</div>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="exportDriverAlerts()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export
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
            <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;background:var(--bg-dark);border:1px solid ${a.days<0?'rgba(239,68,68,0.25)':'var(--border)'};border-radius:10px">
              <div style="width:42px;height:42px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:#fff;
                background:linear-gradient(135deg,${a.priority==='expired'||a.priority==='critical'?'#ef4444,#b91c1c':a.priority==='high'?'#f97316,#c2410c':a.priority==='medium'?'#f59e0b,#b45309':'#84cc16,#4d7c0f'})">
                ${a.name.charAt(0).toUpperCase()}
              </div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap">
                  <span style="font-size:14px;font-weight:700">${a.name}</span>
                  <span style="font-size:12px;color:var(--text-muted)">·</span>
                  <span style="font-size:12px;font-weight:600;color:var(--text-muted)">${a.icon} ${a.label}</span>
                  <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;background:${_drvAlertPriorityColor(a.priority)}20;color:${_drvAlertPriorityColor(a.priority)};border:1px solid ${_drvAlertPriorityColor(a.priority)}40;text-transform:uppercase;letter-spacing:.4px">
                    ${a.priority}
                  </span>
                </div>
                <div style="font-size:12px;color:var(--text-muted)">
                  ${a.days < 0
                    ? `<span style="color:#f87171;font-weight:600">Expired ${Math.abs(a.days)} day${Math.abs(a.days)!==1?'s':''} ago (${fmtDate(a.date)})</span>`
                    : `Expires <strong style="color:${_drvAlertPriorityColor(a.priority)}">${fmtDate(a.date)}</strong> · ${a.days} day${a.days!==1?'s':''} remaining`}
                </div>
              </div>
              <div class="flex gap-2">
                <button class="btn btn-xs btn-secondary" onclick="viewDriver('${a.driverId}')">View</button>
                <button class="btn btn-xs btn-primary btn-sm" onclick="openDriverForm('${a.driverId}')">Update</button>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Add / Edit form ──────────────────────────────────────────────────────────
function openDriverForm(id = null) {
  editingDriverId = id;
  const d       = id ? (KKR.getDrivers().find(x => x.id === id) || {}) : {};
  const vehicles = KKR.getVehicles();
  document.getElementById('drv-form-title').textContent = id ? `Edit — ${d.name || id}` : 'Add Driver';

  document.getElementById('drv-form-body').innerHTML = `
    <form onsubmit="saveDriver(event)" autocomplete="off">

      <!-- ─ Personal ────────────────────────────────────────────────────── -->
      <div class="drv-form-section-hdr">Personal Information</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name <span style="color:#f87171">*</span></label>
          <input class="form-control" id="df-name" value="${d.name||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Phone <span style="color:#f87171">*</span></label>
          <input class="form-control" id="df-phone" value="${d.phone||''}"
            inputmode="numeric" placeholder="10-digit mobile" required>
        </div>
        <div class="form-group">
          <label class="form-label">Alternate Phone</label>
          <input class="form-control" id="df-altphone" value="${d.altPhone||''}"
            inputmode="numeric" placeholder="Optional">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date of Birth</label>
          <input type="date" class="form-control" id="df-dob"
            value="${fmtDateInput(d.dob||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Joining Date</label>
          <input type="date" class="form-control" id="df-join"
            value="${fmtDateInput(d.joinDate||today())}">
        </div>
        <div class="form-group">
          <label class="form-label">Status <span style="color:#f87171">*</span></label>
          <select class="form-control" id="df-status">
            <option value="active"   ${(d.status||'active')==='active'?'selected':''}>Active</option>
            <option value="on-leave" ${d.status==='on-leave'?'selected':''}>On Leave</option>
            <option value="inactive" ${d.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <textarea class="form-control" id="df-addr" rows="2"
          placeholder="Full address">${d.address||''}</textarea>
      </div>

      <!-- ─ License ─────────────────────────────────────────────────────── -->
      <div class="drv-form-section-hdr" style="margin-top:18px">License &amp; Badge</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">License Number <span style="color:#f87171">*</span></label>
          <input class="form-control" id="df-lic" value="${d.license||''}"
            placeholder="PB0120185001234" style="text-transform:uppercase"
            oninput="this.value=this.value.toUpperCase()" required>
        </div>
        <div class="form-group">
          <label class="form-label">License Type</label>
          <select class="form-control" id="df-lictype">
            ${['LMV','HMV','HGV','MGV','LMV-NT','Hazardous']
              .map(t=>`<option value="${t}" ${(d.licenseType||'HMV')===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">License Expiry</label>
          <input type="date" class="form-control" id="df-licexp"
            value="${fmtDateInput(d.licenseExpiry||'')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Badge / PSV Badge No.</label>
          <input class="form-control" id="df-badge" value="${d.badgeNo||''}"
            placeholder="Optional">
        </div>
        <div class="form-group">
          <label class="form-label">Badge Expiry</label>
          <input type="date" class="form-control" id="df-badgeexp"
            value="${fmtDateInput(d.badgeExpiry||'')}">
        </div>
      </div>

      <!-- ─ Assignment ─────────────────────────────────────────────────── -->
      <div class="drv-form-section-hdr" style="margin-top:18px">Vehicle Assignment</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Assigned Vehicle</label>
          <select class="form-control" id="df-vehicle">
            <option value="">— Unassigned —</option>
            ${vehicles.map(v =>
              `<option value="${v.id}" ${d.vehicle===v.id?'selected':''}>${v.regNo} · ${v.make} ${v.model}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- ─ Allowance ──────────────────────────────────────────────────── -->
      <div class="drv-form-section-hdr" style="margin-top:18px">Allowance</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Allowance Amount (₹)</label>
          <input type="number" class="form-control" id="df-allow"
            value="${d.allowancePerDay||''}" placeholder="0.00" min="0" step="0.01">
        </div>
        <div class="form-group">
          <label class="form-label">Allowance Type</label>
          <select class="form-control" id="df-allowtype">
            ${['per day','per trip','per km','monthly']
              .map(t=>`<option value="${t}" ${(d.allowanceType||'per day')===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- ─ Notes ──────────────────────────────────────────────────────── -->
      <div class="drv-form-section-hdr" style="margin-top:18px">Notes</div>
      <div class="form-group">
        <textarea class="form-control" id="df-notes" rows="2"
          placeholder="Medical conditions, special skills, languages, emergency contact…">${d.notes||''}</textarea>
      </div>

      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('drv-form-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update Driver' : 'Save Driver'}
        </button>
      </div>
    </form>
    <style>
      .drv-form-section-hdr{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
    </style>`;

  openModal('drv-form-modal');
}

// ── Save ────────────────────────────────────────────────────────────────────
function saveDriver(e) {
  e.preventDefault();
  const drivers = KKR.getDrivers();
  const drv = {
    id:            editingDriverId || 'D' + Date.now().toString().slice(-5),
    name:          document.getElementById('df-name').value.trim(),
    phone:         document.getElementById('df-phone').value.trim(),
    altPhone:      document.getElementById('df-altphone').value.trim(),
    dob:           document.getElementById('df-dob').value,
    joinDate:      document.getElementById('df-join').value,
    status:        document.getElementById('df-status').value,
    address:       document.getElementById('df-addr').value.trim(),
    // License
    license:       document.getElementById('df-lic').value.trim().toUpperCase(),
    licenseType:   document.getElementById('df-lictype').value,
    licenseExpiry: document.getElementById('df-licexp').value,
    // Badge
    badgeNo:       document.getElementById('df-badge').value.trim(),
    badgeExpiry:   document.getElementById('df-badgeexp').value,
    // Vehicle
    vehicle:       document.getElementById('df-vehicle').value,
    // Allowance
    allowancePerDay: parseFloat(document.getElementById('df-allow').value) || 0,
    allowanceType:   document.getElementById('df-allowtype').value,
    // Notes
    notes:         document.getElementById('df-notes').value.trim(),
    // Preserve trip count from existing record
    trips:         (KKR.getDrivers().find(x => x.id === editingDriverId) || { trips: 0 }).trips,
  };

  const idx = drivers.findIndex(d => d.id === editingDriverId);
  if (idx >= 0) drivers[idx] = drv; else drivers.push(drv);
  KKR.saveDrivers(drivers);
  closeModal('drv-form-modal');
  toast(editingDriverId ? `${drv.name} updated` : `${drv.name} added`, 'success');
  rerenderPage();
}

// ── View ────────────────────────────────────────────────────────────────────
function viewDriver(id) {
  viewingDriverId = id;
  const d  = KKR.getDrivers().find(x => x.id === id);
  if (!d) return;
  const ts = _drvTripStats(id);

  document.getElementById('drv-view-title').textContent = d.name;
  document.getElementById('drv-view-edit-btn').onclick  = () => { closeModal('drv-view-modal'); openDriverForm(id); };

  document.getElementById('drv-view-body').innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:16px;padding:0 0 16px;border-bottom:1px solid var(--border);margin-bottom:16px">
      <div style="width:56px;height:56px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;color:#fff;
        background:linear-gradient(135deg,${d.status==='active'?'#2563eb,#7c3aed':d.status==='on-leave'?'#f59e0b,#d97706':'#64748b,#475569'})">
        ${d.name.charAt(0).toUpperCase()}
      </div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800">${d.name}</div>
        <div style="font-size:13px;color:var(--text-muted)">
          ${d.phone}${d.altPhone?' · '+d.altPhone:''}
          ${d.joinDate ? ' · Joined '+fmtDate(d.joinDate) : ''}
        </div>
      </div>
      ${statusBadge(d.status)}
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
      <div style="background:rgba(37,99,235,0.07);border:1px solid rgba(37,99,235,0.18);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#60a5fa">${ts.total}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Total Trips</div>
      </div>
      <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.18);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#34d399">${ts.completed}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">Completed</div>
      </div>
      <div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.18);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:20px;font-weight:800;color:#fbbf24">${ts.totalKM > 0 ? fmtNum(ts.totalKM,0)+' km' : '—'}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px">KM Driven</div>
      </div>
    </div>

    <!-- Details grid -->
    <div class="drv-detail-grid" style="margin-bottom:14px">
      <div class="drv-section-hdr" style="grid-column:span 2">Personal</div>
      <div class="drv-detail-row"><span class="drv-detail-label">Date of Birth</span><span class="drv-detail-val">${fmtDate(d.dob)||'—'}</span></div>
      <div class="drv-detail-row"><span class="drv-detail-label">Joining Date</span><span class="drv-detail-val">${fmtDate(d.joinDate)||'—'}</span></div>
      <div class="drv-detail-row" style="grid-column:span 2"><span class="drv-detail-label">Address</span><span class="drv-detail-val" style="font-weight:500;color:var(--text-muted)">${d.address||'—'}</span></div>
    </div>

    <div class="drv-detail-grid" style="margin-bottom:14px">
      <div class="drv-section-hdr" style="grid-column:span 2">License &amp; Badge</div>
      <div class="drv-detail-row"><span class="drv-detail-label">License Number</span><span class="drv-detail-val">${d.license||'—'}</span></div>
      <div class="drv-detail-row"><span class="drv-detail-label">License Type</span><span class="drv-detail-val">${d.licenseType||'—'}</span></div>
      <div class="drv-detail-row"><span class="drv-detail-label">License Expiry</span><span class="drv-detail-val">${_drvExpiryCell(d.licenseExpiry)}</span></div>
      <div class="drv-detail-row"><span class="drv-detail-label">Badge No.</span><span class="drv-detail-val">${d.badgeNo||'—'}</span></div>
      <div class="drv-detail-row"><span class="drv-detail-label">Badge Expiry</span><span class="drv-detail-val">${_drvExpiryCell(d.badgeExpiry)}</span></div>
      <div class="drv-detail-row"><span class="drv-detail-label">Assigned Vehicle</span><span class="drv-detail-val">${KKR.vehicleReg(d.vehicle)}</span></div>
    </div>

    <div class="drv-detail-grid" style="margin-bottom:14px">
      <div class="drv-section-hdr" style="grid-column:span 2">Allowance</div>
      <div class="drv-detail-row"><span class="drv-detail-label">Rate</span>
        <span class="drv-detail-val">${d.allowancePerDay ? '₹'+fmtNum(d.allowancePerDay,2)+' / '+(d.allowanceType||'day') : '—'}</span>
      </div>
    </div>

    ${d.notes ? `
    <div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;padding:12px 16px">
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Notes</div>
      <div style="font-size:13px;color:var(--text-primary)">${d.notes}</div>
    </div>` : ''}`;

  openModal('drv-view-modal');
}

// ── Delete ───────────────────────────────────────────────────────────────────
function deleteDriver(id) {
  const d = KKR.getDrivers().find(x => x.id === id);
  confirmDelete(d ? d.name : id, () => {
    KKR.saveDrivers(KKR.getDrivers().filter(x => x.id !== id));
    toast('Driver removed', 'error');
    rerenderPage();
  });
}

// ── Export ───────────────────────────────────────────────────────────────────
function exportDriversCSV() {
  const rows = KKR.getDrivers().map(d => ({
    'Name':           d.name,
    'Phone':          d.phone,
    'Alt Phone':      d.altPhone||'',
    'DOB':            d.dob||'',
    'Join Date':      d.joinDate||'',
    'Address':        d.address||'',
    'Status':         d.status,
    'License No':     d.license||'',
    'License Type':   d.licenseType||'',
    'License Expiry': d.licenseExpiry||'',
    'Badge No':       d.badgeNo||'',
    'Badge Expiry':   d.badgeExpiry||'',
    'Vehicle':        KKR.vehicleReg(d.vehicle),
    'Allowance':      d.allowancePerDay||0,
    'Allowance Type': d.allowanceType||'',
    'Total Trips':    d.trips||0,
    'Notes':          d.notes||'',
  }));
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-drivers-${today()}.csv`);
  toast('Drivers exported', 'success');
}

function exportDriverAlerts() {
  const alerts = _drvAlerts(KKR.getDrivers());
  const rows = alerts.map(a => ({
    'Driver':   a.name,
    'Phone':    a.phone,
    'Document': a.label,
    'Expiry':   a.date,
    'Days':     a.days,
    'Priority': a.priority,
  }));
  exportCSV(['Driver','Phone','Document','Expiry','Days','Priority'], rows, `kkr-driver-alerts-${today()}.csv`);
  toast('Alerts exported', 'success');
}

// Backward-compat aliases
function openDriverModal(id = null) { openDriverForm(id); }
