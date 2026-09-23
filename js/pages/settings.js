// Settings Page
function renderSettings() {
  const s = KKR.getSettings();
  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Settings</div>
        <div class="subtitle">Business configuration and preferences</div>
      </div>
      <div class="page-header-right">
        <button class="btn btn-secondary" onclick="resetData()">${icon('trash',15)} Reset Demo Data</button>
        <button class="btn btn-primary" onclick="saveSettings()">${icon('check',15)} Save All Settings</button>
      </div>
    </div>

    <div class="grid-2">
      <!-- Business Info -->
      <div class="card">
        <div class="settings-section-title">${icon('customers',16)} Business Information</div>
        <div class="form-group">
          <label class="form-label">Business Name</label>
          <input class="form-control" id="set-bname" value="${s.businessName||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Owner Name</label>
          <input class="form-control" id="set-owner" value="${s.ownerName||''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input class="form-control" id="set-phone" value="${s.phone||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" id="set-email" value="${s.email||''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Address</label>
          <textarea class="form-control" id="set-addr" rows="3">${s.address||''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">GSTIN</label>
            <input class="form-control" id="set-gstin" value="${s.gstin||''}">
          </div>
          <div class="form-group">
            <label class="form-label">PAN</label>
            <input class="form-control" id="set-pan" value="${s.pan||''}">
          </div>
        </div>
      </div>

      <!-- Bank Details -->
      <div class="card">
        <div class="settings-section-title">${icon('payments',16)} Bank Details</div>
        <div class="form-group">
          <label class="form-label">Bank Name</label>
          <input class="form-control" id="set-bank" value="${s.bankName||''}">
        </div>
        <div class="form-group">
          <label class="form-label">Account Number</label>
          <input class="form-control" id="set-accno" value="${s.accountNo||''}">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">IFSC Code</label>
            <input class="form-control" id="set-ifsc" value="${s.ifsc||''}">
          </div>
          <div class="form-group">
            <label class="form-label">Financial Year</label>
            <select class="form-control" id="set-fy">
              ${['2024-25','2025-26','2026-27'].map(y=>`<option ${(s.financialYear||'2025-26')===y?'selected':''}>${y}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="settings-section-title" style="margin-top:24px">${icon('settings',16)} Preferences</div>

        <div class="settings-row">
          <div class="settings-row-left">
            <div class="s-title">Date Format</div>
            <div class="s-desc">How dates are displayed</div>
          </div>
          <select class="form-control" id="set-datefmt" style="width:160px">
            <option value="DD/MM/YYYY" ${(s.dateFormat||'DD/MM/YYYY')==='DD/MM/YYYY'?'selected':''}>DD/MM/YYYY</option>
            <option value="MM/DD/YYYY" ${s.dateFormat==='MM/DD/YYYY'?'selected':''}>MM/DD/YYYY</option>
            <option value="YYYY-MM-DD" ${s.dateFormat==='YYYY-MM-DD'?'selected':''}>YYYY-MM-DD</option>
          </select>
        </div>

        <div class="settings-row">
          <div class="settings-row-left">
            <div class="s-title">Email Alerts</div>
            <div class="s-desc">Send alerts to registered email</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="set-alertemail" ${s.alertsEmail?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div class="settings-row">
          <div class="settings-row-left">
            <div class="s-title">SMS Alerts</div>
            <div class="s-desc">Send alerts via SMS</div>
          </div>
          <label class="toggle">
            <input type="checkbox" id="set-alertsms" ${s.alertsSMS?'checked':''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- Danger zone -->
    <div class="card" style="margin-top:20px; border-color:rgba(239,68,68,0.3)">
      <div style="color:#f87171; font-weight:700; font-size:14px; margin-bottom:12px">${icon('warning',16)} Danger Zone</div>
      <div style="display:flex; align-items:center; justify-content:space-between">
        <div>
          <div style="font-size:13px; font-weight:600">Export All Data</div>
          <div style="font-size:12px; color:var(--text-muted)">Download all data as JSON backup</div>
        </div>
        <button class="btn btn-secondary" onclick="exportAllData()">${icon('download',15)} Export JSON</button>
      </div>
      <hr class="divider">
      <div style="display:flex; align-items:center; justify-content:space-between">
        <div>
          <div style="font-size:13px; font-weight:600; color:#f87171">Clear All Data</div>
          <div style="font-size:12px; color:var(--text-muted)">Delete all records — cannot be undone</div>
        </div>
        <button class="btn btn-danger" onclick="clearAllData()">${icon('trash',15)} Clear All</button>
      </div>
    </div>

    <!-- ── Security ──────────────────────────────────────────────────── -->
    <div class="card" style="margin-top:20px" id="security-card">
      <div class="settings-section-title" style="display:flex;align-items:center;gap:8px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Security &amp; Access
      </div>

      <!-- Active session info -->
      <div class="security-field-row">
        <div>
          <div class="security-field-label">Active Session</div>
          <div class="security-field-desc" id="sec-session-desc">Loading…</div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="secRefreshSession()">Refresh</button>
      </div>

      <!-- Registered mobile -->
      <div class="security-field-row">
        <div>
          <div class="security-field-label">Registered Mobile</div>
          <div class="security-field-desc" id="sec-phone-display">Loading…</div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="secToggleChangePhone()">Change</button>
      </div>

      <!-- Change phone inline form -->
      <div id="sec-phone-form" class="pin-change-form" style="display:none">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">New Mobile Number (10 digits)</label>
            <input class="form-control" id="sec-new-phone" type="tel" inputmode="numeric"
              maxlength="10" placeholder="9XXXXXXXXX">
          </div>
          <div class="form-group">
            <label class="form-label">Current PIN (to confirm)</label>
            <input class="form-control" id="sec-phone-pin" type="password"
              inputmode="numeric" maxlength="8" placeholder="••••">
          </div>
        </div>
        <div id="sec-phone-err" class="auth-error" style="display:none"></div>
        <div class="flex gap-2" style="margin-top:4px">
          <button class="btn btn-primary btn-sm" onclick="secSavePhone()">Save Number</button>
          <button class="btn btn-secondary btn-sm" onclick="secToggleChangePhone()">Cancel</button>
        </div>
      </div>

      <!-- Change PIN -->
      <div class="security-field-row">
        <div>
          <div class="security-field-label">Login PIN</div>
          <div class="security-field-desc">4–8 digit numeric PIN used with mobile OTP login</div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="secToggleChangePIN()">Change PIN</button>
      </div>

      <!-- Change PIN inline form -->
      <div id="sec-pin-form" class="pin-change-form" style="display:none">
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Current PIN</label>
            <input class="form-control" id="sec-cur-pin" type="password"
              inputmode="numeric" maxlength="8" placeholder="Current PIN">
          </div>
          <div class="form-group">
            <label class="form-label">New PIN</label>
            <input class="form-control" id="sec-new-pin" type="password"
              inputmode="numeric" maxlength="8" placeholder="4–8 digits">
          </div>
          <div class="form-group">
            <label class="form-label">Confirm New PIN</label>
            <input class="form-control" id="sec-con-pin" type="password"
              inputmode="numeric" maxlength="8" placeholder="Repeat PIN">
          </div>
        </div>
        <div id="sec-pin-err"  class="auth-error"   style="display:none"></div>
        <div id="sec-pin-ok"   class="auth-otp-dev-box" style="display:none;padding:10px 14px">
          <span class="auth-otp-dev-label">PIN changed successfully</span>
          <span style="color:#34d399;font-size:20px">✓</span>
        </div>
        <div class="flex gap-2" style="margin-top:4px">
          <button class="btn btn-primary btn-sm" onclick="secSavePIN()">Update PIN</button>
          <button class="btn btn-secondary btn-sm" onclick="secToggleChangePIN()">Cancel</button>
        </div>
      </div>

      <!-- Session timeout -->
      <div class="security-field-row">
        <div>
          <div class="security-field-label">Session Timeout</div>
          <div class="security-field-desc">Auto-logout after this many hours of activity (1–72 h). Idle timeout is always 30 min.</div>
        </div>
        <div class="flex items-center gap-2">
          <select class="form-control" id="sec-session-hrs" style="width:100px"
            onchange="secSaveSessionTimeout(this.value)">
            ${[1,2,4,8,12,24,48,72].map(h => {
              const cur = (() => { try { return parseInt(JSON.parse(localStorage.getItem('kkr_settings')||'{}').sessionTimeoutHours)||8; } catch { return 8; } })();
              return `<option value="${h}" ${cur===h?'selected':''}>${h} hr${h>1?'s':''}</option>`;
            }).join('')}
          </select>
        </div>
      </div>

      <!-- Force logout all sessions -->
      <div class="security-field-row">
        <div>
          <div class="security-field-label">End Current Session</div>
          <div class="security-field-desc">Immediately invalidates the active session and returns to the login screen</div>
        </div>
        <button class="btn btn-sm btn-danger" onclick="KKR_AUTH.logout('manual')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout Now
        </button>
      </div>

      <!-- Session history -->
      <div style="margin-top:20px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px">
          Recent Login History (last 10)
        </div>
        <div class="table-wrap">
          <table class="session-log-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Logged In</th>
                <th>Logged Out</th>
                <th>Duration</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody id="sec-session-log">
              <tr><td colspan="5" style="color:var(--text-muted);padding:14px">Loading…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div><!-- /security-card -->

  </div>`;
}

function saveSettings() {
  const s = {
    businessName:  document.getElementById('set-bname').value.trim(),
    ownerName:     document.getElementById('set-owner').value.trim(),
    phone:         document.getElementById('set-phone').value.trim(),
    email:         document.getElementById('set-email').value.trim(),
    address:       document.getElementById('set-addr').value.trim(),
    gstin:         document.getElementById('set-gstin').value.trim().toUpperCase(),
    pan:           document.getElementById('set-pan').value.trim().toUpperCase(),
    bankName:      document.getElementById('set-bank').value.trim(),
    accountNo:     document.getElementById('set-accno').value.trim(),
    ifsc:          document.getElementById('set-ifsc').value.trim().toUpperCase(),
    financialYear: document.getElementById('set-fy').value,
    dateFormat:    document.getElementById('set-datefmt').value,
    alertsEmail:   document.getElementById('set-alertemail').checked,
    alertsSMS:     document.getElementById('set-alertsms').checked,
  };
  KKR.saveSettings(s);
  // Update topbar business name
  const tn = document.getElementById('topbar-business');
  if (tn) tn.textContent = s.businessName;
  toast('Settings saved successfully','success');
}

function resetData() {
  if (!confirm('This will reload all demo data. Your changes will be lost. Continue?')) return;
  localStorage.removeItem('kkr_seeded');
  KKR.seed();
  toast('Demo data reloaded','info');
  rerenderPage();
}

function exportAllData() {
  const data = {
    settings:    KKR.getSettings(),
    customers:   KKR.getCustomers(),
    vehicles:    KKR.getVehicles(),
    drivers:     KKR.getDrivers(),
    materials:   KKR.getMaterials(),
    trips:       KKR.getTrips(),
    weighbridge: KKR.getWeighbridge(),
    fuel:        KKR.getFuel(),
    expenses:    KKR.getExpenses(),
    invoices:    KKR.getInvoices(),
    payments:    KKR.getPayments(),
    ewayBills:   KKR.getEwayBills(),
    documents:   KKR.getDocuments(),
    alerts:      KKR.getAlerts(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `kkr-logistics-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Data exported as JSON','success');
}

function clearAllData() {
  if (!confirm('⚠️ This will permanently delete ALL data including trips, invoices, customers, etc. This CANNOT be undone. Type "DELETE" to confirm.')) return;
  const input = prompt('Type DELETE to confirm:');
  if (input !== 'DELETE') { toast('Cancelled — no data was deleted','info'); return; }
  ['settings','customers','vehicles','drivers','materials','trips','weighbridge','fuel','expenses','invoices','payments','ewayBills','documents','alerts','seeded'].forEach(k=>{
    localStorage.removeItem('kkr_'+k);
  });
  toast('All data cleared','error');
  setTimeout(()=>location.reload(), 1500);
}

// ============================================================
// Security Section — handlers
// ============================================================

// ── Init (called by afterRender hook) ─────────────────────────────────────
function initSecuritySection() {
  secRefreshSession();
  secRefreshPhone();
  secRenderSessionLog();
}

// ── Session info ──────────────────────────────────────────────────────────
function secRefreshSession() {
  const el = document.getElementById('sec-session-desc');
  if (!el) return;

  const session = (typeof KKR_AUTH !== 'undefined') ? KKR_AUTH.getSession() : null;
  if (!session) { el.textContent = 'No active session.'; return; }

  const now       = Date.now();
  const elapsed   = Math.round((now - session.createdAt) / 60000);
  const remaining = Math.max(0, Math.round((session.expiresAt - now) / 60000));
  const idle      = Math.round((now - session.lastActivity) / 60000);

  const fmt = m => m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}m`;
  el.innerHTML = `Started ${fmt(elapsed)} ago &nbsp;·&nbsp; Expires in <strong style="color:#60a5fa">${fmt(remaining)}</strong> &nbsp;·&nbsp; Idle ${fmt(idle)}`;
}

// ── Phone display ─────────────────────────────────────────────────────────
function secRefreshPhone() {
  const el = document.getElementById('sec-phone-display');
  if (!el) return;
  if (typeof KKR_AUTH === 'undefined') { el.textContent = '—'; return; }
  const creds = KKR_AUTH.getCreds();
  // Mask middle 5 digits: 98765 ***** (last 5 shown, first 5 shown, middle hidden)
  const p = creds.phone;
  const masked = p.length === 10
    ? `+91 ${p.slice(0,2)}***** ${p.slice(-3)}`
    : `+91 ${p}`;
  el.textContent = masked;
}

// ── Toggle forms ──────────────────────────────────────────────────────────
function secToggleChangePhone() {
  const form = document.getElementById('sec-phone-form');
  if (!form) return;
  const showing = form.style.display !== 'none';
  form.style.display = showing ? 'none' : 'block';
  if (!showing) {
    document.getElementById('sec-new-phone').value = '';
    document.getElementById('sec-phone-pin').value = '';
    document.getElementById('sec-phone-err').style.display = 'none';
    document.getElementById('sec-new-phone').focus();
  }
}

function secToggleChangePIN() {
  const form = document.getElementById('sec-pin-form');
  if (!form) return;
  const showing = form.style.display !== 'none';
  form.style.display = showing ? 'none' : 'block';
  if (!showing) {
    document.getElementById('sec-cur-pin').value = '';
    document.getElementById('sec-new-pin').value = '';
    document.getElementById('sec-con-pin').value = '';
    document.getElementById('sec-pin-err').style.display = 'none';
    document.getElementById('sec-pin-ok').style.display  = 'none';
    document.getElementById('sec-cur-pin').focus();
  }
}

// ── Save phone ────────────────────────────────────────────────────────────
function secSavePhone() {
  if (typeof KKR_AUTH === 'undefined') return;
  const newPhone = document.getElementById('sec-new-phone').value.trim().replace(/\D/g,'');
  const pin      = document.getElementById('sec-phone-pin').value.trim();
  const errEl    = document.getElementById('sec-phone-err');

  const result = KKR_AUTH.changePhone(newPhone, pin);
  if (!result.ok) {
    errEl.textContent   = result.msg;
    errEl.style.display = 'block';
    errEl.classList.remove('auth-error-shake');
    void errEl.offsetWidth;
    errEl.classList.add('auth-error-shake');
    return;
  }

  errEl.style.display = 'none';
  toast('Mobile number updated. Use the new number to log in next time.', 'success');
  secToggleChangePhone();
  secRefreshPhone();
}

// ── Save PIN ──────────────────────────────────────────────────────────────
function secSavePIN() {
  if (typeof KKR_AUTH === 'undefined') return;
  const cur  = document.getElementById('sec-cur-pin').value.trim();
  const nw   = document.getElementById('sec-new-pin').value.trim();
  const conf = document.getElementById('sec-con-pin').value.trim();
  const errEl = document.getElementById('sec-pin-err');
  const okEl  = document.getElementById('sec-pin-ok');

  const result = KKR_AUTH.changePIN(cur, nw, conf);
  if (!result.ok) {
    errEl.textContent   = result.msg;
    errEl.style.display = 'block';
    okEl.style.display  = 'none';
    errEl.classList.remove('auth-error-shake');
    void errEl.offsetWidth;
    errEl.classList.add('auth-error-shake');
    return;
  }

  errEl.style.display = 'none';
  okEl.style.display  = 'flex';
  document.getElementById('sec-cur-pin').value = '';
  document.getElementById('sec-new-pin').value = '';
  document.getElementById('sec-con-pin').value = '';
  toast('PIN changed successfully. Use the new PIN on your next login.', 'success');
}

// ── Session timeout ───────────────────────────────────────────────────────
function secSaveSessionTimeout(hrs) {
  const s = KKR.getSettings();
  s.sessionTimeoutHours = parseInt(hrs) || 8;
  KKR.saveSettings(s);
  toast(`Session timeout set to ${hrs} hour${hrs > 1 ? 's' : ''}.`, 'success');
}

// ── Session log ───────────────────────────────────────────────────────────
function secRenderSessionLog() {
  const tbody = document.getElementById('sec-session-log');
  if (!tbody) return;
  if (typeof KKR_AUTH === 'undefined') { tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Auth module not loaded.</td></tr>'; return; }

  const log = KKR_AUTH.getSessionLog().slice(0, 10);
  if (!log.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);padding:12px">No login history yet.</td></tr>';
    return;
  }

  const fmtTs = ts => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
      + ' ' + d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: true });
  };

  const fmtDur = (loginAt, logoutAt) => {
    if (!loginAt || !logoutAt) return '—';
    const ms = logoutAt - loginAt;
    const m  = Math.round(ms / 60000);
    return m < 60 ? `${m} min` : `${Math.floor(m/60)}h ${m%60}m`;
  };

  const reasonLabel = r => {
    if (!r) return '<span style="color:#34d399">Active</span>';
    const map = {
      manual:         'Manual logout',
      session_expired:'Session expired',
      idle_timeout:   'Idle timeout',
    };
    return `<span style="color:var(--text-muted)">${map[r] || r}</span>`;
  };

  tbody.innerHTML = log.map((entry, i) => `
    <tr>
      <td style="color:var(--text-muted)">${i + 1}</td>
      <td>${fmtTs(entry.loginAt)}</td>
      <td>${fmtTs(entry.logoutAt)}</td>
      <td>${fmtDur(entry.loginAt, entry.logoutAt)}</td>
      <td>${reasonLabel(entry.reason)}</td>
    </tr>`).join('');
}
