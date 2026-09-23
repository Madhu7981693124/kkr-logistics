// ============================================================
// KKR Logistics — Billing / Invoices Module
//
// Invoice fields:
//   invoiceNo, date, dueDate, customer
//   tripId, vehicle, material, quantity, rate
//   transportationCharges  (= quantity × rate, editable override)
//   otherCharges           (loading, unloading, port etc.)
//   taxRate (%), taxAmount (auto-calc)
//   discount, subtotal, total, paid, balance
//   status: draft | issued | partially-paid | paid | overdue | cancelled
//   notes
//
// Auto-calc chain:
//   transportationCharges = quantity × rate  (unless manually overridden)
//   subtotal              = transportationCharges + otherCharges − discount
//   taxAmount             = subtotal × taxRate / 100
//   total                 = subtotal + taxAmount
//   balance               = total − paid
//
// Backward-compat: old invoices missing new fields render fine (default 0)
// ============================================================

// ── Module state ────────────────────────────────────────────────────────────
let billFilter       = { q: '', status: '', customer: '' };
let billTab          = 'list';         // 'list' | 'summary'
let editingInvoiceId = null;
let _viewInvoiceId   = null;

// ── Status definitions ───────────────────────────────────────────────────────
const INV_STATUSES = [
  { value: 'draft',          label: 'Draft',          color: '#94a3b8' },
  { value: 'issued',         label: 'Issued',          color: '#93c5fd' },
  { value: 'partially-paid', label: 'Partially Paid',  color: '#fcd34d' },
  { value: 'paid',           label: 'Paid',            color: '#34d399' },
  { value: 'overdue',        label: 'Overdue',         color: '#f87171' },
  { value: 'cancelled',      label: 'Cancelled',       color: '#64748b' },
];

// ── Auto-calc (pure, no DOM) ─────────────────────────────────────────────────
function _invCalc(qty, rate, otherCharges, taxRate, discount, transportOverride) {
  const qty_n      = parseFloat(qty)              || 0;
  const rate_n     = parseFloat(rate)             || 0;
  const other_n    = parseFloat(otherCharges)     || 0;
  const taxRate_n  = parseFloat(taxRate)          || 0;
  const discount_n = parseFloat(discount)         || 0;
  const transport  = transportOverride != null && transportOverride !== ''
    ? parseFloat(transportOverride) || 0
    : qty_n * rate_n;
  const subtotal   = transport + other_n - discount_n;
  const taxAmount  = subtotal > 0 ? subtotal * taxRate_n / 100 : 0;
  const total      = subtotal + taxAmount;
  return { transport, subtotal, taxAmount, total };
}

// Derive status from paid/total/dueDate if not explicitly set
function _invAutoStatus(inv) {
  if (['draft','cancelled'].includes(inv.status)) return inv.status;
  const balance = (inv.total || 0) - (inv.paid || 0);
  if (balance <= 0)                        return 'paid';
  if ((inv.paid || 0) > 0)                 return 'partially-paid';
  if (inv.dueDate && daysFromNow(inv.dueDate) < 0) return 'overdue';
  if (inv.status === 'issued')             return 'issued';
  return inv.status || 'draft';
}

// ── Aggregate stats ──────────────────────────────────────────────────────────
function _invStats(invoices) {
  const total       = invoices.reduce((s,i) => s + (i.total || 0), 0);
  const collected   = invoices.reduce((s,i) => s + (i.paid  || 0), 0);
  const outstanding = total - collected;
  const byStatus    = {};
  invoices.forEach(i => { byStatus[i.status] = (byStatus[i.status] || 0) + 1; });
  return { total, collected, outstanding, byStatus };
}

// Auto-generate next invoice number
function _nextInvoiceNo() {
  const existing = KKR.getInvoices().map(i => i.id);
  const year     = new Date().getFullYear();
  const base     = `INV-${year}-`;
  const nums     = existing
    .filter(id => id && id.startsWith(base))
    .map(id => parseInt(id.replace(base, '')) || 0);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return base + String(next).padStart(3, '0');
}

