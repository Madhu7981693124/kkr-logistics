// Expenses Page
let expFilter = { q: '', category: '' };
let editingExpId = null;

const EXP_CATEGORIES = ['Toll','Driver Allowance','Repair','Tyre','Insurance','Fuel','Oil & Lubricants','Permit & Tax','Office','Miscellaneous'];

function renderExpenses() {
  let rows = KKR.getExpenses();
  if (expFilter.category) rows = rows.filter(e=>e.category===expFilter.category);
  if (expFilter.q) rows = filterRows(rows, expFilter.q, ['id','category','description','vehicle']);
  rows = [...rows].sort((a,b)=>b.date.localeCompare(a.date));

  const total = rows.reduce((s,r)=>s+r.amount,0);

  // Category breakdown
  const byCat = {};
  KKR.getExpenses().forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+e.amount; });

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Expenses</div>
        <div class="subtitle">Total: ${fmtCurrency(KKR.getExpenses().reduce((s,e)=>s+e.amount,0))}</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportExpCSV()">${icon('download',15)} Export</button>
        <button class="btn btn-primary" onclick="openExpModal()">${icon('plus',15)} Add Expense</button>
      </div>
    </div>

    <!-- Category Breakdown -->
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><div class="card-title">Breakdown by Category</div></div>
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        ${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{
          const pct = KKR.getExpenses().reduce((s,e)=>s+e.amount,0) ? Math.round(amt/KKR.getExpenses().reduce((s,e)=>s+e.amount,0)*100) : 0;
          return `
          <div style="flex:1; min-width:150px; background:var(--bg-dark); border-radius:8px; padding:12px; border:1px solid var(--border)">
            <div style="font-size:12px; font-weight:700; margin-bottom:6px">${cat}</div>
            <div style="font-size:16px; font-weight:800; color:var(--text-primary)">${fmtCurrency(amt)}</div>
            <div class="progress-bar-wrap" style="margin-top:8px">
              <div class="progress-bar red" style="width:${pct}%"></div>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:4px">${pct}% of total</div>
          </div>`;}).join('')}
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search expenses..." value="${expFilter.q}"
            oninput="expFilter.q=this.value; rerenderPage()">
        </div>
        <select class="form-control" style="width:200px" onchange="expFilter.category=this.value; rerenderPage()">
          <option value="">All Categories</option>
          ${EXP_CATEGORIES.map(c=>`<option value="${c}" ${expFilter.category===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Date</th><th>Category</th><th>Vehicle</th><th>Trip</th>
            <th>Description</th><th>Paid By</th><th>Receipt</th><th>Amount</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length===0 ? `<tr><td colspan="9" class="text-center text-muted" style="padding:40px">No expenses found</td></tr>` :
            rows.map(e=>`
            <tr>
              <td>${fmtDate(e.date)}</td>
              <td><span style="background:rgba(239,68,68,0.15); color:#f87171; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600">${e.category}</span></td>
              <td>${KKR.vehicleReg(e.vehicle)||'—'}</td>
              <td>${e.tripId||'—'}</td>
              <td>${e.description}</td>
              <td style="text-transform:capitalize">${e.paidBy}</td>
              <td class="text-muted">${e.receipt||'—'}</td>
              <td class="font-bold">${fmtCurrency(e.amount)}</td>
              <td>
                <div class="flex gap-2">
                  <button class="btn btn-xs btn-secondary" onclick="openExpModal('${e.id}')">${icon('edit',13)}</button>
                  <button class="btn btn-xs btn-danger" onclick="deleteExp('${e.id}')">${icon('trash',13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border)">
              <td colspan="7" style="padding:12px 16px; font-weight:700">Total (filtered)</td>
              <td class="font-bold" style="padding:12px 16px; color:#f87171">${fmtCurrency(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="exp-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="exp-modal-title">Add Expense</div>
        <button class="modal-close" onclick="closeModal('exp-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="exp-modal-body"></div>
    </div>
  </div>`;
}

function openExpModal(id=null) {
  editingExpId = id;
  const e = id ? KKR.getExpenses().find(x=>x.id===id) : {};
  document.getElementById('exp-modal-title').textContent = id ? 'Edit Expense' : 'Add Expense';
  const vehicles = KKR.getVehicles();
  const trips    = KKR.getTrips();

  document.getElementById('exp-modal-body').innerHTML = `
    <form onsubmit="saveExp(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="ef-date" value="${fmtDateInput(e.date||today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-control" id="ef-cat" required>
            ${EXP_CATEGORIES.map(c=>`<option value="${c}" ${(e.category||'')==c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Vehicle (optional)</label>
          <select class="form-control" id="ef-vehicle">
            <option value="">— None —</option>
            ${vehicles.map(v=>`<option value="${v.id}" ${e.vehicle===v.id?'selected':''}>${v.regNo}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Trip (optional)</label>
          <select class="form-control" id="ef-trip">
            <option value="">— None —</option>
            ${trips.map(t=>`<option value="${t.id}" ${e.tripId===t.id?'selected':''}>${t.id}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-control" id="ef-desc" value="${e.description||''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input type="number" class="form-control" id="ef-amount" value="${e.amount||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Paid By</label>
          <select class="form-control" id="ef-paid">
            <option value="cash" ${(e.paidBy||'cash')==='cash'?'selected':''}>Cash</option>
            <option value="bank" ${e.paidBy==='bank'?'selected':''}>Bank Transfer</option>
            <option value="driver" ${e.paidBy==='driver'?'selected':''}>Driver (advance)</option>
            <option value="upi" ${e.paidBy==='upi'?'selected':''}>UPI</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Receipt No.</label>
        <input class="form-control" id="ef-receipt" value="${e.receipt||''}">
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('exp-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('exp-modal');
}

function saveExp(e) {
  e.preventDefault();
  const expenses = KKR.getExpenses();
  const entry = {
    id:          editingExpId || 'EX' + Date.now().toString().slice(-6),
    date:        document.getElementById('ef-date').value,
    category:    document.getElementById('ef-cat').value,
    vehicle:     document.getElementById('ef-vehicle').value,
    tripId:      document.getElementById('ef-trip').value,
    description: document.getElementById('ef-desc').value.trim(),
    amount:      parseFloat(document.getElementById('ef-amount').value)||0,
    paidBy:      document.getElementById('ef-paid').value,
    receipt:     document.getElementById('ef-receipt').value.trim(),
  };
  const idx = expenses.findIndex(x=>x.id===editingExpId);
  if (idx>=0) expenses[idx]=entry; else expenses.unshift(entry);
  KKR.saveExpenses(expenses);
  closeModal('exp-modal');
  toast(editingExpId?'Updated':'Saved','success');
  rerenderPage();
}

function deleteExp(id) {
  confirmDelete('this expense', ()=>{
    KKR.saveExpenses(KKR.getExpenses().filter(x=>x.id!==id));
    toast('Deleted','error');
    rerenderPage();
  });
}

function exportExpCSV() {
  const rows = KKR.getExpenses().map(e=>({...e, vehicle: KKR.vehicleReg(e.vehicle)||''}));
  exportCSV(['date','category','vehicle','tripId','description','amount','paidBy','receipt'], rows, 'expenses.csv');
  toast('Exported','success');
}
