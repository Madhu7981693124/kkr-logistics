// Alerts & Notifications Page
let alertsFilter = { priority: '' };

function renderAlerts() {
  let rows = KKR.getAlerts();
  if (alertsFilter.priority) rows = rows.filter(a=>a.priority===alertsFilter.priority);
  rows = [...rows].sort((a,b)=>{
    const order = {high:0, medium:1, low:2};
    return (order[a.priority]||3) - (order[b.priority]||3);
  });

  const unread = KKR.getAlerts().filter(a=>!a.read).length;

  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Alerts & Notifications</div>
        <div class="subtitle">${unread} unread · ${KKR.getAlerts().length} total</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="markAllRead()">${icon('check',15)} Mark All Read</button>
        <button class="btn btn-primary" onclick="openAlertModal()">${icon('plus',15)} Add Alert</button>
      </div>
    </div>

    <div class="filter-bar" style="margin-bottom:20px">
      <div class="search-input-wrap">
        ${icon('filter',15)}
        <span style="font-size:13px; color:var(--text-muted)">Filter by priority:</span>
      </div>
      ${[['','All'],['high','High'],['medium','Medium'],['low','Low']].map(([val,lbl])=>`
        <button class="btn btn-sm ${alertsFilter.priority===val?'btn-primary':'btn-secondary'}" onclick="alertsFilter.priority='${val}'; rerenderPage()">${lbl}</button>`).join('')}
    </div>

    <div style="display:flex; flex-direction:column; gap:10px">
      ${rows.length===0 ? `<div class="empty-state">${icon('check',48)}<h3>No alerts</h3><p>All clear!</p></div>` :
        rows.map(a=>`
        <div class="alert-item ${a.priority}" style="cursor:default; ${a.read?'opacity:0.65':''}">
          <div class="alert-icon ${a.priority}">
            ${icon(a.priority==='high'?'warning':a.priority==='medium'?'info':'check', 20)}
          </div>
          <div style="flex:1">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px">
              <span style="font-size:14px; font-weight:700; color:var(--text-primary)">${a.title}</span>
              ${!a.read?`<span style="background:#2563eb; width:8px; height:8px; border-radius:50%; flex-shrink:0"></span>`:''}
              <span style="font-size:11px; padding:2px 8px; border-radius:20px; font-weight:600;
                background:${a.priority==='high'?'rgba(239,68,68,0.15)':a.priority==='medium'?'rgba(245,158,11,0.15)':'rgba(37,99,235,0.15)'};
                color:${a.priority==='high'?'#f87171':a.priority==='medium'?'#fbbf24':'#60a5fa'}">${a.priority.charAt(0).toUpperCase()+a.priority.slice(1)}</span>
            </div>
            <div style="font-size:13px; color:var(--text-muted)">${a.message}</div>
            <div style="font-size:11px; color:#475569; margin-top:6px">${fmtDate(a.date)}</div>
          </div>
          <div class="flex gap-2" style="align-items:flex-start">
            ${!a.read?`<button class="btn btn-xs btn-secondary" onclick="markAlertRead('${a.id}')" title="Mark read">${icon('check',13)}</button>`:''}
            <button class="btn btn-xs btn-danger" onclick="deleteAlert('${a.id}')">${icon('trash',13)}</button>
          </div>
        </div>`).join('')}
    </div>
  </div>

  <div class="modal-overlay" id="alert-modal">
    <div class="modal modal-sm">
      <div class="modal-header">
        <div class="modal-title">New Alert</div>
        <button class="modal-close" onclick="closeModal('alert-modal')">${icon('close',18)}</button>
      </div>
      <div class="modal-body">
        <form onsubmit="saveAlert(event)">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input class="form-control" id="alf-title" required>
          </div>
          <div class="form-group">
            <label class="form-label">Message</label>
            <textarea class="form-control" id="alf-msg" rows="3" required></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Priority</label>
              <select class="form-control" id="alf-pri">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Type</label>
              <select class="form-control" id="alf-type">
                ${['insurance','fitness','payment','license','trip','eway','general'].map(t=>`<option>${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="modal-footer" style="margin:-24px; margin-top:8px">
            <button type="button" class="btn btn-secondary" onclick="closeModal('alert-modal')">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Alert</button>
          </div>
        </form>
      </div>
    </div>
  </div>`;
}

function markAlertRead(id) {
  const alerts = KKR.getAlerts();
  const idx = alerts.findIndex(a=>a.id===id);
  if (idx>=0) { alerts[idx].read=true; KKR.saveAlerts(alerts); }
  updateAlertBadge();
  rerenderPage();
}

function markAllRead() {
  const alerts = KKR.getAlerts().map(a=>({...a, read:true}));
  KKR.saveAlerts(alerts);
  updateAlertBadge();
  toast('All alerts marked as read','success');
  rerenderPage();
}

function deleteAlert(id) {
  confirmDelete('this alert', ()=>{
    KKR.saveAlerts(KKR.getAlerts().filter(a=>a.id!==id));
    updateAlertBadge();
    rerenderPage();
  });
}

function saveAlert(e) {
  e.preventDefault();
  const alerts = KKR.getAlerts();
  alerts.unshift({
    id:       'AL' + Date.now().toString().slice(-6),
    title:    document.getElementById('alf-title').value.trim(),
    message:  document.getElementById('alf-msg').value.trim(),
    priority: document.getElementById('alf-pri').value,
    type:     document.getElementById('alf-type').value,
    date:     today(),
    read:     false,
  });
  KKR.saveAlerts(alerts);
  updateAlertBadge();
  closeModal('alert-modal');
  toast('Alert added','success');
  rerenderPage();
}

function updateAlertBadge() {
  const count = KKR.unreadAlertCount();
  const badge = document.getElementById('alert-badge');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }
  const navBadge = document.getElementById('nav-alerts-badge');
  if (navBadge) {
    navBadge.textContent = count;
    navBadge.style.display = count > 0 ? 'inline' : 'none';
  }
}
