// ============================================================
// KKR Logistics — Central Export & Print Hub
// All export/print functions that were missing from individual
// page modules live here.  Functions already defined in page
// files (exportTripsCSV, exportFuelCSV, etc.) are NOT
// duplicated — this file only adds what was absent.
// ============================================================

// ── Shared SVG icon snippets (inline, no dependency on icon()) ──────────────
const _EXPORT_SVG  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
const _PRINT_SVG   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;

// ── Helper: open print window ──────────────────────────────────────────────
function _printWin(title, bodyHtml) {
  const s   = KKR.getSettings();
  const biz = s.businessName || 'KKR Logistics';
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>${title} — ${biz}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;padding:24px;color:#111}
      h2{margin-bottom:4px}
      .sub{color:#666;font-size:13px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}
      th{background:#f0f4f8;padding:8px 10px;text-align:left;border:1px solid #d1d5db;font-size:11px;text-transform:uppercase;letter-spacing:.4px}
      td{padding:8px 10px;border:1px solid #e5e7eb}
      tr:nth-child(even) td{background:#f9fafb}
      tfoot td{font-weight:700;background:#f0f4f8;border-top:2px solid #9ca3af}
      .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700}
      .no-print{margin-top:20px;text-align:center}
      @media print{.no-print{display:none}@page{margin:10mm;size:A4}}
    </style>
  </head><body>
    <h2>${biz} — ${title}</h2>
    <p class="sub">Printed on ${new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})}</p>
    ${bodyHtml}
    <div class="no-print">
      <button onclick="window.print()" style="padding:10px 24px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer">🖨 Print / Save PDF</button>
    </div>
  </body></html>`);
  win.document.close();
}

// ============================================================
// MATERIALS
// ============================================================
function exportMaterialsCSV() {
  const rows = KKR.getMaterials().map(m => {
    const trips  = KKR.getTrips().filter(t => t.material === m.id && t.status !== 'cancelled');
    const wb     = KKR.getWeighbridge().filter(w => w.material === m.id);
    return {
      'ID':           m.id,
      'Name':         m.name,
      'Category':     m.category,
      'Unit':         m.unit,
      'Density':      m.density  || '',
      'Trip Count':   trips.length,
      'Total Qty (MT)': trips.reduce((s,t) => s+(t.quantity||t.billedWt||0),0).toFixed(2),
      'WB Net (MT)':  wb.reduce((s,w) => s+(w.net||0),0).toFixed(2),
      'Notes':        m.notes    || '',
    };
  });
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-materials-${today()}.csv`);
  toast('Materials exported', 'success');
}

function printMaterials() {
  const rows = KKR.getMaterials();
  const html = `<table>
    <thead><tr><th>Name</th><th>Category</th><th>Unit</th><th>Density</th><th>Trips</th><th>Total Qty (MT)</th><th>Notes</th></tr></thead>
    <tbody>
    ${rows.map(m => {
      const trips = KKR.getTrips().filter(t => t.material === m.id && t.status !== 'cancelled');
      return `<tr>
        <td>${m.name}</td><td>${m.category}</td><td>${m.unit}</td>
        <td>${m.density||'—'}</td><td>${trips.length}</td>
        <td>${trips.reduce((s,t)=>s+(t.quantity||t.billedWt||0),0).toFixed(2)}</td>
        <td>${m.notes||'—'}</td>
      </tr>`;}).join('')}
    </tbody>
    <tfoot><tr>
      <td colspan="4"><strong>Total (${rows.length} materials)</strong></td>
      <td><strong>${KKR.getTrips().filter(t=>t.status!=='cancelled').length}</strong></td>
      <td><strong>${KKR.getTrips().filter(t=>t.status!=='cancelled').reduce((s,t)=>s+(t.quantity||t.billedWt||0),0).toFixed(2)} MT</strong></td>
      <td></td>
    </tr></tfoot>
  </table>`;
  _printWin('Materials List', html);
}

// ============================================================
// DOCUMENTS
// ============================================================
function exportDocumentsCSV() {
  const rows = KKR.getDocuments().map(d => ({
    'Name':       d.name,
    'Type':       d.type,
    'File Type':  d.fileType || '',
    'Vehicle':    KKR.vehicleReg(d.vehicle) || '',
    'Driver':     d.driver ? KKR.driverName(d.driver) : '',
    'Expiry':     d.expiry   || '',
    'Days Left':  d.expiry   ? (daysFromNow(d.expiry) ?? '') : '',
    'Uploaded':   d.uploaded || '',
    'Size':       d.size     || '',
  }));
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-documents-${today()}.csv`);
  toast('Documents exported', 'success');
}

function exportExpiringDocumentsCSV() {
  const rows = KKR.getDocuments()
    .filter(d => { const n = daysFromNow(d.expiry); return n !== null && n <= 60; })
    .sort((a,b) => (a.expiry||'').localeCompare(b.expiry||''))
    .map(d => ({
      'Name':      d.name,
      'Type':      d.type,
      'Vehicle':   KKR.vehicleReg(d.vehicle) || '',
      'Driver':    d.driver ? KKR.driverName(d.driver) : '',
      'Expiry':    d.expiry || '',
      'Days Left': daysFromNow(d.expiry) ?? '',
      'Status':    (daysFromNow(d.expiry) ?? 1) < 0 ? 'Expired' : 'Expiring',
    }));
  if (!rows.length) { toast('No expiring documents found', 'info'); return; }
  exportCSV(Object.keys(rows[0]), rows, `kkr-expiring-docs-${today()}.csv`);
  toast(`${rows.length} expiring documents exported`, 'success');
}

function printDocuments() {
  const rows = KKR.getDocuments().sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999'));
  const html = `<table>
    <thead><tr><th>Name</th><th>Type</th><th>Vehicle/Driver</th><th>Expiry</th><th>Days Left</th><th>Uploaded</th><th>Size</th></tr></thead>
    <tbody>
    ${rows.map(d => {
      const n   = daysFromNow(d.expiry);
      const col = n !== null && n < 0 ? 'color:#dc2626' : n !== null && n <= 30 ? 'color:#d97706' : '';
      return `<tr>
        <td>${d.name}</td>
        <td><span class="badge" style="background:#dbeafe;color:#1e40af">${d.type}</span></td>
        <td>${KKR.vehicleReg(d.vehicle)||''} ${d.driver?KKR.driverName(d.driver):''}</td>
        <td style="${col}">${d.expiry ? fmtDate(d.expiry) : '—'}</td>
        <td style="${col}">${n !== null ? (n < 0 ? 'Expired '+Math.abs(n)+'d ago' : n+'d') : '—'}</td>
        <td>${fmtDate(d.uploaded)||'—'}</td>
        <td>${d.size||'—'}</td>
      </tr>`;}).join('')}
    </tbody>
  </table>`;
  _printWin('Documents List', html);
}

// ============================================================
// ALERTS
// ============================================================
function exportAlertsCSV() {
  const rows = KKR.getAlerts().map(a => ({
    'Title':    a.title,
    'Message':  a.message,
    'Priority': a.priority,
    'Type':     a.type,
    'Date':     a.date,
    'Read':     a.read ? 'Yes' : 'No',
  }));
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-alerts-${today()}.csv`);
  toast('Alerts exported', 'success');
}

