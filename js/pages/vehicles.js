// Vehicles Page
let vehiclesFilter = { q: '', status: '' };
let editingVehicleId = null;

function renderVehicles() {
  let rows = KKR.getVehicles();
  if (vehiclesFilter.status) rows = rows.filter(v => v.status === vehiclesFilter.status);
  if (vehiclesFilter.q) rows = filterRows(rows, vehiclesFilter.q, ['regNo','make','model','type']);

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Vehicles</div>
        <div class="subtitle">Fleet management — ${KKR.getVehicles().length} vehicles registered</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportVehiclesCSV()">${icon('download',15)} Export</button>
        <button class="btn btn-primary" onclick="openVehicleModal()">${icon('plus',15)} Add Vehicle</button>
      </div>
    </div>

    <!-- Summary -->
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px">
      ${[
        { label:'Total', val: KKR.getVehicles().length, col:'blue' },
        { label:'Active', val: KKR.getVehicles().filter(v=>v.status==='active').length, col:'green' },
        { label:'Maintenance', val: KKR.getVehicles().filter(v=>v.status==='maintenance').length, col:'amber' },
        { label:'Inactive', val: KKR.getVehicles().filter(v=>v.status==='inactive').length, col:'red' },
      ].map(s=>`<div class="card card-sm" style="text-align:center">
        <div style="font-size:22px; font-weight:800; color:var(--text-primary)">${s.val}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:4px">${s.label}</div>
      </div>`).join('')}
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search by reg. no, make, model..." value="${vehiclesFilter.q}"
            oninput="vehiclesFilter.q=this.value; rerenderPage()">
        </div>
        <select class="form-control" style="width:160px" onchange="vehiclesFilter.status=this.value; rerenderPage()">
          <option value="">All Status</option>
          <option value="active" ${vehiclesFilter.status==='active'?'selected':''}>Active</option>
          <option value="maintenance" ${vehiclesFilter.status==='maintenance'?'selected':''}>Maintenance</option>
          <option value="inactive" ${vehiclesFilter.status==='inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Reg. No.</th><th>Type</th><th>Make / Model</th><th>Year</th>
            <th>Capacity</th><th>Driver</th><th>Insurance</th><th>Fitness</th>
            <th>PUC</th><th>KM Reading</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length === 0 ? `<tr><td colspan="12" class="text-center text-muted" style="padding:40px">No vehicles found</td></tr>` :
            rows.map(v => {
              const insExpiry = daysFromNow(v.insurance);
              const insWarn = insExpiry !== null && insExpiry < 60;
              return `
              <tr>
                <td class="font-bold text-blue">${v.regNo}</td>
                <td>${v.type}</td>
                <td>${v.make} ${v.model}</td>
                <td>${v.year}</td>
                <td>${v.capacity}</td>
                <td>${KKR.driverName(v.driver)}</td>
                <td style="color:${insWarn?'#f87171':'inherit'}">${fmtDate(v.insurance)}${insWarn?` <small>(${insExpiry}d)</small>`:''}</td>
                <td>${fmtDate(v.fitness)}</td>
                <td>${fmtDate(v.puc)}</td>
                <td>${fmtNum(v.kmReading)} km</td>
                <td>${statusBadge(v.status)}</td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-xs btn-secondary" onclick="openVehicleModal('${v.id}')">${icon('edit',13)}</button>
                    <button class="btn btn-xs btn-danger" onclick="deleteVehicle('${v.id}')">${icon('trash',13)}</button>
                  </div>
                </td>
              </tr>`;}).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="vehicle-modal">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title" id="vehicle-modal-title">Add Vehicle</div>
        <button class="modal-close" onclick="closeModal('vehicle-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="vehicle-modal-body"></div>
    </div>
  </div>`;
}

function openVehicleModal(id = null) {
  editingVehicleId = id;
  const v = id ? KKR.getVehicles().find(x=>x.id===id) : {};
  document.getElementById('vehicle-modal-title').textContent = id ? 'Edit Vehicle' : 'Add Vehicle';
  const drivers = KKR.getDrivers();

  document.getElementById('vehicle-modal-body').innerHTML = `
    <form onsubmit="saveVehicle(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Registration No.</label>
          <input class="form-control" id="vf-reg" value="${v.regNo||''}" placeholder="XX-00-XX-0000" required>
        </div>
        <div class="form-group">
          <label class="form-label">Vehicle Type</label>
          <select class="form-control" id="vf-type">
            ${['Truck','Tipper','Container','Tanker','Trailer','Mini Truck'].map(t=>`<option ${(v.type||'')==t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Make</label>
          <input class="form-control" id="vf-make" value="${v.make||''}" placeholder="Tata / Ashok Leyland..." required>
        </div>
        <div class="form-group">
          <label class="form-label">Model</label>
          <input class="form-control" id="vf-model" value="${v.model||''}" placeholder="LPT 2518..." required>
        </div>
        <div class="form-group">
          <label class="form-label">Year</label>
          <input type="number" class="form-control" id="vf-year" value="${v.year||2024}" min="2000" max="2030">
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
            ${['Diesel','Petrol','CNG','LNG'].map(f=>`<option ${(v.fuelType||'Diesel')===f?'selected':''}>${f}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Assigned Driver</label>
          <select class="form-control" id="vf-driver">
            <option value="">Unassigned</option>
            ${drivers.map(d=>`<option value="${d.id}" ${v.driver===d.id?'selected':''}>${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">KM Reading</label>
          <input type="number" class="form-control" id="vf-km" value="${v.kmReading||0}">
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Insurance Expiry</label>
          <input type="date" class="form-control" id="vf-ins" value="${fmtDateInput(v.insurance||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Fitness Expiry</label>
          <input type="date" class="form-control" id="vf-fit" value="${fmtDateInput(v.fitness||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Permit Expiry</label>
          <input type="date" class="form-control" id="vf-per" value="${fmtDateInput(v.permit||'')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">PUC Expiry</label>
          <input type="date" class="form-control" id="vf-puc" value="${fmtDateInput(v.puc||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="vf-status">
            <option value="active" ${(v.status||'active')==='active'?'selected':''}>Active</option>
            <option value="maintenance" ${v.status==='maintenance'?'selected':''}>Maintenance</option>
            <option value="inactive" ${v.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('vehicle-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('vehicle-modal');
}

function saveVehicle(e) {
  e.preventDefault();
  const vehicles = KKR.getVehicles();
  const veh = {
    id:         editingVehicleId || 'V' + Date.now().toString().slice(-5),
    regNo:      document.getElementById('vf-reg').value.trim().toUpperCase(),
    type:       document.getElementById('vf-type').value,
    make:       document.getElementById('vf-make').value.trim(),
    model:      document.getElementById('vf-model').value.trim(),
    year:       parseInt(document.getElementById('vf-year').value),
    capacity:   document.getElementById('vf-cap').value.trim(),
    fuelType:   document.getElementById('vf-fuel').value,
    driver:     document.getElementById('vf-driver').value,
    kmReading:  parseInt(document.getElementById('vf-km').value)||0,
    insurance:  document.getElementById('vf-ins').value,
    fitness:    document.getElementById('vf-fit').value,
    permit:     document.getElementById('vf-per').value,
    puc:        document.getElementById('vf-puc').value,
    status:     document.getElementById('vf-status').value,
  };
  const idx = vehicles.findIndex(v=>v.id===editingVehicleId);
  if (idx>=0) vehicles[idx]=veh; else vehicles.push(veh);
  KKR.saveVehicles(vehicles);
  closeModal('vehicle-modal');
  toast(editingVehicleId?'Vehicle updated':'Vehicle added','success');
  rerenderPage();
}

function deleteVehicle(id) {
  const v = KKR.getVehicles().find(x=>x.id===id);
  confirmDelete(v?v.regNo:id, ()=>{
    KKR.saveVehicles(KKR.getVehicles().filter(x=>x.id!==id));
    toast('Vehicle removed','error');
    rerenderPage();
  });
}

function exportVehiclesCSV() {
  const rows = KKR.getVehicles().map(v=>({...v, driver: KKR.driverName(v.driver)}));
  exportCSV(['regNo','type','make','model','year','capacity','driver','status','insurance','fitness','puc'], rows, 'vehicles.csv');
  toast('Exported','success');
}
