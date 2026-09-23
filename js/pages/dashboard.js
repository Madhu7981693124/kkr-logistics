// ============================================================
// KKR Logistics — Dashboard Page
// All metrics computed live from real data in KKR store.
// ============================================================

// ── Helpers scoped to dashboard ────────────────────────────────────────────
function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Build last-N-months label + date-range array  [{label, from, to}]
function _lastNMonths(n) {
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    const label = d.toLocaleString('default', { month: 'short' }) + (i === 0 ? '' : '');
    const from = `${y}-${String(m + 1).padStart(2,'0')}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const to   = `${y}-${String(m + 1).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    months.push({ label, from, to, y, m });
  }
  return months;
}

// Sum trips.freight for trips falling in date range
function _freightInRange(trips, from, to) {
  return trips
    .filter(t => t.date >= from && t.date <= to && t.status === 'completed')
    .reduce((s, t) => s + (t.freight || 0), 0);
}

// Sum expenses + fuel in a date range
function _expInRange(expenses, fuel, from, to) {
  const e = expenses.filter(x => x.date >= from && x.date <= to).reduce((s,x) => s + x.amount, 0);
  const f = fuel.filter(x => x.date >= from && x.date <= to).reduce((s,x) => s + x.amount, 0);
  return e + f;
}

// Material tonnage grouped by name
function _matTonnage(trips, materials) {
  const map = {};
  trips.filter(t => t.status !== 'cancelled').forEach(t => {
    const name = (materials.find(m => m.id === t.material) || {}).name || t.material || 'Unknown';
    map[name] = (map[name] || 0) + (t.billedWt || 0);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
}

// ── Compute all dashboard stats ─────────────────────────────────────────────
function _dashStats() {
  const td         = _todayStr();
  const trips      = KKR.getTrips();
  const vehicles   = KKR.getVehicles();
  const drivers    = KKR.getDrivers();
  const invoices   = KKR.getInvoices();
  const expenses   = KKR.getExpenses();
  const fuel       = KKR.getFuel();
  const ewayBills  = KKR.getEwayBills();
  const documents  = KKR.getDocuments();
  const alerts     = KKR.getAlerts();
  const materials  = KKR.getMaterials();

  // ── Trips ────────────────────────────────────────────────────────────────
  const todayTrips     = trips.filter(t => t.date === td);
  const activeTrips    = trips.filter(t => t.status === 'in-transit');
  const pendingTrips   = trips.filter(t => t.status === 'pending');
  const completedTrips = trips.filter(t => t.status === 'completed');
  const allActiveSorted = [...activeTrips, ...pendingTrips]
    .sort((a,b) => b.date.localeCompare(a.date));

  const totalTons = trips
    .filter(t => t.status !== 'cancelled')
    .reduce((s, t) => s + (t.billedWt || 0), 0);
  const todayTons = todayTrips.reduce((s, t) => s + (t.billedWt || 0), 0);

  // ── Finance ──────────────────────────────────────────────────────────────
  const totalRevenue  = invoices.reduce((s,i) => s + i.total, 0);
  const totalCollected= invoices.reduce((s,i) => s + i.paid, 0);
  const outstanding   = totalRevenue - totalCollected;
  const totalExpenses = expenses.reduce((s,e) => s + e.amount, 0);
  const totalFuel     = fuel.reduce((s,f) => s + f.amount, 0);
  const totalCost     = totalExpenses + totalFuel;
  const grossProfit   = totalRevenue - totalCost;
  const margin        = totalRevenue > 0 ? Math.round(grossProfit / totalRevenue * 100) : 0;

  // Pending invoices
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'overdue');
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');
  const pendingInvTotal = pendingInvoices.reduce((s,i) => s + (i.total - i.paid), 0);

  // ── E-Way Bills expiring within 3 days ───────────────────────────────────
  const expiring = ewayBills.filter(e => {
    if (e.status !== 'active') return false;
    const d = daysFromNow(e.validUpto);
    return d !== null && d >= 0 && d <= 3;
  }).sort((a,b) => a.validUpto.localeCompare(b.validUpto));

  // ── Vehicle & doc alerts ──────────────────────────────────────────────────
  const docAlerts = [];
  vehicles.forEach(v => {
    [['insurance', v.insurance],['fitness', v.fitness],['puc', v.puc],['permit', v.permit]].forEach(([type, date]) => {
      if (!date) return;
      const d = daysFromNow(date);
      if (d !== null && d <= 60) {
        docAlerts.push({ reg: v.regNo, type, date, days: d, priority: d <= 7 ? 'high' : d <= 30 ? 'medium' : 'low' });
      }
    });
  });
  drivers.forEach(dr => {
    const d = daysFromNow(dr.licenseExpiry);
    if (d !== null && d <= 90) {
      docAlerts.push({ reg: dr.name, type: 'license', date: dr.licenseExpiry, days: d, priority: d <= 7 ? 'high' : d <= 30 ? 'medium' : 'low' });
    }
  });
  docAlerts.sort((a,b) => a.days - b.days);

  // ── Monthly trend (last 6 months) ─────────────────────────────────────────
  const months = _lastNMonths(6);
  const monthRevenue  = months.map(m => _freightInRange(trips, m.from, m.to));
  const monthExpenses = months.map(m => _expInRange(expenses, fuel, m.from, m.to));
  const monthProfit   = months.map((_, i) => monthRevenue[i] - monthExpenses[i]);
  const monthLabels   = months.map(m => m.label);

  // ── Trips per month (count) ───────────────────────────────────────────────
  const monthTrips = months.map(m =>
    trips.filter(t => t.date >= m.from && t.date <= m.to && t.status === 'completed').length
  );

  // ── Material tonnage ──────────────────────────────────────────────────────
  const matData = _matTonnage(trips, materials);

  // ── Fleet ─────────────────────────────────────────────────────────────────
  const fleetActive      = vehicles.filter(v => v.status === 'active').length;
  const fleetMaintenance = vehicles.filter(v => v.status === 'maintenance').length;
  const driversActive    = drivers.filter(d => d.status === 'active').length;

  // ── Recent trips (last 6) ─────────────────────────────────────────────────
  const recentTrips = [...trips]
    .sort((a,b) => b.date.localeCompare(a.date))
    .slice(0, 6);

  // ── Top customers by freight ──────────────────────────────────────────────
  const custMap = {};
  trips.filter(t => t.status === 'completed').forEach(t => {
    custMap[t.customer] = (custMap[t.customer] || 0) + (t.freight || 0);
  });
  const topCustomers = Object.entries(custMap)
    .sort((a,b) => b[1]-a[1])
    .slice(0,4)
    .map(([id, amt]) => ({ name: KKR.customerName(id), amt }));

  return {
    td, todayTrips, activeTrips, pendingTrips, completedTrips, allActiveSorted,
    totalTons, todayTons,
    totalRevenue, totalCollected, outstanding,
    totalExpenses, totalFuel, totalCost, grossProfit, margin,
    pendingInvoices, overdueInvoices, pendingInvTotal,
    expiring, docAlerts,
    monthLabels, monthRevenue, monthExpenses, monthProfit, monthTrips,
    matData,
    fleetActive, fleetMaintenance, driversActive,
    recentTrips, topCustomers,
    unreadAlerts: alerts.filter(a => !a.read).length,
    vehicles, drivers,
  };
}

// ── Mini sparkline bars (pure CSS inline) ─────────────────────────────────
function _sparkBars(values, color='#2563eb') {
  const max = Math.max(...values, 1);
  return `<div style="display:flex;align-items:flex-end;gap:2px;height:28px">
    ${values.map(v => {
      const pct = Math.max(4, Math.round(v / max * 100));
      return `<div style="flex:1;height:${pct}%;background:${color};border-radius:2px 2px 0 0;min-height:3px"></div>`;
    }).join('')}
  </div>`;
}

// ── Progress ring SVG ──────────────────────────────────────────────────────
function _ring(pct, color, size=52, stroke=5) {
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const filled = c * Math.max(0, Math.min(100, pct)) / 100;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
      stroke-dasharray="${filled} ${c}" stroke-linecap="round"/>
  </svg>`;
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const s   = _dashStats();
  const td  = s.td;
  const profitColor = s.grossProfit >= 0 ? '#10b981' : '#ef4444';

  return `
  <div class="page-content" id="dash-root">

    <!-- ── Date header ──────────────────────────────────────────────────── -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
      <div>
        <div style="font-size:22px;font-weight:800;color:var(--text-primary)">Business Overview</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px">
          ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
          &nbsp;·&nbsp; <span style="color:#34d399;font-weight:600">${s.activeTrips.length} trips on road</span>
        </div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="rerenderPage()" style="gap:6px">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Refresh
      </button>
    </div>

    <!-- ── Row 1: TODAY KPIs (3+3 mini strip) ──────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr) 1.3fr 1.3fr;gap:14px;margin-bottom:18px" class="dash-kpi-row">

      <!-- Today's trips -->
      <div class="kpi-card blue" style="cursor:pointer" onclick="navigate('trips')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div class="kpi-icon blue" style="width:38px;height:38px">${icon('trips',18)}</div>
          <div style="text-align:right">
            <div class="kpi-value" style="font-size:26px">${s.todayTrips.length}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">TODAY</div>
          </div>
        </div>
        <div class="kpi-label" style="margin-top:10px">Today's Trips</div>
        <div class="kpi-change">${fmtNum(s.todayTons,1)} MT loaded today</div>
      </div>

      <!-- Active / in-transit -->
      <div class="kpi-card cyan" style="cursor:pointer" onclick="navigate('trips')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div class="kpi-icon cyan" style="width:38px;height:38px">${icon('vehicles',18)}</div>
          <div style="text-align:right">
            <div class="kpi-value" style="font-size:26px">${s.activeTrips.length}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">LIVE</div>
          </div>
        </div>
        <div class="kpi-label" style="margin-top:10px">Active Trips</div>
        <div class="kpi-change">${s.pendingTrips.length} pending dispatch</div>
      </div>

      <!-- Completed -->
      <div class="kpi-card green" style="cursor:pointer" onclick="navigate('trips')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div class="kpi-icon green" style="width:38px;height:38px">${icon('check',18)}</div>
          <div style="text-align:right">
            <div class="kpi-value" style="font-size:26px">${s.completedTrips.length}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">TOTAL</div>
          </div>
        </div>
        <div class="kpi-label" style="margin-top:10px">Completed Trips</div>
        <div class="kpi-change up">${fmtNum(s.totalTons,1)} MT total</div>
      </div>

      <!-- Total Tons -->
      <div class="kpi-card purple">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div class="kpi-icon purple" style="width:38px;height:38px">${icon('weighbridge',18)}</div>
          <div style="text-align:right">
            <div class="kpi-value" style="font-size:22px">${fmtNum(s.totalTons,1)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">MT</div>
          </div>
        </div>
        <div class="kpi-label" style="margin-top:10px">Total Tonnage</div>
        <div class="kpi-change">All billed trips</div>
      </div>

      <!-- Revenue + sparkline -->
      <div class="kpi-card blue" style="cursor:pointer" onclick="navigate('billing')">
        <div style="display:flex;align-items:flex-start;justify-content:space-between">
          <div class="kpi-icon blue" style="width:38px;height:38px">${icon('billing',18)}</div>
          <div style="text-align:right">
            <div class="kpi-value" style="font-size:20px">${fmtCurrency(s.totalRevenue)}</div>
          </div>
        </div>
        <div class="kpi-label" style="margin-top:8px">Total Revenue</div>
        <div style="margin-top:8px">${_sparkBars(s.monthRevenue,'rgba(37,99,235,0.7)')}</div>
        <div class="kpi-change up" style="margin-top:4px">${fmtCurrency(s.totalCollected)} collected</div>
      </div>

      <!-- Profit ring -->
      <div class="kpi-card ${s.grossProfit >= 0 ? 'green' : 'red'}" style="cursor:pointer" onclick="navigate('reports')">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div class="kpi-value" style="font-size:20px;color:${profitColor}">${fmtCurrency(s.grossProfit)}</div>
            <div class="kpi-label" style="margin-top:4px">Gross Profit</div>
          </div>
          <div style="position:relative;display:flex;align-items:center;justify-content:center">
            ${_ring(Math.abs(s.margin), profitColor)}
            <span style="position:absolute;font-size:12px;font-weight:800;color:${profitColor};transform:rotate(90deg)">${s.margin}%</span>
          </div>
        </div>
        <div class="kpi-change" style="margin-top:10px">Margin on revenue</div>
      </div>
    </div>

    <!-- ── Row 2: Finance KPIs ─────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px" class="dash-finance-row">

      <!-- Expenses -->
      <div class="kpi-card red" style="cursor:pointer" onclick="navigate('expenses')">
        <div class="kpi-icon red" style="width:38px;height:38px;margin-bottom:10px">${icon('expenses',18)}</div>
        <div class="kpi-value" style="font-size:20px">${fmtCurrency(s.totalExpenses)}</div>
        <div class="kpi-label">Expenses</div>
        <div style="margin-top:8px">${_sparkBars(s.monthExpenses,'rgba(239,68,68,0.6)')}</div>
      </div>

      <!-- Fuel -->
      <div class="kpi-card amber" style="cursor:pointer" onclick="navigate('fuel')">
        <div class="kpi-icon amber" style="width:38px;height:38px;margin-bottom:10px">${icon('fuel',18)}</div>
        <div class="kpi-value" style="font-size:20px">${fmtCurrency(s.totalFuel)}</div>
        <div class="kpi-label">Fuel Cost</div>
        <div class="kpi-change down" style="margin-top:6px">
          ${fmtCurrency(s.totalCost)} total operating cost
        </div>
      </div>

      <!-- Outstanding payments -->
      <div class="kpi-card ${s.outstanding > 0 ? 'amber' : 'green'}" style="cursor:pointer" onclick="navigate('payments')">
        <div class="kpi-icon ${s.outstanding > 0 ? 'amber' : 'green'}" style="width:38px;height:38px;margin-bottom:10px">${icon('payments',18)}</div>
        <div class="kpi-value" style="font-size:20px">${fmtCurrency(s.outstanding)}</div>
        <div class="kpi-label">Outstanding</div>
        <div class="kpi-change ${s.outstanding > 0 ? 'down' : 'up'}" style="margin-top:6px">
          ${s.overdueInvoices.length > 0 ? s.overdueInvoices.length + ' overdue invoice(s)' : 'No overdue invoices'}
        </div>
      </div>

      <!-- Pending invoices -->
      <div class="kpi-card ${s.pendingInvoices.length > 0 ? 'amber' : 'green'}" style="cursor:pointer" onclick="navigate('billing')">
        <div class="kpi-icon ${s.pendingInvoices.length > 0 ? 'amber' : 'green'}" style="width:38px;height:38px;margin-bottom:10px">${icon('billing',18)}</div>
        <div class="kpi-value" style="font-size:20px">${s.pendingInvoices.length}</div>
        <div class="kpi-label">Pending Invoices</div>
        <div class="kpi-change down" style="margin-top:6px">${fmtCurrency(s.pendingInvTotal)} receivable</div>
      </div>
    </div>

    <!-- ── Row 3: Charts (2 big + 1 right col) ──────────────────────────── -->
    <div style="display:grid;grid-template-columns:1fr 1fr 340px;gap:18px;margin-bottom:18px" class="dash-charts-row">

      <!-- Revenue / Expenses / Profit line+bar combo -->
      <div class="card" style="grid-column:span 2">
        <div class="card-header">
          <div>
            <div class="card-title">Revenue · Expenses · Profit — Last 6 Months</div>
            <div class="card-sub">All values from actual trips, invoices and expenses</div>
          </div>
          <div style="display:flex;gap:6px">
            <span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(37,99,235,0.15);color:#60a5fa;font-weight:600">Revenue</span>
            <span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(239,68,68,0.15);color:#f87171;font-weight:600">Expenses</span>
            <span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(16,185,129,0.15);color:#34d399;font-weight:600">Profit</span>
          </div>
        </div>
        <div class="chart-container" style="height:240px">
          <canvas id="chart-rev-exp"></canvas>
        </div>
      </div>

      <!-- Trip status donut -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Trip Status</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;height:180px">
          <canvas id="chart-trip-donut" style="max-height:170px;max-width:170px"></canvas>
        </div>
        <!-- Legend with counts -->
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          ${[
            ['Completed', s.completedTrips.length, '#10b981'],
            ['In Transit', s.activeTrips.length, '#2563eb'],
            ['Pending',    s.pendingTrips.length,  '#f59e0b'],
          ].map(([l,v,c]) => `
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="width:9px;height:9px;border-radius:50%;background:${c};flex-shrink:0"></div>
                <span style="color:var(--text-muted)">${l}</span>
              </div>
              <span style="font-weight:700;color:var(--text-primary)">${v}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- ── Row 4: Trips per month + Material tonnage ─────────────────────── -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px" class="dash-mid-row">

      <!-- Trips per month bar -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Completed Trips — Monthly</div>
          <div class="card-sub">Count of completed trips per month</div>
        </div>
        <div class="chart-container" style="height:200px">
          <canvas id="chart-trips-monthly"></canvas>
        </div>
      </div>

      <!-- Material tonnage horizontal bar -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Material Tonnage (MT)</div>
          <div class="card-sub">Total billed weight by material type</div>
        </div>
        <div class="chart-container" style="height:200px">
          <canvas id="chart-material"></canvas>
        </div>
      </div>
    </div>

    <!-- ── Row 5: Active trips + E-Way alerts ───────────────────────────── -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:18px;margin-bottom:18px" class="dash-live-row">

      <!-- Active + Pending trips live table -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Active & Pending Trips</div>
            <div class="card-sub">${s.allActiveSorted.length} trip${s.allActiveSorted.length !== 1 ? 's' : ''} require attention</div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="navigate('trips')">${icon('chevronRight',13)} All Trips</button>
        </div>
        ${s.allActiveSorted.length === 0
          ? `<div class="empty-state" style="padding:30px 0">${icon('check',32)}<h3>All clear</h3><p>No active or pending trips right now</p></div>`
          : `<div class="table-wrap">
            <table>
              <thead><tr><th>Trip</th><th>Date</th><th>Route</th><th>Driver</th><th>Vehicle</th><th>Wt (MT)</th><th>Freight</th><th>Status</th></tr></thead>
              <tbody>
              ${s.allActiveSorted.map(t => `
                <tr onclick="navigate('trips')" style="cursor:pointer">
                  <td class="font-bold text-blue">${t.id}</td>
                  <td>${fmtDate(t.date)}</td>
                  <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis">${t.from} → ${t.to}</td>
                  <td>${KKR.driverName(t.driver)}</td>
                  <td>${KKR.vehicleReg(t.vehicle)}</td>
                  <td class="text-right">${fmtNum(t.billedWt, 1)}</td>
                  <td class="font-bold">${fmtCurrency(t.freight)}</td>
                  <td>${statusBadge(t.status)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
      </div>

      <!-- E-Way bills expiring + doc alerts stacked -->
      <div style="display:flex;flex-direction:column;gap:16px">

        <!-- E-Way expiring -->
        <div class="card" style="flex:0 0 auto">
          <div class="card-header">
            <div>
              <div class="card-title">E-Way Bills Expiring Soon</div>
              <div class="card-sub">Within 3 days</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="navigate('eway')">${icon('chevronRight',13)}</button>
          </div>
          ${s.expiring.length === 0
            ? `<div style="padding:16px 0;text-align:center;color:var(--text-muted);font-size:12px">${icon('check',16)} All e-way bills valid</div>`
            : s.expiring.map(e => {
                const d = daysFromNow(e.validUpto);
                const col = d === 0 ? '#ef4444' : d === 1 ? '#f59e0b' : '#60a5fa';
                return `
                <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.3)">
                  <div style="width:36px;height:36px;border-radius:8px;background:rgba(239,68,68,0.12);display:flex;align-items:center;justify-content:center;color:#f87171;flex-shrink:0;font-size:13px;font-weight:800">${d}d</div>
                  <div style="flex:1;overflow:hidden">
                    <div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.billNo}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${e.from} → ${e.to} · ${fmtDate(e.validUpto)}</div>
                  </div>
                </div>`;}).join('')}
        </div>

        <!-- Document / vehicle alerts -->
        <div class="card" style="flex:1">
          <div class="card-header">
            <div>
              <div class="card-title">Vehicle & Doc Alerts</div>
              <div class="card-sub">Expiring within 60 days</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="navigate('documents')">${icon('chevronRight',13)}</button>
          </div>
          ${s.docAlerts.length === 0
            ? `<div style="padding:16px 0;text-align:center;color:var(--text-muted);font-size:12px">${icon('check',16)} No expiry alerts</div>`
            : s.docAlerts.slice(0, 5).map(a => `
              <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(51,65,85,0.3)">
                <div style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${a.priority==='high'?'#ef4444':a.priority==='medium'?'#f59e0b':'#60a5fa'}"></div>
                <div style="flex:1;overflow:hidden">
                  <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${a.reg} — ${a.type}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${fmtDate(a.date)} · <span style="color:${a.days<=7?'#f87171':a.days<=30?'#fbbf24':'#94a3b8'}">${a.days >= 0 ? a.days+'d left' : 'EXPIRED'}</span></div>
                </div>
              </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- ── Row 6: Recent trips + pending invoices ────────────────────────── -->
    <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:18px;margin-bottom:18px" class="dash-bottom-row">

      <!-- Recent trips -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Recent Trips</div>
          <button class="btn btn-sm btn-secondary" onclick="navigate('trips')">${icon('chevronRight',13)} All</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Trip</th><th>Date</th><th>Customer</th><th>Route</th><th>Freight</th><th>Status</th></tr></thead>
            <tbody>
            ${s.recentTrips.map(t => `
              <tr onclick="navigate('trips')" style="cursor:pointer">
                <td class="font-bold text-blue">${t.id}</td>
                <td>${fmtDate(t.date)}</td>
                <td>${KKR.customerName(t.customer)}</td>
                <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.from}→${t.to}</td>
                <td class="font-bold">${fmtCurrency(t.freight)}</td>
                <td>${statusBadge(t.status)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Pending invoices -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">Pending Invoices</div>
          <button class="btn btn-sm btn-secondary" onclick="navigate('billing')">${icon('chevronRight',13)} All</button>
        </div>
        ${s.pendingInvoices.length === 0
          ? `<div class="empty-state" style="padding:30px 0">${icon('check',28)}<h3>All paid</h3></div>`
          : s.pendingInvoices.map(inv => {
              const bal = inv.total - inv.paid;
              const due = daysFromNow(inv.dueDate);
              return `
              <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(51,65,85,0.3);cursor:pointer" onclick="navigate('billing')">
                <div style="width:38px;height:38px;border-radius:8px;background:${inv.status==='overdue'?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${inv.status==='overdue'?'#f87171':'#fbbf24'}" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div style="flex:1;overflow:hidden">
                  <div style="font-size:13px;font-weight:700">${inv.id}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${KKR.customerName(inv.customer)} · Due ${fmtDate(inv.dueDate)}</div>
                </div>
                <div style="text-align:right;flex-shrink:0">
                  <div style="font-size:13px;font-weight:800;color:${inv.status==='overdue'?'#f87171':'#fbbf24'}">${fmtCurrency(bal)}</div>
                  <div style="font-size:10px;color:var(--text-muted)">${inv.status==='overdue'?`${Math.abs(due)}d overdue`:`${due}d left`}</div>
                </div>
              </div>`;}).join('')}
      </div>
    </div>

    <!-- ── Row 7: Fleet + Top customers ─────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px" class="dash-fleet-row">

      <!-- Fleet status -->
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Fleet Status</div>
            <div class="card-sub">${s.vehicles.length} vehicles · ${s.fleetActive} active · ${s.fleetMaintenance} in maintenance</div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="navigate('vehicles')">${icon('chevronRight',13)}</button>
        </div>
        ${s.vehicles.map(v => {
          const d = daysFromNow(v.insurance);
          const insWarn = d !== null && d < 60;
          return `
          <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid rgba(51,65,85,0.3)">
            <div style="width:36px;height:36px;border-radius:8px;background:${v.status==='active'?'rgba(16,185,129,0.1)':v.status==='maintenance'?'rgba(245,158,11,0.1)':'rgba(239,68,68,0.1)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${v.status==='active'?'#34d399':v.status==='maintenance'?'#fbbf24':'#f87171'}" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            </div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">${v.regNo}</div>
              <div style="font-size:11px;color:var(--text-muted)">${v.make} ${v.model} · ${v.capacity}</div>
            </div>
            <div style="text-align:right">
              ${statusBadge(v.status)}
              ${insWarn ? `<div style="font-size:10px;color:#f87171;margin-top:3px">Ins: ${d}d</div>` : ''}
            </div>
          </div>`;}).join('')}
      </div>

      <!-- Top customers + drivers -->
      <div style="display:flex;flex-direction:column;gap:16px">
        <!-- Top customers -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Top Customers by Freight</div>
            <button class="btn btn-sm btn-secondary" onclick="navigate('customers')">${icon('chevronRight',13)}</button>
          </div>
          ${s.topCustomers.length === 0
            ? `<div class="text-muted text-center" style="padding:20px 0">No completed trips yet</div>`
            : (() => {
                const max = s.topCustomers[0].amt;
                return s.topCustomers.map(c => `
                  <div style="margin-bottom:12px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                      <span style="font-size:12px;font-weight:600">${c.name}</span>
                      <span style="font-size:12px;font-weight:800;color:#60a5fa">${fmtCurrency(c.amt)}</span>
                    </div>
                    <div class="progress-bar-wrap">
                      <div class="progress-bar blue" style="width:${Math.round(c.amt/max*100)}%"></div>
                    </div>
                  </div>`).join('');
              })()}
        </div>

        <!-- Drivers -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">Drivers</div>
            <button class="btn btn-sm btn-secondary" onclick="navigate('drivers')">${icon('chevronRight',13)}</button>
          </div>
          ${s.drivers.map(d => `
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid rgba(51,65,85,0.3)">
              <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#7c3aed);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:#fff;flex-shrink:0">${d.name.charAt(0)}</div>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600">${d.name}</div>
                <div style="font-size:11px;color:var(--text-muted)">${d.trips} trips · ${KKR.vehicleReg(d.vehicle)}</div>
              </div>
              ${statusBadge(d.status)}
            </div>`).join('')}
        </div>
      </div>
    </div>

  </div>

  <style>
    /* Responsive overrides for dashboard grids */
    @media(max-width:1280px) {
      .dash-kpi-row    { grid-template-columns: repeat(3,1fr) !important; }
      .dash-charts-row { grid-template-columns: 1fr 1fr !important; }
      .dash-charts-row .card:first-child { grid-column: span 2; }
    }
    @media(max-width:900px) {
      .dash-kpi-row    { grid-template-columns: repeat(2,1fr) !important; }
      .dash-finance-row{ grid-template-columns: repeat(2,1fr) !important; }
      .dash-mid-row,.dash-live-row,.dash-bottom-row,.dash-fleet-row { grid-template-columns: 1fr !important; }
      .dash-charts-row { grid-template-columns: 1fr !important; }
      .dash-charts-row .card:first-child { grid-column: span 1; }
    }
    @media(max-width:540px) {
      .dash-kpi-row    { grid-template-columns: 1fr 1fr !important; }
      .dash-finance-row{ grid-template-columns: 1fr 1fr !important; }
    }
  </style>`;
}

// ── Chart initialisation ────────────────────────────────────────────────────
function initDashboardCharts() {
  if (!window.Chart) return;

  const s = _dashStats();

  // Shared chart options helpers
  const gridColor = 'rgba(51,65,85,0.4)';
  const tickColor = '#64748b';
  const baseScales = {
    x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
    y: { ticks: { color: tickColor, font: { size: 11 },
                  callback: v => v >= 1000 ? '₹' + (v/1000).toFixed(0) + 'k' : '₹' + v },
         grid: { color: gridColor } }
  };

  // ── 1. Revenue / Expenses / Profit combo ─────────────────────────────────
  const revCtx = document.getElementById('chart-rev-exp');
  if (revCtx) {
    if (revCtx._chart) revCtx._chart.destroy();
    revCtx._chart = new Chart(revCtx, {
      type: 'bar',
      data: {
        labels: s.monthLabels,
        datasets: [
          {
            label: 'Revenue',
            data: s.monthRevenue,
            backgroundColor: 'rgba(37,99,235,0.65)',
            borderRadius: 5,
            order: 2,
          },
          {
            label: 'Expenses',
            data: s.monthExpenses,
            backgroundColor: 'rgba(239,68,68,0.55)',
            borderRadius: 5,
            order: 3,
          },
          {
            label: 'Profit',
            data: s.monthProfit,
            type: 'line',
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.1)',
            pointBackgroundColor: '#10b981',
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.4,
            order: 1,
            yAxisID: 'y',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12, padding: 16 } },
          tooltip: {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}`,
            },
          },
        },
        scales: baseScales,
      },
    });
  }

  // ── 2. Trip status donut ──────────────────────────────────────────────────
  const donutCtx = document.getElementById('chart-trip-donut');
  if (donutCtx) {
    if (donutCtx._chart) donutCtx._chart.destroy();
    const completed = s.completedTrips.length;
    const active    = s.activeTrips.length;
    const pending   = s.pendingTrips.length;
    const total     = completed + active + pending || 1;
    donutCtx._chart = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'In Transit', 'Pending'],
        datasets: [{
          data: [completed, active, pending],
          backgroundColor: ['#10b981', '#2563eb', '#f59e0b'],
          borderColor: 'transparent',
          borderWidth: 0,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            borderWidth: 1,
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw} (${Math.round(ctx.raw/total*100)}%)`,
            },
          },
        },
      },
    });
  }

  // ── 3. Monthly trip count bar ─────────────────────────────────────────────
  const mTripCtx = document.getElementById('chart-trips-monthly');
  if (mTripCtx) {
    if (mTripCtx._chart) mTripCtx._chart.destroy();
    mTripCtx._chart = new Chart(mTripCtx, {
      type: 'bar',
      data: {
        labels: s.monthLabels,
        datasets: [{
          label: 'Completed Trips',
          data: s.monthTrips,
          backgroundColor: ctx => {
            const i = ctx.dataIndex;
            const max = Math.max(...s.monthTrips, 1);
            const alpha = 0.35 + 0.55 * (s.monthTrips[i] / max);
            return `rgba(37,99,235,${alpha.toFixed(2)})`;
          },
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.raw} trips` },
          },
        },
        scales: {
          x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
          y: { ticks: { color: tickColor, font: { size: 11 }, stepSize: 1 }, grid: { color: gridColor }, beginAtZero: true },
        },
      },
    });
  }

  // ── 4. Material tonnage horizontal bar ────────────────────────────────────
  const matCtx = document.getElementById('chart-material');
  if (matCtx) {
    if (matCtx._chart) matCtx._chart.destroy();
    const matColors = ['#2563eb','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ef4444'];
    matCtx._chart = new Chart(matCtx, {
      type: 'bar',
      data: {
        labels: s.matData.map(d => d[0]),
        datasets: [{
          label: 'MT',
          data: s.matData.map(d => d[1]),
          backgroundColor: matColors.slice(0, s.matData.length),
          borderRadius: 4,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
            borderWidth: 1,
            callbacks: { label: ctx => ` ${ctx.raw.toFixed(2)} MT` },
          },
        },
        scales: {
          x: { ticks: { color: tickColor, font: { size: 11 } }, grid: { color: gridColor } },
          y: { ticks: { color: '#f1f5f9', font: { size: 11 } }, grid: { display: false } },
        },
      },
    });
  }
}
