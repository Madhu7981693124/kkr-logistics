// ============================================================
// KKR Logistics — Materials Module
// Master list for all cargo/material types used in trips.
// Preset materials seed the list; custom materials can be added.
// Each material shows live usage stats from weighbridge & trips.
// ============================================================

// ── Module state ────────────────────────────────────────────────────────────
let materialsFilter  = { q: '', category: '' };
let editingMaterialId = null;

// ── Preset categories with colours ──────────────────────────────────────────
const MAT_CATEGORIES = [
  { name: 'Mineral',        color: '#60a5fa', bg: 'rgba(37,99,235,0.12)'  },
  { name: 'Metal Ore',      color: '#f87171', bg: 'rgba(239,68,68,0.12)'  },
  { name: 'Finished Steel', color: '#34d399', bg: 'rgba(16,185,129,0.12)' },
  { name: 'Aggregate',      color: '#fbbf24', bg: 'rgba(245,158,11,0.12)' },
  { name: 'Cement',         color: '#e2e8f0', bg: 'rgba(148,163,184,0.12)'},
  { name: 'By-product',     color: '#a78bfa', bg: 'rgba(139,92,246,0.12)' },
  { name: 'Scrap',          color: '#fb923c', bg: 'rgba(251,146,60,0.12)' },
  { name: 'Agricultural',   color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  { name: 'Chemical',       color: '#67e8f9', bg: 'rgba(103,232,249,0.12)'},
  { name: 'Other',          color: '#94a3b8', bg: 'rgba(148,163,184,0.12)'},
];

// ── Preset quick-add materials ───────────────────────────────────────────────
const MAT_PRESETS = [
  { name:'Coal',         category:'Mineral',        unit:'MT', density:'1.4 t/m³', notes:'Thermal / coking grade' },
  { name:'Iron Ore',     category:'Metal Ore',      unit:'MT', density:'2.5 t/m³', notes:'Grade A / Grade B'      },
  { name:'Limestone',    category:'Mineral',        unit:'MT', density:'2.7 t/m³', notes:'Used in steel plants'   },
  { name:'Cement',       category:'Cement',         unit:'MT', density:'1.5 t/m³', notes:''                       },
  { name:'Fly Ash',      category:'By-product',     unit:'MT', density:'1.0 t/m³', notes:'From thermal plants'    },
  { name:'Sand',         category:'Aggregate',      unit:'MT', density:'1.6 t/m³', notes:''                       },
  { name:'Gravel',       category:'Aggregate',      unit:'MT', density:'1.7 t/m³', notes:''                       },
  { name:'Steel Coils',  category:'Finished Steel', unit:'MT', density:'N/A',       notes:'HR & CR coils'         },
  { name:'Scrap Metal',  category:'Scrap',          unit:'MT', density:'N/A',       notes:'Mixed scrap'           },
  { name:'Alumina',      category:'Metal Ore',      unit:'MT', density:'3.9 t/m³', notes:''                       },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function _catStyle(catName) {
  const c = MAT_CATEGORIES.find(x => x.name === catName);
  return c ? { color: c.color, bg: c.bg } : { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
}

function _matUsageStats(materialId) {
  const trips = KKR.getTrips().filter(t => t.material === materialId && t.status !== 'cancelled');
  const wb    = KKR.getWeighbridge().filter(w => w.material === materialId);
  const totalQty = trips.reduce((s, t) => s + (t.quantity || t.billedWt || 0), 0);
  const totalNet = wb.reduce((s, w) => s + (w.net || 0), 0);
  return { trips: trips.length, totalQty, totalNet };
}

// ── Main render ──────────────────────────────────────────────────────────────
function renderMaterials() {
  const allMaterials = KKR.getMaterials();

  let rows = [...allMaterials];
  if (materialsFilter.category) rows = rows.filter(m => m.category === materialsFilter.category);
  if (materialsFilter.q) {
    const q = materialsFilter.q.toLowerCase();
    rows = rows.filter(m =>
      (m.name     || '').toLowerCase().includes(q) ||
      (m.category || '').toLowerCase().includes(q) ||
      (m.notes    || '').toLowerCase().includes(q)
    );
  }

  // Category breakdown for stat strip
  const byCat = {};
  allMaterials.forEach(m => { byCat[m.category] = (byCat[m.category] || 0) + 1; });
  const catEntries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  // Total tonnage (all trips, not cancelled)
  const totalTons = KKR.getTrips()
    .filter(t => t.status !== 'cancelled')
    .reduce((s, t) => s + (t.quantity || t.billedWt || 0), 0);

  return `
  <div class="page-content">

    <!-- ── Header ────────────────────────────────────────────────────── -->
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Materials</div>
        <div class="subtitle">${allMaterials.length} materials · ${fmtNum(totalTons,2)} MT total transported</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="printMaterials()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print
        </button>
        <button class="btn btn-secondary" onclick="exportMaterialsCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button class="btn btn-secondary" onclick="openMatPresets()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          Quick Add
        </button>
        <button class="btn btn-primary" onclick="openMaterialModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Custom
        </button>
      </div>
    </div>

    <!-- ── Category filter strip ─────────────────────────────────────── -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
      <button class="btn btn-sm ${!materialsFilter.category?'btn-primary':'btn-secondary'}"
        onclick="materialsFilter.category='';rerenderPage()">All (${allMaterials.length})</button>
      ${catEntries.map(([cat, cnt]) => {
        const cs = _catStyle(cat);
        const active = materialsFilter.category === cat;
        return `<button class="btn btn-sm"
          style="border-color:${active?cs.color:'var(--border)'};background:${active?cs.bg:'transparent'};color:${active?cs.color:'var(--text-muted)'};transition:all .15s"
          onclick="materialsFilter.category='${cat.replace(/'/g,"\\'")}';rerenderPage()">
          ${cat} (${cnt})
        </button>`;
      }).join('')}
    </div>

    <!-- ── Table ─────────────────────────────────────────────────────── -->
    <div class="card">
      <div class="filter-bar" style="margin-bottom:16px">
        <div class="search-input-wrap" style="flex:1;min-width:200px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" placeholder="Search name, category, notes…"
            value="${materialsFilter.q}"
            oninput="materialsFilter.q=this.value;rerenderPage()">
        </div>
        ${materialsFilter.q ? `
          <button class="btn btn-secondary btn-sm" onclick="materialsFilter.q='';rerenderPage()">Clear</button>` : ''}
        <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">
          ${rows.length} of ${allMaterials.length}
        </span>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Material Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Density</th>
              <th>Trips Used</th>
              <th>Total Qty (MT)</th>
              <th>WB Net (MT)</th>
              <th>Notes</th>
              <th style="text-align:center">Actions</th>
            </tr>
          </thead>
          <tbody>
          ${rows.length === 0 ? `
            <tr><td colspan="9" style="padding:56px;text-align:center;color:var(--text-muted)">
              <div style="font-size:32px;margin-bottom:8px">📦</div>
              <div style="font-weight:600;color:var(--text-primary);margin-bottom:4px">No materials found</div>
              <div style="font-size:12px">${materialsFilter.q || materialsFilter.category ? 'Try clearing filters' : 'Click "Quick Add" for presets or "Add Custom"'}</div>
            </td></tr>` :
            rows.map(m => {
              const cs   = _catStyle(m.category);
              const stat = _matUsageStats(m.id);
              return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:10px;height:10px;border-radius:50%;background:${cs.color};flex-shrink:0"></div>
                    <span class="font-bold">${m.name}</span>
                  </div>
                </td>
                <td>
                  <span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;
                    background:${cs.bg};color:${cs.color};border:1px solid ${cs.color}30">
                    ${m.category}
                  </span>
                </td>
                <td>${m.unit}</td>
                <td style="color:var(--text-muted)">${m.density || '—'}</td>
                <td class="font-bold text-blue" style="text-align:center">${stat.trips}</td>
                <td class="text-right font-bold">${stat.totalQty > 0 ? fmtNum(stat.totalQty, 2) : '—'}</td>
                <td class="text-right" style="color:#34d399">${stat.totalNet > 0 ? fmtNum(stat.totalNet, 2) : '—'}</td>
                <td style="color:var(--text-muted);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.notes || '—'}</td>
                <td>
                  <div class="flex gap-2" style="justify-content:center">
                    <button class="btn btn-xs btn-secondary" title="Edit" onclick="openMaterialModal('${m.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn btn-xs btn-danger" title="Delete" onclick="deleteMaterial('${m.id}')">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
          ${rows.length > 0 ? `
          <tfoot>
            <tr style="border-top:2px solid var(--border)">
              <td colspan="4" style="padding:10px 16px;font-weight:700;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.4px">
                Totals (${rows.length})
              </td>
              <td class="font-bold text-blue" style="text-align:center;padding:10px 16px">
                ${rows.reduce((s,m)=>s+_matUsageStats(m.id).trips,0)}
              </td>
              <td class="text-right font-bold" style="padding:10px 16px;color:#60a5fa">
                ${fmtNum(rows.reduce((s,m)=>s+_matUsageStats(m.id).totalQty,0),2)} MT
              </td>
              <td class="text-right font-bold" style="padding:10px 16px;color:#34d399">
                ${fmtNum(rows.reduce((s,m)=>s+_matUsageStats(m.id).totalNet,0),2)} MT
              </td>
              <td colspan="2"></td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
    </div>

    <!-- ── Usage chart ─────────────────────────────────────────────────── -->
    ${rows.length > 0 ? `
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <div>
          <div class="card-title">Material Usage by Tonnage</div>
          <div class="card-sub">Total MT transported per material</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${(() => {
          const sorted = [...rows]
            .map(m => ({ ...m, stat: _matUsageStats(m.id) }))
            .filter(m => m.stat.totalQty > 0)
            .sort((a, b) => b.stat.totalQty - a.stat.totalQty);
          const maxQty = sorted.length ? sorted[0].stat.totalQty : 1;
          return sorted.map(m => {
            const cs  = _catStyle(m.category);
            const pct = Math.round(m.stat.totalQty / maxQty * 100);
            return `
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:5px">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:9px;height:9px;border-radius:50%;background:${cs.color};flex-shrink:0"></div>
                  <span style="font-size:13px;font-weight:600">${m.name}</span>
                  <span style="font-size:11px;padding:2px 8px;border-radius:20px;background:${cs.bg};color:${cs.color};font-weight:600">${m.category}</span>
                </div>
                <span style="font-size:13px;font-weight:700;color:var(--text-primary)">${fmtNum(m.stat.totalQty,2)} MT</span>
              </div>
              <div style="background:var(--bg-dark);border-radius:99px;height:7px;overflow:hidden">
                <div style="height:100%;border-radius:99px;background:${cs.color};width:${pct}%;transition:width .4s ease"></div>
              </div>
            </div>`;
          }).join('') || '<div style="color:var(--text-muted);text-align:center;padding:20px 0">No trip data yet</div>';
        })()}
      </div>
    </div>` : ''}

  </div>

  <!-- ── Add / Edit modal ─────────────────────────────────────────────── -->
  <div class="modal-overlay" id="material-modal">
    <div class="modal modal-sm">
      <div class="modal-header">
        <div class="modal-title" id="material-modal-title">Add Custom Material</div>
        <button class="modal-close" onclick="closeModal('material-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="material-modal-body"></div>
    </div>
  </div>

  <!-- ── Quick-add presets modal ──────────────────────────────────────── -->
  <div class="modal-overlay" id="mat-presets-modal">
    <div class="modal" style="max-width:580px">
      <div class="modal-header">
        <div class="modal-title">Quick Add — Preset Materials</div>
        <button class="modal-close" onclick="closeModal('mat-presets-modal')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body" id="mat-presets-body"></div>
    </div>
  </div>`;
}

// ── Add / Edit form ──────────────────────────────────────────────────────────
function openMaterialModal(id = null) {
  editingMaterialId = id;
  const m = id ? (KKR.getMaterials().find(x => x.id === id) || {}) : {};
  document.getElementById('material-modal-title').textContent = id ? `Edit — ${m.name || id}` : 'Add Custom Material';

  document.getElementById('material-modal-body').innerHTML = `
    <form onsubmit="saveMaterial(event)" autocomplete="off">
      <div class="form-group">
        <label class="form-label">Material Name <span style="color:#f87171">*</span></label>
        <input class="form-control" id="mf-name" value="${m.name || ''}"
          placeholder="e.g. Iron Ore, Cement, Coal…" required autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-control" id="mf-cat">
            ${MAT_CATEGORIES.map(c =>
              `<option value="${c.name}" ${(m.category || 'Mineral') === c.name ? 'selected' : ''}>${c.name}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Unit</label>
          <select class="form-control" id="mf-unit">
            ${['MT', 'KG', 'Litre', 'CBM', 'Units', 'Bags']
              .map(u => `<option value="${u}" ${(m.unit || 'MT') === u ? 'selected' : ''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Bulk Density</label>
        <input class="form-control" id="mf-den" value="${m.density || ''}"
          placeholder="e.g. 2.5 t/m³  (optional)">
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="mf-notes" rows="2"
          placeholder="Grade, specification, handling requirements…">${m.notes || ''}</textarea>
      </div>
      <div class="modal-footer" style="margin:-24px;margin-top:16px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('material-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ${id ? 'Update Material' : 'Save Material'}
        </button>
      </div>
    </form>`;
  openModal('material-modal');
}

// ── Save ─────────────────────────────────────────────────────────────────────
function saveMaterial(e) {
  e.preventDefault();
  const materials = KKR.getMaterials();
  const mat = {
    id:       editingMaterialId || 'M' + Date.now().toString().slice(-5),
    name:     document.getElementById('mf-name').value.trim(),
    category: document.getElementById('mf-cat').value,
    unit:     document.getElementById('mf-unit').value,
    density:  document.getElementById('mf-den').value.trim(),
    notes:    document.getElementById('mf-notes').value.trim(),
  };
  if (!mat.name) return;
  const idx = materials.findIndex(m => m.id === editingMaterialId);
  if (idx >= 0) materials[idx] = mat; else materials.push(mat);
  KKR.saveMaterials(materials);
  closeModal('material-modal');
  toast(editingMaterialId ? `${mat.name} updated` : `${mat.name} added`, 'success');
  rerenderPage();
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteMaterial(id) {
  const m    = KKR.getMaterials().find(x => x.id === id);
  const stat = _matUsageStats(id);
  const warn = stat.trips > 0 ? ` — used in ${stat.trips} trip(s)` : '';
  confirmDelete((m ? m.name : id) + warn, () => {
    KKR.saveMaterials(KKR.getMaterials().filter(x => x.id !== id));
    toast('Material removed', 'error');
    rerenderPage();
  });
}

// ── Quick-add presets ────────────────────────────────────────────────────────
function openMatPresets() {
  const existing = new Set(KKR.getMaterials().map(m => m.name.toLowerCase()));
  const available = MAT_PRESETS.filter(p => !existing.has(p.name.toLowerCase()));

  document.getElementById('mat-presets-body').innerHTML = `
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
      Select one or more presets to add to your materials list. Already-existing materials are hidden.
    </p>
    ${available.length === 0
      ? `<div style="text-align:center;padding:32px;color:var(--text-muted)">
           <div style="font-size:28px;margin-bottom:8px">✅</div>
           <div style="font-weight:600">All preset materials already added</div>
         </div>`
      : `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${available.map(p => {
            const cs = _catStyle(p.category);
            return `
            <label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;cursor:pointer;transition:all .12s"
              onmouseenter="this.style.borderColor='${cs.color}50'" onmouseleave="this.style.borderColor='var(--border)'">
              <input type="checkbox" value="${p.name}" style="width:16px;height:16px;accent-color:${cs.color};flex-shrink:0">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700">${p.name}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                  ${p.category} · ${p.unit}
                  ${p.density ? ' · '+p.density : ''}
                  ${p.notes ? ' — '+p.notes : ''}
                </div>
              </div>
              <span style="font-size:11px;padding:2px 8px;border-radius:20px;background:${cs.bg};color:${cs.color};font-weight:700">${p.category}</span>
            </label>`;
          }).join('')}
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:12px;border-top:1px solid var(--border)">
          <button class="btn btn-secondary" onclick="closeModal('mat-presets-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="addSelectedPresets()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Add Selected
          </button>
        </div>`}`;
  openModal('mat-presets-modal');
}

function addSelectedPresets() {
  const checkboxes = document.querySelectorAll('#mat-presets-body input[type="checkbox"]:checked');
  if (!checkboxes.length) { toast('Select at least one material', 'error'); return; }
  const materials = KKR.getMaterials();
  let added = 0;
  checkboxes.forEach(cb => {
    const preset = MAT_PRESETS.find(p => p.name === cb.value);
    if (!preset) return;
    if (materials.some(m => m.name.toLowerCase() === preset.name.toLowerCase())) return;
    materials.push({
      id:       'M' + Date.now().toString().slice(-5) + Math.random().toString(36).slice(2,4),
      name:     preset.name,
      category: preset.category,
      unit:     preset.unit,
      density:  preset.density,
      notes:    preset.notes,
    });
    added++;
  });
  KKR.saveMaterials(materials);
  closeModal('mat-presets-modal');
  toast(`${added} material${added !== 1 ? 's' : ''} added`, 'success');
  rerenderPage();
}