function printAlerts() {
  const rows = KKR.getAlerts().sort((a,b) => {
    const o = {high:0,medium:1,low:2};
    return (o[a.priority]||3) - (o[b.priority]||3);
  });
  const col = { high:'#fee2e2;color:#b91c1c', medium:'#fef3c7;color:#92400e', low:'#dbeafe;color:#1e40af' };
  const html = `<table>
    <thead><tr><th>Priority</th><th>Title</th><th>Message</th><th>Type</th><th>Date</th><th>Read</th></tr></thead>
    <tbody>
    ${rows.map(a => `<tr>
      <td><span class="badge" style="background:${(col[a.priority]||'').split(';')[0]};${(col[a.priority]||'').split(';')[1]}">${a.priority}</span></td>
      <td>${a.title}</td><td>${a.message}</td><td>${a.type}</td>
      <td>${fmtDate(a.date)}</td><td>${a.read?'✓':''}</td>
    </tr>`).join('')}
    </tbody>
  </table>`;
  _printWin('Alerts & Notifications', html);
}

// ============================================================
// CALENDAR — Export Upcoming Events
// ============================================================
function exportCalendarEvents() {
  const upcoming = [];
  KKR.getTrips().forEach(t => {
    if (t.status==='in-transit'||t.status==='pending'||t.status==='planned'||t.status==='loading')
      upcoming.push({ Date:t.date, Type:'Trip', Details:`${t.id}: ${t.loadingPoint||t.from||''}→${t.destination||t.to||''}`, Status:t.status });
  });
  KKR.getInvoices().filter(i=>i.status!=='paid'&&i.dueDate).forEach(i => {
    upcoming.push({ Date:i.dueDate, Type:'Invoice Due', Details:`${i.id} — ${KKR.customerName(i.customer)} (${fmtCurrency(i.total-i.paid)})`, Status:i.status });
  });
  KKR.getVehicles().forEach(v => {
    [['insurance',v.insurance],['fitness',v.fitness],['puc',v.puc],['permit',v.permit]].forEach(([type,date]) => {
      if (date) { const d=daysFromNow(date); if(d!==null&&d>=0&&d<=90) upcoming.push({ Date:date, Type:'Vehicle '+type, Details:v.regNo, Status:d<=7?'Critical':d<=30?'High':'Low' }); }
    });
  });
  KKR.getEwayBills().filter(e=>e.status!=='cancelled').forEach(e => {
    const d=daysFromNow(e.validUpto);
    if(d!==null&&d>=0&&d<=7) upcoming.push({ Date:e.validUpto, Type:'E-Way Expiry', Details:`${e.billNo}: ${e.pickup||e.from||''}→${e.destination||e.to||''}`, Status:d<=0?'Expired':'Expiring' });
  });
  upcoming.sort((a,b)=>a.Date.localeCompare(b.Date));
  if (!upcoming.length) { toast('No upcoming events found', 'info'); return; }
  exportCSV(['Date','Type','Details','Status'], upcoming, `kkr-calendar-events-${today()}.csv`);
  toast(`${upcoming.length} events exported`, 'success');
}