// ── Main render ──────────────────────────────────────────────────────────────
function renderBilling() {
  const allInvoices = KKR.getInvoices();
  const allStats    = _invStats(allInvoices);
  const customers   = KKR.getCustomers();

  let rows = [...allInvoices];
  if (billFilter.status)   rows = rows.filter(i => i.status === billFilter.status);
  if (billFilter.customer) rows = rows.filter(i => i.customer === billFilter.customer);
  if (billFilter.q) {
    const q = billFilter.q.toLowerCase();
    rows = rows.filter(i =>
      (i.id || '').toLowerCase().includes(q) ||
      KKR.customerName(i.customer).toLowerCase().includes(q) ||
      (i.tripIds || []).join(' ').toLowerCase().includes(q)
    );
  }
  rows = [...rows].sort((a, b) => b.date.localeCompare(a.date));

  return `
  <div class="page-content">

    <!-- ── Header ────────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Billing &amp; Invoices</div>
        <div class="subtitle">${allInvoices.length} invoice${allInvoices.length!==1?'s':''} · Outstanding: ${fmtCurrency(allStats.outstanding)}</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportInvCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-primary" onclick="openInvoiceForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Invoice
        </button>
      </div>
    </div>

    <!-- ── KPI strip ─────────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px" class="inv-kpi-strip">
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:18px;font-weight:800;color:#60a5fa">${fmtCurrency(allStats.total)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Total Billed</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:18px;font-weight:800;color:#34d399">${fmtCurrency(allStats.collected)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Collected</div>
      </div>
      <div class="card card-sm ${billFilter.status==='overdue'?'inv-kpi-active':''}" style="text-align:center;cursor:pointer" onclick="billFilter.status=billFilter.status==='overdue'?'':'overdue';rerenderPage()">
        <div style="font-size:18px;font-weight:800;color:#f87171">${fmtCurrency(allStats.outstanding)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Outstanding</div>
      </div>
      ${INV_STATUSES.filter(s => ['draft','issued','partially-paid','overdue'].includes(s.value)).map(s => `
        <div class="card card-sm ${billFilter.status===s.value?'inv-kpi-active':''}"
          style="text-align:center;cursor:pointer;transition:all .15s"
          onclick="billFilter.status=billFilter.status==='${s.value}'?'':'${s.value}';rerenderPage()">
          <div style="font-size:20px;font-weight:800;color:${s.color}">${allStats.byStatus[s.value]||0}</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.label}</div>
        </div>`).join('')}
    </div>

    <!-- ── Table ─────────────────────────────────────────────────── -->
    <div class="card">
      <div class="filter-bar" style="margin-bottom:16px;flex-wrap:wrap">
        <div class="search-input-wrap" style="flex:1;min-width:180px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search invoice no., customer, trip…"
            value="${billFilter.q}" oninput="billFilter.q=this.value;rerenderPage()">
        </div>
        <select class="form-control" style="width:165px" onchange="billFilter.status=this.value;rerenderPage()">
          <option value="">All Statuses</option>
          ${INV_STATUSES.map(s =>
            `<option value="${s.value}" ${billFilter.status===s.value?'selected':''}>${s.label}</option>`
          ).join('')}
        </select>
        <select class="form-control" style="width:175px" onchange="billFilter.customer=this.value;rerenderPage()">
          <option value="">All Customers</option>
          ${customers.map(c =>
            `<option value="${c.id}" ${billFilter.customer===c.id?'selected':''}>${c.name}</option>`
          ).join('')}
        </select>
        ${billFilter.q||billFilter.status||billFilter.customer
          ? `<button class="btn btn-secondary btn-sm" onclick="billFilter={q:'',status:'',customer:''};rerenderPage()">Clear</button>` : ''}
        <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${rows.length} of ${allInvoices.length}</span>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice No.</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Customer</th>
              <th>Trip(s)</th>
              <th style="text-align:right">Transport</th>
              <th style="text-align:right">Other</th>
              <th style="text-align:right">Tax</th>
              <th style="text-align:right">Total</th>
              <th style="text-align:right">Paid</th>
              <th style="text-align:right">Balance</th>
              <th>Status</th>
              <th style="text-align:center">Actions</th>
            </tr>
          </thead>
          <tbody>
          ${rows.length === 0 ? `
            <tr><td colspan="13" style="padding:56px;text-align:center;color:var(--text-muted)">
              <div style="font-size:32px;margin-bottom:8px">📄</div>
              <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No invoices found</div>
              <div style="font-size:12px">${billFilter.q||billFilter.status||billFilter.customer?'Try clearing filters':'Click "New Invoice" to create your first invoice'}</div>
            </td></tr>` :
            rows.map(inv => {
              const bal     = (inv.total || 0) - (inv.paid || 0);
              const due     = daysFromNow(inv.dueDate);
              const dueCol  = due !== null && due < 0 ? '#f87171' : due !== null && due < 7 ? '#fbbf24' : 'inherit';
              const status  = _invAutoStatus(inv);
              const trips   = (inv.tripIds || []).slice(0, 2).join(', ') + ((inv.tripIds||[]).length > 2 ? '…' : '');
              return `
              <tr>
                <td>
                  <span class="font-bold text-blue" style="cursor:pointer" onclick="viewInvoice('${inv.id}')">${inv.id}</span>
                </td>
                <td style="white-space:nowrap">${fmtDate(inv.date)}</td>
                <td style="color:${dueCol};white-space:nowrap">
                  ${fmtDate(inv.dueDate)}
                  ${due !== null && due < 0 ? `<small style="font-size:10px">(${Math.abs(due)}d ago)</small>` :
                    due !== null && due <= 7 ? `<small style="font-size:10px">(${due}d)</small>` : ''}
                </td>
                <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${KKR.customerName(inv.customer)}</td>
                <td style="font-size:11px;color:var(--text-muted)">${trips || '—'}</td>
                <td class="text-right">${fmtCurrency(inv.transportationCharges || inv.subtotal || 0)}</td>
                <td class="text-right">${fmtCurrency(inv.otherCharges || 0)}</td>
                <td class="text-right" style="color:var(--text-muted)">${inv.taxAmount > 0 ? fmtCurrency(inv.taxAmount) : '—'}</td>
                <td class="text-right font-bold">${fmtCurrency(inv.total || 0)}</td>
                <td class="text-right" style="color:#34d399">${fmtCurrency(inv.paid || 0)}</td>
                <td class="text-right font-bold" style="color:${bal > 0 ? '#fbbf24' : '#34d399'}">${fmtCurrency(bal)}</td>
                <td>${statusBadge(status)}</td>
                <td>
                  <div class="flex gap-2" style="justify-content:center">
                    <button class="btn btn-xs btn-secondary" title="Preview" onclick="viewInvoice('${inv.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="btn btn-xs btn-secondary" title="Edit" onclick="openInvoiceForm('${inv.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-xs btn-danger" title="Delete" onclick="deleteInvoice('${inv.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
          ${rows.length > 0 ? `
          <tfoot>
            <tr style="border-top:2px solid var(--border);background:rgba(37,99,235,0.04)">
              <td colspan="8" style="padding:11px 16px;font-weight:700;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">
                Totals (${rows.length})
              </td>
              <td class="text-right font-bold" style="padding:11px 16px;color:#60a5fa">${fmtCurrency(rows.reduce((s,i)=>s+(i.total||0),0))}</td>
              <td class="text-right font-bold" style="padding:11px 16px;color:#34d399">${fmtCurrency(rows.reduce((s,i)=>s+(i.paid||0),0))}</td>
              <td class="text-right font-bold" style="padding:11px 16px;color:#fbbf24">${fmtCurrency(rows.reduce((s,i)=>s+(i.total||0)-(i.paid||0),0))}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
    </div>

  </div>

  <!-- ── Add / Edit modal ─────────────────────────────────────────── -->
  <div class="modal-overlay" id="inv-form-modal">
    <div class="modal" style="max-width:820px">
      <div class="modal-header">
        <div class="modal-title" id="inv-form-title">New Invoice</div>
        <button class="modal-close" onclick="closeModal('inv-form-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="inv-form-body"></div>
    </div>
  </div>

  <!-- ── Preview modal ────────────────────────────────────────────── -->
  <div class="modal-overlay" id="inv-preview-modal">
    <div class="modal" style="max-width:780px">
      <div class="modal-header">
        <div class="modal-title" id="inv-preview-title">Invoice Preview</div>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-secondary" onclick="invPrint()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print / PDF
          </button>
          <button class="btn btn-sm btn-secondary" onclick="openInvoiceForm(_viewInvoiceId)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button class="modal-close" onclick="closeModal('inv-preview-modal')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="modal-body" id="inv-preview-body" style="padding:0"></div>
    </div>
  </div>

  <style>
    .inv-kpi-active { border-color:#2563eb!important;background:rgba(37,99,235,0.06)!important; }
    @media(max-width:1000px){ .inv-kpi-strip{grid-template-columns:repeat(3,1fr)!important} }
    @media(max-width:600px) { .inv-kpi-strip{grid-template-columns:repeat(2,1fr)!important} }
  </style>`;
}

// ── Add / Edit form ──────────────────────────────────────────────────────────
function openInvoiceForm(id = null) {
  editingInvoiceId = id;
  const inv      = id ? (KKR.getInvoices().find(x => x.id === id) || {}) : {};
  const customers = KKR.getCustomers();
  const trips     = KKR.getTrips().filter(t => t.status !== 'cancelled');
  const vehicles  = KKR.getVehicles();
  const materials = KKR.getMaterials();
  const nextNo    = _nextInvoiceNo();

  document.getElementById('inv-form-title').textContent = id ? `Edit Invoice — ${id}` : 'New Invoice';

  document.getElementById('inv-form-body').innerHTML = `
    <form onsubmit="saveInvoice(event)" autocomplete="off">

      <!-- ─ Header ─────────────────────────────────────────────────── -->
      <div class="inv-form-sec">Invoice Details</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Invoice No. <span style="color:#f87171">*</span></label>
          <input class="form-control" id="if-id"
            value="${inv.id || nextNo}"
            ${id ? 'readonly style="opacity:.65;cursor:not-allowed"' : ''} required>
        </div>
        <div class="form-group">
          <label class="form-label">Invoice Date <span style="color:#f87171">*</span></label>
          <input type="date" class="form-control" id="if-date"
            value="${fmtDateInput(inv.date || today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input type="date" class="form-control" id="if-due"
            value="${fmtDateInput(inv.dueDate || '')}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Customer <span style="color:#f87171">*</span></label>
          <select class="form-control" id="if-customer" required>
            <option value="">— Select Customer —</option>
            ${customers.map(c =>
              `<option value="${c.id}" ${inv.customer===c.id?'selected':''}>${c.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="if-status">
            ${INV_STATUSES.map(s =>
              `<option value="${s.value}" ${(inv.status||'draft')===s.value?'selected':''}>${s.label}</option>`
            ).join('')}
          </select>
        </div>
      </div>

      <!-- ─ Trip / Vehicle / Material ──────────────────────────────── -->
      <div class="inv-form-sec" style="margin-top:18px">Trip &amp; Cargo</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Link Trip</label>
          <select class="form-control" id="if-trip" onchange="invAutoFillFromTrip(this.value)">
            <option value="">— None —</option>
            ${trips.map(t => {
              const from = t.loadingPoint || t.from || '';
              const to   = t.destination  || t.to   || '';
              const sel  = (inv.tripIds||[]).includes(t.id) || inv.tripId === t.id;
              return `<option value="${t.id}" ${sel?'selected':''}>${t.id}${from?' · '+from+'→'+to:''}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Vehicle</label>
          <select class="form-control" id="if-vehicle">
            <option value="">— None —</option>
            ${vehicles.map(v =>
              `<option value="${v.id}" ${inv.vehicle===v.id?'selected':''}>${v.regNo} · ${v.make} ${v.model}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Material</label>
          <select class="form-control" id="if-material">
            <option value="">— None —</option>
            ${materials.map(m =>
              `<option value="${m.id}" ${inv.material===m.id?'selected':''}>${m.name} (${m.unit})</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantity (MT)</label>
          <input type="number" step="0.01" class="form-control" id="if-qty"
            value="${inv.quantity ?? ''}" placeholder="0.00"
            min="0" oninput="invCalc()">
        </div>
        <div class="form-group">
          <label class="form-label">Rate (₹/MT)</label>
          <input type="number" step="0.01" class="form-control" id="if-rate"
            value="${inv.rate ?? ''}" placeholder="0.00"
            min="0" oninput="invCalc()">
        </div>
      </div>

      <!-- ─ Charges ─────────────────────────────────────────────────── -->
      <div class="inv-form-sec" style="margin-top:18px">Charges &amp; Tax</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Transportation Charges (₹)</label>
          <input type="number" step="0.01" class="form-control" id="if-transport"
            value="${inv.transportationCharges ?? ''}" placeholder="Auto: qty × rate"
            min="0" oninput="invCalc(true)">
          <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Leave blank to auto-calc from qty × rate</div>
        </div>
        <div class="form-group">
          <label class="form-label">Other Charges (₹)</label>
          <input type="number" step="0.01" class="form-control" id="if-other"
            value="${inv.otherCharges ?? ''}" placeholder="Loading, port, etc."
            min="0" oninput="invCalc()">
        </div>
        <div class="form-group">
          <label class="form-label">Discount (₹)</label>
          <input type="number" step="0.01" class="form-control" id="if-discount"
            value="${inv.discount ?? 0}" placeholder="0.00"
            min="0" oninput="invCalc()">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tax Rate (%)</label>
          <select class="form-control" id="if-taxrate" onchange="invCalc()">
            ${[0, 5, 12, 18, 28].map(r =>
              `<option value="${r}" ${(inv.taxRate||0)==r?'selected':''}>${r === 0 ? 'No Tax (0%)' : `GST ${r}%`}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tax Amount (₹)</label>
          <input type="number" class="form-control" id="if-taxamt"
            value="${inv.taxAmount ?? 0}" readonly
            style="background:rgba(37,99,235,0.05);cursor:not-allowed">
        </div>
      </div>

      <!-- ─ Live calc summary ───────────────────────────────────────── -->
      <div style="background:rgba(37,99,235,0.06);border:1px solid rgba(37,99,235,0.2);border-radius:10px;padding:16px 20px;margin-bottom:18px" id="inv-calc-box">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;text-align:center">
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Transport</div>
            <div style="font-size:18px;font-weight:800;color:#60a5fa" id="inv-disp-trans">₹0</div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Subtotal</div>
            <div style="font-size:18px;font-weight:800;color:#94a3b8" id="inv-disp-sub">₹0</div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Tax</div>
            <div style="font-size:18px;font-weight:800;color:#fbbf24" id="inv-disp-tax">₹0</div>
          </div>
          <div style="border-left:2px solid rgba(37,99,235,0.25);padding-left:16px">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Invoice Total</div>
            <div style="font-size:24px;font-weight:900;color:#34d399" id="inv-disp-total">₹0</div>
          </div>
        </div>
      </div>

      <!-- ─ Payment ─────────────────────────────────────────────────── -->
      <div class="inv-form-sec">Payment</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount Already Paid (₹)</label>
          <input type="number" step="0.01" class="form-control" id="if-paid"
            value="${inv.paid ?? 0}" min="0">
        </div>
      </div>

      <!-- ─ Notes ──────────────────────────────────────────────────── -->
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="if-notes" rows="2"
          placeholder="Terms, remarks, special instructions…">${inv.notes || ''}</textarea>
      </div>

      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('inv-form-modal')">Cancel</button>
        <button type="button" class="btn btn-secondary" onclick="saveAndPreview()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Save &amp; Preview
        </button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update Invoice' : 'Create Invoice'}
        </button>
      </div>
    </form>
    <style>
      .inv-form-sec{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
    </style>`;

  openModal('inv-form-modal');
  invCalc(); // populate display for existing invoice
}

// ── Auto-fill from trip ───────────────────────────────────────────────────────
function invAutoFillFromTrip(tripId) {
  if (!tripId) return;
  const t = KKR.getTrips().find(x => x.id === tripId);
  if (!t) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null && el.value === '') el.value = val; };
  const force = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null) el.value = val; };

  force('if-vehicle',   t.vehicle);
  force('if-material',  t.material);
  set('if-qty',   t.quantity   || t.billedWt  || '');
  set('if-rate',  t.rate       || '');
  // Auto-set customer if not already chosen
  const custEl = document.getElementById('if-customer');
  if (custEl && !custEl.value && t.customer) custEl.value = t.customer;

  invCalc();
}

// ── Live calculation in form ──────────────────────────────────────────────────
function invCalc(transportManual = false) {
  const qty         = document.getElementById('if-qty')?.value;
  const rate        = document.getElementById('if-rate')?.value;
  const transportEl = document.getElementById('if-transport');
  const otherVal    = document.getElementById('if-other')?.value;
  const discount    = document.getElementById('if-discount')?.value;
  const taxRate     = document.getElementById('if-taxrate')?.value;

  // If transport field is empty, auto-fill from qty × rate
  const transportOverride = (transportEl && transportEl.value !== '') ? transportEl.value : null;
  const c = _invCalc(qty, rate, otherVal, taxRate, discount, transportOverride);

  // Update transport field if auto
  if (!transportManual && transportEl && transportEl.value === '') {
    // leave blank — placeholder shows auto
  }
  if (!transportManual && transportEl) {
    const autoVal = (parseFloat(qty)||0) * (parseFloat(rate)||0);
    if (autoVal > 0 && transportEl.value === '') {
      // still blank — that's fine, placeholder shows it
    }
  }

  // Update tax amount field
  const taxAmtEl = document.getElementById('if-taxamt');
  if (taxAmtEl) taxAmtEl.value = c.taxAmount.toFixed(2);

  // Update display
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = fmtCurrency(val); };
  set('inv-disp-trans', c.transport);
  set('inv-disp-sub',   c.subtotal);
  set('inv-disp-tax',   c.taxAmount);
  set('inv-disp-total', c.total);
}

// ── Save invoice ──────────────────────────────────────────────────────────────
function saveInvoice(e) {
  if (e) e.preventDefault();

  const qty           = document.getElementById('if-qty').value;
  const rate          = document.getElementById('if-rate').value;
  const transportEl   = document.getElementById('if-transport');
  const otherCharges  = parseFloat(document.getElementById('if-other').value)    || 0;
  const discount      = parseFloat(document.getElementById('if-discount').value) || 0;
  const taxRate       = parseFloat(document.getElementById('if-taxrate').value)  || 0;
  const transportOvr  = transportEl && transportEl.value !== '' ? transportEl.value : null;
  const c             = _invCalc(qty, rate, otherCharges, taxRate, discount, transportOvr);

  const tripIdVal     = document.getElementById('if-trip').value;
  const invs          = KKR.getInvoices();
  const existing      = editingInvoiceId ? invs.find(x => x.id === editingInvoiceId) : null;

  const inv = {
    id:                    document.getElementById('if-id').value.trim() || _nextInvoiceNo(),
    date:                  document.getElementById('if-date').value,
    dueDate:               document.getElementById('if-due').value,
    customer:              document.getElementById('if-customer').value,
    status:                document.getElementById('if-status').value,
    // Trip / cargo
    tripId:                tripIdVal,
    tripIds:               tripIdVal ? [tripIdVal] : (existing?.tripIds || []),
    vehicle:               document.getElementById('if-vehicle').value,
    material:              document.getElementById('if-material').value,
    quantity:              parseFloat(qty)  || 0,
    rate:                  parseFloat(rate) || 0,
    // Charges
    transportationCharges: c.transport,
    otherCharges,
    discount,
    taxRate,
    taxAmount:             c.taxAmount,
    subtotal:              c.subtotal,
    total:                 c.total,
    // Payment
    paid:                  parseFloat(document.getElementById('if-paid').value) || 0,
    // Notes
    notes:                 document.getElementById('if-notes').value.trim(),
  };

  // Derive status from payment if not explicitly overridden to cancelled/draft
  if (!['draft','cancelled'].includes(inv.status)) {
    inv.status = _invAutoStatus(inv);
  }

  const idx = invs.findIndex(x => x.id === editingInvoiceId);
  if (idx >= 0) invs[idx] = inv; else invs.unshift(inv);
  KKR.saveInvoices(invs);

  return inv; // return for save-and-preview
}

function saveAndPreview() {
  // Validate form first
  const form = document.querySelector('#inv-form-body form');
  if (form && !form.checkValidity()) { form.reportValidity(); return; }
  const inv = saveInvoice(null);
  closeModal('inv-form-modal');
  toast(`Invoice ${inv.id} saved`, 'success');
  rerenderPage();
  setTimeout(() => viewInvoice(inv.id), 200);
}

// Override submit to also update rerenderPage
const _origSaveInvoice = saveInvoice;
function saveInvoice(e) {
  const inv = _origSaveInvoice(e);
  if (e) { // called from form submit
    closeModal('inv-form-modal');
    toast(editingInvoiceId ? `Invoice ${inv.id} updated` : `Invoice ${inv.id} created`, 'success');
    editingInvoiceId = null;
    rerenderPage();
  }
  return inv;
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteInvoice(id) {
  const inv = KKR.getInvoices().find(x => x.id === id);
  confirmDelete(inv ? `${inv.id} — ${KKR.customerName(inv.customer)}` : id, () => {
    KKR.saveInvoices(KKR.getInvoices().filter(x => x.id !== id));
    toast('Invoice deleted', 'error');
    rerenderPage();
  });
}

// ── Invoice preview ───────────────────────────────────────────────────────────
function viewInvoice(id) {
  _viewInvoiceId = id;
  const inv   = KKR.getInvoices().find(x => x.id === id);
  if (!inv) return;
  const s      = KKR.getSettings();
  const cust   = KKR.getCustomers().find(c => c.id === inv.customer) || {};
  const status = _invAutoStatus(inv);
  const bal    = (inv.total || 0) - (inv.paid || 0);
  const transport = inv.transportationCharges || inv.subtotal || 0;

  // Also close form modal if open
  const formModal = document.getElementById('inv-form-modal');
  if (formModal && formModal.classList.contains('open')) {
    formModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  document.getElementById('inv-preview-title').textContent = `Invoice — ${inv.id}`;

  document.getElementById('inv-preview-body').innerHTML = `
    <div id="printable-invoice-${id}" style="background:#fff;color:#1a1a1a;padding:40px 44px;min-height:500px">

      <!-- Company header -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
            <div style="width:44px;height:44px;background:linear-gradient(135deg,#1d4ed8,#2563eb);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;color:#fff;flex-shrink:0">KK</div>
            <div>
              <div style="font-size:20px;font-weight:800;color:#111">${s.businessName || 'KKR Logistics'}</div>
              <div style="font-size:11px;color:#666;margin-top:1px">Freight &amp; Logistics</div>
            </div>
          </div>
          <div style="font-size:12px;color:#555;line-height:1.6">
            ${s.address ? `<div>${s.address}</div>` : ''}
            ${s.phone   ? `<div>📞 ${s.phone}</div>` : ''}
            ${s.email   ? `<div>✉ ${s.email}</div>` : ''}
            ${s.gstin   ? `<div style="font-weight:600">GSTIN: ${s.gstin}</div>` : ''}
            ${s.pan     ? `<div>PAN: ${s.pan}</div>` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:32px;font-weight:900;color:#2563eb;letter-spacing:-1px">INVOICE</div>
          <div style="font-size:16px;font-weight:800;color:#111;margin-top:4px">${inv.id}</div>
          <div style="margin-top:10px;font-size:12px;color:#555;line-height:1.8">
            <div><span style="color:#999">Date:</span> <strong>${fmtDate(inv.date)}</strong></div>
            ${inv.dueDate ? `<div><span style="color:#999">Due:</span> <strong style="color:${daysFromNow(inv.dueDate)<0?'#e53e3e':'#111'}">${fmtDate(inv.dueDate)}</strong></div>` : ''}
          </div>
          <div style="margin-top:10px">${statusBadge(status)}</div>
        </div>
      </div>

      <!-- Bill from / to -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:28px;padding:20px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
        <div>
          <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Bill From</div>
          <div style="font-weight:700;font-size:14px;color:#111">${s.businessName || 'KKR Logistics'}</div>
          <div style="font-size:12px;color:#555;margin-top:4px;line-height:1.6">
            ${s.phone ? s.phone + '<br>' : ''}${s.email || ''}
          </div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Bill To</div>
          <div style="font-weight:700;font-size:14px;color:#111">${cust.name || inv.customer}</div>
          <div style="font-size:12px;color:#555;margin-top:4px;line-height:1.6">
            ${cust.contact ? cust.contact+'<br>' : ''}
            ${cust.address ? cust.address+'<br>' : ''}
            ${cust.gstin   ? '<span style="font-weight:600">GSTIN: '+cust.gstin+'</span>' : ''}
          </div>
        </div>
      </div>

      <!-- Trip / cargo info -->
      ${(inv.tripId || inv.vehicle || inv.material) ? `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;padding:14px 18px;background:#f1f5f9;border-radius:8px;border:1px solid #e2e8f0">
        ${inv.tripId ? `<div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;font-weight:700">Trip</div><div style="font-size:13px;font-weight:700;color:#2563eb;margin-top:3px">${inv.tripId}</div></div>` : ''}
        ${inv.vehicle ? `<div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;font-weight:700">Vehicle</div><div style="font-size:13px;font-weight:600;color:#111;margin-top:3px">${KKR.vehicleReg(inv.vehicle)}</div></div>` : ''}
        ${inv.material ? `<div><div style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;font-weight:700">Material</div><div style="font-size:13px;font-weight:600;color:#111;margin-top:3px">${KKR.materialName(inv.material)}</div></div>` : ''}
      </div>` : ''}

      <!-- Line items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px">
        <thead>
          <tr style="background:#1e3a5f">
            <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;border-radius:6px 0 0 0">#</th>
            <th style="padding:12px 16px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff">Description</th>
            <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff">Qty (MT)</th>
            <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff">Rate (₹/MT)</th>
            <th style="padding:12px 16px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff;border-radius:0 6px 0 0">Amount</th>
          </tr>
        </thead>
        <tbody>
          <!-- Transportation row -->
          <tr style="border-bottom:1px solid #e2e8f0">
            <td style="padding:14px 16px;font-size:13px;color:#64748b">1</td>
            <td style="padding:14px 16px">
              <div style="font-weight:600;font-size:13px;color:#111">Transportation / Freight Charges</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px">
                ${inv.material ? KKR.materialName(inv.material) : 'As per agreement'}
                ${inv.tripId ? ' · Trip ' + inv.tripId : ''}
              </div>
            </td>
            <td style="padding:14px 16px;text-align:right;font-size:13px">${inv.quantity > 0 ? fmtNum(inv.quantity,2) : '—'}</td>
            <td style="padding:14px 16px;text-align:right;font-size:13px">${inv.rate > 0 ? fmtCurrency(inv.rate) : '—'}</td>
            <td style="padding:14px 16px;text-align:right;font-size:13px;font-weight:600">${fmtCurrency(transport)}</td>
          </tr>
          <!-- Other charges row (if any) -->
          ${(inv.otherCharges || 0) > 0 ? `
          <tr style="border-bottom:1px solid #e2e8f0">
            <td style="padding:12px 16px;font-size:13px;color:#64748b">2</td>
            <td style="padding:12px 16px"><div style="font-weight:600;font-size:13px;color:#111">Other Charges</div><div style="font-size:11px;color:#64748b">Loading / unloading / port / misc.</div></td>
            <td colspan="2" style="padding:12px 16px"></td>
            <td style="padding:12px 16px;text-align:right;font-size:13px;font-weight:600">${fmtCurrency(inv.otherCharges)}</td>
          </tr>` : ''}
        </tbody>
        <tfoot>
          <!-- Subtotal -->
          <tr style="background:#f8fafc">
            <td colspan="4" style="padding:10px 16px;text-align:right;font-size:12px;color:#64748b;font-weight:600">Subtotal</td>
            <td style="padding:10px 16px;text-align:right;font-size:13px;font-weight:700">${fmtCurrency(inv.subtotal || (transport + (inv.otherCharges||0)))}</td>
          </tr>
          <!-- Discount -->
          ${(inv.discount || 0) > 0 ? `
          <tr style="background:#f8fafc">
            <td colspan="4" style="padding:8px 16px;text-align:right;font-size:12px;color:#059669;font-weight:600">Discount</td>
            <td style="padding:8px 16px;text-align:right;font-size:13px;color:#059669;font-weight:600">— ${fmtCurrency(inv.discount)}</td>
          </tr>` : ''}
          <!-- Tax -->
          ${(inv.taxRate || 0) > 0 ? `
          <tr style="background:#f8fafc">
            <td colspan="4" style="padding:8px 16px;text-align:right;font-size:12px;color:#64748b;font-weight:600">GST @ ${inv.taxRate}%</td>
            <td style="padding:8px 16px;text-align:right;font-size:13px;color:#d97706;font-weight:600">${fmtCurrency(inv.taxAmount || 0)}</td>
          </tr>` : ''}
          <!-- Grand total -->
          <tr style="background:#1e3a5f">
            <td colspan="4" style="padding:14px 16px;text-align:right;font-size:14px;font-weight:800;color:#fff;border-radius:0 0 0 6px">TOTAL AMOUNT</td>
            <td style="padding:14px 16px;text-align:right;font-size:16px;font-weight:900;color:#60a5fa;border-radius:0 0 6px 0">${fmtCurrency(inv.total || 0)}</td>
          </tr>
          <!-- Paid / balance -->
          ${(inv.paid || 0) > 0 ? `
          <tr>
            <td colspan="4" style="padding:10px 16px;text-align:right;font-size:12px;color:#059669;font-weight:600">Amount Paid</td>
            <td style="padding:10px 16px;text-align:right;font-size:13px;color:#059669;font-weight:700">${fmtCurrency(inv.paid)}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding:10px 16px;text-align:right;font-size:13px;font-weight:800;color:${bal>0?'#e53e3e':'#059669'}">Balance Due</td>
            <td style="padding:10px 16px;text-align:right;font-size:15px;font-weight:900;color:${bal>0?'#e53e3e':'#059669'}">${fmtCurrency(bal)}</td>
          </tr>` : ''}
        </tfoot>
      </table>

      <!-- Bank / payment details -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:28px;padding:16px 20px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
        <div>
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Bank Details</div>
          <div style="font-size:12px;color:#555;line-height:1.8">
            ${s.bankName   ? `<div><span style="color:#999">Bank:</span> <strong>${s.bankName}</strong></div>`   : ''}
            ${s.accountNo  ? `<div><span style="color:#999">A/C:</span> <strong>${s.accountNo}</strong></div>`   : ''}
            ${s.ifsc       ? `<div><span style="color:#999">IFSC:</span> <strong>${s.ifsc}</strong></div>`        : ''}
          </div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Terms &amp; Notes</div>
          <div style="font-size:12px;color:#555;line-height:1.6">
            ${inv.dueDate ? `Payment due by <strong>${fmtDate(inv.dueDate)}</strong><br>` : ''}
            ${inv.notes || 'Thank you for your business.'}
          </div>
        </div>
      </div>

      <!-- Signature strip -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px">
        <div style="border-top:1px solid #cbd5e1;padding-top:8px;text-align:center;font-size:11px;color:#94a3b8">
          Authorised Signatory<br>${s.businessName || 'KKR Logistics'}
        </div>
        <div style="border-top:1px solid #cbd5e1;padding-top:8px;text-align:center;font-size:11px;color:#94a3b8">
          Receiver's Signature<br>${cust.name || ''}
        </div>
      </div>

    </div>`;

  openModal('inv-preview-modal');
}

// ── Print / PDF ───────────────────────────────────────────────────────────────
function invPrint() {
  if (!_viewInvoiceId) return;
  const content = document.getElementById(`printable-invoice-${_viewInvoiceId}`);
  if (!content) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <title>Invoice ${_viewInvoiceId}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @media print {
        @page { size: A4; margin: 10mm; }
        button, .no-print { display: none !important; }
      }
    </style>
  </head><body>${content.outerHTML}
  <div class="no-print" style="margin:20px;text-align:center">
    <button onclick="window.print()" style="padding:12px 28px;background:#2563eb;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">
      🖨 Print / Save as PDF
    </button>
    <p style="margin-top:8px;font-size:12px;color:#666">Use your browser's "Save as PDF" option to download</p>
  </div>
  </body></html>`);
  win.document.close();
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportInvCSV() {
  const rows = KKR.getInvoices().map(inv => ({
    'Invoice No':       inv.id,
    'Date':             inv.date,
    'Due Date':         inv.dueDate || '',
    'Customer':         KKR.customerName(inv.customer),
    'Trip':             (inv.tripIds||[]).join('; ') || inv.tripId || '',
    'Vehicle':          KKR.vehicleReg(inv.vehicle)  || '',
    'Material':         KKR.materialName(inv.material) || '',
    'Quantity (MT)':    inv.quantity    || 0,
    'Rate (₹/MT)':      inv.rate        || 0,
    'Transportation':   inv.transportationCharges || inv.subtotal || 0,
    'Other Charges':    inv.otherCharges || 0,
    'Discount':         inv.discount    || 0,
    'Tax Rate (%)':     inv.taxRate     || 0,
    'Tax Amount':       inv.taxAmount   || 0,
    'Total':            inv.total       || 0,
    'Paid':             inv.paid        || 0,
    'Balance':          (inv.total||0) - (inv.paid||0),
    'Status':           inv.status,
    'Notes':            inv.notes       || '',
  }));
  exportCSV(Object.keys(rows[0] || {}), rows, `kkr-invoices-${today()}.csv`);
  toast('Invoices exported', 'success');
}

// ── Backward-compat aliases ───────────────────────────────────────────────────
function openInvoiceModal(id = null) { openInvoiceForm(id); }
function printCurrentInvoice()       { invPrint(); }
function calcInvTotal()              { invCalc(); }
