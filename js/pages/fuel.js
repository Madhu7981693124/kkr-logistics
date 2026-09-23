// ============================================================
// KKR Logistics — Fuel Module
// Fields: date, vehicle, driver, trip, openingKM, closingKM,
//         litres, rate, fuelCost, station, paymentMethod,
//         receiptNo, notes
// Auto-calc: totalKM, fuelCost (litres × rate),
//            kmPerLitre (totalKM / litres),
//            costPerKM  (fuelCost / totalKM)
// Backward-compat: old records missing new fields default to 0/''
// ============================================================

// ── Module state ────────────────────────────────────────────────────────────
let fuelFilter   = { q: '', vehicle: '', month: '' };
let fuelTab      = 'records';   // 'records' | 'analytics'
let editingFuelId = null;
let viewingFuelId = null;

// ── Payment methods ──────────────────────────────────────────────────────────
const FUEL_PAYMENT_METHODS = ['Cash','UPI','Card','Bank Transfer','Fleet Card','Credit'];

// ── Pure calculations ────────────────────────────────────────────────────────
function _fuelCalcs(f) {
  const openKM   = f.openingKM  || 0;
  const closeKM  = f.closingKM  || 0;
  const litres   = f.litres     || 0;
  const rate     = f.rate       || 0;
  // Legacy records may already have 'amount' — prefer re-calc when new fields present
  const fuelCost = f.fuelCost   || f.amount || (litres * rate);
  const totalKM  = closeKM > openKM ? closeKM - openKM : (f.totalKM || 0);
  const kmPerLtr = litres > 0 && totalKM > 0 ? totalKM / litres : 0;
  const costPerKM= totalKM > 0 && fuelCost > 0 ? fuelCost / totalKM : 0;
  return { fuelCost, totalKM, kmPerLtr, costPerKM };
}

// ── Month label helpers ──────────────────────────────────────────────────────
function _monthLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function _monthDisplay(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1).toLocaleString('default', { month: 'short', year: 'numeric' });
}

// ── Fleet aggregate stats ────────────────────────────────────────────────────
function _fuelStats(rows) {
  const totalLitres  = rows.reduce((s, r) => s + (r.litres    || 0), 0);
  const totalCost    = rows.reduce((s, r) => s + _fuelCalcs(r).fuelCost, 0);
  const totalKM      = rows.reduce((s, r) => s + _fuelCalcs(r).totalKM, 0);
  const avgRate      = totalLitres > 0 ? totalCost / totalLitres : 0;
  const avgKmPerLtr  = totalLitres > 0 && totalKM > 0 ? totalKM / totalLitres : 0;
  const avgCostPerKM = totalKM > 0 ? totalCost / totalKM : 0;
  return { totalLitres, totalCost, totalKM, avgRate, avgKmPerLtr, avgCostPerKM };
}

// ── Per-vehicle analytics ────────────────────────────────────────────────────
function _fuelByVehicle(allFuel) {
  const map = {};
  allFuel.forEach(f => {
    if (!map[f.vehicle]) map[f.vehicle] = { litres: 0, cost: 0, km: 0, fills: 0 };
    const c = _fuelCalcs(f);
    map[f.vehicle].litres += f.litres || 0;
    map[f.vehicle].cost   += c.fuelCost;
    map[f.vehicle].km     += c.totalKM;
    map[f.vehicle].fills  += 1;
  });
  return Object.entries(map)
    .map(([vid, d]) => ({
      vid,
      regNo:     KKR.vehicleReg(vid),
      litres:    d.litres,
      cost:      d.cost,
      km:        d.km,
      fills:     d.fills,
      kmPerLtr:  d.litres > 0 && d.km > 0 ? d.km / d.litres : 0,
      costPerKM: d.km > 0 ? d.cost / d.km : 0,
    }))
    .sort((a, b) => b.cost - a.cost);
}