function printCalendarEvents() {
  const upcoming = [];
  KKR.getTrips().filter(t=>['in-transit','pending','planned','loading'].includes(t.status)).forEach(t => {
    upcoming.push({ date:t.date, type:'Trip', details:`${t.id}: ${t.loadingPoint||t.from||''}→${t.destination||t.to||''}`, status:t.status });
  });
  KKR.getInvoices().filter(i=>i.status!=='paid'&&i.dueDate).forEach(i => {
    upcoming.push({ date:i.dueDate, type:'Invoice Due', details:`${i.id} — ${KKR.customerName(i.customer)}`, status:i.status });
  });
  KKR.getVehicles().forEach(v => {
    [['Insurance',v.insurance],['Fitness',v.fitness],['PUC',v.puc]].forEach(([t,d]) => {
      if(d){ const n=daysFromNow(d); if(n!==null&&n>=0&&n<=90) upcoming.push({date:d,type:'Vehicle '+t,details:v.regNo,status:n<=7?'Critical':n<=30?'High':'OK'}); }
    });
  });
  upcoming.sort((a,b)=>a.date.localeCompare(b.date));
  const html = `<table>
    <thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Status</th></tr></thead>
    <tbody>
    ${upcoming.map(e=>`<tr>
      <td>${fmtDate(e.date)}</td><td>${e.type}</td><td>${e.details}</td><td>${e.status}</td>
    </tr>`).join('')}
    </tbody>
  </table>`;
  _printWin('Calendar — Upcoming Events', html);
}

// ============================================================
// PAYMENTS — Print
// ============================================================
function printPayments() {
  const rows = KKR.getPayments().sort((a,b)=>b.date.localeCompare(a.date));
  const total = rows.reduce((s,p)=>s+p.amount,0);
  const html = `<table>
    <thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Amount</th><th>Mode</th><th>Reference</th><th>Notes</th></tr></thead>
    <tbody>
    ${rows.map(p=>`<tr>
      <td>${fmtDate(p.date)}</td>
      <td>${KKR.customerName(p.customer)}</td>
      <td>${p.invoiceId||'—'}</td>
      <td><strong>${fmtCurrency(p.amount)}</strong></td>
      <td>${p.mode||'—'}</td>
      <td>${p.reference||'—'}</td>
      <td>${p.notes||'—'}</td>
    </tr>`).join('')}
    </tbody>
    <tfoot><tr>
      <td colspan="3"><strong>Total Collected (${rows.length} payments)</strong></td>
      <td><strong>${fmtCurrency(total)}</strong></td>
      <td colspan="3"></td>
    </tr></tfoot>
  </table>`;
  _printWin('Payments Register', html);
}

// ============================================================
// CUSTOMERS — Print + Outstanding export
// ============================================================
function printCustomers() {
  const rows = KKR.getCustomers();
  const html = `<table>
    <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>GSTIN</th><th>Outstanding</th><th>Status</th></tr></thead>
    <tbody>
    ${rows.map(c => {
      const outstanding = KKR.getInvoices().filter(i=>i.customer===c.id).reduce((s,i)=>s+(i.total-i.paid),0);
      return `<tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.contact||'—'}</td>
        <td>${c.phone}</td>
        <td>${c.gstin||'—'}</td>
        <td style="${outstanding>0?'color:#b45309;font-weight:700':''}">${fmtCurrency(outstanding)}</td>
        <td>${c.status}</td>
      </tr>`;}).join('')}
    </tbody>
    <tfoot><tr>
      <td colspan="4"><strong>Total Outstanding</strong></td>
      <td><strong>${fmtCurrency(rows.reduce((s,c)=>s+KKR.getInvoices().filter(i=>i.customer===c.id).reduce((ss,i)=>ss+(i.total-i.paid),0),0))}</strong></td>
      <td></td>
    </tr></tfoot>
  </table>`;
  _printWin('Customers List', html);
}

