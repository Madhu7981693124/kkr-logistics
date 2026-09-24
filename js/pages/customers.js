// ============================================================
// KKR Logistics — Customers Module
// Full fields: companyName, contactPerson, phone, altPhone,
//   email, address, billingAddress, gstin, pan, status,
//   deliveryLocations[], agreedRates[], notes, creditLimit
// View: list + detail profile with linked trips/invoices
// ============================================================

let custFilter    = { q: '', status: '' };
let custTab       = 'list';
let editingCustId = null;
let viewingCustId = null;

// ── Customer stats ────────────────────────────────────────────────────────
function _custStats(cid) {
  const trips    = KKR.getTrips().filter(t => t.customer === cid && t.status !== 'cancelled');
  const invoices = KKR.getInvoices().filter(i => i.customer === cid);
  const payments = KKR.getPayments().filter(p => p.customer === cid);
  const totalBilled    = invoices.reduce((s,i) => s + (i.total||0), 0);
  const totalPaid      = invoices.reduce((s,i) => s + (i.paid||0), 0);
  const outstanding    = totalBilled - totalPaid;
  const totalFreight   = trips.reduce((s,t) => s + (t.grandTotal||t.freight||0), 0);
  const totalTons      = trips.reduce((s,t) => s + (t.quantity||t.billedWt||0), 0);
  return { trips:trips.length, invoices:invoices.length, payments:payments.length,
           totalBilled, totalPaid, outstanding, totalFreight, totalTons };
}

