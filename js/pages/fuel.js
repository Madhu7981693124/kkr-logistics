// Fuel Management Page
let fuelFilter = { q: '', vehicle: '' };
let editingFuelId = null;

function renderFuel() {
  let rows = KKR.getFuel();
  if (fuelFilter.vehicle) rows = rows.filter(f=>f.vehicle===fuelFilter.vehicle);
  if (fuelFilter.q) rows = filterRows(rows, fuelFilter.q, ['vehicle','driver','station','tripId']);
  rows = [...rows].sort((a,b)=>b.date.localeCompare(a.date));

  const totalLitres = rows.reduce((s,r)=>s+r.litres,0);
  const totalCost   = rows.reduce((s,r)=>s+r.amount,0);
  const avgRate     = rows.length ? totalCost/totalLitres : 0;

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Fuel Management</div>
        <div class="subtitle">Track diesel consumption and costs across fleet</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportFuelCSV()">${icon('download',15)} Export</button>
        <button class="btn btn-primary" onclick="openFuelModal()">${icon('plus',15)} Add Entry</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:20px">
      <div class="kpi-card amber">
        <div class="kpi-icon amber">${icon('fuel',20)}</div>
        <div class="kpi-value">${fmtNum(totalLitres,0)} L</div>
        <div class="kpi-label">Total Litres</div>
      </div>
      <div class="kpi-card red">
        <div class="kpi-icon red">${icon('expenses',20)}</div>
        <div class="kpi-value">${fmtCurrency(totalCost)}</div>
        <div class="kpi-label">Total Fuel Cost</div>
      </div>
      <div class="kpi-card blue">
        <div class="kpi-icon blue">${icon('reports',20)}</div>
        <div class="kpi-value">₹${avgRate.toFixed(2)}/L</div>
        <div class="kpi-label">Avg Rate</div>
      </div>
    </div>

    <!-- Per Vehicle Summary -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><div class="card-title">Fuel by Vehicle</div></div>
      <div style="display:flex; gap:20px; flex-wrap:wrap">
        ${KKR.getVehicles().map(v=>{
          const vFuel = KKR.getFuel().filter(f=>f.vehicle===v.id);
          const vLit  = vFuel.reduce((s,f)=>s+f.litres,0);
          const vCost = vFuel.reduce((s,f)=>s+f.amount,0);
          const pct = totalLitres ? Math.round(vLit/totalLitres*100) : 0;
          return `
          <div style="flex:1; min-width:160px">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px">
              <span style="font-size:12px; font-weight:600">${v.regNo}</span>
              <span style="font-size:12px; color:var(--text-muted)">${fmtNum(vLit,0)} L</span>
            </div>
            <div class="progress-bar-wrap">
              <div class="progress-bar amber" style="width:${pct}%"></div>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px">${fmtCurrency(vCost)} · ${pct}%</div>
          </div>`;}).join('')}
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search..." value="${fuelFilter.q}"
            oninput="fuelFilter.q=this.value; rerenderPage()">
        </div>
        <select class="form-control" style="width:200px" onchange="fuelFilter.vehicle=this.value; rerenderPage()">
          <option value="">All Vehicles</option>
          ${KKR.getVehicles().map(v=>`<option value="${v.id}" ${fuelFilter.vehicle===v.id?'selected':''}>${v.regNo}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Date</th><th>Vehicle</th><th>Driver</th><th>Station</th>
            <th>Litres</th><th>Rate (₹/L)</th><th>Amount</th><th>Odometer</th><th>Trip</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length===0 ? `<tr><td colspan="10" class="text-center text-muted" style="padding:40px">No records</td></tr>` :
            rows.map(f=>`
            <tr>
              <td>${fmtDate(f.date)}</td>
              <td>${KKR.vehicleReg(f.vehicle)}</td>
              <td>${KKR.driverName(f.driver)}</td>
              <td>${f.station}</td>
              <td class="text-right font-bold">${fmtNum(f.litres,0)} L</td>
              <td class="text-right">₹${f.rate}</td>
              <td class="font-bold">${fmtCurrency(f.amount)}</td>
              <td>${fmtNum(f.odometer,0)} km</td>
              <td>${f.tripId||'—'}</td>
              <td>
                <div class="flex gap-2">
                  <button class="btn btn-xs btn-secondary" onclick="openFuelModal('${f.id}')">${icon('edit',13)}</button>
                  <button class="btn btn-xs btn-danger" onclick="deleteFuel('${f.id}')">${icon('trash',13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="fuel-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="fuel-modal-title">Add Fuel Entry</div>
        <button class="modal-close" onclick="closeModal('fuel-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="fuel-modal-body"></div>
    </div>
  </div>`;
}

function openFuelModal(id=null) {
  editingFuelId = id;
  const f = id ? KKR.getFuel().find(x=>x.id===id) : {};
  document.getElementById('fuel-modal-title').textContent = id ? 'Edit Fuel Entry' : 'Add Fuel Entry';
  const vehicles = KKR.getVehicles();
  const drivers  = KKR.getDrivers();
  const trips    = KKR.getTrips();

  document.getElementById('fuel-modal-body').innerHTML = `
    <form onsubmit="saveFuel(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="ff-date" value="${fmtDateInput(f.date||today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Vehicle</label>
          <select class="form-control" id="ff-vehicle" required>
            <option value="">Select</option>
            ${vehicles.map(v=>`<option value="${v.id}" ${f.vehicle===v.id?'selected':''}>${v.regNo}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Driver</label>
          <select class="form-control" id="ff-driver">
            <option value="">Select</option>
            ${drivers.map(d=>`<option value="${d.id}" ${f.driver===d.id?'selected':''}>${d.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Trip (optional)</label>
          <select class="form-control" id="ff-trip">
            <option value="">— None —</option>
            ${trips.map(t=>`<option value="${t.id}" ${f.tripId===t.id?'selected':''}>${t.id}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Fuel Station</label>
        <input class="form-control" id="ff-station" value="${f.station||''}" required>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Litres</label>
          <input type="number" step="0.01" class="form-control" id="ff-litres" value="${f.litres||''}" oninput="calcFuelAmt()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Rate (₹/L)</label>
          <input type="number" step="0.01" class="form-control" id="ff-rate" value="${f.rate||''}" oninput="calcFuelAmt()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input type="number" class="form-control" id="ff-amount" value="${f.amount||''}" readonly style="background:rgba(37,99,235,0.08)">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Odometer Reading (km)</label>
        <input type="number" class="form-control" id="ff-odo" value="${f.odometer||''}">
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('fuel-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('fuel-modal');
}

function calcFuelAmt() {
  const l = parseFloat(document.getElementById('ff-litres').value)||0;
  const r = parseFloat(document.getElementById('ff-rate').value)||0;
  document.getElementById('ff-amount').value = (l*r).toFixed(2);
}

function saveFuel(e) {
  e.preventDefault();
  const fuel = KKR.getFuel();
  const entry = {
    id:       editingFuelId || 'F' + Date.now().toString().slice(-6),
    date:     document.getElementById('ff-date').value,
    vehicle:  document.getElementById('ff-vehicle').value,
    driver:   document.getElementById('ff-driver').value,
    tripId:   document.getElementById('ff-trip').value,
    station:  document.getElementById('ff-station').value.trim(),
    litres:   parseFloat(document.getElementById('ff-litres').value)||0,
    rate:     parseFloat(document.getElementById('ff-rate').value)||0,
    amount:   parseFloat(document.getElementById('ff-amount').value)||0,
    odometer: parseInt(document.getElementById('ff-odo').value)||0,
  };
  const idx = fuel.findIndex(f=>f.id===editingFuelId);
  if (idx>=0) fuel[idx]=entry; else fuel.unshift(entry);
  KKR.saveFuel(fuel);
  closeModal('fuel-modal');
  toast(editingFuelId?'Updated':'Saved','success');
  rerenderPage();
}

function deleteFuel(id) {
  confirmDelete('this fuel entry', ()=>{
    KKR.saveFuel(KKR.getFuel().filter(x=>x.id!==id));
    toast('Deleted','error');
    rerenderPage();
  });
}

function exportFuelCSV() {
  const rows = KKR.getFuel().map(f=>({...f, vehicle: KKR.vehicleReg(f.vehicle), driver: KKR.driverName(f.driver)}));
  exportCSV(['date','vehicle','driver','station','litres','rate','amount','odometer'], rows, 'fuel.csv');
  toast('Exported','success');
}