function exportCustomersWithOutstanding() {
  const rows = KKR.getCustomers().map(c => {
    const invs        = KKR.getInvoices().filter(i => i.customer === c.id);
    const outstanding = invs.reduce((s,i) => s+(i.total-i.paid), 0);
    const totalBilled = invs.reduce((s,i) => s+i.total, 0);
    const totalPaid   = invs.reduce((s,i) => s+i.paid,  0);
    return {
      'Name':           c.name,
      'Contact':        c.contact || '',
      'Phone':          c.phone,
      'Email':          c.email   || '',
      'GSTIN':          c.gstin   || '',
      'Address':        c.address || '',
      'Status':         c.status,
      'Invoice Count':  invs.length,
      'Total Billed':   totalBilled,
      'Total Paid':     totalPaid,
      'Outstanding':    outstanding,
    };
  });
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-customers-outstanding-${today()}.csv`);
  toast('Customers with outstanding exported', 'success');
}

// ============================================================
// FUEL — Vehicle Analytics tab export
// ============================================================
function exportFuelAnalyticsCSV() {
  const allFuel = KKR.getFuel();
  const map = {};
  allFuel.forEach(f => {
    if (!map[f.vehicle]) map[f.vehicle] = { litres:0, cost:0, km:0, fills:0 };
    const openKM  = f.openingKM || 0;
    const closeKM = f.closingKM || 0;
    const totalKM = closeKM > openKM ? closeKM - openKM : (f.totalKM || 0);
    map[f.vehicle].litres += f.litres || 0;
    map[f.vehicle].cost   += f.fuelCost || f.amount || 0;
    map[f.vehicle].km     += totalKM;
    map[f.vehicle].fills  += 1;
  });
  const rows = Object.entries(map).map(([vid, d]) => ({
    'Vehicle':     KKR.vehicleReg(vid),
    'Fill-ups':    d.fills,
    'Total Litres':d.litres.toFixed(2),
    'Total KM':    d.km,
    'Fuel Cost':   d.cost.toFixed(2),
    'KM/Litre':    d.litres>0&&d.km>0 ? (d.km/d.litres).toFixed(2) : '',
    'Cost/KM':     d.km>0 ? (d.cost/d.km).toFixed(2) : '',
  })).sort((a,b) => parseFloat(b['Fuel Cost'])-parseFloat(a['Fuel Cost']));
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-fuel-analytics-${today()}.csv`);
  toast('Fuel analytics exported', 'success');
}

function printFuelAnalytics() {
  const allFuel = KKR.getFuel();
  const map = {};
  allFuel.forEach(f => {
    if (!map[f.vehicle]) map[f.vehicle] = { litres:0, cost:0, km:0, fills:0 };
    const totalKM = f.closingKM>f.openingKM ? f.closingKM-f.openingKM : (f.totalKM||0);
    map[f.vehicle].litres += f.litres||0;
    map[f.vehicle].cost   += f.fuelCost||f.amount||0;
    map[f.vehicle].km     += totalKM;
    map[f.vehicle].fills  += 1;
  });
  const rows = Object.entries(map).sort((a,b)=>b[1].cost-a[1].cost);
  const html = `<table>
    <thead><tr><th>Vehicle</th><th>Fill-ups</th><th>Total Litres</th><th>Total KM</th><th>Fuel Cost</th><th>KM/Litre</th><th>Cost/KM</th></tr></thead>
    <tbody>
    ${rows.map(([vid,d])=>`<tr>
      <td><strong>${KKR.vehicleReg(vid)}</strong></td>
      <td>${d.fills}</td>
      <td>${d.litres.toFixed(2)} L</td>
      <td>${d.km>0?fmtNum(d.km,0)+' km':'—'}</td>
      <td><strong>${fmtCurrency(d.cost)}</strong></td>
      <td>${d.litres>0&&d.km>0?(d.km/d.litres).toFixed(2):'—'}</td>
      <td>${d.km>0?'₹'+(d.cost/d.km).toFixed(2):'—'}</td>
    </tr>`).join('')}
    </tbody>
  </table>`;
  _printWin('Fuel — Vehicle Analytics', html);
}

