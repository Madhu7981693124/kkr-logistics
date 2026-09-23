// Payments Page
let payFilter = { q: '' };
let editingPayId = null;

function renderPayments() {
  let rows = KKR.getPayments();
  if (payFilter.q) rows = filterRows(rows, payFilter.q, ['id','customer','invoiceId','reference','mode']);
  rows = [...rows].sort((a,b)=>b.date.localeCompare(a.date));

  const totalCollected = KKR.getPayments().reduce((s,p)=>s+p.amount,0);

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Payments</div>
        <div class="subtitle">Total collected: ${fmtCurrency(totalCollected)}</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportPayCSV()">${icon('download',15)} Export</button>
        <button class="btn btn-primary" onclick="openPayModal()">${icon('plus',15)} Record Payment</button>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:20px">
      <div class="kpi-card green">
        <div class="kpi-icon green">${icon('payments',20)}</div>
        <div class="kpi-value">${fmtCurrency(totalCollected)}</div>
        <div class="kpi-label">Total Collected</div>
      </div>
      <div class="kpi-card amber">
        <div class="kpi-icon amber">${icon('billing',20)}</div>
        <div class="kpi-value">${fmtCurrency(KKR.getInvoices().reduce((s,i)=>s+i.total-i.paid,0))}</div>
        <div class="kpi-label">Outstanding Balance</div>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search payments..." value="${payFilter.q}"
            oninput="payFilter.q=this.value; rerenderPage()">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Payment ID</th><th>Date</th><th>Customer</th><th>Invoice</th>
            <th>Amount</th><th>Mode</th><th>Reference</th><th>Notes</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length===0 ? `<tr><td colspan="9" class="text-center text-muted" style="padding:40px">No payments recorded</td></tr>` :
            rows.map(p=>`
            <tr>
              <td class="font-bold text-blue">${p.id}</td>
              <td>${fmtDate(p.date)}</td>
              <td>${KKR.customerName(p.customer)}</td>
              <td class="text-blue">${p.invoiceId||'—'}</td>
              <td class="font-bold text-success">${fmtCurrency(p.amount)}</td>
              <td><span style="background:rgba(37,99,235,0.15); color:#60a5fa; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600">${p.mode}</span></td>
              <td class="text-muted">${p.reference||'—'}</td>
              <td class="text-muted">${p.notes||'—'}</td>
              <td>
                <div class="flex gap-2">
                  <button class="btn btn-xs btn-secondary" onclick="openPayModal('${p.id}')">${icon('edit',13)}</button>
                  <button class="btn btn-xs btn-danger" onclick="deletePay('${p.id}')">${icon('trash',13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="pay-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="pay-modal-title">Record Payment</div>
        <button class="modal-close" onclick="closeModal('pay-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="pay-modal-body"></div>
    </div>
  </div>`;
}

function openPayModal(id=null) {
  editingPayId = id;
  const p = id ? KKR.getPayments().find(x=>x.id===id) : {};
  document.getElementById('pay-modal-title').textContent = id ? 'Edit Payment' : 'Record Payment';
  const customers = KKR.getCustomers();
  const invoices  = KKR.getInvoices().filter(i=>i.status!=='paid');

  document.getElementById('pay-modal-body').innerHTML = `
    <form onsubmit="savePay(event)">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Date</label>
          <input type="date" class="form-control" id="pf-date" value="${fmtDateInput(p.date||today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Customer</label>
          <select class="form-control" id="pf-cust" required>
            <option value="">Select</option>
            ${customers.map(c=>`<option value="${c.id}" ${p.customer===c.id?'selected':''}>${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Against Invoice</label>
          <select class="form-control" id="pf-inv">
            <option value="">— None / Advance —</option>
            ${KKR.getInvoices().map(i=>`<option value="${i.id}" ${p.invoiceId===i.id?'selected':''}>${i.id} (${fmtCurrency(i.total-i.paid)} due)</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Amount (₹)</label>
          <input type="number" class="form-control" id="pf-amount" value="${p.amount||''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Payment Mode</label>
          <select class="form-control" id="pf-mode">
            ${['NEFT','RTGS','IMPS','Cheque','Cash','UPI','DD'].map(m=>`<option ${(p.mode||'NEFT')===m?'selected':''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Reference / UTR No.</label>
          <input class="form-control" id="pf-ref" value="${p.reference||''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="pf-notes" rows="2">${p.notes||''}</textarea>
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('pay-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('pay-modal');
}

function savePay(e) {
  e.preventDefault();
  const payments = KKR.getPayments();
  const entry = {
    id:        editingPayId || 'PAY' + Date.now().toString().slice(-6),
    date:      document.getElementById('pf-date').value,
    customer:  document.getElementById('pf-cust').value,
    invoiceId: document.getElementById('pf-inv').value,
    amount:    parseFloat(document.getElementById('pf-amount').value)||0,
    mode:      document.getElementById('pf-mode').value,
    reference: document.getElementById('pf-ref').value.trim(),
    notes:     document.getElementById('pf-notes').value.trim(),
  };
  // Update invoice paid amount
  if (entry.invoiceId) {
    const invs = KKR.getInvoices();
    const invIdx = invs.findIndex(i=>i.id===entry.invoiceId);
    if (invIdx>=0) {
      const oldPay = editingPayId ? (KKR.getPayments().find(x=>x.id===editingPayId)||{}).amount||0 : 0;
      invs[invIdx].paid = Math.min(invs[invIdx].total, invs[invIdx].paid - oldPay + entry.amount);
      invs[invIdx].status = invs[invIdx].paid >= invs[invIdx].total ? 'paid' : 'pending';
      KKR.saveInvoices(invs);
    }
  }
  const idx = payments.findIndex(x=>x.id===editingPayId);
  if (idx>=0) payments[idx]=entry; else payments.unshift(entry);
  KKR.savePayments(payments);
  closeModal('pay-modal');
  toast('Payment recorded','success');
  rerenderPage();
}

function deletePay(id) {
  confirmDelete('this payment', ()=>{
    KKR.savePayments(KKR.getPayments().filter(x=>x.id!==id));
    toast('Deleted','error');
    rerenderPage();
  });
}

function exportPayCSV() {
  const rows = KKR.getPayments().map(p=>({...p, customer: KKR.customerName(p.customer)}));
  exportCSV(['id','date','customer','invoiceId','amount','mode','reference'], rows, 'payments.csv');
  toast('Exported','success');
}
