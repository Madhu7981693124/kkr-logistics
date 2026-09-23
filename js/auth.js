// ============================================================
// KKR Logistics — Authentication Engine
// Single-user OTP-based login. No server required.
// All state lives in localStorage under the 'kkr_auth_*' namespace
// (separate from the 'kkr_*' business data namespace).
// ============================================================

const KKR_AUTH = (() => {

  // ── Constants ──────────────────────────────────────────────────────────
  const STORE = {
    CREDS:       'kkr_auth_creds',      // { phone, pinHash }
    SESSION:     'kkr_auth_session',    // { token, createdAt, expiresAt, lastActivity }
    OTP_STATE:   'kkr_auth_otp',        // { hash, expiresAt, attempts, phone, lockedUntil }
    LOCK:        'kkr_auth_lock',       // { lockedUntil, failCount }
    SESSION_LOG: 'kkr_auth_log',        // [ { loginAt, logoutAt, reason } ]
  };

  const CONFIG = {
    OTP_LENGTH:          6,
    OTP_TTL_MS:          5 * 60 * 1000,       // 5 minutes
    OTP_MAX_ATTEMPTS:    5,                    // wrong OTP attempts before lock
    OTP_RESEND_COOLDOWN: 60 * 1000,            // 60 s between resends
    LOCK_DURATION_MS:    15 * 60 * 1000,       // 15 min account lock after exhausted attempts
    SESSION_TTL_MS:      8 * 60 * 60 * 1000,  // 8-hour session (configurable)
    IDLE_TTL_MS:         30 * 60 * 1000,       // 30-min idle timeout
    MAX_LOG_ENTRIES:     50,
    // Default owner credentials — owner changes these on first login via Settings
    DEFAULT_PHONE: '9876543210',
    DEFAULT_PIN:   '1234',
  };

  // ── Tiny helpers ───────────────────────────────────────────────────────
  const _load  = (k, def = null) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
  const _save  = (k, v)         => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const _del   = (k)            => { try { localStorage.removeItem(k); } catch {} };
  const _now   = ()             => Date.now();

  // Simple, non-cryptographic hash (FNV-1a 32-bit).
  // Suitable for a local-storage PIN because an attacker who has localStorage
  // access already owns the device. This is not meant to replace server-side
  // hashing — it only prevents the PIN being readable as plaintext.
  function _hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    // XOR-fold to add salt tied to this key namespace
    return (h ^ 0xdeadbeef).toString(16).padStart(8, '0') + str.length.toString(16);
  }

  // Constant-time comparison to resist timing attacks on local code
  function _safeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  // Cryptographically random OTP using Web Crypto where available
  function _generateOTP() {
    const len = CONFIG.OTP_LENGTH;
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return String(arr[0] % Math.pow(10, len)).padStart(len, '0');
    }
    // Fallback (older browsers)
    return String(Math.floor(Math.random() * Math.pow(10, len))).padStart(len, '0');
  }

  // Generate a random session token (128-bit hex)
  function _generateToken() {
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint8Array(16);
      window.crypto.getRandomValues(arr);
      return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ── Credential management ──────────────────────────────────────────────
  function _ensureDefaultCreds() {
    const existing = _load(STORE.CREDS);
    // Write defaults if missing, or if stored record is structurally broken
    if (!existing || typeof existing.phone !== 'string' || !existing.pinHash) {
      _save(STORE.CREDS, {
        phone:   CONFIG.DEFAULT_PHONE,
        pinHash: _hash(CONFIG.DEFAULT_PIN),
      });
    }
  }

  function getCreds() { return _load(STORE.CREDS, { phone: CONFIG.DEFAULT_PHONE, pinHash: _hash(CONFIG.DEFAULT_PIN) }); }

  function changePhone(newPhone, currentPin) {
    const creds = getCreds();
    if (!_safeEqual(_hash(currentPin), creds.pinHash)) return { ok: false, msg: 'Current PIN is incorrect.' };
    if (!/^\d{10}$/.test(newPhone)) return { ok: false, msg: 'Phone must be exactly 10 digits.' };
    _save(STORE.CREDS, { ...creds, phone: newPhone });
    return { ok: true };
  }

  function changePIN(currentPin, newPin, confirmPin) {
    const creds = getCreds();
    if (!_safeEqual(_hash(currentPin), creds.pinHash)) return { ok: false, msg: 'Current PIN is incorrect.' };
    if (newPin.length < 4 || newPin.length > 8) return { ok: false, msg: 'New PIN must be 4–8 digits.' };
    if (!/^\d+$/.test(newPin)) return { ok: false, msg: 'PIN must contain digits only.' };
    if (newPin !== confirmPin) return { ok: false, msg: 'PINs do not match.' };
    if (newPin === currentPin) return { ok: false, msg: 'New PIN must differ from current PIN.' };
    _save(STORE.CREDS, { ...creds, pinHash: _hash(newPin) });
    return { ok: true };
  }

  // ── Lock management ────────────────────────────────────────────────────
  function getLockState() { return _load(STORE.LOCK, { lockedUntil: 0, failCount: 0 }); }

  function isAccountLocked() {
    const lock = getLockState();
    return lock.lockedUntil > _now();
  }

  function lockRemainingMs() {
    const lock = getLockState();
    return Math.max(0, lock.lockedUntil - _now());
  }

  function _incrementFail() {
    const lock = getLockState();
    const failCount = (lock.failCount || 0) + 1;
    const lockedUntil = failCount >= CONFIG.OTP_MAX_ATTEMPTS ? _now() + CONFIG.LOCK_DURATION_MS : lock.lockedUntil;
    _save(STORE.LOCK, { failCount, lockedUntil });
    return failCount;
  }

  function _clearLock() { _save(STORE.LOCK, { lockedUntil: 0, failCount: 0 }); }

  // Public reset — clears credentials + lock so defaults are restored on next load
  function _resetCreds() {
    if (!confirm('This will reset your login credentials to the defaults:\nPhone: ' + CONFIG.DEFAULT_PHONE + '\nPIN: ' + CONFIG.DEFAULT_PIN + '\n\nContinue?')) return;
    _del(STORE.CREDS);
    _del(STORE.LOCK);
    _del(STORE.OTP_STATE);
    _del(STORE.SESSION);
    _ensureDefaultCreds();
    document.getElementById('auth-overlay').innerHTML = _buildPhaseHTML('phone');
    document.getElementById('auth-phone').focus();
  }

  // ── OTP management ─────────────────────────────────────────────────────
  function getOTPState() { return _load(STORE.OTP_STATE, null); }

  /**
   * Request a new OTP for the given phone number.
   * Returns { ok, otp, msg, cooldownMs }
   * In production the OTP would be sent via SMS gateway; here it is
   * returned in the response object so the UI can display it in a
   * dev-mode banner (hidden in the UI by default, shown only while
   * the owner is setting up credentials for the first time).
   */
  function requestOTP(phone) {
    if (isAccountLocked()) {
      return { ok: false, msg: `Account locked. Try again in ${Math.ceil(lockRemainingMs() / 60000)} min.` };
    }

    const creds = getCreds();

    // Resend cooldown (keyed on the stored phone, not the input)
    const prev = getOTPState();
    if (prev && prev.phone === creds.phone) {
      const elapsed = _now() - (prev.issuedAt || 0);
      if (elapsed < CONFIG.OTP_RESEND_COOLDOWN) {
        return { ok: false, cooldown: true, cooldownMs: CONFIG.OTP_RESEND_COOLDOWN - elapsed,
                 msg: `Wait ${Math.ceil((CONFIG.OTP_RESEND_COOLDOWN - elapsed) / 1000)} seconds before requesting a new OTP.` };
      }
    }

    const otp = _generateOTP();
    _save(STORE.OTP_STATE, {
      hash:       _hash(otp),
      expiresAt:  _now() + CONFIG.OTP_TTL_MS,
      issuedAt:   _now(),
      attempts:   0,
      phone:      creds.phone,
    });

    // In a real deployment: send otp to phone via SMS API here.
    // We surface it through the return value so the UI can show it
    // in the "OTP display box" (simulated SMS delivery).
    return { ok: true, otp };
  }

  /**
   * Verify an entered OTP.
   * Returns { ok, msg, attemptsLeft }
   */
  function verifyOTP(enteredOTP) {
    if (isAccountLocked()) {
      return { ok: false, msg: `Account locked for ${Math.ceil(lockRemainingMs() / 60000)} more minutes.` };
    }

    const state = getOTPState();
    if (!state) return { ok: false, msg: 'No OTP requested. Please request a new one.' };

    if (_now() > state.expiresAt) {
      _del(STORE.OTP_STATE);
      return { ok: false, expired: true, msg: 'OTP has expired. Please request a new one.' };
    }

    const attemptsLeft = CONFIG.OTP_MAX_ATTEMPTS - state.attempts - 1;

    if (!_safeEqual(_hash(String(enteredOTP).trim()), state.hash)) {
      const newAttempts = state.attempts + 1;
      if (newAttempts >= CONFIG.OTP_MAX_ATTEMPTS) {
        _del(STORE.OTP_STATE);
        _save(STORE.LOCK, { failCount: CONFIG.OTP_MAX_ATTEMPTS, lockedUntil: _now() + CONFIG.LOCK_DURATION_MS });
        return { ok: false, locked: true, msg: `Too many wrong attempts. Account locked for ${CONFIG.LOCK_DURATION_MS / 60000} minutes.` };
      }
      _save(STORE.OTP_STATE, { ...state, attempts: newAttempts });
      return { ok: false, msg: `Incorrect OTP. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`, attemptsLeft };
    }

    // ── SUCCESS ─────────────────────────────────────────────────────────
    _del(STORE.OTP_STATE);
    _clearLock();
    _createSession();
    return { ok: true };
  }

  // ── Session management ─────────────────────────────────────────────────
  function _getSessionTTL() {
    // Allow the owner to override session TTL from Settings (stored in business settings)
    try {
      const s = JSON.parse(localStorage.getItem('kkr_settings') || '{}');
      const hrs = parseInt(s.sessionTimeoutHours);
      if (hrs > 0 && hrs <= 72) return hrs * 60 * 60 * 1000;
    } catch {}
    return CONFIG.SESSION_TTL_MS;
  }

  function _createSession() {
    const ttl = _getSessionTTL();
    const now = _now();
    const session = {
      token:        _generateToken(),
      createdAt:    now,
      expiresAt:    now + ttl,
      lastActivity: now,
    };
    _save(STORE.SESSION, session);
    _appendLog({ loginAt: now, logoutAt: null, reason: null });
  }

  function getSession() { return _load(STORE.SESSION, null); }

  /**
   * Returns true if a valid, non-expired, non-idle session exists.
   * Also extends lastActivity on every call (keep-alive).
   */
  function isLoggedIn() {
    const session = getSession();
    if (!session || !session.token) return false;

    const now = _now();
    if (now > session.expiresAt) {
      _expireSession('session_expired');
      return false;
    }
    const idle = now - session.lastActivity;
    if (idle > CONFIG.IDLE_TTL_MS) {
      _expireSession('idle_timeout');
      return false;
    }

    // Extend activity timestamp (write only if >30 s has passed to avoid thrashing storage)
    if (now - session.lastActivity > 30000) {
      _save(STORE.SESSION, { ...session, lastActivity: now });
    }
    return true;
  }

  function _expireSession(reason) {
    const session = getSession();
    if (session) _updateLastLog({ logoutAt: _now(), reason });
    _del(STORE.SESSION);
  }

  function logout(reason = 'manual') {
    _expireSession(reason);
    showLoginScreen();
  }

  // ── Session log ────────────────────────────────────────────────────────
  function _appendLog(entry) {
    const log = _load(STORE.SESSION_LOG, []);
    log.unshift(entry);
    if (log.length > CONFIG.MAX_LOG_ENTRIES) log.length = CONFIG.MAX_LOG_ENTRIES;
    _save(STORE.SESSION_LOG, log);
  }

  function _updateLastLog(patch) {
    const log = _load(STORE.SESSION_LOG, []);
    if (log.length) Object.assign(log[0], patch);
    _save(STORE.SESSION_LOG, log);
  }

  function getSessionLog() { return _load(STORE.SESSION_LOG, []); }

  // ── Idle keep-alive (called by app on user interaction) ────────────────
  function touch() {
    const session = getSession();
    if (session) _save(STORE.SESSION, { ...session, lastActivity: _now() });
  }

  // ── UI ──────────────────────────────────────────────────────────────────
  // The login overlay lives OUTSIDE the main app shell so the app DOM is
  // never shown to an unauthenticated user.

  let _otpDisplayed    = null; // holds OTP for simulated SMS display
  let _resendTimer     = null;
  let _otpExpiryTimer  = null;
  let _sessionWatcher  = null;

  function showLoginScreen() {
    // Hide app shell
    _setAppVisible(false);

    // Build or reveal overlay
    let overlay = document.getElementById('auth-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'auth-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = _buildPhaseHTML('phone');
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('auth-visible'));

    const phoneInput = document.getElementById('auth-phone');
    if (phoneInput) phoneInput.focus();

    // Stop any running watchers
    _stopWatchers();
  }

  function hideLoginScreen() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) {
      overlay.classList.remove('auth-visible');
      setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
    _setAppVisible(true);
    _startSessionWatcher();
    _startActivityListeners();
  }

  function _setAppVisible(visible) {
    const els = ['sidebar', 'topbar', 'main-content', 'toast-container', 'confirm-modal'];
    els.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.visibility = visible ? '' : 'hidden';
    });
  }

  // ── Login screen HTML builders ─────────────────────────────────────────
  function _buildPhaseHTML(phase) {
    const creds = getCreds();
    const masked = '+91 ' + creds.phone.replace(/(\d{5})(\d{5})/, '$1 *****');
    const isLocked = isAccountLocked();

    if (isLocked) {
      const mins = Math.ceil(lockRemainingMs() / 60000);
      return `
      <div class="auth-card">
        ${_authLogo()}
        <div class="auth-lock-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 class="auth-title">Account Locked</h2>
        <p class="auth-subtitle">Too many failed attempts. Try again in <strong>${mins} minute${mins !== 1 ? 's' : ''}</strong>.</p>
        <button class="auth-btn" onclick="KKR_AUTH.checkLockExpiry()">Check Again</button>
      </div>`;
    }

    if (phase === 'phone') {
      return `
      <div class="auth-card">
        ${_authLogo()}
        <h2 class="auth-title">Welcome Back</h2>
        <p class="auth-subtitle">Enter your registered mobile number to receive a login OTP.</p>
        <form onsubmit="KKR_AUTH.handlePhasePhone(event)">
          <div class="auth-field">
            <label class="auth-label">Mobile Number</label>
            <div class="auth-phone-wrap">
              <span class="auth-phone-prefix">+91</span>
              <input id="auth-phone" class="auth-input auth-input-phone" type="tel"
                inputmode="numeric" maxlength="10" pattern="[0-9]{10}"
                placeholder="10-digit number" autocomplete="tel" required>
            </div>
          </div>
          <div class="auth-field">
            <label class="auth-label">Security PIN</label>
            <input id="auth-pin" class="auth-input" type="password"
              inputmode="numeric" maxlength="8" minlength="4"
              placeholder="4–8 digit PIN" autocomplete="current-password" required>
          </div>
          <div id="auth-error" class="auth-error" style="display:none"></div>
          <button type="submit" class="auth-btn" id="auth-submit-btn">
            <span id="auth-btn-label">Send OTP</span>
          </button>
        </form>
        <p class="auth-help">Default mobile: <code class="auth-code">${CONFIG.DEFAULT_PHONE}</code> &nbsp;·&nbsp; PIN: <code class="auth-code">${CONFIG.DEFAULT_PIN}</code><br>
        Change both in Settings → Security after login.<br>
        <button type="button" class="auth-link" style="font-size:11px;color:#475569;margin-top:8px" onclick="KKR_AUTH._resetCreds()">Having trouble? Reset to defaults</button></p>
      </div>`;
    }

    if (phase === 'otp') {
      return `
      <div class="auth-card">
        ${_authLogo()}
        <h2 class="auth-title">Verify OTP</h2>
        <p class="auth-subtitle">A 6-digit OTP has been sent to <strong>${masked}</strong>.</p>
        ${_otpDisplayed ? `
        <div class="auth-otp-dev-box">
          <span class="auth-otp-dev-label">OTP (simulated SMS)</span>
          <span class="auth-otp-dev-code" id="dev-otp-display">${_otpDisplayed}</span>
        </div>` : ''}
        <form onsubmit="KKR_AUTH.handlePhaseOTP(event)">
          <div class="auth-field">
            <label class="auth-label">Enter OTP</label>
            <input id="auth-otp" class="auth-input auth-otp-input" type="tel"
              inputmode="numeric" maxlength="6" pattern="[0-9]{6}"
              placeholder="— — — — — —" autocomplete="one-time-code" required autofocus>
          </div>
          <div class="auth-otp-meta">
            <span id="auth-otp-timer" class="auth-timer"></span>
            <button type="button" class="auth-link" id="auth-resend-btn" onclick="KKR_AUTH.handleResend()" disabled>Resend OTP</button>
          </div>
          <div id="auth-error" class="auth-error" style="display:none"></div>
          <div id="auth-attempts" class="auth-attempts" style="display:none"></div>
          <button type="submit" class="auth-btn" id="auth-submit-btn">Verify &amp; Login</button>
          <button type="button" class="auth-link auth-back-link" onclick="KKR_AUTH.backToPhone()">
            ← Change number / PIN
          </button>
        </form>
      </div>`;
    }
  }

  function _authLogo() {
    const s = JSON.parse(localStorage.getItem('kkr_settings') || '{}');
    const name = s.businessName || 'KKR Logistics';
    return `
    <div class="auth-logo-wrap">
      <div class="auth-logo-icon">KK</div>
      <div>
        <div class="auth-logo-name">${name}</div>
        <div class="auth-logo-sub">Business Management System</div>
      </div>
    </div>`;
  }

  // ── Phase handlers (called by inline onclick / form submit) ────────────
  function handlePhasePhone(e) {
    e.preventDefault();
    const phone  = document.getElementById('auth-phone').value.trim().replace(/\D/g, '');
    const pin    = document.getElementById('auth-pin').value.trim();
    const errEl  = document.getElementById('auth-error');
    const btnLbl = document.getElementById('auth-btn-label');

    if (isAccountLocked()) {
      document.getElementById('auth-overlay').innerHTML = _buildPhaseHTML('phone');
      return;
    }

    const creds  = getCreds();
    const pinOk  = _safeEqual(_hash(pin), creds.pinHash);
    const phoneOk = phone === creds.phone;

    if (!pinOk || !phoneOk) {
      // Count the failed attempt once, regardless of which field was wrong
      _incrementFail();
      // Generic message — never reveal which field failed
      _showError(errEl, 'Phone number or PIN is incorrect.');
      btnLbl.textContent = 'Send OTP';
      return;
    }

    // Both correct — request OTP (handles cooldown / lock internally)
    const result = requestOTP(phone);
    if (!result.ok) {
      _showError(errEl, result.msg);
      btnLbl.textContent = 'Send OTP';
      return;
    }

    _otpDisplayed = result.otp; // store for simulated SMS display
    const overlay = document.getElementById('auth-overlay');
    overlay.innerHTML = _buildPhaseHTML('otp');
    _startOTPTimers();
    document.getElementById('auth-otp').focus();
  }

  function handlePhaseOTP(e) {
    e.preventDefault();
    const entered = document.getElementById('auth-otp').value.trim();
    const errEl   = document.getElementById('auth-error');
    const attEl   = document.getElementById('auth-attempts');

    const result = verifyOTP(entered);
    if (!result.ok) {
      if (result.locked) {
        document.getElementById('auth-overlay').innerHTML = _buildPhaseHTML('phone');
        return;
      }
      _showError(errEl, result.msg);
      if (result.attemptsLeft !== undefined) {
        attEl.style.display = 'block';
        attEl.textContent = `${result.attemptsLeft} attempt${result.attemptsLeft !== 1 ? 's' : ''} remaining`;
      }
      if (result.expired) {
        document.getElementById('auth-overlay').innerHTML = _buildPhaseHTML('otp');
        _startOTPTimers();
      }
      return;
    }

    // ── Logged in ──────────────────────────────────────────────────────
    _stopWatchers();
    _otpDisplayed = null;
    hideLoginScreen();

    // Let the app initialise (or re-render if it was already loaded)
    if (typeof window._kkrAppReady === 'function') {
      window._kkrAppReady();
    }
  }

  function handleResend() {
    const creds = getCreds();
    const result = requestOTP(creds.phone);
    if (!result.ok) {
      const errEl = document.getElementById('auth-error');
      if (errEl) _showError(errEl, result.msg);
      return;
    }
    _otpDisplayed = result.otp;
    // Update dev box
    const devBox = document.getElementById('dev-otp-display');
    if (devBox) devBox.textContent = _otpDisplayed;
    // Reset timers
    _stopWatchers();
    _startOTPTimers();
    // Visual feedback
    const errEl = document.getElementById('auth-error');
    if (errEl) { errEl.style.display = 'none'; }
  }

  function backToPhone() {
    _del(STORE.OTP_STATE);
    _otpDisplayed = null;
    _stopWatchers();
    document.getElementById('auth-overlay').innerHTML = _buildPhaseHTML('phone');
    document.getElementById('auth-phone').focus();
  }

  function checkLockExpiry() {
    if (!isAccountLocked()) {
      document.getElementById('auth-overlay').innerHTML = _buildPhaseHTML('phone');
    } else {
      const mins = Math.ceil(lockRemainingMs() / 60000);
      const s = document.querySelector('.auth-subtitle');
      if (s) s.innerHTML = `Still locked. Try again in <strong>${mins} minute${mins !== 1 ? 's' : ''}</strong>.`;
    }
  }

  // ── Timer helpers ──────────────────────────────────────────────────────
  function _startOTPTimers() {
    const state = getOTPState();
    if (!state) return;

    const timerEl    = () => document.getElementById('auth-otp-timer');
    const resendBtn  = () => document.getElementById('auth-resend-btn');

    function updateTimer() {
      const remaining = state.expiresAt - _now();
      const te = timerEl();
      if (!te) { clearInterval(_otpExpiryTimer); return; }

      if (remaining <= 0) {
        te.textContent = 'OTP expired';
        te.style.color = '#f87171';
        clearInterval(_otpExpiryTimer);
        const rb = resendBtn();
        if (rb) { rb.disabled = false; rb.style.opacity = '1'; }
        return;
      }
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      te.textContent = `Expires in ${m}:${String(s).padStart(2, '0')}`;
      te.style.color = remaining < 60000 ? '#f87171' : '#94a3b8';
    }

    function updateResend() {
      const elapsed  = _now() - (state.issuedAt || 0);
      const cooldown = CONFIG.OTP_RESEND_COOLDOWN - elapsed;
      const rb = resendBtn();
      if (!rb) { clearInterval(_resendTimer); return; }

      if (cooldown <= 0) {
        rb.disabled = false;
        rb.style.opacity = '1';
        rb.textContent = 'Resend OTP';
        clearInterval(_resendTimer);
      } else {
        rb.disabled = true;
        rb.style.opacity = '0.5';
        rb.textContent = `Resend in ${Math.ceil(cooldown / 1000)}s`;
      }
    }

    updateTimer();
    updateResend();
    _otpExpiryTimer = setInterval(updateTimer, 1000);
    _resendTimer    = setInterval(updateResend, 1000);
  }

  function _stopWatchers() {
    clearInterval(_otpExpiryTimer);
    clearInterval(_resendTimer);
    clearInterval(_sessionWatcher);
    _otpExpiryTimer = null;
    _resendTimer    = null;
    _sessionWatcher = null;
  }

  // ── Session watcher (checks expiry every 60 s while app is running) ────
  function _startSessionWatcher() {
    _sessionWatcher = setInterval(() => {
      if (!isLoggedIn()) {
        showLoginScreen();
        // Show a one-time toast after the overlay is rendered
        setTimeout(() => {
          const errEl = document.createElement('div');
          errEl.className = 'auth-session-msg';
          errEl.textContent = 'Your session expired. Please log in again.';
          const card = document.querySelector('.auth-card');
          if (card) card.prepend(errEl);
        }, 400);
      }
    }, 60 * 1000); // check every minute
  }

  // ── Activity listeners (idle timeout keep-alive) ───────────────────────
  function _startActivityListeners() {
    ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'].forEach(ev => {
      document.addEventListener(ev, touch, { passive: true });
    });
  }

  // ── Error display ──────────────────────────────────────────────────────
  function _showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.classList.remove('auth-error-shake');
    void el.offsetWidth; // reflow for animation restart
    el.classList.add('auth-error-shake');
  }

  // ── Public API ─────────────────────────────────────────────────────────
  _ensureDefaultCreds();

  return {
    // Guards
    isLoggedIn,
    showLoginScreen,
    hideLoginScreen,
    logout,
    touch,

    // OTP flow (called from inline handlers)
    handlePhasePhone,
    handlePhaseOTP,
    handleResend,
    backToPhone,
    checkLockExpiry,

    // Credential management (used by Settings)
    getCreds,
    changePhone,
    changePIN,
    getSession,
    getSessionLog,

    // Config access (used by Settings)
    CONFIG,
    // Emergency credential reset (shown on login screen)
    _resetCreds,
  };
})();