// ============================================================
// EXPENSES — Category Breakdown export + By Vehicle export
// ============================================================
function exportExpBreakdownCSV() {
  const all  = KKR.getExpenses();
  const total= all.reduce((s,e)=>s+e.amount,0);
  const byCat= {};
  all.forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+e.amount; });
  const rows = Object.entries(byCat)
    .sort((a,b)=>b[1]-a[1])
    .map(([cat,amt])=>({
      'Category': cat,
      'Amount':   amt.toFixed(2),
      'Count':    all.filter(e=>e.category===cat).length,
      'Pct of Total': total>0 ? ((amt/total)*100).toFixed(1)+'%' : '0%',
    }));
  rows.push({ 'Category':'TOTAL', 'Amount':total.toFixed(2), 'Count':all.length, 'Pct of Total':'100%' });
  exportCSV(['Category','Amount','Count','Pct of Total'], rows, `kkr-expense-breakdown-${today()}.csv`);
  toast('Expense breakdown exported', 'success');
}

function printExpBreakdown() {
  const all  = KKR.getExpenses();
  const total= all.reduce((s,e)=>s+e.amount,0);
  const byCat= {};
  all.forEach(e=>{ byCat[e.category]=(byCat[e.category]||0)+e.amount; });
  const sorted = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const html = `<table>
    <thead><tr><th>Category</th><th>Count</th><th>Amount</th><th>% of Total</th></tr></thead>
    <tbody>
    ${sorted.map(([cat,amt])=>`<tr>
      <td>${cat}</td>
      <td>${all.filter(e=>e.category===cat).length}</td>
      <td><strong>${fmtCurrency(amt)}</strong></td>
      <td>${total>0?((amt/total)*100).toFixed(1)+'%':'—'}</td>
    </tr>`).join('')}
    </tbody>
    <tfoot><tr>
      <td colspan="2"><strong>TOTAL</strong></td>
      <td><strong>${fmtCurrency(total)}</strong></td>
      <td><strong>100%</strong></td>
    </tr></tfoot>
  </table>`;
  _printWin('Expenses — Category Breakdown', html);
}

function exportExpByVehicleCSV() {
  const all = KKR.getExpenses();
  const vehicles = KKR.getVehicles();
  const vehRevenue = {};
  KKR.getTrips().filter(t=>t.status!=='cancelled').forEach(t=>{
    vehRevenue[t.vehicle]=(vehRevenue[t.vehicle]||0)+(t.grandTotal||t.freight||0);
  });
  const rows = vehicles.map(v => {
    const vExp = all.filter(e=>e.vehicle===v.id).reduce((s,e)=>s+e.amount,0);
    const vRev = vehRevenue[v.id]||0;
    return {
      'Vehicle':   v.regNo,
      'Make/Model':`${v.make} ${v.model}`,
      'Expenses':  vExp.toFixed(2),
      'Revenue':   vRev.toFixed(2),
      'Net Margin':(vRev-vExp).toFixed(2),
      'Records':   all.filter(e=>e.vehicle===v.id).length,
    };
  }).filter(r=>parseFloat(r.Expenses)>0 || parseFloat(r.Revenue)>0);
  if (!rows.length) { toast('No vehicle expense data found', 'info'); return; }
  exportCSV(Object.keys(rows[0]), rows, `kkr-expenses-by-vehicle-${today()}.csv`);
  toast('Vehicle expense P&L exported', 'success');
}

function printExpByVehicle() {
  const all      = KKR.getExpenses();
  const vehicles = KKR.getVehicles();
  const vehRevenue = {};
  KKR.getTrips().filter(t=>t.status!=='cancelled').forEach(t=>{
    vehRevenue[t.vehicle]=(vehRevenue[t.vehicle]||0)+(t.grandTotal||t.freight||0);
  });
  const html = `<table>
    <thead><tr><th>Vehicle</th><th>Expenses</th><th>Revenue</th><th>Net Margin</th><th>Records</th></tr></thead>
    <tbody>
    ${vehicles.map(v=>{
      const vExp = all.filter(e=>e.vehicle===v.id).reduce((s,e)=>s+e.amount,0);
      const vRev = vehRevenue[v.id]||0;
      const margin = vRev - vExp;
      return `<tr>
        <td><strong>${v.regNo}</strong><br><small>${v.make} ${v.model}</small></td>
        <td style="color:#b91c1c">${fmtCurrency(vExp)}</td>
        <td style="color:#1d4ed8">${vRev>0?fmtCurrency(vRev):'—'}</td>
        <td style="${margin>=0?'color:#15803d;font-weight:700':'color:#b91c1c;font-weight:700'}">${vRev>0?fmtCurrency(margin):'—'}</td>
        <td>${all.filter(e=>e.vehicle===v.id).length}</td>
      </tr>`;}).join('')}
    </tbody>
  </table>`;
  _printWin('Expenses — By Vehicle P&L', html);
}