// ── Available months from records ─────────────────────────────────────────────
function _fuelMonths(allFuel) {
  return [...new Set(allFuel.map(f => _monthLabel(f.date)).filter(Boolean))].sort().reverse();
}

// ── Main render ─────────────────────────────────────────────────────────────
function renderFuel() {
  const allFuel  = KKR.getFuel();
  const allStats = _fuelStats(allFuel);
  const months   = _fuelMonths(allFuel);

  let rows = [...allFuel];
  if (fuelFilter.vehicle) rows = rows.filter(f => f.vehicle === fuelFilter.vehicle);
  if (fuelFilter.month)   rows = rows.filter(f => _monthLabel(f.date) === fuelFilter.month);
  if (fuelFilter.q) {
    const q = fuelFilter.q.toLowerCase();
    rows = rows.filter(f =>
      (f.station    || '').toLowerCase().includes(q) ||
      (f.receiptNo  || '').toLowerCase().includes(q) ||
      (f.tripId     || '').toLowerCase().includes(q) ||
      KKR.vehicleReg(f.vehicle).toLowerCase().includes(q) ||
      KKR.driverName(f.driver).toLowerCase().includes(q)
    );
  }
  rows = [...rows].sort((a, b) => b.date.localeCompare(a.date));

  const filtStats = _fuelStats(rows);
  const vehData   = _fuelByVehicle(allFuel);

  return `
  <div class="page-content">

    <!-- ── Header ──────────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Fuel</div>
        <div class="subtitle">${allFuel.length} fill-up${allFuel.length !== 1 ? 's' : ''} · ${fmtNum(allStats.totalLitres, 0)} L · ${fmtCurrency(allStats.totalCost)}</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="exportFuelCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-primary" onclick="openFuelForm()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Fill-up
        </button>
      </div>
    </div>

    <!-- ── KPI strip ─────────────────────────────────────────────────── -->
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:20px" class="fuel-kpi-strip">
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:20px;font-weight:800;color:#fbbf24">${fmtNum(allStats.totalLitres, 0)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Total Litres</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:20px;font-weight:800;color:#f87171">${fmtCurrency(allStats.totalCost)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Total Cost</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:20px;font-weight:800;color:#60a5fa">${fmtNum(allStats.totalKM, 0)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Total KM</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:20px;font-weight:800;color:#94a3b8">₹${allStats.avgRate.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Avg Rate/L</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:20px;font-weight:800;color:#34d399">${allStats.avgKmPerLtr > 0 ? allStats.avgKmPerLtr.toFixed(2) : '—'}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">KM / Litre</div>
      </div>
      <div class="card card-sm" style="text-align:center">
        <div style="font-size:20px;font-weight:800;color:#a78bfa">${allStats.avgCostPerKM > 0 ? '₹'+allStats.avgCostPerKM.toFixed(2) : '—'}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px;text-transform:uppercase;letter-spacing:.5px">Cost / KM</div>
      </div>
    </div>

    <!-- ── Tabs ──────────────────────────────────────────────────────── -->
    <div class="tabs" style="margin-bottom:0">
      <div class="tab ${fuelTab==='records'?'active':''}" onclick="fuelTab='records';rerenderPage()">Fill-up Records</div>
      <div class="tab ${fuelTab==='analytics'?'active':''}" onclick="fuelTab='analytics';rerenderPage()">Vehicle Analytics</div>
    </div>

    ${fuelTab === 'analytics' ? _renderFuelAnalytics(vehData, allFuel, allStats) : _renderFuelRecords(rows, allFuel, filtStats, months)}

  </div>

  <!-- ── Add / Edit modal ──────────────────────────────────────────── -->
  <div class="modal-overlay" id="fuel-form-modal">
    <div class="modal" style="max-width:740px">
      <div class="modal-header">
        <div class="modal-title" id="fuel-form-title">Add Fuel Fill-up</div>
        <button class="modal-close" onclick="closeModal('fuel-form-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="fuel-form-body"></div>
    </div>
  </div>

  <style>
    @media(max-width:900px){ .fuel-kpi-strip{grid-template-columns:repeat(3,1fr)!important} }
    @media(max-width:540px){ .fuel-kpi-strip{grid-template-columns:repeat(2,1fr)!important} }
  </style>`;
}