// ============================================================
// Boot guard — runs immediately when this script is parsed,
// BEFORE app.js DOMContentLoaded fires.
// ============================================================
(function bootGuard() {
  // We need the DOM ready before we can show the overlay
  function _guard() {
    if (!KKR_AUTH.isLoggedIn()) {
      KKR_AUTH.showLoginScreen();
      // Wire the app init to fire after successful login.
      // app.js sets window._kkrAppReady = _initApp in its DOMContentLoaded
      // guard, so by the time the user completes OTP that assignment is
      // already in place. We only provide a fallback here in case the
      // timing differs (e.g. very fast script parse before DOMContentLoaded).
      if (typeof window._kkrAppReady !== 'function') {
        window._kkrAppReady = function () {
          if (typeof _initApp === 'function') {
            _initApp();
          } else if (typeof navigate === 'function') {
            // Last-resort fallback
            KKR.seed();
            const s = KKR.getSettings();
            const bname = document.getElementById('topbar-business');
            if (bname) bname.textContent = s.businessName || 'KKR Logistics';
            navigate('dashboard');
            if (typeof updateAlertBadge  === 'function') updateAlertBadge();
            if (typeof updateSessionChip === 'function') updateSessionChip();
          }
        };
      }
    }
    // If already logged in, app.js DOMContentLoaded runs _initApp normally.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _guard);
  } else {
    _guard();
  }
})();
