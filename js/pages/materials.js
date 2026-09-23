// Materials Page
let materialsFilter = { q: '' };
let editingMaterialId = null;

function renderMaterials() {
  let rows = KKR.getMaterials();
  if (materialsFilter.q) rows = filterRows(rows, materialsFilter.q, ['name','category','unit']);

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Materials</div>
        <div class="subtitle">Master list of all cargo types</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-primary" onclick="openMaterialModal()">${icon('plus',15)} Add Material</button>
      </div>
    </div>

    <div class="card">
      <div class="filter-bar">
        <div class="search-input-wrap">
          ${icon('search',15)}
          <input type="text" placeholder="Search materials..." value="${materialsFilter.q}"
            oninput="materialsFilter.q=this.value; rerenderPage()">
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>ID</th><th>Material Name</th><th>Category</th><th>Unit</th><th>Density</th><th>Notes</th><th>Actions</th>
          </tr></thead>
          <tbody>
          ${rows.length === 0 ? `<tr><td colspan="7" class="text-center text-muted" style="padding:40px">No materials found</td></tr>` :
            rows.map(m => `
            <tr>
              <td class="font-bold text-blue">${m.id}</td>
              <td class="font-bold">${m.name}</td>
              <td><span style="background:rgba(37,99,235,0.15); color:#60a5fa; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600">${m.category}</span></td>
              <td>${m.unit}</td>
              <td>${m.density||'—'}</td>
              <td class="text-muted">${m.notes||'—'}</td>
              <td>
                <div class="flex gap-2">
                  <button class="btn btn-xs btn-secondary" onclick="openMaterialModal('${m.id}')">${icon('edit',13)}</button>
                  <button class="btn btn-xs btn-danger" onclick="deleteMaterial('${m.id}')">${icon('trash',13)}</button>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="modal-overlay" id="material-modal">
    <div class="modal modal-sm">
      <div class="modal-header">
        <div class="modal-title" id="material-modal-title">Add Material</div>
        <button class="modal-close" onclick="closeModal('material-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="material-modal-body"></div>
    </div>
  </div>`;
}

function openMaterialModal(id = null) {
  editingMaterialId = id;
  const m = id ? KKR.getMaterials().find(x=>x.id===id) : {};
  document.getElementById('material-modal-title').textContent = id ? 'Edit Material' : 'Add Material';

  document.getElementById('material-modal-body').innerHTML = `
    <form onsubmit="saveMaterial(event)">
      <div class="form-group">
        <label class="form-label">Material Name</label>
        <input class="form-control" id="mf-name" value="${m.name||''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Category</label>
          <input class="form-control" id="mf-cat" value="${m.category||''}" list="cat-list">
          <datalist id="cat-list">
            <option>Metal Ore</option><option>Mineral</option><option>Finished Steel</option>
            <option>By-product</option><option>Scrap</option><option>Agricultural</option><option>Chemical</option>
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Unit</label>
          <select class="form-control" id="mf-unit">
            ${['MT','KG','Litre','CBM','Units'].map(u=>`<option ${(m.unit||'MT')===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Density</label>
          <input class="form-control" id="mf-den" value="${m.density||''}" placeholder="e.g. 2.5 t/m³">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="mf-notes" rows="2">${m.notes||''}</textarea>
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('material-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('material-modal');
}

function saveMaterial(e) {
  e.preventDefault();
  const materials = KKR.getMaterials();
  const mat = {
    id:       editingMaterialId || 'M' + Date.now().toString().slice(-5),
    name:     document.getElementById('mf-name').value.trim(),
    category: document.getElementById('mf-cat').value.trim(),
    unit:     document.getElementById('mf-unit').value,
    density:  document.getElementById('mf-den').value.trim(),
    notes:    document.getElementById('mf-notes').value.trim(),
  };
  const idx = materials.findIndex(m=>m.id===editingMaterialId);
  if (idx>=0) materials[idx]=mat; else materials.push(mat);
  KKR.saveMaterials(materials);
  closeModal('material-modal');
  toast(editingMaterialId?'Material updated':'Material added','success');
  rerenderPage();
}

function deleteMaterial(id) {
  const m = KKR.getMaterials().find(x=>x.id===id);
  confirmDelete(m?m.name:id, ()=>{
    KKR.saveMaterials(KKR.getMaterials().filter(x=>x.id!==id));
    toast('Material removed','error');
    rerenderPage();
  });
}
