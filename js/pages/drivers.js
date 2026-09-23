// Drivers Page
let driversFilter = { q: '', status: '' };
let editingDriverId = null;

function renderDrivers() {
  let rows = KKR.getDrivers();
  if (driversFilter.status) rows = rows.filter(d => d.status === driversFilter.status);
  if (driversFilter.q) rows = filterRows(rows, driversFilter.q, ['name','phone','license','address']);

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Drivers</div>
        <div class="subtitle">${KKR.getDrivers().length} drivers registered</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportDriversCSV()">${icon('download',15)} Export</button>
        <button class="btn btn-primary" onclick="openDriverModal()">${icon('plus',15)} Add Driver</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px">
      ${[
        { label:'Total', val: KKR.getDrivers().length },
        { label:'Active', val: KKR.getDrivers().filter(d=>d.status==='active').length },
        { label:'On Leave', val: KKR.getDrivers().filter(d=>d.status==='on-leave').length },
        { label:'Inactive', val: KKR.getDrivers().filter(d=>d.status==='inactive').length },
      ].map(s=>`<div class="card card-sm" style="text-align:center">
        <div style="font-size:22px; font-weight:800">${s.val}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px">${s.label}</div>
      </div>`).join('')}
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search drivers..." value="${driversFilter.q}"
            oninput="driversFilter.q=this.value; rerenderPage()">
        </div>
        <select class="form-control" style="width:160px" onchange="driversFilter.status=this.value; rerenderPage()">
          <option value="">All Status</option>
          <option value="active" ${driversFilter.status==='active'?'selected':''}>Active</option>
          <option value="on-leave" ${driversFilter.status==='on-leave'?'selected':''}>On Leave</option>
          <option value="inactive" ${driversFilter.status==='inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Driver</th><th>Phone</th><th>License No.</th><th>License Expiry</th>
            <th>Assigned Vehicle</th><th>Trips Done</th><th>Join Date</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length === 0 ? `<tr><td colspan="9" class="text-center text-muted" style="padding:40px">No drivers found</td></tr>` :
            rows.map(d => {
              const licExpiry = daysFromNow(d.licenseExpiry);
              const licWarn = licExpiry !== null && licExpiry < 90;
              return `
              <tr>
                <td>
                  <div style="display:flex; align-items:center; gap:10px">
                    <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#2563eb,#7c3aed); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; color:#fff; flex-shrink:0">${d.name.charAt(0)}</div>
                    <div>
                      <div class="font-bold">${d.name}</div>
                      <div style="font-size:11px; color:var(--text-muted)">${d.address}</div>
                    </div>
                  </div>
                </td>
                <td>${d.phone}</td>
                <td class="font-medium">${d.license}</td>
                <td style="color:${licWarn?'#f87171':'inherit'}">${fmtDate(d.licenseExpiry)}${licWarn?` <small class="text-danger">(${licExpiry}d)</small>`:''}</td>
                <td>${KKR.vehicleReg(d.vehicle)}</td>
                <td class="font-bold">${d.trips}</td>
                <td>${fmtDate(d.joinDate)}</td>
                <td>${statusBadge(d.status)}</td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-xs btn-secondary" onclick="openDriverModal('${d.id}')">${icon('edit',13)}</button>
                    <button class="btn btn-xs btn-danger" onclick="deleteDriver('${d.id}')">${icon('trash',13)}</button>
                  </div>
                </td>
              </tr>`;}).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="driver-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="driver-modal-title">Add Driver</div>
        <button class="modal-close" onclick="closeModal('driver-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="driver-modal-body"></div>
    </div>
  </div>`;
}

function openDriverModal(id = null) {
  editingDriverId = id;
  const d = id ? KKR.getDrivers().find(x=>x.id===id) : {};
  document.getElementById('driver-modal-title').textContent = id ? 'Edit Driver' : 'Add Driver';
  const vehicles = KKR.getVehicles();

  document.getElementById('driver-modal-body').innerHTML = `
    <form onsubmit="saveDriver(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-control" id="df-name" value="${d.name||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-control" id="df-phone" value="${d.phone||''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date of Birth</label>
          <input type="date" class="form-control" id="df-dob" value="${fmtDateInput(d.dob||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Join Date</label>
          <input type="date" class="form-control" id="df-join" value="${fmtDateInput(d.joinDate||today())}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">License No.</label>
          <input class="form-control" id="df-lic" value="${d.license||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">License Expiry</label>
          <input type="date" class="form-control" id="df-licexp" value="${fmtDateInput(d.licenseExpiry||'')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Assigned Vehicle</label>
          <select class="form-control" id="df-vehicle">
            <option value="">Unassigned</option>
            ${vehicles.map(v=>`<option value="${v.id}" ${d.vehicle===v.id?'selected':''}>${v.regNo}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="df-status">
            <option value="active" ${(d.status||'active')==='active'?'selected':''}>Active</option>
            <option value="on-leave" ${d.status==='on-leave'?'selected':''}>On Leave</option>
            <option value="inactive" ${d.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <input class="form-control" id="df-addr" value="${d.address||''}">
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('driver-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('driver-modal');
}

function saveDriver(e) {
  e.preventDefault();
  const drivers = KKR.getDrivers();
  const drv = {
    id:            editingDriverId || 'D' + Date.now().toString().slice(-5),
    name:          document.getElementById('df-name').value.trim(),
    phone:         document.getElementById('df-phone').value.trim(),
    dob:           document.getElementById('df-dob').value,
    joinDate:      document.getElementById('df-join').value,
    license:       document.getElementById('df-lic').value.trim(),
    licenseExpiry: document.getElementById('df-licexp').value,
    vehicle:       document.getElementById('df-vehicle').value,
    status:        document.getElementById('df-status').value,
    address:       document.getElementById('df-addr').value.trim(),
    trips:         (KKR.getDrivers().find(x=>x.id===editingDriverId)||{trips:0}).trips,
  };
  const idx = drivers.findIndex(d=>d.id===editingDriverId);
  if (idx>=0) drivers[idx]=drv; else drivers.push(drv);
  KKR.saveDrivers(drivers);
  closeModal('driver-modal');
  toast(editingDriverId?'Driver updated':'Driver added','success');
  rerenderPage();
}

function deleteDriver(id) {
  const d = KKR.getDrivers().find(x=>x.id===id);
  confirmDelete(d?d.name:id, ()=>{
    KKR.saveDrivers(KKR.getDrivers().filter(x=>x.id!==id));
    toast('Driver removed','error');
    rerenderPage();
  });
}

function exportDriversCSV() {
  const rows = KKR.getDrivers().map(d=>({...d, vehicle: KKR.vehicleReg(d.vehicle)}));
  exportCSV(['name','phone','license','licenseExpiry','vehicle','trips','status'], rows, 'drivers.csv');
  toast('Exported','success');
}
