// Trips Page
let tripsFilter = { q: '', status: '' };
let editingTripId = null;

function renderTrips() {
  let rows = KKR.getTrips();
  if (tripsFilter.status) rows = rows.filter(t => t.status === tripsFilter.status);
  if (tripsFilter.q) rows = filterRows(rows, tripsFilter.q, ['id','from','to','material','vehicle','driver','customer']);
  rows = [...rows].sort((a,b) => b.date.localeCompare(a.date));

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Trips</div>
        <div class="subtitle">${KKR.getTrips().length} total trips · Manage all freight movements</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportTripsCSV()">${icon('download',15)} Export</button>
        <button class="btn btn-primary" onclick="openTripModal()">${icon('plus',15)} New Trip</button>
      </div>
    </div>

    <!-- Summary Strip -->
    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px">
      ${[
        { label:'Total Trips', val: KKR.getTrips().length, color:'blue' },
        { label:'Completed',   val: KKR.getTrips().filter(t=>t.status==='completed').length, color:'green' },
        { label:'In Transit',  val: KKR.getTrips().filter(t=>t.status==='in-transit').length, color:'blue' },
        { label:'Pending',     val: KKR.getTrips().filter(t=>t.status==='pending').length, color:'amber' },
      ].map(s=>`
        <div class="card card-sm" style="text-align:center">
          <div style="font-size:22px; font-weight:800; color:var(--text-primary)">${s.val}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:4px; text-transform:uppercase; letter-spacing:.5px">${s.label}</div>
        </div>`).join('')}
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search trips..." value="${tripsFilter.q}"
            oninput="tripsFilter.q=this.value; rerenderPage()">
        </div>
        <select class="form-control" style="width:160px" onchange="tripsFilter.status=this.value; rerenderPage()">
          <option value="">All Status</option>
          <option value="completed" ${tripsFilter.status==='completed'?'selected':''}>Completed</option>
          <option value="in-transit" ${tripsFilter.status==='in-transit'?'selected':''}>In Transit</option>
          <option value="pending" ${tripsFilter.status==='pending'?'selected':''}>Pending</option>
          <option value="cancelled" ${tripsFilter.status==='cancelled'?'selected':''}>Cancelled</option>
        </select>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Trip ID</th><th>Date</th><th>Vehicle</th><th>Driver</th>
            <th>Customer</th><th>Route</th><th>Material</th>
            <th>Net Wt (MT)</th><th>Freight</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length === 0 ? `<tr><td colspan="11" class="text-center text-muted" style="padding:40px">No trips found</td></tr>` :
            rows.map(t => `
            <tr>
              <td class="font-bold text-blue">${t.id}</td>
              <td>${fmtDate(t.date)}</td>
              <td>${KKR.vehicleReg(t.vehicle)}</td>
              <td>${KKR.driverName(t.driver)}</td>
              <td>${KKR.customerName(t.customer)}</td>
              <td style="max-width:140px; overflow:hidden; text-overflow:ellipsis">${t.from} → ${t.to}</td>
              <td>${KKR.materialName(t.material)}</td>
              <td class="text-right">${fmtNum(t.billedWt,2)}</td>
              <td class="font-bold">${fmtCurrency(t.freight)}</td>
              <td>${statusBadge(t.status)}</td>
              <td>
                <div class="flex gap-2">
                  <button class="btn btn-xs btn-secondary" onclick="openTripModal('${t.id}')">${icon('edit',13)}</button>
                  <button class="btn btn-xs btn-danger" onclick="deleteTrip('${t.id}')">${icon('trash',13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Trip Modal -->
  <div class="modal-overlay" id="trip-modal">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title" id="trip-modal-title">New Trip</div>
        <button class="modal-close" onclick="closeModal('trip-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="trip-modal-body"></div>
    </div>
  </div>`;
}

function openTripModal(id = null) {
  editingTripId = id;
  const trips = KKR.getTrips();
  const t = id ? trips.find(x => x.id === id) : {};
  document.getElementById('trip-modal-title').textContent = id ? 'Edit Trip' : 'New Trip';
  const vehicles  = KKR.getVehicles();
  const drivers   = KKR.getDrivers();
  const customers = KKR.getCustomers();
  const materials = KKR.getMaterials();

  document.getElementById('trip-modal-body').innerHTML = `
    <form id="trip-form" onsubmit="saveTrip(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Trip ID</label>
          <input class="form-control" id="tf-id" value="${t.id||''}" ${id?'readonly':''} placeholder="Auto-generate" required>
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="tf-date" value="${fmtDateInput(t.date||today())}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Vehicle</label>
          <select class="form-control" id="tf-vehicle">
            <option value="">Select Vehicle</option>
            ${vehicles.map(v=>`<option value="${v.id}" ${t.vehicle===v.id?'selected':''}>${v.regNo} (${v.make} ${v.model})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Driver</label>
          <select class="form-control" id="tf-driver">
            <option value="">Select Driver</option>
            ${drivers.map(d=>`<option value="${d.id}" ${t.driver===d.id?'selected':''}>${d.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Customer</label>
          <select class="form-control" id="tf-customer">
            <option value="">Select Customer</option>
            ${customers.map(c=>`<option value="${c.id}" ${t.customer===c.id?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Material</label>
          <select class="form-control" id="tf-material">
            <option value="">Select Material</option>
            ${materials.map(m=>`<option value="${m.id}" ${t.material===m.id?'selected':''}>${m.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">From (Origin)</label>
          <input class="form-control" id="tf-from" value="${t.from||''}" placeholder="City / Location" required>
        </div>
        <div class="form-group">
          <label class="form-label">To (Destination)</label>
          <input class="form-control" id="tf-to" value="${t.to||''}" placeholder="City / Location" required>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Loaded Wt (MT)</label>
          <input type="number" step="0.01" class="form-control" id="tf-loaded" value="${t.loadedWt||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Billed Wt (MT)</label>
          <input type="number" step="0.01" class="form-control" id="tf-billed" value="${t.billedWt||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Distance (km)</label>
          <input type="number" class="form-control" id="tf-dist" value="${t.distance||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Freight Amount (₹)</label>
          <input type="number" class="form-control" id="tf-freight" value="${t.freight||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="tf-status">
            <option value="pending" ${(t.status||'pending')==='pending'?'selected':''}>Pending</option>
            <option value="in-transit" ${t.status==='in-transit'?'selected':''}>In Transit</option>
            <option value="completed" ${t.status==='completed'?'selected':''}>Completed</option>
            <option value="cancelled" ${t.status==='cancelled'?'selected':''}>Cancelled</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">E-Way Bill No.</label>
          <input class="form-control" id="tf-eway" value="${t.ewayBill||''}" placeholder="EW...">
        </div>
        <div class="form-group">
          <label class="form-label">Invoice No.</label>
          <input class="form-control" id="tf-invoice" value="${t.invoiceNo||''}" placeholder="INV-...">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Remarks</label>
        <textarea class="form-control" id="tf-remarks" rows="2" placeholder="Optional notes...">${t.remarks||''}</textarea>
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('trip-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'} Trip</button>
      </div>
    </form>`;
  openModal('trip-modal');
}

function saveTrip(e) {
  e.preventDefault();
  const trips = KKR.getTrips();
  const idVal = document.getElementById('tf-id').value.trim();
  const trip = {
    id:         idVal || 'TR' + Date.now().toString().slice(-6),
    date:       document.getElementById('tf-date').value,
    vehicle:    document.getElementById('tf-vehicle').value,
    driver:     document.getElementById('tf-driver').value,
    customer:   document.getElementById('tf-customer').value,
    from:       document.getElementById('tf-from').value,
    to:         document.getElementById('tf-to').value,
    material:   document.getElementById('tf-material').value,
    loadedWt:   parseFloat(document.getElementById('tf-loaded').value)||0,
    billedWt:   parseFloat(document.getElementById('tf-billed').value)||0,
    distance:   parseFloat(document.getElementById('tf-dist').value)||0,
    freight:    parseFloat(document.getElementById('tf-freight').value)||0,
    status:     document.getElementById('tf-status').value,
    ewayBill:   document.getElementById('tf-eway').value,
    invoiceNo:  document.getElementById('tf-invoice').value,
    remarks:    document.getElementById('tf-remarks').value,
  };
  const idx = trips.findIndex(t => t.id === editingTripId);
  if (idx >= 0) trips[idx] = trip; else trips.unshift(trip);
  KKR.saveTrips(trips);
  closeModal('trip-modal');
  toast(editingTripId ? 'Trip updated' : 'Trip added', 'success');
  rerenderPage();
}

function deleteTrip(id) {
  const t = KKR.getTrips().find(x=>x.id===id);
  confirmDelete(t ? t.id + ' (' + t.from + '→' + t.to + ')' : id, () => {
    KKR.saveTrips(KKR.getTrips().filter(x=>x.id!==id));
    toast('Trip deleted', 'error');
    rerenderPage();
  });
}

function exportTripsCSV() {
  const rows = KKR.getTrips().map(t => ({
    id: t.id, date: t.date, vehicle: KKR.vehicleReg(t.vehicle), driver: KKR.driverName(t.driver),
    customer: KKR.customerName(t.customer), from: t.from, to: t.to,
    material: KKR.materialName(t.material), billedWt: t.billedWt, freight: t.freight, status: t.status
  }));
  exportCSV(['id','date','vehicle','driver','customer','from','to','material','billedWt','freight','status'], rows, 'trips.csv');
  toast('Trips exported', 'success');
}
