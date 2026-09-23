// E-Way Bills Page
let ewayFilter = { q: '', status: '' };
let editingEwayId = null;

function renderEway() {
  let rows = KKR.getEwayBills();
  if (ewayFilter.status) rows = rows.filter(e=>e.status===ewayFilter.status);
  if (ewayFilter.q) rows = filterRows(rows, ewayFilter.q, ['id','billNo','tripId','from','to']);
  rows = [...rows].sort((a,b)=>b.date.localeCompare(a.date));

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">E-Way Bills</div>
        <div class="subtitle">${KKR.getEwayBills().length} bills · ${KKR.getEwayBills().filter(e=>e.status==='active').length} active</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportEwayCSV()">${icon('download',15)} Export</button>
        <button class="btn btn-primary" onclick="openEwayModal()">${icon('plus',15)} New E-Way Bill</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:20px">
      <div class="kpi-card green"><div class="kpi-icon green">${icon('check',20)}</div>
        <div class="kpi-value">${KKR.getEwayBills().filter(e=>e.status==='active').length}</div><div class="kpi-label">Active Bills</div></div>
      <div class="kpi-card red"><div class="kpi-icon red">${icon('warning',20)}</div>
        <div class="kpi-value">${KKR.getEwayBills().filter(e=>e.status==='expired').length}</div><div class="kpi-label">Expired</div></div>
      <div class="kpi-card blue"><div class="kpi-icon blue">${icon('eway',20)}</div>
        <div class="kpi-value">${fmtCurrency(KKR.getEwayBills().reduce((s,e)=>s+e.value,0))}</div><div class="kpi-label">Total Consignment Value</div></div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search by bill no, trip..." value="${ewayFilter.q}"
            oninput="ewayFilter.q=this.value; rerenderPage()">
        </div>
        <select class="form-control" style="width:160px" onchange="ewayFilter.status=this.value; rerenderPage()">
          <option value="">All Status</option>
          <option value="active" ${ewayFilter.status==='active'?'selected':''}>Active</option>
          <option value="expired" ${ewayFilter.status==='expired'?'selected':''}>Expired</option>
          <option value="cancelled" ${ewayFilter.status==='cancelled'?'selected':''}>Cancelled</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>E-Way Bill No.</th><th>Date</th><th>Valid Upto</th><th>Trip</th>
            <th>Vehicle</th><th>Route</th><th>Material</th><th>Value</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length===0 ? `<tr><td colspan="10" class="text-center text-muted" style="padding:40px">No records found</td></tr>` :
            rows.map(e=>{
              const expDays = daysFromNow(e.validUpto);
              const isExpiring = expDays!==null && expDays>=0 && expDays<=2;
              return `
              <tr>
                <td class="font-bold text-blue">${e.billNo}</td>
                <td>${fmtDate(e.date)}</td>
                <td style="color:${expDays!==null&&expDays<0?'#f87171':isExpiring?'#fbbf24':'inherit'}">${fmtDate(e.validUpto)}${isExpiring?` <small>(${expDays}d left)</small>`:''}</td>
                <td>${e.tripId||'—'}</td>
                <td>${KKR.vehicleReg(e.vehicle)}</td>
                <td>${e.from} → ${e.to}</td>
                <td>${KKR.materialName(e.material)}</td>
                <td class="font-bold">${fmtCurrency(e.value)}</td>
                <td>${statusBadge(e.status)}</td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-xs btn-secondary" onclick="openEwayModal('${e.id}')">${icon('edit',13)}</button>
                    <button class="btn btn-xs btn-danger" onclick="deleteEway('${e.id}')">${icon('trash',13)}</button>
                  </div>
                </td>
              </tr>`;}).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="eway-modal">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title" id="eway-modal-title">New E-Way Bill</div>
        <button class="modal-close" onclick="closeModal('eway-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="eway-modal-body"></div>
    </div>
  </div>`;
}

function openEwayModal(id=null) {
  editingEwayId = id;
  const e = id ? KKR.getEwayBills().find(x=>x.id===id) : {};
  document.getElementById('eway-modal-title').textContent = id ? 'Edit E-Way Bill' : 'New E-Way Bill';
  const vehicles  = KKR.getVehicles();
  const materials = KKR.getMaterials();
  const trips     = KKR.getTrips();

  document.getElementById('eway-modal-body').innerHTML = `
    <form onsubmit="saveEway(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">E-Way Bill No.</label>
          <input class="form-control" id="ewf-no" value="${e.billNo||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Trip ID</label>
          <select class="form-control" id="ewf-trip">
            <option value="">— None —</option>
            ${trips.map(t=>`<option value="${t.id}" ${e.tripId===t.id?'selected':''}>${t.id} (${t.from}→${t.to})</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date Generated</label>
          <input type="date" class="form-control" id="ewf-date" value="${fmtDateInput(e.date||today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Valid Upto</label>
          <input type="date" class="form-control" id="ewf-valid" value="${fmtDateInput(e.validUpto||'')}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">From</label>
          <input class="form-control" id="ewf-from" value="${e.from||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">To</label>
          <input class="form-control" id="ewf-to" value="${e.to||''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Vehicle</label>
          <select class="form-control" id="ewf-vehicle">
            <option value="">Select</option>
            ${vehicles.map(v=>`<option value="${v.id}" ${e.vehicle===v.id?'selected':''}>${v.regNo}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Material</label>
          <select class="form-control" id="ewf-mat">
            <option value="">Select</option>
            ${materials.map(m=>`<option value="${m.id}" ${e.material===m.id?'selected':''}>${m.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Consignment Value (₹)</label>
          <input type="number" class="form-control" id="ewf-value" value="${e.value||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="ewf-status">
            <option value="active" ${(e.status||'active')==='active'?'selected':''}>Active</option>
            <option value="expired" ${e.status==='expired'?'selected':''}>Expired</option>
            <option value="cancelled" ${e.status==='cancelled'?'selected':''}>Cancelled</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('eway-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('eway-modal');
}

function saveEway(e) {
  e.preventDefault();
  const bills = KKR.getEwayBills();
  const entry = {
    id:       editingEwayId || 'EW' + Date.now().toString().slice(-6),
    billNo:   document.getElementById('ewf-no').value.trim(),
    tripId:   document.getElementById('ewf-trip').value,
    date:     document.getElementById('ewf-date').value,
    validUpto:document.getElementById('ewf-valid').value,
    from:     document.getElementById('ewf-from').value.trim(),
    to:       document.getElementById('ewf-to').value.trim(),
    vehicle:  document.getElementById('ewf-vehicle').value,
    material: document.getElementById('ewf-mat').value,
    value:    parseFloat(document.getElementById('ewf-value').value)||0,
    status:   document.getElementById('ewf-status').value,
  };
  const idx = bills.findIndex(x=>x.id===editingEwayId);
  if (idx>=0) bills[idx]=entry; else bills.unshift(entry);
  KKR.saveEwayBills(bills);
  closeModal('eway-modal');
  toast(editingEwayId?'Updated':'E-Way Bill saved','success');
  rerenderPage();
}

function deleteEway(id) {
  const e = KKR.getEwayBills().find(x=>x.id===id);
  confirmDelete(e?e.billNo:id, ()=>{
    KKR.saveEwayBills(KKR.getEwayBills().filter(x=>x.id!==id));
    toast('Deleted','error');
    rerenderPage();
  });
}

function exportEwayCSV() {
  const rows = KKR.getEwayBills().map(e=>({...e, vehicle: KKR.vehicleReg(e.vehicle), material: KKR.materialName(e.material)}));
  exportCSV(['billNo','date','validUpto','tripId','vehicle','from','to','material','value','status'], rows, 'eway-bills.csv');
  toast('Exported','success');
}