function renderCustomers() {
  const allCust = KKR.getCustomers();
  let rows = [...allCust];
  if (custFilter.status) rows = rows.filter(c => c.status === custFilter.status);
  if (custFilter.q) {
    const q = custFilter.q.toLowerCase();
    rows = rows.filter(c =>
      (c.name    ||'').toLowerCase().includes(q) ||
      (c.contact ||'').toLowerCase().includes(q) ||
      (c.phone   ||'').toLowerCase().includes(q) ||
      (c.email   ||'').toLowerCase().includes(q) ||
      (c.gstin   ||'').toLowerCase().includes(q)
    );
  }

  const totalOutstanding = allCust.reduce((s,c) => {
    return s + KKR.getInvoices().filter(i=>i.customer===c.id).reduce((ss,i)=>ss+(i.total-i.paid),0);
  }, 0);

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Customers</div>
        <div class="subtitle">${allCust.length} customers · Outstanding: ${fmtCurrency(totalOutstanding)}</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="printCustomers()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg> Print
        </button>
        <button class="btn btn-secondary" onclick="exportCustomersWithOutstanding()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Export
        </button>
        <button class="btn btn-primary" onclick="openCustForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Customer
        </button>
      </div>
    </div>

    <!-- KPI strip -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px">
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:22px;font-weight:800;color:#60a5fa">${allCust.length}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Total</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:22px;font-weight:800;color:#34d399">${allCust.filter(c=>c.status==='active').length}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Active</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:20px;font-weight:800;color:#f87171">${fmtCurrency(totalOutstanding)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Outstanding</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:20px;font-weight:800;color:#fbbf24">${fmtCurrency(KKR.getInvoices().filter(i=>i.customer&&i.status==='overdue').reduce((s,i)=>s+(i.total-i.paid),0))}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Overdue</div>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar" style="margin-bottom:16px">
        <div class="search-input-wrap" style="flex:1;min-width:200px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search name, contact, phone, GSTIN…"
            value="${custFilter.q}" oninput="custFilter.q=this.value;rerenderPage()">
        </div>
        <select class="form-control" style="width:155px" onchange="custFilter.status=this.value;rerenderPage()">
          <option value="">All Status</option>
          <option value="active"   ${custFilter.status==='active'?'selected':''}>Active</option>
          <option value="inactive" ${custFilter.status==='inactive'?'selected':''}>Inactive</option>
        </select>
        ${custFilter.q||custFilter.status ? `<button class="btn btn-secondary btn-sm" onclick="custFilter={q:'',status:''};rerenderPage()">Clear</button>` : ''}
        <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${rows.length} of ${allCust.length}</span>
      </div>

      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Customer</th><th>Contact</th><th>Phone</th><th>GSTIN</th>
            <th>Trips</th><th>Total Freight</th><th>Outstanding</th><th>Status</th><th style="text-align:center">Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length===0 ? `<tr><td colspan="9" style="padding:56px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:8px">🏢</div>
            <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No customers found</div>
            <div style="font-size:12px">Click "Add Customer" to get started</div>
          </td></tr>` :
            rows.map(c => {
              const st = _custStats(c.id);
              return `<tr style="cursor:pointer" onclick="viewCustomer('${c.id}')">
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#1e3a5f,#2563eb);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;flex-shrink:0">${c.name.charAt(0)}</div>
                    <div>
                      <div class="font-bold">${c.name}</div>
                      <div style="font-size:11px;color:var(--text-muted)">${c.address||'—'}</div>
                    </div>
                  </div>
                </td>
                <td>${c.contact||'—'}</td>
                <td>${c.phone}</td>
                <td class="font-medium">${c.gstin||'—'}</td>
                <td class="font-bold text-blue" style="text-align:center">${st.trips}</td>
                <td class="font-bold">${fmtCurrency(st.totalFreight)}</td>
                <td class="font-bold ${st.outstanding>0?'text-amber':''}">${fmtCurrency(st.outstanding)}</td>
                <td onclick="event.stopPropagation()">${statusBadge(c.status)}</td>
                <td onclick="event.stopPropagation()">
                  <div class="flex gap-2" style="justify-content:center">
                    <button class="btn btn-xs btn-secondary" onclick="viewCustomer('${c.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="btn btn-xs btn-secondary" onclick="openCustForm('${c.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-xs btn-danger" onclick="deleteCust('${c.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>`;}).join('')}
          </tbody>
          ${rows.length>0 ? `<tfoot><tr style="border-top:2px solid var(--border)">
            <td colspan="6" style="padding:11px 16px;font-weight:700;font-size:12px;color:var(--text-muted)">TOTALS (${rows.length})</td>
            <td class="font-bold" style="padding:11px 16px;color:#fbbf24">${fmtCurrency(rows.reduce((s,c)=>s+KKR.getInvoices().filter(i=>i.customer===c.id).reduce((ss,i)=>ss+(i.total-i.paid),0),0))}</td>
            <td colspan="2"></td>
          </tr></tfoot>` : ''}
        </table>
      </div>
    </div>
  </div>

  <!-- Add/Edit modal -->
  <div class="modal-overlay" id="cust-form-modal">
    <div class="modal" style="max-width:820px">
      <div class="modal-header">
        <div class="modal-title" id="cust-form-title">Add Customer</div>
        <button class="modal-close" onclick="closeModal('cust-form-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="cust-form-body"></div>
    </div>
  </div>

  <!-- View modal -->
  <div class="modal-overlay" id="cust-view-modal">
    <div class="modal" style="max-width:780px">
      <div class="modal-header">
        <div class="modal-title" id="cust-view-title">Customer Profile</div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" id="cust-view-edit-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit
          </button>
          <button class="modal-close" onclick="closeModal('cust-view-modal')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-body" id="cust-view-body"></div>
    </div>
  </div>

  <style>
    .cust-det-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden}
    .cust-det-grid .cust-det-row:nth-child(odd){border-right:1px solid rgba(51,65,85,0.4)}
    .cust-det-row{display:flex;flex-direction:column;padding:10px 14px;border-bottom:1px solid rgba(51,65,85,0.4)}
    .cust-det-lbl{font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
    .cust-det-val{font-size:13.5px;font-weight:600;color:var(--text-primary)}
    .cust-sec-hdr{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;padding:10px 14px;background:rgba(51,65,85,0.2);border-bottom:1px solid var(--border)}
    .cust-form-sec{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
    @media(max-width:640px){.cust-det-grid{grid-template-columns:1fr!important}.cust-det-grid .cust-det-row:nth-child(odd){border-right:none}}
  </style>`;
}

// ── Add / Edit form ──────────────────────────────────────────────────────
function openCustForm(id = null) {
  editingCustId = id;
  const c = id ? (KKR.getCustomers().find(x=>x.id===id)||{}) : {};
  document.getElementById('cust-form-title').textContent = id ? `Edit — ${c.name||id}` : 'Add Customer';

  // Delivery locations & agreed rates as arrays stored as newline text
  const deliveries = Array.isArray(c.deliveryLocations) ? c.deliveryLocations.join('\n') : (c.deliveryLocations||'');
  const rates      = Array.isArray(c.agreedRates) ? c.agreedRates.join('\n') : (c.agreedRates||'');

  document.getElementById('cust-form-body').innerHTML = `
    <form onsubmit="saveCust(event)" autocomplete="off">
      <div class="cust-form-sec">Company Details</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Company Name <span style="color:#f87171">*</span></label>
          <input class="form-control" id="cf-name" value="${c.name||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Contact Person <span style="color:#f87171">*</span></label>
          <input class="form-control" id="cf-contact" value="${c.contact||''}" required>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Phone <span style="color:#f87171">*</span></label>
          <input class="form-control" id="cf-phone" value="${c.phone||''}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Alternate Phone</label>
          <input class="form-control" id="cf-altphone" value="${c.altPhone||''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-control" id="cf-email" value="${c.email||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="cf-status">
            <option value="active"   ${(c.status||'active')==='active'?'selected':''}>Active</option>
            <option value="inactive" ${c.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">GSTIN</label>
          <input class="form-control" id="cf-gstin" value="${c.gstin||''}" placeholder="22AAAAA0000A1Z5" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
        </div>
        <div class="form-group">
          <label class="form-label">PAN</label>
          <input class="form-control" id="cf-pan" value="${c.pan||''}" placeholder="AAAAA0000A" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Credit Limit (₹)</label>
        <input type="number" class="form-control" id="cf-credit" value="${c.creditLimit||''}" placeholder="0 = unlimited" min="0">
      </div>

      <div class="cust-form-sec" style="margin-top:18px">Addresses</div>
      <div class="form-group">
        <label class="form-label">Office / Billing Address</label>
        <textarea class="form-control" id="cf-addr" rows="2">${c.address||''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Billing Address (if different)</label>
        <textarea class="form-control" id="cf-billing" rows="2">${c.billingAddress||''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Delivery Locations <span style="font-weight:400;color:var(--text-muted)">(one per line)</span></label>
        <textarea class="form-control" id="cf-deliveries" rows="3" placeholder="Jamshedpur Plant&#10;Mumbai Warehouse&#10;Delhi Depot">${deliveries}</textarea>
      </div>

      <div class="cust-form-sec" style="margin-top:18px">Commercial</div>
      <div class="form-group">
        <label class="form-label">Agreed Rates <span style="font-weight:400;color:var(--text-muted)">(one per line, e.g. Iron Ore: ₹3500/MT)</span></label>
        <textarea class="form-control" id="cf-rates" rows="3" placeholder="Iron Ore Ludhiana→Jamshedpur: ₹3500/MT&#10;Coal: ₹2800/MT">${rates}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="cf-notes" rows="2">${c.notes||''}</textarea>
      </div>

      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('cust-form-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update' : 'Save Customer'}
        </button>
      </div>
    </form>`;
  openModal('cust-form-modal');
}

function saveCust(e) {
  e.preventDefault();
  const customers = KKR.getCustomers();
  const cust = {
    id:               editingCustId || 'C' + Date.now().toString().slice(-5),
    name:             document.getElementById('cf-name').value.trim(),
    contact:          document.getElementById('cf-contact').value.trim(),
    phone:            document.getElementById('cf-phone').value.trim(),
    altPhone:         document.getElementById('cf-altphone').value.trim(),
    email:            document.getElementById('cf-email').value.trim(),
    status:           document.getElementById('cf-status').value,
    gstin:            document.getElementById('cf-gstin').value.trim().toUpperCase(),
    pan:              document.getElementById('cf-pan').value.trim().toUpperCase(),
    creditLimit:      parseFloat(document.getElementById('cf-credit').value)||0,
    address:          document.getElementById('cf-addr').value.trim(),
    billingAddress:   document.getElementById('cf-billing').value.trim(),
    deliveryLocations:document.getElementById('cf-deliveries').value.trim().split('\n').map(s=>s.trim()).filter(Boolean),
    agreedRates:      document.getElementById('cf-rates').value.trim().split('\n').map(s=>s.trim()).filter(Boolean),
    notes:            document.getElementById('cf-notes').value.trim(),
    balance:          (KKR.getCustomers().find(x=>x.id===editingCustId)||{balance:0}).balance || 0,
  };
  const idx = customers.findIndex(c => c.id === editingCustId);
  if (idx>=0) customers[idx]=cust; else customers.push(cust);
  KKR.saveCustomers(customers);
  closeModal('cust-form-modal');
  toast(editingCustId ? `${cust.name} updated` : `${cust.name} added`, 'success');
  rerenderPage();
}

// ── View detail ─────────────────────────────────────────────────────────
function viewCustomer(id) {
  viewingCustId = id;
  const c  = KKR.getCustomers().find(x => x.id === id);
  if (!c) return;
  const st = _custStats(id);
  const recentTrips    = KKR.getTrips().filter(t=>t.customer===id).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const pendingInvs    = KKR.getInvoices().filter(i=>i.customer===id&&i.status!=='paid').slice(0,5);

  document.getElementById('cust-view-title').textContent = c.name;
  document.getElementById('cust-view-edit-btn').onclick  = () => { closeModal('cust-view-modal'); openCustForm(id); };

  document.getElementById('cust-view-body').innerHTML = `
    <!-- Header -->
    <div style="display:flex;align-items:center;gap:16px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:16px">
      <div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#1e3a5f,#2563eb);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:20px;color:#fff;flex-shrink:0">${c.name.charAt(0)}</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800">${c.name}</div>
        <div style="font-size:13px;color:var(--text-muted)">${c.contact} · ${c.phone}</div>
      </div>
      ${statusBadge(c.status)}
    </div>

    <!-- KPI row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
      ${[
        ['Trips',     st.trips,                   '#60a5fa'],
        ['Invoices',  st.invoices,                '#a78bfa'],
        ['Total Billed', fmtCurrency(st.totalBilled), '#34d399'],
        ['Outstanding',  fmtCurrency(st.outstanding),  st.outstanding>0?'#fbbf24':'#34d399'],
      ].map(([l,v,col])=>`
        <div style="background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.15);border-radius:8px;padding:12px;text-align:center">
          <div style="font-size:16px;font-weight:800;color:${col}">${v}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${l}</div>
        </div>`).join('')}
    </div>

    <!-- Details -->
    <div class="cust-det-grid" style="margin-bottom:14px">
      <div class="cust-sec-hdr" style="grid-column:span 2">Contact & Tax</div>
      <div class="cust-det-row"><span class="cust-det-lbl">Phone</span><span class="cust-det-val">${c.phone}${c.altPhone?' / '+c.altPhone:''}</span></div>
      <div class="cust-det-row"><span class="cust-det-lbl">Email</span><span class="cust-det-val">${c.email||'—'}</span></div>
      <div class="cust-det-row"><span class="cust-det-lbl">GSTIN</span><span class="cust-det-val">${c.gstin||'—'}</span></div>
      <div class="cust-det-row"><span class="cust-det-lbl">PAN</span><span class="cust-det-val">${c.pan||'—'}</span></div>
      <div class="cust-det-row" style="grid-column:span 2"><span class="cust-det-lbl">Address</span><span class="cust-det-val">${c.address||'—'}</span></div>
      ${c.billingAddress?`<div class="cust-det-row" style="grid-column:span 2"><span class="cust-det-lbl">Billing Address</span><span class="cust-det-val">${c.billingAddress}</span></div>`:''}
      <div class="cust-det-row"><span class="cust-det-lbl">Credit Limit</span><span class="cust-det-val">${c.creditLimit>0?fmtCurrency(c.creditLimit):'Unlimited'}</span></div>
    </div>

    ${(c.deliveryLocations||[]).length>0?`
    <div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Delivery Locations</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${c.deliveryLocations.map(l=>`<span style="padding:3px 10px;background:rgba(37,99,235,0.12);color:#60a5fa;border-radius:20px;font-size:12px;font-weight:600">${l}</span>`).join('')}
      </div>
    </div>`:''}

    ${(c.agreedRates||[]).length>0?`
    <div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Agreed Rates</div>
      ${c.agreedRates.map(r=>`<div style="font-size:12px;color:var(--text-primary);padding:3px 0;border-bottom:1px solid rgba(51,65,85,0.3)">${r}</div>`).join('')}
    </div>`:''}

    ${c.notes?`
    <div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Notes</div>
      <div style="font-size:13px">${c.notes}</div>
    </div>`:''}

    <!-- Recent trips -->
    ${recentTrips.length>0?`
    <div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Recent Trips</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Trip</th><th>Date</th><th>Route</th><th>Material</th><th>Qty</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
          ${recentTrips.map(t=>`<tr>
            <td class="font-bold text-blue">${t.id}</td>
            <td>${fmtDate(t.date)}</td>
            <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.loadingPoint||t.from||'—'}→${t.destination||t.to||'—'}</td>
            <td>${KKR.materialName(t.material)}</td>
            <td>${fmtNum(t.quantity||t.billedWt||0,2)} MT</td>
            <td class="font-bold">${fmtCurrency(t.grandTotal||t.freight||0)}</td>
            <td>${statusBadge(t.status)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`:''}

    <!-- Pending invoices -->
    ${pendingInvs.length>0?`
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Pending Invoices</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Date</th><th>Due</th><th>Total</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>
          ${pendingInvs.map(i=>`<tr>
            <td class="font-bold" style="color:#a78bfa">${i.id}</td>
            <td>${fmtDate(i.date)}</td>
            <td style="color:${daysFromNow(i.dueDate)<0?'#f87171':'inherit'}">${fmtDate(i.dueDate)}</td>
            <td>${fmtCurrency(i.total)}</td>
            <td class="font-bold text-amber">${fmtCurrency(i.total-i.paid)}</td>
            <td>${statusBadge(i.status)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`:''}`;

  openModal('cust-view-modal');
}

function deleteCust(id) {
  const c = KKR.getCustomers().find(x=>x.id===id);
  confirmDelete(c?c.name:id, ()=>{
    KKR.saveCustomers(KKR.getCustomers().filter(x=>x.id!==id));
    toast('Customer deleted', 'error');
    rerenderPage();
  });
}

function exportCustCSV() {
  exportCSV(['id','name','contact','phone','email','gstin','address','status'], KKR.getCustomers(), `kkr-customers-${today()}.csv`);
  toast('Exported', 'success');
}

// backward-compat alias
function openCustModal(id=null) { openCustForm(id); }