// ============================================================
// WEIGHBRIDGE — Trips Without Slip export
// ============================================================
function exportTripsWithoutSlip() {
  const linked = new Set(KKR.getWeighbridge().map(r=>r.tripId).filter(Boolean));
  const rows = KKR.getTrips()
    .filter(t => !linked.has(t.id) && t.status !== 'cancelled')
    .map(t => ({
      'Trip ID':    t.id,
      'Date':       t.date,
      'Status':     t.status,
      'Customer':   KKR.customerName(t.customer),
      'Vehicle':    KKR.vehicleReg(t.vehicle),
      'Driver':     KKR.driverName(t.driver),
      'From':       t.loadingPoint || t.from || '',
      'To':         t.destination  || t.to   || '',
      'Qty (MT)':   (t.quantity||t.billedWt||0).toFixed(2),
      'Grand Total':_tripGrandTotal ? _tripGrandTotal(t).toFixed(2) : (t.freight||0).toFixed(2),
    }));
  if (!rows.length) { toast('All trips are linked to a weighbridge slip', 'success'); return; }
  exportCSV(Object.keys(rows[0]), rows, `kkr-trips-without-slip-${today()}.csv`);
  toast(`${rows.length} unlinked trips exported`, 'success');
}

// ============================================================
// EWAY BILLS — Expiry Alerts export
// ============================================================
function exportEwayAlerts() {
  const statusFn = typeof _ewayComputedStatus === 'function' ? _ewayComputedStatus : (b=>b.status);
  const rows = KKR.getEwayBills()
    .filter(b => { const s=statusFn(b); return s==='expiring'||s==='expired'; })
    .sort((a,b)=>a.validUpto.localeCompare(b.validUpto))
    .map(b => ({
      'Bill No':     b.billNo,
      'Valid Until': b.validUpto,
      'Days':        daysFromNow(b.validUpto) ?? '',
      'Status':      statusFn(b),
      'Trip':        b.tripId    || '',
      'Invoice':     b.invoiceId || '',
      'Vehicle':     KKR.vehicleReg(b.vehicle),
      'Customer':    b.customer ? KKR.customerName(b.customer) : '',
      'Route':       `${b.pickup||b.from||''}→${b.destination||b.to||''}`,
      'Value':       b.value || 0,
    }));
  if (!rows.length) { toast('No expiring or expired e-way bills', 'info'); return; }
  exportCSV(Object.keys(rows[0]), rows, `kkr-eway-alerts-${today()}.csv`);
  toast(`${rows.length} e-way alerts exported`, 'success');
}

// ============================================================
// REPORTS — Financial tab + Fleet Report tab
// ============================================================
function exportFinancialReport() {
  const invoices = KKR.getInvoices();
  const rows = invoices.map(i => ({
    'Invoice':     i.id,
    'Date':        i.date,
    'Due Date':    i.dueDate || '',
    'Customer':    KKR.customerName(i.customer),
    'Total':       i.total    || 0,
    'Paid':        i.paid     || 0,
    'Balance':     (i.total||0)-(i.paid||0),
    'Days Overdue':i.dueDate && daysFromNow(i.dueDate)<0 ? Math.abs(daysFromNow(i.dueDate)) : 0,
    'Status':      i.status,
  }));
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-financial-report-${today()}.csv`);
  toast('Financial report exported', 'success');
}

function printFinancialReport() {
  const invoices = KKR.getInvoices().filter(i=>(i.total||0)-(i.paid||0)>0).sort((a,b)=>(a.dueDate||'').localeCompare(b.dueDate||''));
  const total    = invoices.reduce((s,i)=>s+(i.total||0)-(i.paid||0),0);
  const html = `<table>
    <thead><tr><th>Invoice</th><th>Customer</th><th>Due Date</th><th>Balance</th><th>Days Overdue</th><th>Status</th></tr></thead>
    <tbody>
    ${invoices.map(i=>{
      const d=daysFromNow(i.dueDate); const bal=(i.total||0)-(i.paid||0);
      return `<tr>
        <td>${i.id}</td>
        <td>${KKR.customerName(i.customer)}</td>
        <td style="${d!==null&&d<0?'color:#b91c1c;font-weight:700':''}">${fmtDate(i.dueDate)}</td>
        <td><strong>${fmtCurrency(bal)}</strong></td>
        <td style="${d!==null&&d<0?'color:#b91c1c':''}">${d!==null&&d<0?Math.abs(d)+'d overdue':'Current'}</td>
        <td>${i.status}</td>
      </tr>`;}).join('')}
    </tbody>
    <tfoot><tr>
      <td colspan="3"><strong>Total Outstanding</strong></td>
      <td><strong>${fmtCurrency(total)}</strong></td>
      <td colspan="2"></td>
    </tr></tfoot>
  </table>`;
  _printWin('Financial Report — Invoice Ageing', html);
}

function exportFleetReport() {
  const fuel = KKR.getFuel();
  const rows = KKR.getVehicles().map(v => {
    const vTrips = KKR.getTrips().filter(t=>t.vehicle===v.id);
    const vFuel  = fuel.filter(f=>f.vehicle===v.id);
    return {
      'Reg No':        v.regNo,
      'Type':          v.type,
      'Make/Model':    `${v.make} ${v.model}`,
      'Year':          v.year,
      'Capacity':      v.capacity,
      'Driver':        KKR.driverName(v.driver),
      'KM Reading':    v.kmReading || 0,
      'Trip Count':    vTrips.length,
      'Total Fuel (L)':vFuel.reduce((s,f)=>s+f.litres,0).toFixed(2),
      'Fuel Cost':     vFuel.reduce((s,f)=>s+(f.fuelCost||f.amount||0),0).toFixed(2),
      'Insurance':     v.insurance || '',
      'Fitness':       v.fitness   || '',
      'PUC':           v.puc       || '',
      'Status':        v.status,
    };
  });
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-fleet-report-${today()}.csv`);
  toast('Fleet report exported', 'success');
}

