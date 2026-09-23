// Billing / Invoices Page
let billFilter = { q: '', status: '' };
let editingInvoiceId = null;

function renderBilling() {
  let rows = KKR.getInvoices();
  if (billFilter.status) rows = rows.filter(i=>i.status===billFilter.status);
  if (billFilter.q) rows = filterRows(rows, billFilter.q, ['id','customer']);
  rows = [...rows].sort((a,b)=>b.date.localeCompare(a.date));

  const totalBilled = KKR.getInvoices().reduce((s,i)=>s+i.total,0);
  const totalPaid   = KKR.getInvoices().reduce((s,i)=>s+i.paid,0);
  const outstanding = totalBilled - totalPaid;

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Billing & Invoices</div>
        <div class="subtitle">${KKR.getInvoices().length} invoices · Outstanding: ${fmtCurrency(outstanding)}</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportInvCSV()">${icon('download',15)} Export</button>
        <button class="btn btn-primary" onclick="openInvoiceModal()">${icon('plus',15)} New Invoice</button>
      </div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px">
      <div class="kpi-card blue"><div class="kpi-icon blue">${icon('billing',20)}</div>
        <div class="kpi-value">${fmtCurrency(totalBilled)}</div><div class="kpi-label">Total Billed</div></div>
      <div class="kpi-card green"><div class="kpi-icon green">${icon('check',20)}</div>
        <div class="kpi-value">${fmtCurrency(totalPaid)}</div><div class="kpi-label">Collected</div></div>
      <div class="kpi-card amber"><div class="kpi-icon amber">${icon('warning',20)}</div>
        <div class="kpi-value">${fmtCurrency(outstanding)}</div><div class="kpi-label">Outstanding</div></div>
      <div class="kpi-card red"><div class="kpi-icon red">${icon('info',20)}</div>
        <div class="kpi-value">${KKR.getInvoices().filter(i=>i.status==='overdue').length}</div><div class="kpi-label">Overdue</div></div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search invoices..." value="${billFilter.q}"
            oninput="billFilter.q=this.value; rerenderPage()">
        </div>
        <select class="form-control" style="width:160px" onchange="billFilter.status=this.value; rerenderPage()">
          <option value="">All Status</option>
          <option value="paid" ${billFilter.status==='paid'?'selected':''}>Paid</option>
          <option value="pending" ${billFilter.status==='pending'?'selected':''}>Pending</option>
          <option value="overdue" ${billFilter.status==='overdue'?'selected':''}>Overdue</option>
          <option value="draft" ${billFilter.status==='draft'?'selected':''}>Draft</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Invoice No.</th><th>Date</th><th>Due Date</th><th>Customer</th>
            <th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length===0 ? `<tr><td colspan="9" class="text-center text-muted" style="padding:40px">No invoices found</td></tr>` :
            rows.map(i=>{
              const bal = i.total - i.paid;
              const due = daysFromNow(i.dueDate);
              return `
              <tr>
                <td class="font-bold text-blue" style="cursor:pointer" onclick="viewInvoice('${i.id}')">${i.id}</td>
                <td>${fmtDate(i.date)}</td>
                <td style="color:${due!==null&&due<0?'#f87171':due!==null&&due<7?'#fbbf24':'inherit'}">${fmtDate(i.dueDate)}</td>
                <td>${KKR.customerName(i.customer)}</td>
                <td class="font-bold">${fmtCurrency(i.total)}</td>
                <td class="text-success">${fmtCurrency(i.paid)}</td>
                <td class="font-bold ${bal>0?'text-amber':''}">${fmtCurrency(bal)}</td>
                <td>${statusBadge(i.status)}</td>
                <td>
                  <div class="flex gap-2">
                    <button class="btn btn-xs btn-secondary tooltip-wrap" onclick="viewInvoice('${i.id}')">${icon('eye',13)}<span class="tooltip">View</span></button>
                    <button class="btn btn-xs btn-secondary" onclick="openInvoiceModal('${i.id}')">${icon('edit',13)}</button>
                    <button class="btn btn-xs btn-danger" onclick="deleteInvoice('${i.id}')">${icon('trash',13)}</button>
                  </div>
                </td>
              </tr>`;}).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Invoice Form Modal -->
  <div class="modal-overlay" id="invoice-modal">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title" id="invoice-modal-title">New Invoice</div>
        <button class="modal-close" onclick="closeModal('invoice-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="invoice-modal-body"></div>
    </div>
  </div>

  <!-- Invoice View Modal -->
  <div class="modal-overlay" id="invoice-view-modal">
    <div class="modal modal-lg">
      <div class="modal-header">
        <div class="modal-title">Invoice</div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" onclick="printCurrentInvoice()">${icon('print',14)} Print</button>
          <button class="modal-close" onclick="closeModal('invoice-view-modal')">${icon('close',18)}</button>
        </div>
      </div>
      <div class="modal-body" id="invoice-view-body"></div>
    </div>
  </div>`;
}

function openInvoiceModal(id=null) {
  editingInvoiceId = id;
  const inv = id ? KKR.getInvoices().find(x=>x.id===id) : {};
  document.getElementById('invoice-modal-title').textContent = id ? 'Edit Invoice' : 'New Invoice';
  const customers = KKR.getCustomers();

  document.getElementById('invoice-modal-body').innerHTML = `
    <form onsubmit="saveInvoice(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Invoice No.</label>
          <input class="form-control" id="if-id" value="${inv.id||''}" ${id?'readonly':''} placeholder="INV-2025-XXX" required>
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="if-date" value="${fmtDateInput(inv.date||today())}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input type="date" class="form-control" id="if-due" value="${fmtDateInput(inv.dueDate||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Customer</label>
          <select class="form-control" id="if-customer" required>
            <option value="">Select Customer</option>
            ${customers.map(c=>`<option value="${c.id}" ${inv.customer===c.id?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Subtotal (₹)</label>
          <input type="number" class="form-control" id="if-sub" value="${inv.subtotal||''}" oninput="calcInvTotal()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Discount (₹)</label>
          <input type="number" class="form-control" id="if-dis" value="${inv.discount||0}" oninput="calcInvTotal()">
        </div>
        <div class="form-group">
          <label class="form-label">Total (₹)</label>
          <input type="number" class="form-control" id="if-total" value="${inv.total||''}" readonly style="background:rgba(37,99,235,0.08)">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount Paid (₹)</label>
          <input type="number" class="form-control" id="if-paid" value="${inv.paid||0}">
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="if-status">
            <option value="draft" ${(inv.status||'draft')==='draft'?'selected':''}>Draft</option>
            <option value="pending" ${inv.status==='pending'?'selected':''}>Pending</option>
            <option value="paid" ${inv.status==='paid'?'selected':''}>Paid</option>
            <option value="overdue" ${inv.status==='overdue'?'selected':''}>Overdue</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="if-notes" rows="2">${inv.notes||''}</textarea>
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('invoice-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('invoice-modal');
}

function calcInvTotal() {
  const sub = parseFloat(document.getElementById('if-sub').value)||0;
  const dis = parseFloat(document.getElementById('if-dis').value)||0;
  document.getElementById('if-total').value = (sub - dis).toFixed(2);
}

function saveInvoice(e) {
  e.preventDefault();
  const invs = KKR.getInvoices();
  const inv = {
    id:       document.getElementById('if-id').value.trim() || 'INV-' + Date.now().toString().slice(-6),
    date:     document.getElementById('if-date').value,
    dueDate:  document.getElementById('if-due').value,
    customer: document.getElementById('if-customer').value,
    subtotal: parseFloat(document.getElementById('if-sub').value)||0,
    discount: parseFloat(document.getElementById('if-dis').value)||0,
    tax:      0,
    total:    parseFloat(document.getElementById('if-total').value)||0,
    paid:     parseFloat(document.getElementById('if-paid').value)||0,
    status:   document.getElementById('if-status').value,
    notes:    document.getElementById('if-notes').value.trim(),
    tripIds:  (invs.find(x=>x.id===editingInvoiceId)||{tripIds:[]}).tripIds || [],
  };
  const idx = invs.findIndex(x=>x.id===editingInvoiceId);
  if (idx>=0) invs[idx]=inv; else invs.unshift(inv);
  KKR.saveInvoices(invs);
  closeModal('invoice-modal');
  toast(editingInvoiceId?'Invoice updated':'Invoice created','success');
  rerenderPage();
}

function deleteInvoice(id) {
  confirmDelete(id, ()=>{
    KKR.saveInvoices(KKR.getInvoices().filter(x=>x.id!==id));
    toast('Deleted','error');
    rerenderPage();
  });
}

let _viewInvoiceId = null;
function viewInvoice(id) {
  _viewInvoiceId = id;
  const inv = KKR.getInvoices().find(x=>x.id===id);
  if (!inv) return;
  const s = KKR.getSettings();
  const cust = KKR.getCustomers().find(c=>c.id===inv.customer)||{};
  const balance = inv.total - inv.paid;

  document.getElementById('invoice-view-body').innerHTML = `
    <div id="printable-invoice" style="max-width:700px; margin:auto">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px">
        <div>
          <div style="font-size:22px; font-weight:800; color:var(--text-primary)">${s.businessName||'KKR Logistics'}</div>
          <div style="font-size:12px; color:var(--text-muted); margin-top:4px">${s.address||''}</div>
          <div style="font-size:12px; color:var(--text-muted)">GSTIN: ${s.gstin||''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:28px; font-weight:900; color:#2563eb">INVOICE</div>
          <div style="font-size:16px; font-weight:700; color:var(--text-primary)">${inv.id}</div>
          <div style="font-size:12px; color:var(--text-muted)">Date: ${fmtDate(inv.date)}</div>
          <div style="font-size:12px; color:var(--text-muted)">Due: ${fmtDate(inv.dueDate)}</div>
        </div>
      </div>
      <hr class="divider">
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px">
        <div>
          <div style="font-size:11px; color:var(--text-muted); font-weight:700; letter-spacing:.5px; margin-bottom:6px">BILL FROM</div>
          <div style="font-weight:700">${s.businessName||'KKR Logistics'}</div>
          <div style="font-size:12px; color:var(--text-muted)">${s.phone||''}</div>
          <div style="font-size:12px; color:var(--text-muted)">${s.email||''}</div>
        </div>
        <div>
          <div style="font-size:11px; color:var(--text-muted); font-weight:700; letter-spacing:.5px; margin-bottom:6px">BILL TO</div>
          <div style="font-weight:700">${cust.name||inv.customer}</div>
          <div style="font-size:12px; color:var(--text-muted)">${cust.contact||''}</div>
          <div style="font-size:12px; color:var(--text-muted)">${cust.address||''}</div>
          <div style="font-size:12px; color:var(--text-muted)">${cust.gstin?'GSTIN: '+cust.gstin:''}</div>
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse; margin-bottom:20px">
        <thead>
          <tr style="background:rgba(37,99,235,0.12)">
            <th style="padding:10px 16px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted)">Description</th>
            <th style="padding:10px 16px; text-align:right; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted)">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:12px 16px">Freight charges — ${inv.tripIds&&inv.tripIds.length?inv.tripIds.join(', '):'as per agreement'}</td>
            <td style="padding:12px 16px; text-align:right">${fmtCurrency(inv.subtotal)}</td>
          </tr>
        </tbody>
        <tfoot>
          ${inv.discount>0?`<tr><td style="padding:8px 16px; text-align:right; color:var(--text-muted)">Discount</td><td style="padding:8px 16px; text-align:right; color:#34d399">— ${fmtCurrency(inv.discount)}</td></tr>`:''}
          <tr style="border-top:2px solid var(--border)">
            <td style="padding:12px 16px; font-weight:800; font-size:16px">Total</td>
            <td style="padding:12px 16px; font-weight:800; font-size:16px; text-align:right; color:#60a5fa">${fmtCurrency(inv.total)}</td>
          </tr>
          <tr>
            <td style="padding:8px 16px; color:var(--text-muted)">Paid</td>
            <td style="padding:8px 16px; text-align:right; color:#34d399">${fmtCurrency(inv.paid)}</td>
          </tr>
          <tr>
            <td style="padding:8px 16px; font-weight:700">Balance Due</td>
            <td style="padding:8px 16px; text-align:right; font-weight:700; color:${balance>0?'#f87171':'#34d399'}">${fmtCurrency(balance)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="display:flex; justify-content:space-between; align-items:center">
        <div>${statusBadge(inv.status)}</div>
        <div style="text-align:right; font-size:12px; color:var(--text-muted)">
          Bank: ${s.bankName||''} · A/C: ${s.accountNo||''} · IFSC: ${s.ifsc||''}
        </div>
      </div>
      ${inv.notes?`<div style="margin-top:16px; padding:12px; background:var(--bg-dark); border-radius:8px; font-size:12px; color:var(--text-muted)">Note: ${inv.notes}</div>`:''}
    </div>`;
  openModal('invoice-view-modal');
}

function printCurrentInvoice() {
  const content = document.getElementById('printable-invoice');
  if (content) printSection('Invoice', content.innerHTML);
}

function exportInvCSV() {
  const rows = KKR.getInvoices().map(i=>({...i, customer: KKR.customerName(i.customer), balance: i.total-i.paid}));
  exportCSV(['id','date','dueDate','customer','total','paid','balance','status'], rows, 'invoices.csv');
  toast('Exported','success');
}