// ── Records tab ───────────────────────────────────────────────────────────
function _renderFuelRecords(rows, allFuel, filtStats, months) {
  const vehicles = KKR.getVehicles();
  return `
  <div class="card" style="border-radius:0 12px 12px 12px">
    <div class="filter-bar" style="margin-bottom:16px;flex-wrap:wrap">
      <div class="search-input-wrap" style="flex:1;min-width:180px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" placeholder="Search vehicle, station, trip, receipt…"
          value="${fuelFilter.q}" oninput="fuelFilter.q=this.value;rerenderPage()">
      </div>
      <select class="form-control" style="width:160px" onchange="fuelFilter.vehicle=this.value;rerenderPage()">
        <option value="">All Vehicles</option>
        ${vehicles.map(v => `<option value="${v.id}" ${fuelFilter.vehicle===v.id?'selected':''}>${v.regNo}</option>`).join('')}
      </select>
      <select class="form-control" style="width:140px" onchange="fuelFilter.month=this.value;rerenderPage()">
        <option value="">All Months</option>
        ${months.map(m => `<option value="${m}" ${fuelFilter.month===m?'selected':''}>${_monthDisplay(m)}</option>`).join('')}
      </select>
      ${fuelFilter.q||fuelFilter.vehicle||fuelFilter.month
        ? `<button class="btn btn-secondary btn-sm" onclick="fuelFilter={q:'',vehicle:'',month:''};rerenderPage()">Clear</button>` : ''}
      <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${rows.length} records</span>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Vehicle</th>
            <th>Driver</th>
            <th>Trip</th>
            <th>Station</th>
            <th>Opening KM</th>
            <th>Closing KM</th>
            <th style="text-align:right">Total KM</th>
            <th style="text-align:right">Litres</th>
            <th style="text-align:right">Rate (₹/L)</th>
            <th style="text-align:right">Fuel Cost</th>
            <th style="text-align:right">KM/L</th>
            <th style="text-align:right">₹/KM</th>
            <th>Payment</th>
            <th>Receipt</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
        ${rows.length === 0 ? `
          <tr><td colspan="16" style="padding:56px;text-align:center;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:8px">⛽</div>
            <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No fuel records</div>
            <div style="font-size:12px">${fuelFilter.q||fuelFilter.vehicle||fuelFilter.month ? 'Try clearing filters' : 'Click "Add Fill-up" to start tracking'}</div>
          </td></tr>` :
          rows.map(f => {
            const c  = _fuelCalcs(f);
            const eff = c.kmPerLtr > 0 ? c.kmPerLtr.toFixed(2) : '—';
            const cpp = c.costPerKM > 0 ? '₹'+c.costPerKM.toFixed(2) : '—';
            // Efficiency colour coding
            const effColor = c.kmPerLtr >= 4 ? '#34d399' : c.kmPerLtr >= 2.5 ? '#fbbf24' : c.kmPerLtr > 0 ? '#f87171' : 'var(--text-muted)';
            return `
            <tr>
              <td style="white-space:nowrap">${fmtDate(f.date)}</td>
              <td style="white-space:nowrap">${KKR.vehicleReg(f.vehicle)}</td>
              <td style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${KKR.driverName(f.driver) || '—'}</td>
              <td>${f.tripId ? `<span class="text-blue font-bold">${f.tripId}</span>` : '—'}</td>
              <td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.station || '—'}</td>
              <td class="text-right">${f.openingKM > 0 ? fmtNum(f.openingKM, 0)+' km' : '—'}</td>
              <td class="text-right">${f.closingKM > 0 ? fmtNum(f.closingKM, 0)+' km' : '—'}</td>
              <td class="text-right font-bold" style="color:#60a5fa">${c.totalKM > 0 ? fmtNum(c.totalKM, 0)+' km' : '—'}</td>
              <td class="text-right font-bold">${fmtNum(f.litres || 0, 2)} L</td>
              <td class="text-right">₹${(f.rate || 0).toFixed(2)}</td>
              <td class="text-right font-bold">${fmtCurrency(c.fuelCost)}</td>
              <td class="text-right" style="color:${effColor};font-weight:${c.kmPerLtr>0?'700':'400'}">${eff}</td>
              <td class="text-right" style="color:var(--text-muted)">${cpp}</td>
              <td>
                ${f.paymentMethod
                  ? `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:rgba(37,99,235,0.1);color:#60a5fa;font-weight:600">${f.paymentMethod}</span>`
                  : '—'}
              </td>
              <td style="color:var(--text-muted);font-size:11px">${f.receiptNo || '—'}</td>
              <td>
                <div class="flex gap-2" style="justify-content:center">
                  <button class="btn btn-xs btn-secondary" title="Edit" onclick="openFuelForm('${f.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn btn-xs btn-danger" title="Delete" onclick="deleteFuel('${f.id}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
        ${rows.length > 0 ? `
        <tfoot>
          <tr style="border-top:2px solid var(--border);background:rgba(251,146,60,0.04)">
            <td colspan="7" style="padding:11px 16px;font-weight:700;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">
              Totals (${rows.length})
            </td>
            <td class="text-right font-bold" style="padding:11px 16px;color:#60a5fa">${filtStats.totalKM > 0 ? fmtNum(filtStats.totalKM,0)+' km' : '—'}</td>
            <td class="text-right font-bold" style="padding:11px 16px">${fmtNum(filtStats.totalLitres, 2)} L</td>
            <td style="padding:11px 16px"></td>
            <td class="text-right font-bold" style="padding:11px 16px;color:#f87171">${fmtCurrency(filtStats.totalCost)}</td>
            <td class="text-right font-bold" style="padding:11px 16px;color:#34d399">${filtStats.avgKmPerLtr > 0 ? filtStats.avgKmPerLtr.toFixed(2) : '—'}</td>
            <td class="text-right font-bold" style="padding:11px 16px;color:#a78bfa">${filtStats.avgCostPerKM > 0 ? '₹'+filtStats.avgCostPerKM.toFixed(2) : '—'}</td>
            <td colspan="3"></td>
          </tr>
        </tfoot>` : ''}
      </table>
    </div>
  </div>`;
}

// ── Vehicle Analytics tab ─────────────────────────────────────────────────
function _renderFuelAnalytics(vehData, allFuel, allStats) {
  if (!vehData.length) return `
    <div class="card" style="border-radius:0 12px 12px 12px;padding:60px;text-align:center;color:var(--text-muted)">
      <div style="font-size:40px;margin-bottom:12px">⛽</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary)">No fuel data yet</div>
    </div>`;

  const maxCost  = vehData[0].cost;

  return `
  <div class="card" style="border-radius:0 12px 12px 12px">

    <!-- Per-vehicle table -->
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px">
      Per-Vehicle Fuel Performance
    </div>
    <div class="table-wrap" style="margin-bottom:28px">
      <table>
        <thead>
          <tr>
            <th>Vehicle</th>
            <th style="text-align:center">Fill-ups</th>
            <th style="text-align:right">Total Litres</th>
            <th style="text-align:right">Total KM</th>
            <th style="text-align:right">Fuel Cost</th>
            <th style="text-align:right">KM / Litre</th>
            <th style="text-align:right">Cost / KM</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
        ${vehData.map(v => {
          const pct      = allStats.totalCost > 0 ? Math.round(v.cost / allStats.totalCost * 100) : 0;
          const effColor = v.kmPerLtr >= 4 ? '#34d399' : v.kmPerLtr >= 2.5 ? '#fbbf24' : v.kmPerLtr > 0 ? '#f87171' : 'var(--text-muted)';
          return `
          <tr>
            <td class="font-bold">${v.regNo}</td>
            <td style="text-align:center">${v.fills}</td>
            <td class="text-right">${fmtNum(v.litres, 2)} L</td>
            <td class="text-right">${v.km > 0 ? fmtNum(v.km, 0)+' km' : '—'}</td>
            <td class="text-right font-bold">${fmtCurrency(v.cost)}</td>
            <td class="text-right font-bold" style="color:${effColor}">${v.kmPerLtr > 0 ? v.kmPerLtr.toFixed(2) : '—'}</td>
            <td class="text-right" style="color:var(--text-muted)">${v.costPerKM > 0 ? '₹'+v.costPerKM.toFixed(2) : '—'}</td>
            <td style="min-width:100px">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="flex:1;background:var(--bg-dark);border-radius:99px;height:5px;overflow:hidden">
                  <div style="height:100%;background:#f59e0b;border-radius:99px;width:${pct}%"></div>
                </div>
                <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">${pct}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>

    <!-- Efficiency bar chart (pure CSS) -->
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px">
      KM per Litre — Fleet Comparison
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:28px">
      ${vehData.filter(v => v.kmPerLtr > 0).map(v => {
        const maxKmL = Math.max(...vehData.filter(x=>x.kmPerLtr>0).map(x=>x.kmPerLtr), 1);
        const pct    = Math.round(v.kmPerLtr / maxKmL * 100);
        const color  = v.kmPerLtr >= 4 ? '#34d399' : v.kmPerLtr >= 2.5 ? '#fbbf24' : '#f87171';
        return `
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:13px;font-weight:600">${v.regNo}</span>
            <span style="font-size:13px;font-weight:700;color:${color}">${v.kmPerLtr.toFixed(2)} KM/L</span>
          </div>
          <div style="background:var(--bg-dark);border-radius:99px;height:8px;overflow:hidden">
            <div style="height:100%;border-radius:99px;background:${color};width:${pct}%;transition:width .4s"></div>
          </div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px">${fmtNum(v.litres,0)} L used · ${v.km > 0 ? fmtNum(v.km,0)+' km' : 'no KM data'}</div>
        </div>`;
      }).join('') || '<div style="color:var(--text-muted)">No KM data available. Enter opening and closing KM when adding fill-ups.</div>'}
    </div>

    <!-- Cost per KM -->
    <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:14px">
      Cost per KM — Fleet Comparison
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      ${vehData.filter(v => v.costPerKM > 0).map(v => {
        const maxCpp = Math.max(...vehData.filter(x=>x.costPerKM>0).map(x=>x.costPerKM), 1);
        const pct    = Math.round(v.costPerKM / maxCpp * 100);
        const color  = v.costPerKM < 5 ? '#34d399' : v.costPerKM < 10 ? '#fbbf24' : '#f87171';
        return `
        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:13px;font-weight:600">${v.regNo}</span>
            <span style="font-size:13px;font-weight:700;color:${color}">₹${v.costPerKM.toFixed(2)}/km</span>
          </div>
          <div style="background:var(--bg-dark);border-radius:99px;height:8px;overflow:hidden">
            <div style="height:100%;border-radius:99px;background:${color};width:${pct}%;transition:width .4s"></div>
          </div>
        </div>`;
      }).join('') || '<div style="color:var(--text-muted)">No KM data available.</div>'}
    </div>
  </div>`;
}

// ── Add / Edit form ──────────────────────────────────────────────────────────
function openFuelForm(id = null) {
  editingFuelId = id;
  const f       = id ? (KKR.getFuel().find(x => x.id === id) || {}) : {};
  const vehicles = KKR.getVehicles();
  const drivers  = KKR.getDrivers();
  const trips    = KKR.getTrips().filter(t => t.status !== 'cancelled');
  document.getElementById('fuel-form-title').textContent = id ? `Edit Fill-up` : 'Add Fuel Fill-up';

  document.getElementById('fuel-form-body').innerHTML = `
    <form onsubmit="saveFuel(event)" autocomplete="off">

      <!-- ─ Basic ───────────────────────────────────────────────────── -->
      <div class="fuel-section-hdr">Fill-up Details</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Date <span style="color:#f87171">*</span></label>
          <input type="date" class="form-control" id="ff-date"
            value="${fmtDateInput(f.date || today())}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Vehicle <span style="color:#f87171">*</span></label>
          <select class="form-control" id="ff-vehicle" required
            onchange="fuelAutoFillDriver(this.value)">
            <option value="">— Select —</option>
            ${vehicles.map(v =>
              `<option value="${v.id}" ${f.vehicle===v.id?'selected':''}>${v.regNo} · ${v.make} ${v.model}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Driver</label>
          <select class="form-control" id="ff-driver">
            <option value="">— Select —</option>
            ${drivers.map(d =>
              `<option value="${d.id}" ${f.driver===d.id?'selected':''}>${d.name}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Link to Trip</label>
          <select class="form-control" id="ff-trip"
            onchange="fuelAutoFillFromTrip(this.value)">
            <option value="">— Not linked —</option>
            ${trips.map(t => {
              const from = t.loadingPoint || t.from || '';
              const to   = t.destination  || t.to   || '';
              return `<option value="${t.id}" ${f.tripId===t.id?'selected':''}>${t.id}${from?' · '+from+'→'+to:''}</option>`;
            }).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Fuel Station <span style="color:#f87171">*</span></label>
          <input class="form-control" id="ff-station"
            value="${f.station || ''}"
            placeholder="HP, IOCL, BPCL, HPCL…"
            list="fuel-station-list" required>
          <datalist id="fuel-station-list">
            ${[...new Set(KKR.getFuel().map(x=>x.station).filter(Boolean))].map(s=>`<option>${s}</option>`).join('')}
          </datalist>
        </div>
      </div>

      <!-- ─ Odometer ────────────────────────────────────────────────── -->
      <div class="fuel-section-hdr" style="margin-top:18px">Odometer / KM</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Opening KM</label>
          <input type="number" class="form-control" id="ff-openKM"
            value="${f.openingKM ?? ''}"
            placeholder="KM at start of trip"
            min="0" step="1" oninput="fuelCalc()">
        </div>
        <div class="form-group">
          <label class="form-label">Closing KM</label>
          <input type="number" class="form-control" id="ff-closeKM"
            value="${f.closingKM ?? ''}"
            placeholder="KM at fill-up"
            min="0" step="1" oninput="fuelCalc()">
        </div>
        <div class="form-group">
          <label class="form-label">Total KM</label>
          <input type="number" class="form-control" id="ff-totalKM"
            value="${f.totalKM || ''}" readonly
            style="background:rgba(37,99,235,0.05);cursor:not-allowed">
        </div>
      </div>

      <!-- ─ Fuel quantities ─────────────────────────────────────────── -->
      <div class="fuel-section-hdr" style="margin-top:18px">Fuel & Cost</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Diesel Litres <span style="color:#f87171">*</span></label>
          <input type="number" step="0.01" class="form-control" id="ff-litres"
            value="${f.litres ?? ''}" placeholder="0.00"
            min="0" oninput="fuelCalc()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Rate (₹/Litre) <span style="color:#f87171">*</span></label>
          <input type="number" step="0.01" class="form-control" id="ff-rate"
            value="${f.rate ?? ''}" placeholder="0.00"
            min="0" oninput="fuelCalc()" required>
        </div>
        <div class="form-group">
          <label class="form-label">Fuel Cost (₹)</label>
          <input type="number" step="0.01" class="form-control" id="ff-cost"
            value="${f.fuelCost || f.amount || ''}" readonly
            style="background:rgba(245,158,11,0.07);border-color:rgba(245,158,11,0.3);cursor:not-allowed;font-weight:700">
        </div>
      </div>

      <!-- Live efficiency display -->
      <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:14px 18px;margin-bottom:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px" id="fuel-eff-box">
        <div style="text-align:center">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">KM / Litre</div>
          <div style="font-size:22px;font-weight:900;color:#34d399" id="ff-disp-kml">—</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Cost / KM</div>
          <div style="font-size:22px;font-weight:900;color:#a78bfa" id="ff-disp-cpk">—</div>
        </div>
      </div>

      <!-- ─ Payment ─────────────────────────────────────────────────── -->
      <div class="fuel-section-hdr" style="margin-top:2px">Payment & Receipt</div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Payment Method</label>
          <select class="form-control" id="ff-payment">
            <option value="">— Select —</option>
            ${FUEL_PAYMENT_METHODS.map(m =>
              `<option value="${m}" ${(f.paymentMethod||'')===m?'selected':''}>${m}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Receipt No.</label>
          <input class="form-control" id="ff-receipt"
            value="${f.receiptNo || ''}" placeholder="Optional">
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <input class="form-control" id="ff-notes"
            value="${f.notes || ''}" placeholder="Optional">
        </div>
      </div>

      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('fuel-form-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update' : 'Save Fill-up'}
        </button>
      </div>
    </form>
    <style>
      .fuel-section-hdr{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
    </style>`;

  openModal('fuel-form-modal');
  fuelCalc(); // populate calcs for existing records
}

// ── Auto-fill driver when vehicle changes ─────────────────────────────────
function fuelAutoFillDriver(vehicleId) {
  const v   = KKR.getVehicles().find(x => x.id === vehicleId);
  const dEl = document.getElementById('ff-driver');
  if (v && v.driver && dEl && !dEl.value) dEl.value = v.driver;
}

// ── Auto-fill from trip ────────────────────────────────────────────────────
function fuelAutoFillFromTrip(tripId) {
  if (!tripId) return;
  const t   = KKR.getTrips().find(x => x.id === tripId);
  if (!t) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val && !el.value) el.value = val; };
  set('ff-vehicle', t.vehicle);
  set('ff-driver',  t.driver);
  fuelAutoFillDriver(t.vehicle);
}

// ── Live calculation ──────────────────────────────────────────────────────
function fuelCalc() {
  const openKM  = parseFloat(document.getElementById('ff-openKM')?.value)  || 0;
  const closeKM = parseFloat(document.getElementById('ff-closeKM')?.value) || 0;
  const litres  = parseFloat(document.getElementById('ff-litres')?.value)  || 0;
  const rate    = parseFloat(document.getElementById('ff-rate')?.value)    || 0;

  const totalKM  = Math.max(0, closeKM - openKM);
  const fuelCost = litres * rate;
  const kmPerLtr = litres > 0 && totalKM > 0 ? totalKM / litres : 0;
  const costPerKM= totalKM > 0 && fuelCost > 0 ? fuelCost / totalKM : 0;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('ff-totalKM', totalKM > 0 ? totalKM : '');
  set('ff-cost',    fuelCost > 0 ? fuelCost.toFixed(2) : '');

  const kmlEl = document.getElementById('ff-disp-kml');
  const cpkEl = document.getElementById('ff-disp-cpk');
  if (kmlEl) kmlEl.textContent = kmPerLtr  > 0 ? kmPerLtr.toFixed(2)   : '—';
  if (cpkEl) cpkEl.textContent = costPerKM > 0 ? '₹'+costPerKM.toFixed(2) : '—';
}

// ── Save ────────────────────────────────────────────────────────────────────
function saveFuel(e) {
  e.preventDefault();
  const fuel     = KKR.getFuel();
  const openKM   = parseFloat(document.getElementById('ff-openKM').value)  || 0;
  const closeKM  = parseFloat(document.getElementById('ff-closeKM').value) || 0;
  const litres   = parseFloat(document.getElementById('ff-litres').value)  || 0;
  const rate     = parseFloat(document.getElementById('ff-rate').value)    || 0;
  const fuelCost = litres * rate;
  const totalKM  = Math.max(0, closeKM - openKM);

  if (openKM > 0 && closeKM > 0 && closeKM < openKM) {
    toast('Closing KM must be greater than Opening KM', 'error');
    return;
  }

  const entry = {
    id:            editingFuelId || 'F' + Date.now().toString().slice(-6),
    date:          document.getElementById('ff-date').value,
    vehicle:       document.getElementById('ff-vehicle').value,
    driver:        document.getElementById('ff-driver').value,
    tripId:        document.getElementById('ff-trip').value,
    station:       document.getElementById('ff-station').value.trim(),
    openingKM:     openKM,
    closingKM:     closeKM,
    totalKM:       totalKM,
    litres,
    rate,
    fuelCost,
    amount:        fuelCost,   // legacy alias
    odometer:      closeKM || 0, // legacy alias
    kmPerLitre:    litres > 0 && totalKM > 0 ? totalKM / litres : 0,
    costPerKM:     totalKM > 0 && fuelCost > 0 ? fuelCost / totalKM : 0,
    paymentMethod: document.getElementById('ff-payment').value,
    receiptNo:     document.getElementById('ff-receipt').value.trim(),
    notes:         document.getElementById('ff-notes').value.trim(),
  };

  const idx = fuel.findIndex(x => x.id === editingFuelId);
  if (idx >= 0) fuel[idx] = entry; else fuel.unshift(entry);
  KKR.saveFuel(fuel);
  closeModal('fuel-form-modal');
  toast(editingFuelId ? 'Fill-up updated' : 'Fill-up saved', 'success');
  rerenderPage();
}

// ── Delete ────────────────────────────────────────────────────────────────
function deleteFuel(id) {
  const f = KKR.getFuel().find(x => x.id === id);
  const lbl = f ? `${KKR.vehicleReg(f.vehicle)} — ${fmtDate(f.date)}` : id;
  confirmDelete(lbl, () => {
    KKR.saveFuel(KKR.getFuel().filter(x => x.id !== id));
    toast('Fuel record deleted', 'error');
    rerenderPage();
  });
}

// ── Export CSV ────────────────────────────────────────────────────────────
function exportFuelCSV() {
  const rows = KKR.getFuel().map(f => {
    const c = _fuelCalcs(f);
    return {
      'Date':            f.date,
      'Vehicle':         KKR.vehicleReg(f.vehicle),
      'Driver':          KKR.driverName(f.driver) || '',
      'Trip':            f.tripId || '',
      'Station':         f.station || '',
      'Opening KM':      f.openingKM || '',
      'Closing KM':      f.closingKM || '',
      'Total KM':        c.totalKM || '',
      'Litres':          f.litres,
      'Rate (₹/L)':      f.rate,
      'Fuel Cost (₹)':   c.fuelCost.toFixed(2),
      'KM/Litre':        c.kmPerLtr > 0 ? c.kmPerLtr.toFixed(2) : '',
      'Cost/KM (₹)':     c.costPerKM > 0 ? c.costPerKM.toFixed(2) : '',
      'Payment Method':  f.paymentMethod || '',
      'Receipt No':      f.receiptNo || '',
      'Notes':           f.notes || '',
    };
  });
  exportCSV(Object.keys(rows[0] || {}), rows, `kkr-fuel-${today()}.csv`);
  toast('Fuel records exported', 'success');
}

// ── Backward-compat alias ────────────────────────────────────────────────
function openFuelModal(id = null) { openFuelForm(id); }
function calcFuelAmt()            { fuelCalc(); }