function exportDriverReport() {
  const fuel = KKR.getFuel();
  const rows = KKR.getDrivers().map(d => {
    const dFuel = fuel.filter(f=>f.driver===d.id);
    return {
      'Name':           d.name,
      'Phone':          d.phone,
      'License No':     d.license || '',
      'License Expiry': d.licenseExpiry || '',
      'Vehicle':        KKR.vehicleReg(d.vehicle),
      'Trips Done':     d.trips || 0,
      'Fuel Used (L)':  dFuel.reduce((s,f)=>s+f.litres,0).toFixed(2),
      'Join Date':      d.joinDate || '',
      'Status':         d.status,
    };
  });
  exportCSV(Object.keys(rows[0]||{}), rows, `kkr-driver-report-${today()}.csv`);
  toast('Driver report exported', 'success');
}

function printFleetReport() {
  const fuel = KKR.getFuel();
  const html = `<h3 style="margin-bottom:12px">Vehicle Performance</h3>
  <table>
    <thead><tr><th>Reg No</th><th>Make/Model</th><th>Driver</th><th>Trips</th><th>Fuel (L)</th><th>Fuel Cost</th><th>KM</th><th>Insurance</th><th>Status</th></tr></thead>
    <tbody>
    ${KKR.getVehicles().map(v=>{
      const vTrips=KKR.getTrips().filter(t=>t.vehicle===v.id);
      const vFuel=fuel.filter(f=>f.vehicle===v.id);
      return `<tr>
        <td><strong>${v.regNo}</strong></td>
        <td>${v.make} ${v.model}</td>
        <td>${KKR.driverName(v.driver)}</td>
        <td>${vTrips.length}</td>
        <td>${vFuel.reduce((s,f)=>s+f.litres,0).toFixed(0)}</td>
        <td>${fmtCurrency(vFuel.reduce((s,f)=>s+(f.fuelCost||f.amount||0),0))}</td>
        <td>${v.kmReading?fmtNum(v.kmReading,0)+' km':'—'}</td>
        <td style="${daysFromNow(v.insurance)!==null&&daysFromNow(v.insurance)<60?'color:#b91c1c':''}">${fmtDate(v.insurance)}</td>
        <td>${v.status}</td>
      </tr>`;}).join('')}
    </tbody>
  </table>
  <h3 style="margin:20px 0 12px">Driver Performance</h3>
  <table>
    <thead><tr><th>Driver</th><th>Trips</th><th>Fuel (L)</th><th>License Expiry</th><th>Status</th></tr></thead>
    <tbody>
    ${KKR.getDrivers().map(d=>{
      const dFuel=fuel.filter(f=>f.driver===d.id);
      return `<tr>
        <td><strong>${d.name}</strong></td>
        <td>${d.trips||0}</td>
        <td>${dFuel.reduce((s,f)=>s+f.litres,0).toFixed(0)}</td>
        <td style="${daysFromNow(d.licenseExpiry)!==null&&daysFromNow(d.licenseExpiry)<90?'color:#b91c1c':''}">${fmtDate(d.licenseExpiry)}</td>
        <td>${d.status}</td>
      </tr>`;}).join('')}
    </tbody>
  </table>`;
  _printWin('Fleet & Driver Report', html);
}

