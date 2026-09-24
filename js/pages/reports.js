// Reports Page
let reportTab = 'summary';

function renderReports() {
  const trips    = KKR.getTrips();
  const invoices = KKR.getInvoices();
  const expenses = KKR.getExpenses();
  const fuel     = KKR.getFuel();
  const vehicles = KKR.getVehicles();
  const drivers  = KKR.getDrivers();

  const totalRevenue = invoices.reduce((s,i)=>s+i.total,0);
  const totalPaid    = invoices.reduce((s,i)=>s+i.paid,0);
  const totalExp     = expenses.reduce((s,e)=>s+e.amount,0);
  const totalFuel    = fuel.reduce((s,f)=>s+f.amount,0);
  const grossProfit  = totalRevenue - totalExp - totalFuel;

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Reports & Analytics</div>
        <div class="subtitle">Business performance overview — FY 2025-26</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="printReports()">${icon('print',15)} Print All</button>
      </div>
    </div>

    <div class="tabs">
      ${[['summary','Summary'],['trips','Trip Report'],['finance','Financial'],['fleet','Fleet Report']].map(([k,l])=>`
        <div class="tab ${reportTab===k?'active':''}" onclick="reportTab='${k}'; rerenderPage()">${l}</div>`).join('')}
    </div>

    ${reportTab==='summary'?renderReportSummary(totalRevenue,totalPaid,totalExp,totalFuel,grossProfit,trips,vehicles,drivers):''}
    ${reportTab==='trips'?renderTripReport(trips):''}
    ${reportTab==='finance'?renderFinanceReport(invoices,expenses,fuel):''}
    ${reportTab==='fleet'?renderFleetReport(vehicles,drivers,fuel):''}
  </div>`;
}

function renderReportSummary(rev,paid,exp,fuelCost,profit,trips,vehicles,drivers) {
  return `
  <div class="kpi-grid" style="margin-bottom:24px">
    <div class="kpi-card blue"><div class="kpi-icon blue">${icon('billing',22)}</div>
      <div class="kpi-value">${fmtCurrency(rev)}</div><div class="kpi-label">Gross Revenue</div></div>
    <div class="kpi-card green"><div class="kpi-icon green">${icon('payments',22)}</div>
      <div class="kpi-value">${fmtCurrency(paid)}</div><div class="kpi-label">Amount Collected</div></div>
    <div class="kpi-card red"><div class="kpi-icon red">${icon('expenses',22)}</div>
      <div class="kpi-value">${fmtCurrency(exp+fuelCost)}</div><div class="kpi-label">Total Expenses</div></div>
    <div class="kpi-card ${profit>0?'green':'red'}"><div class="kpi-icon ${profit>0?'green':'red'}">${icon('reports',22)}</div>
      <div class="kpi-value">${fmtCurrency(profit)}</div><div class="kpi-label">Net Margin</div></div>
  </div>
  <div class="grid-2" style="margin-bottom:20px">
    <div class="card">
      <div class="card-header"><div class="card-title">Revenue Trend (6 months)</div></div>
      <div class="chart-container" style="height:240px"><canvas id="chart-rev-trend"></canvas></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Expense Breakdown</div></div>
      <div class="chart-container" style="height:240px; display:flex; align-items:center; justify-content:center"><canvas id="chart-exp-break" style="max-height:220px"></canvas></div>
    </div>
  </div>
  <div class="grid-3">
    <div class="card">
      <div class="card-header"><div class="card-title">Trips Summary</div></div>
      ${[
        ['Total Trips', trips.length],
        ['Completed', trips.filter(t=>t.status==='completed').length],
        ['In Transit', trips.filter(t=>t.status==='in-transit').length],
        ['Pending', trips.filter(t=>t.status==='pending').length],
        ['Total Freight', fmtCurrency(trips.reduce((s,t)=>s+(t.grandTotal||t.freight||0),0))],
      ].map(([l,v])=>`
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(51,65,85,0.4)">
          <span style="font-size:13px; color:var(--text-muted)">${l}</span>
          <span style="font-size:13px; font-weight:700">${v}</span>
        </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Fleet Summary</div></div>
      ${[
        ['Total Vehicles', vehicles.length],
        ['Active', vehicles.filter(v=>v.status==='active').length],
        ['In Maintenance', vehicles.filter(v=>v.status==='maintenance').length],
        ['Total Drivers', drivers.length],
        ['Active Drivers', drivers.filter(d=>d.status==='active').length],
      ].map(([l,v])=>`
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(51,65,85,0.4)">
          <span style="font-size:13px; color:var(--text-muted)">${l}</span>
          <span style="font-size:13px; font-weight:700">${v}</span>
        </div>`).join('')}
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Financial Summary</div></div>
      ${[
        ['Invoice Count', KKR.getInvoices().length],
        ['Paid Invoices', KKR.getInvoices().filter(i=>i.status==='paid').length],
        ['Overdue', KKR.getInvoices().filter(i=>i.status==='overdue').length],
        ['Fuel Cost', fmtCurrency(fuelCost)],
        ['Other Expenses', fmtCurrency(exp)],
      ].map(([l,v])=>`
        <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(51,65,85,0.4)">
          <span style="font-size:13px; color:var(--text-muted)">${l}</span>
          <span style="font-size:13px; font-weight:700">${v}</span>
        </div>`).join('')}
    </div>
  </div>`;
}

function renderTripReport(trips) {
  // Per customer breakdown
  const byCust = {};
  trips.forEach(t=>{ if(!byCust[t.customer]) byCust[t.customer]={count:0,freight:0}; byCust[t.customer].count++; byCust[t.customer].freight+=(t.grandTotal||t.freight||0); });

  return `
  <div class="card" style="margin-bottom:20px">
    <div class="card-header">
      <div class="card-title">Trips by Customer</div>
      <button class="btn btn-sm btn-secondary" onclick="exportTripsReport()">${icon('download',14)} Export</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Customer</th><th>Trip Count</th><th>Total Freight</th><th>Avg Freight</th></tr></thead>
        <tbody>
        ${Object.entries(byCust).sort((a,b)=>b[1].freight-a[1].freight).map(([id,d])=>`
          <tr>
            <td class="font-bold">${KKR.customerName(id)}</td>
            <td>${d.count}</td>
            <td class="font-bold">${fmtCurrency(d.freight)}</td>
            <td>${fmtCurrency(Math.round(d.freight/d.count))}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">All Trips Detail</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ID</th><th>Date</th><th>Route</th><th>Customer</th><th>Material</th><th>Wt (MT)</th><th>Freight</th><th>Status</th></tr></thead>
        <tbody>
        ${[...trips].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`
          <tr>
            <td class="text-blue">${t.id}</td>
            <td>${fmtDate(t.date)}</td>
            <td>${(t.loadingPoint||t.from||'')+'→'+(t.destination||t.to||'')}</td>
            <td>${KKR.customerName(t.customer)}</td>
            <td>${KKR.materialName(t.material)}</td>
            <td>${fmtNum(t.quantity||t.billedWt||0,2)}</td>
            <td class="font-bold">${fmtCurrency(t.grandTotal||t.freight||0)}</td>
            <td>${statusBadge(t.status)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderFinanceReport(invoices,expenses,fuel) {
  return `
  <div class="grid-2" style="margin-bottom:20px">
    <div class="card">
      <div class="card-header"><div class="card-title">Invoice Ageing</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Invoice</th><th>Customer</th><th>Due Date</th><th>Balance</th><th>Days Overdue</th></tr></thead>
          <tbody>
          ${invoices.filter(i=>i.total-i.paid>0).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).map(i=>{
            const days = daysFromNow(i.dueDate);
            const overdue = days!==null&&days<0?Math.abs(days):0;
            return `<tr>
              <td class="text-blue">${i.id}</td>
              <td>${KKR.customerName(i.customer)}</td>
              <td>${fmtDate(i.dueDate)}</td>
              <td class="font-bold text-amber">${fmtCurrency(i.total-i.paid)}</td>
              <td style="color:${overdue>0?'#f87171':'#34d399'}">${overdue>0?overdue+' days':'Current'}</td>
            </tr>`;}).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Monthly Expense Summary</div></div>
      <div class="chart-container" style="height:260px"><canvas id="chart-exp-monthly"></canvas></div>
    </div>
  </div>`;
}

function renderFleetReport(vehicles,drivers,fuel) {
  return `
  <div class="card" style="margin-bottom:20px">
    <div class="card-header"><div class="card-title">Vehicle Performance</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Vehicle</th><th>Type</th><th>Trips</th><th>Total Fuel (L)</th><th>Fuel Cost</th><th>KM Reading</th><th>Insurance Expiry</th><th>Status</th></tr></thead>
        <tbody>
        ${vehicles.map(v=>{
          const vTrips = KKR.getTrips().filter(t=>t.vehicle===v.id);
          const vFuel  = fuel.filter(f=>f.vehicle===v.id);
          return `<tr>
            <td class="font-bold">${v.regNo}</td>
            <td>${v.type}</td>
            <td>${vTrips.length}</td>
            <td>${fmtNum(vFuel.reduce((s,f)=>s+f.litres,0),0)}</td>
            <td>${fmtCurrency(vFuel.reduce((s,f)=>s+f.amount,0))}</td>
            <td>${fmtNum(v.kmReading,0)} km</td>
            <td style="color:${daysFromNow(v.insurance)!==null&&daysFromNow(v.insurance)<60?'#f87171':'inherit'}">${fmtDate(v.insurance)}</td>
            <td>${statusBadge(v.status)}</td>
          </tr>`;}).join('')}
        </tbody>
      </table>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">Driver Performance</div></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Driver</th><th>Trips Done</th><th>Fuel Used (L)</th><th>License Expiry</th><th>Status</th></tr></thead>
        <tbody>
        ${drivers.map(d=>{
          const dFuel = fuel.filter(f=>f.driver===d.id);
          return `<tr>
            <td class="font-bold">${d.name}</td>
            <td>${d.trips}</td>
            <td>${fmtNum(dFuel.reduce((s,f)=>s+f.litres,0),0)}</td>
            <td style="color:${daysFromNow(d.licenseExpiry)!==null&&daysFromNow(d.licenseExpiry)<90?'#f87171':'inherit'}">${fmtDate(d.licenseExpiry)}</td>
            <td>${statusBadge(d.status)}</td>
          </tr>`;}).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function initReportCharts() {
  const revCtx = document.getElementById('chart-rev-trend');
  if (revCtx && window.Chart) {
    if (revCtx._chart) revCtx._chart.destroy();
    revCtx._chart = new Chart(revCtx, {
      type: 'line',
      data: {
        labels: ['Apr','May','Jun','Jul','Aug','Sep'],
        datasets: [{
          label:'Revenue', data:[320000,410000,380000,450000,420000,480000],
          borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,0.1)', tension:0.4, fill:true
        }]
      },
      options: { responsive:true, maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#94a3b8'}}},
        scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(51,65,85,0.5)'}},
                y:{ticks:{color:'#94a3b8',callback:v=>'₹'+(v/1000).toFixed(0)+'k'},grid:{color:'rgba(51,65,85,0.5)'}}}
      }
    });
  }
  const expCtx = document.getElementById('chart-exp-break');
  if (expCtx && window.Chart) {
    const bycat = {};
    KKR.getExpenses().forEach(e=>{bycat[e.category]=(bycat[e.category]||0)+e.amount;});
    if (expCtx._chart) expCtx._chart.destroy();
    expCtx._chart = new Chart(expCtx, {
      type:'doughnut',
      data:{
        labels:Object.keys(bycat),
        datasets:[{data:Object.values(bycat),backgroundColor:['#2563eb','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899'],borderColor:'transparent'}]
      },
      options:{responsive:true,maintainAspectRatio:false,cutout:'65%',
        plugins:{legend:{position:'right',labels:{color:'#94a3b8',font:{size:11},padding:12}}}}
    });
  }
  const expMonCtx = document.getElementById('chart-exp-monthly');
  if (expMonCtx && window.Chart) {
    if (expMonCtx._chart) expMonCtx._chart.destroy();
    expMonCtx._chart = new Chart(expMonCtx, {
      type:'bar',
      data:{
        labels:['Apr','May','Jun','Jul','Aug','Sep'],
        datasets:[
          {label:'Expenses',data:[95000,110000,88000,125000,102000,118000],backgroundColor:'rgba(239,68,68,0.6)',borderRadius:4},
          {label:'Fuel',data:[45000,52000,48000,58000,51000,61000],backgroundColor:'rgba(245,158,11,0.6)',borderRadius:4},
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#94a3b8'}}},
        scales:{x:{ticks:{color:'#94a3b8'},grid:{color:'rgba(51,65,85,0.5)'}},
                y:{ticks:{color:'#94a3b8',callback:v=>'₹'+(v/1000).toFixed(0)+'k'},grid:{color:'rgba(51,65,85,0.5)'}}}
      }
    });
  }
}

function exportTripsReport() {
  const rows = KKR.getTrips().map(t=>({
    id:       t.id,
    date:     t.date,
    customer: KKR.customerName(t.customer),
    from:     t.loadingPoint || t.from || '',
    to:       t.destination  || t.to   || '',
    material: KKR.materialName(t.material),
    qty:      t.quantity     || t.billedWt || 0,
    amount:   t.grandTotal   || t.freight  || 0,
    status:   t.status
  }));
  exportCSV(['id','date','customer','from','to','material','qty','amount','status'], rows, `kkr-trip-report-${today()}.csv`);
  toast('Exported','success');
}

function printReports() {
  const invs  = KKR.getInvoices();
  const exps  = KKR.getExpenses();
  const trips = KKR.getTrips();
  const html = `
    <h3>Summary</h3>
    <p>Total Revenue: ${fmtCurrency(invs.reduce((s,i)=>s+i.total,0))}</p>
    <p>Collected: ${fmtCurrency(invs.reduce((s,i)=>s+i.paid,0))}</p>
    <p>Total Expenses: ${fmtCurrency(exps.reduce((s,e)=>s+e.amount,0))}</p>
    <p>Trips Completed: ${trips.filter(t=>t.status==='completed').length}</p>
    <p>Active Vehicles: ${KKR.getVehicles().filter(v=>v.status==='active').length}</p>`;
  printSection('Business Report', html);
}
