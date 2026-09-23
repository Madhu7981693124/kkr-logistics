// Weighbridge Page
let wbFilter = { q: '' };
let editingWbId = null;

function renderWeighbridge() {
  let rows = KKR.getWeighbridge();
  if (wbFilter.q) rows = filterRows(rows, wbFilter.q, ['id','vehicle','tripId','slip','operator']);
  rows = [...rows].sort((a,b)=>b.date.localeCompare(a.date));

  const totalNet = rows.reduce((s,r)=>s+r.net,0);

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Weighbridge</div>
        <div class="subtitle">Weight records — ${rows.length} entries · Total Net: ${fmtNum(totalNet,2)} MT</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="printWbReport()">${icon('print',15)} Print</button>
        <button class="btn btn-primary" onclick="openWbModal()">${icon('plus',15)} New Entry</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search by trip ID, vehicle, slip..." value="${wbFilter.q}"
            oninput="wbFilter.q=this.value; rerenderPage()">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Date</th><th>Slip No.</th><th>Trip ID</th><th>Vehicle</th>
            <th>Material</th><th>Gross (MT)</th><th>Tare (MT)</th><th>Net (MT)</th>
            <th>Operator</th><th>Remarks</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length===0 ? `<tr><td colspan="11" class="text-center text-muted" style="padding:40px">No records found</td></tr>` :
            rows.map(r=>`
            <tr>
              <td>${fmtDate(r.date)}</td>
              <td class="font-bold text-blue">${r.slip}</td>
              <td>${r.tripId||'—'}</td>
              <td>${KKR.vehicleReg(r.vehicle)}</td>
              <td>${KKR.materialName(r.material)}</td>
              <td class="text-right">${fmtNum(r.gross,2)}</td>
              <td class="text-right">${fmtNum(r.tare,2)}</td>
              <td class="font-bold text-right">${fmtNum(r.net,2)}</td>
              <td>${r.operator}</td>
              <td class="text-muted">${r.remarks||'—'}</td>
              <td>
                <div class="flex gap-2">
                  <button class="btn btn-xs btn-secondary" onclick="openWbModal('${r.id}')">${icon('edit',13)}</button>
                  <button class="btn btn-xs btn-danger" onclick="deleteWb('${r.id}')">${icon('trash',13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border)">
              <td colspan="5" style="padding:12px 16px; font-weight:700">Total</td>
              <td class="font-bold text-right" style="padding:12px 16px">${fmtNum(rows.reduce((s,r)=>s+r.gross,0),2)}</td>
              <td class="font-bold text-right" style="padding:12px 16px">${fmtNum(rows.reduce((s,r)=>s+r.tare,0),2)}</td>
              <td class="font-bold text-right" style="padding:12px 16px; color:#34d399">${fmtNum(totalNet,2)}</td>
              <td colspan="3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="wb-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="wb-modal-title">New Weighbridge Entry</div>
        <button class="modal-close" onclick="closeModal('wb-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="wb-modal-body"></div>
    </div>
  </div>`;
}

function openWbModal(id=null) {
  editingWbId = id;
  const r = id ? KKR.getWeighbridge().find(x=>x.id===id) : {};
  document.getElementById('wb-modal-title').textContent = id ? 'Edit Weighbridge Entry' : 'New Entry';
  const vehicles  = KKR.getVehicles();
  const materials = KKR.getMaterials();
  const trips     = KKR.getTrips();

  document.getElementById('wb-modal-body').innerHTML = `
    <form onsubmit="saveWb(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="wbf-date" value="${fmtDateInput(r.date||today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Slip No.</label>
          <input class="form-control" id="wbf-slip" value="${r.slip||''}" placeholder="WS-XXX" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Trip ID (optional)</label>
          <select class="form-control" id="wbf-trip">
            <option value="">— None —</option>
            ${trips.map(t=>`<option value="${t.id}" ${r.tripId===t.id?'selected':''}>${t.id} (${t.from}→${t.to})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Vehicle</label>
          <select class="form-control" id="wbf-vehicle" required>
            <option value="">Select</option>
            ${vehicles.map(v=>`<option value="${v.id}" ${r.vehicle===v.id?'selected':''}>${v.regNo}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Material</label>
        <select class="form-control" id="wbf-mat">
          <option value="">Select</option>
          ${materials.map(m=>`<option value="${m.id}" ${r.material===m.id?'selected':''}>${m.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Gross Weight (MT)</label>
          <input type="number" step="0.01" class="form-control" id="wbf-gross" value="${r.gross||''}" oninput="calcWbNet()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Tare Weight (MT)</label>
          <input type="number" step="0.01" class="form-control" id="wbf-tare" value="${r.tare||''}" oninput="calcWbNet()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Net Weight (MT)</label>
          <input type="number" step="0.01" class="form-control" id="wbf-net" value="${r.net||''}" readonly style="background:rgba(16,185,129,0.08)">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Operator</label>
          <input class="form-control" id="wbf-op" value="${r.operator||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Remarks</label>
          <input class="form-control" id="wbf-rem" value="${r.remarks||''}">
        </div>
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('wb-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('wb-modal');
}

function calcWbNet() {
  const g = parseFloat(document.getElementById('wbf-gross').value)||0;
  const t = parseFloat(document.getElementById('wbf-tare').value)||0;
  document.getElementById('wbf-net').value = (g-t).toFixed(2);
}

function saveWb(e) {
  e.preventDefault();
  const wb = KKR.getWeighbridge();
  const entry = {
    id:       editingWbId || 'WB' + Date.now().toString().slice(-6),
    date:     document.getElementById('wbf-date').value,
    slip:     document.getElementById('wbf-slip').value.trim(),
    tripId:   document.getElementById('wbf-trip').value,
    vehicle:  document.getElementById('wbf-vehicle').value,
    material: document.getElementById('wbf-mat').value,
    gross:    parseFloat(document.getElementById('wbf-gross').value)||0,
    tare:     parseFloat(document.getElementById('wbf-tare').value)||0,
    net:      parseFloat(document.getElementById('wbf-net').value)||0,
    operator: document.getElementById('wbf-op').value.trim(),
    remarks:  document.getElementById('wbf-rem').value.trim(),
  };
  const idx = wb.findIndex(r=>r.id===editingWbId);
  if (idx>=0) wb[idx]=entry; else wb.unshift(entry);
  KKR.saveWeighbridge(wb);
  closeModal('wb-modal');
  toast(editingWbId?'Record updated':'Record saved','success');
  rerenderPage();
}

function deleteWb(id) {
  const r = KKR.getWeighbridge().find(x=>x.id===id);
  confirmDelete(r?r.slip:id, ()=>{
    KKR.saveWeighbridge(KKR.getWeighbridge().filter(x=>x.id!==id));
    toast('Record deleted','error');
    rerenderPage();
  });
}

function printWbReport() {
  const rows = KKR.getWeighbridge();
  const html = `<table>
    <tr><th>Date</th><th>Slip</th><th>Trip</th><th>Vehicle</th><th>Material</th><th>Gross</th><th>Tare</th><th>Net</th></tr>
    ${rows.map(r=>`<tr>
      <td>${fmtDate(r.date)}</td><td>${r.slip}</td><td>${r.tripId||'—'}</td>
      <td>${KKR.vehicleReg(r.vehicle)}</td><td>${KKR.materialName(r.material)}</td>
      <td>${r.gross}</td><td>${r.tare}</td><td><strong>${r.net}</strong></td>
    </tr>`).join('')}
  </table>`;
  printSection('Weighbridge Report', html);
}