// ============================================================
// DASHBOARD — Export / Print summary
// ============================================================
function exportDashboardSummary() {
  const invs = KKR.getInvoices();
  const exps = KKR.getExpenses();
  const fuel = KKR.getFuel();
  const trips= KKR.getTrips();
  const rows = [
    { 'Metric':'Total Revenue',         'Value': fmtCurrency(invs.reduce((s,i)=>s+i.total,0)) },
    { 'Metric':'Total Collected',        'Value': fmtCurrency(invs.reduce((s,i)=>s+i.paid,0)) },
    { 'Metric':'Outstanding',            'Value': fmtCurrency(invs.reduce((s,i)=>s+(i.total-i.paid),0)) },
    { 'Metric':'Total Expenses',         'Value': fmtCurrency(exps.reduce((s,e)=>s+e.amount,0)) },
    { 'Metric':'Fuel Cost',              'Value': fmtCurrency(fuel.reduce((s,f)=>s+(f.fuelCost||f.amount||0),0)) },
    { 'Metric':'Total Trips',            'Value': trips.length },
    { 'Metric':'Completed Trips',        'Value': trips.filter(t=>t.status==='completed').length },
    { 'Metric':'In Transit',             'Value': trips.filter(t=>t.status==='in-transit').length },
    { 'Metric':'Active Vehicles',        'Value': KKR.getVehicles().filter(v=>v.status==='active').length },
    { 'Metric':'Active Drivers',         'Value': KKR.getDrivers().filter(d=>d.status==='active').length },
    { 'Metric':'Total Tonnage (MT)',     'Value': trips.filter(t=>t.status!=='cancelled').reduce((s,t)=>s+(t.quantity||t.billedWt||0),0).toFixed(2) },
    { 'Metric':'Overdue Invoices',       'Value': invs.filter(i=>i.status==='overdue').length },
    { 'Metric':'E-Way Bills Active',     'Value': KKR.getEwayBills().filter(b=>b.status!=='cancelled'&&(daysFromNow(b.validUpto)??1)>=0).length },
    { 'Metric':'Documents Expiring (60d)','Value': KKR.getDocuments().filter(d=>{const n=daysFromNow(d.expiry);return n!==null&&n>=0&&n<=60;}).length },
  ];
  exportCSV(['Metric','Value'], rows, `kkr-dashboard-summary-${today()}.csv`);
  toast('Dashboard summary exported', 'success');
}

function printDashboardSummary() {
  const invs = KKR.getInvoices();
  const exps = KKR.getExpenses();
  const fuel = KKR.getFuel();
  const trips= KKR.getTrips();
  const s    = KKR.getSettings();
  const totalRev  = invs.reduce((s,i)=>s+i.total,0);
  const totalColl = invs.reduce((s,i)=>s+i.paid,0);
  const totalExp  = exps.reduce((s,e)=>s+e.amount,0);
  const totalFuel = fuel.reduce((s,f)=>s+(f.fuelCost||f.amount||0),0);
  const profit    = totalRev - totalExp - totalFuel;
  const html = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
    ${[
      ['Total Revenue',   fmtCurrency(totalRev),  '#1d4ed8'],
      ['Collected',       fmtCurrency(totalColl), '#16a34a'],
      ['Outstanding',     fmtCurrency(totalRev-totalColl), '#d97706'],
      ['Total Expenses',  fmtCurrency(totalExp+totalFuel), '#b91c1c'],
      ['Gross Profit',    fmtCurrency(profit),    profit>=0?'#16a34a':'#b91c1c'],
      ['Total Trips',     trips.length,            '#6d28d9'],
    ].map(([l,v,c])=>`<div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px">
      <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">${l}</div>
      <div style="font-size:22px;font-weight:800;color:${c}">${v}</div>
    </div>`).join('')}
  </div>
  <table>
    <thead><tr><th>Metric</th><th>Value</th></tr></thead>
    <tbody>
    ${[
      ['Completed Trips',      trips.filter(t=>t.status==='completed').length],
      ['In Transit',           trips.filter(t=>t.status==='in-transit').length],
      ['Total Tonnage (MT)',   trips.filter(t=>t.status!=='cancelled').reduce((s,t)=>s+(t.quantity||t.billedWt||0),0).toFixed(2)],
      ['Active Vehicles',      KKR.getVehicles().filter(v=>v.status==='active').length],
      ['Active Drivers',       KKR.getDrivers().filter(d=>d.status==='active').length],
      ['Overdue Invoices',     invs.filter(i=>i.status==='overdue').length],
      ['E-Way Bills Active',   KKR.getEwayBills().filter(b=>b.status!=='cancelled'&&(daysFromNow(b.validUpto)??1)>=0).length],
      ['Docs Expiring (60d)',  KKR.getDocuments().filter(d=>{const n=daysFromNow(d.expiry);return n!==null&&n>=0&&n<=60;}).length],
    ].map(([l,v])=>`<tr><td>${l}</td><td><strong>${v}</strong></td></tr>`).join('')}
    </tbody>
  </table>`;
  _printWin('Business Overview — Dashboard Summary', html);
}
