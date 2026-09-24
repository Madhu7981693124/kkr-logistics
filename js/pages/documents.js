// Documents Page
let docFilter = { q: '', type: '' };
let editingDocId = null;

const DOC_TYPES = ['insurance','fitness','permit','puc','rc','license','gst','pan','other'];
const DOC_TYPE_COLORS = { insurance:'blue', fitness:'green', permit:'amber', puc:'cyan', rc:'purple', license:'blue', gst:'green', pan:'amber', other:'red' };

function renderDocuments() {
  let rows = KKR.getDocuments();
  if (docFilter.type) rows = rows.filter(d=>d.type===docFilter.type);
  if (docFilter.q) rows = filterRows(rows, docFilter.q, ['name','type','vehicle']);
  rows = [...rows].sort((a,b)=>(a.expiry||'9999').localeCompare(b.expiry||'9999'));

  const expiringSoon = KKR.getDocuments().filter(d=>{ const days=daysFromNow(d.expiry); return days!==null && days>=0 && days<=60; }).length;

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Documents</div>
        <div class="subtitle">${KKR.getDocuments().length} documents · ${expiringSoon} expiring within 60 days</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="printDocuments()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print
        </button>
        <button class="btn btn-secondary" onclick="exportExpiringDocumentsCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Expiring
        </button>
        <button class="btn btn-secondary" onclick="exportDocumentsCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export All
        </button>
        <button class="btn btn-primary" onclick="openDocModal()">${icon('plus',15)} Add Document</button>
      </div>
    </div>

    ${expiringSoon>0?`
    <div style="background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.3); border-radius:10px; padding:14px 18px; margin-bottom:20px; display:flex; align-items:center; gap:12px">
      <span style="color:#fbbf24">${icon('warning',20)}</span>
      <span style="font-size:13px; color:#fbbf24; font-weight:600">${expiringSoon} document${expiringSoon>1?'s':''} expiring within 60 days. Review and renew promptly.</span>
    </div>`:''}

    <div class="filter-bar" style="margin-bottom:20px">
      <div class="search-input-wrap">
        ${icon('search',15)}
        <input type="text" placeholder="Search documents..." value="${docFilter.q}"
          oninput="docFilter.q=this.value; rerenderPage()">
      </div>
      <select class="form-control" style="width:180px" onchange="docFilter.type=this.value; rerenderPage()">
        <option value="">All Types</option>
        ${DOC_TYPES.map(t=>`<option value="${t}" ${docFilter.type===t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
      </select>
    </div>

    <div class="doc-grid">
      ${rows.length===0 ? `<div class="empty-state" style="grid-column:1/-1">${icon('documents',48)}<h3>No documents found</h3></div>` :
        rows.map(d=>{
          const days = daysFromNow(d.expiry);
          const expStatus = d.expiry ? (days!==null&&days<0?'expired':days!==null&&days<60?'expiring':'valid') : 'na';
          const color = DOC_TYPE_COLORS[d.type]||'blue';
          return `
          <div class="doc-card" onclick="">
            <div style="display:flex; align-items:center; gap:12px">
              <div class="doc-icon" style="background:rgba(37,99,235,0.15); color:#60a5fa">
                ${d.fileType==='pdf'?`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>`:
                `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`}
              </div>
              <div style="flex:1; overflow:hidden">
                <div style="font-size:13px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${d.name}</div>
                <div style="font-size:11px; color:var(--text-muted)">${d.fileType?.toUpperCase()||''} · ${d.size||''}</div>
              </div>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap">
              <span style="background:rgba(37,99,235,0.15); color:#60a5fa; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; text-transform:uppercase">${d.type}</span>
              ${d.vehicle?`<span style="background:rgba(51,65,85,0.5); color:var(--text-muted); padding:2px 8px; border-radius:20px; font-size:10px">${KKR.vehicleReg(d.vehicle)}</span>`:''}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center">
              <div style="font-size:11px; color:var(--text-muted)">
                ${d.expiry?`Expires: <span style="color:${expStatus==='expired'?'#f87171':expStatus==='expiring'?'#fbbf24':'#34d399'}; font-weight:600">${fmtDate(d.expiry)}${days!==null&&days>=0?` (${days}d)`:(days!==null&&days<0?' (expired)':'')}</span>`:'No expiry'}
              </div>
              <div class="flex gap-2">
                <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation(); openDocModal('${d.id}')">${icon('edit',12)}</button>
                <button class="btn btn-xs btn-danger" onclick="event.stopPropagation(); deleteDoc('${d.id}')">${icon('trash',12)}</button>
              </div>
            </div>
          </div>`;}).join('')}
    </div>
  </div>

  <div class="modal-overlay" id="doc-modal">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" id="doc-modal-title">Add Document</div>
        <button class="modal-close" onclick="closeModal('doc-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body" id="doc-modal-body"></div>
    </div>
  </div>`;
}

function openDocModal(id=null) {
  editingDocId = id;
  const d = id ? KKR.getDocuments().find(x=>x.id===id) : {};
  document.getElementById('doc-modal-title').textContent = id ? 'Edit Document' : 'Add Document';
  const vehicles = KKR.getVehicles();
  const drivers  = KKR.getDrivers();

  document.getElementById('doc-modal-body').innerHTML = `
    <form onsubmit="saveDoc(event)">
      <div class="form-group">
        <label class="form-label">Document Name</label>
        <input class="form-control" id="docf-name" value="${d.name||''}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Document Type</label>
          <select class="form-control" id="docf-type">
            ${DOC_TYPES.map(t=>`<option value="${t}" ${(d.type||'')==t?'selected':''}>${t.charAt(0).toUpperCase()+t.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">File Type</label>
          <select class="form-control" id="docf-ftype">
            ${['pdf','jpg','png','doc','xlsx'].map(t=>`<option ${(d.fileType||'pdf')===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Related Vehicle (optional)</label>
          <select class="form-control" id="docf-vehicle">
            <option value="">— None —</option>
            ${vehicles.map(v=>`<option value="${v.id}" ${d.vehicle===v.id?'selected':''}>${v.regNo}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Related Driver (optional)</label>
          <select class="form-control" id="docf-driver">
            <option value="">— None —</option>
            ${drivers.map(dr=>`<option value="${dr.id}" ${d.driver===dr.id?'selected':''}>${dr.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Expiry Date</label>
          <input type="date" class="form-control" id="docf-exp" value="${fmtDateInput(d.expiry||'')}">
        </div>
        <div class="form-group">
          <label class="form-label">Upload Date</label>
          <input type="date" class="form-control" id="docf-upload" value="${fmtDateInput(d.uploaded||today())}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">File Size (display only)</label>
        <input class="form-control" id="docf-size" value="${d.size||''}" placeholder="e.g. 1.2 MB">
      </div>
      <div class="modal-footer" style="margin:-24px; margin-top:8px">
        <button type="button" class="btn btn-secondary" onclick="closeModal('doc-modal')">Cancel</button>
        <button type="submit" class="btn btn-primary">${icon('check',15)} ${id?'Update':'Save'}</button>
      </div>
    </form>`;
  openModal('doc-modal');
}

function saveDoc(e) {
  e.preventDefault();
  const docs = KKR.getDocuments();
  const doc = {
    id:       editingDocId || 'DOC' + Date.now().toString().slice(-6),
    name:     document.getElementById('docf-name').value.trim(),
    type:     document.getElementById('docf-type').value,
    fileType: document.getElementById('docf-ftype').value,
    vehicle:  document.getElementById('docf-vehicle').value,
    driver:   document.getElementById('docf-driver').value,
    expiry:   document.getElementById('docf-exp').value,
    uploaded: document.getElementById('docf-upload').value,
    size:     document.getElementById('docf-size').value.trim(),
  };
  const idx = docs.findIndex(d=>d.id===editingDocId);
  if (idx>=0) docs[idx]=doc; else docs.push(doc);
  KKR.saveDocuments(docs);
  closeModal('doc-modal');
  toast(editingDocId?'Updated':'Document added','success');
  rerenderPage();
}

function deleteDoc(id) {
  const d = KKR.getDocuments().find(x=>x.id===id);
  confirmDelete(d?d.name:id, ()=>{
    KKR.saveDocuments(KKR.getDocuments().filter(x=>x.id!==id));
    toast('Deleted','error');
    rerenderPage();
  });
}
