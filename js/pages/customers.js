// Customers Page
let custFilter = { q: '', status: '' };
let editingCustId = null;

function renderCustomers() {
  let rows = KKR.getCustomers();
  if (custFilter.status) rows = rows.filter(c=>c.status===custFilter.status);
  if (custFilter.q) rows = filterRows(rows, custFilter.q, ['name','contact','phone','email','gstin']);

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Customers</div>
        <div class="subtitle">${KKR.getCustomers().length} customers · Total balance: ${fmtCurrency(KKR.getCustomers().reduce((s,c)=>s+c.balance,0))}</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportCustCSV()">${icon('download',15)} Export</button>
        <button class="btn btn-primary" onclick="openCustModal()">${icon('plus',15)} Add Customer</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search customers..." value="${custFilter.q}"
            oninput="custFilter.q=this.value; rerenderPage()">
        </div>
        <select class="form-control" style="width:160px" onchange="custFilter.status=this.value; rerenderPage()">
          <option value="">All Status</option>
          <option value="active" ${custFilter.status==='active'?'selected':''}>Active</option>
          <option value="inactive" ${custFilter.status==='inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Customer</th><th>Contact Person</th><th>Phone</th><th>Email</th>
            <th>GSTIN</th><th>Outstanding</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length===0 ? `<tr><td colspan="8" class="text-center text-muted" style="padding:40px">No customers found</td></tr>` :
            rows.map(c=>{
              // Calculate actual outstanding from invoices
              const outstanding = KKR.getInvoices().filter(i=>i.customer===c.id).reduce((s,i)=>s+(i.total-i.paid),0);
              return `
              <tr>
                <td>
                  <div class="flex items-center gap-2">
                    <div style="width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,#1e3a5f,#2563eb); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; color:#fff; flex-shrink:0">${c.name.charAt(0)}</div>
                    <div>
                      <div class="font-bold">${c.name}</div>
                      <div style="font-size:11px; color:var(--text-muted)">${c.address}</div>
                    </div>
                  </div>
                </td>
                <td>${c.contact}</td>
                <td>${c.phone}</td>
                <td class="text-muted">${c.email}</td>
                <td class="font-medium">${c.gstin||'—'}</td>
                <td class="font-bold ${outstanding>0?'text-amber':''}">${fmtCurrency(outstanding)}</td>
                <td>${statusBadge(c.status)}</td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-xs btn-secondary" onclick="openCustModal('${c.id}')">${icon('edit',13)}</button>
                    <button class="btn btn-xs btn-danger" onclick="deleteCust('${c.id}')">${icon('trash',13)}</button>
                  </div>
                </td>
              </tr>`;}).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="cust-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="cust-modal-title">Add Customer</div>
        <button class="modal-close" onclick="closeModal('cust-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="cust-modal-body"></div>
    </div>
  </div>`;
}

function openCustModal(id=null) {
  editingCustId = id;
  const c = id ? KKR.getCustomers().find(x=>x.id===id) : {};
  document.getElementById('cust-modal-title').textContent = id ? 'Edit Customer' : 'Add Customer';

  document.getElementById('cust-modal-body').innerHTML = `
    <form onsubmit="saveCust(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Company Name</label>
          <input class="form-control" id="cf-name" value="${c.name||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Contact Person</label>
          <input class="form-control" id="cf-contact" value="${c.contact||''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Phone</label>
          <input class="form-control" id="cf-phone" value="${c.phone||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-control" id="cf-email" value="${c.email||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">GSTIN</label>
          <input class="form-control" id="cf-gstin" value="${c.gstin||''}" placeholder="22AAAAA0000A1Z5">
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="cf-status">
            <option value="active" ${(c.status||'active')==='active'?'selected':''}>Active</option>
            <option value="inactive" ${c.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Address</label>
        <textarea class="form-control" id="cf-addr" rows="2">${c.address||''}</textarea>
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('cust-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('cust-modal');
}

function saveCust(e) {
  e.preventDefault();
  const customers = KKR.getCustomers();
  const cust = {
    id:      editingCustId || 'C' + Date.now().toString().slice(-5),
    name:    document.getElementById('cf-name').value.trim(),
    contact: document.getElementById('cf-contact').value.trim(),
    phone:   document.getElementById('cf-phone').value.trim(),
    email:   document.getElementById('cf-email').value.trim(),
    gstin:   document.getElementById('cf-gstin').value.trim().toUpperCase(),
    address: document.getElementById('cf-addr').value.trim(),
    status:  document.getElementById('cf-status').value,
    balance: (KKR.getCustomers().find(x=>x.id===editingCustId)||{balance:0}).balance || 0,
  };
  const idx = customers.findIndex(c=>c.id===editingCustId);
  if (idx>=0) customers[idx]=cust; else customers.push(cust);
  KKR.saveCustomers(customers);
  closeModal('cust-modal');
  toast(editingCustId?'Updated':'Customer added','success');
  rerenderPage();
}

function deleteCust(id) {
  const c = KKR.getCustomers().find(x=>x.id===id);
  confirmDelete(c?c.name:id, ()=>{
    KKR.saveCustomers(KKR.getCustomers().filter(x=>x.id!==id));
    toast('Deleted','error');
    rerenderPage();
  });
}

function exportCustCSV() {
  exportCSV(['id','name','contact','phone','email','gstin','address','status'], KKR.getCustomers(), 'customers.csv');
  toast('Exported','success');
}
