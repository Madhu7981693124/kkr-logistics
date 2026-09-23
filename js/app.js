// KKR Logistics - Main App Controller

let currentPage = 'dashboard';
let sidebarCollapsed = false;

const PAGES = {
  dashboard: { title: 'Dashboard',    sub: 'Overview & KPIs',          render: renderDashboard,  afterRender: initDashboardCharts },
  trips:     { title: 'Trips',        sub: 'Freight movement records',  render: renderTrips },
  vehicles:  { title: 'Vehicles',     sub: 'Fleet management',          render: renderVehicles },
  drivers:   { title: 'Drivers',      sub: 'Driver management',         render: renderDrivers },
  materials: { title: 'Materials',    sub: 'Cargo types master',        render: renderMaterials },
  weighbridge:{ title:'Weighbridge',  sub: 'Weight records',            render: renderWeighbridge },
  fuel:      { title: 'Fuel',         sub: 'Consumption tracking',      render: renderFuel },
  expenses:  { title: 'Expenses',     sub: 'Operational costs',         render: renderExpenses },
  billing:   { title: 'Billing',      sub: 'Invoices & receivables',    render: renderBilling },
  payments:  { title: 'Payments',     sub: 'Payment records',           render: renderPayments },
  customers: { title: 'Customers',    sub: 'Client management',         render: renderCustomers },
  eway:      { title: 'E-Way Bills',  sub: 'Goods transit documents',   render: renderEway },
  documents: { title: 'Documents',   sub: 'Compliance & records',      render: renderDocuments },
  reports:   { title: 'Reports',      sub: 'Analytics & exports',       render: renderReports,    afterRender: initReportCharts },
  calendar:  { title: 'Calendar',     sub: 'Schedule & reminders',      render: renderCalendar },
  alerts:    { title: 'Alerts',       sub: 'Notifications & reminders', render: renderAlerts },
  settings:  { title: 'Settings',     sub: 'System configuration',      render: renderSettings,   afterRender: initSecuritySection },
};

function navigate(page) {
  if (!PAGES[page]) return;
  currentPage = page;

  // Reset page-specific filters
  if (page === 'trips')      { tripsFilter = { q: '', status: '' }; }
  if (page === 'vehicles')   { vehiclesFilter = { q: '', status: '' }; }
  if (page === 'drivers')    { driversFilter = { q: '', status: '' }; }
  if (page === 'materials')  { materialsFilter = { q: '' }; }
  if (page === 'weighbridge'){ wbFilter = { q: '' }; }
  if (page === 'fuel')       { fuelFilter = { q: '', vehicle: '' }; }
  if (page === 'expenses')   { expFilter = { q: '', category: '' }; }
  if (page === 'billing')    { billFilter = { q: '', status: '' }; }
  if (page === 'payments')   { payFilter = { q: '' }; }
  if (page === 'customers')  { custFilter = { q: '', status: '' }; }
  if (page === 'eway')       { ewayFilter = { q: '', status: '' }; }
  if (page === 'documents')  { docFilter = { q: '', type: '' }; }
  if (page === 'alerts')     { alertsFilter = { priority: '' }; }
  if (page === 'reports')    { reportTab = 'summary'; }

  renderPage();
}

function rerenderPage() {
  renderPage(true); // rerender without resetting scroll
}

function renderPage(keepScroll = false) {
  const page = PAGES[currentPage];
  if (!page) return;

  // Update breadcrumb
  document.getElementById('topbar-page-title').textContent = page.title;
  document.getElementById('topbar-page-sub').textContent   = page.sub;

  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === currentPage);
  });

  // Render page content
  const content = document.getElementById('main-content');
  const scrollTop = keepScroll ? content.scrollTop : 0;
  content.innerHTML = page.render();
  if (!keepScroll) content.scrollTop = 0;
  else content.scrollTop = scrollTop;

  // Post-render hooks
  if (page.afterRender) {
    requestAnimationFrame(() => page.afterRender());
  }
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  const sidebar = document.getElementById('sidebar');
  const topbar  = document.getElementById('topbar');
  const content = document.getElementById('main-content');
  sidebar.classList.toggle('collapsed', sidebarCollapsed);
  topbar.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  content.classList.toggle('sidebar-collapsed', sidebarCollapsed);
}

// ── SESSION CHIP ──────────────────────────────────────────────────────────
function updateSessionChip() {
  const chip = document.getElementById('session-info-chip');
  if (!chip) return;
  const session = (typeof KKR_AUTH !== 'undefined') ? KKR_AUTH.getSession() : null;
  if (!session) { chip.style.display = 'none'; return; }
  const expiresIn = Math.max(0, Math.round((session.expiresAt - Date.now()) / 60000));
  const hrs  = Math.floor(expiresIn / 60);
  const mins = expiresIn % 60;
  chip.style.display = '';
  chip.title = `Session expires in ${hrs > 0 ? hrs + 'h ' : ''}${mins}m`;
  chip.textContent = `${hrs > 0 ? hrs + 'h ' : ''}${mins}m`;
}

// ── INIT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // If auth module is present and user is NOT logged in, the boot guard in
  // auth.js has already shown the login screen. Register our init as the
  // post-login callback and bail out here — auth.js will call _kkrAppReady()
  // after a successful OTP verification.
  if (typeof KKR_AUTH !== 'undefined' && !KKR_AUTH.isLoggedIn()) {
    window._kkrAppReady = _initApp;
    return;
  }
  _initApp();
});

function _initApp() {
  // Seed default data
  KKR.seed();

  // Set business name
  const s = KKR.getSettings();
  const bname = document.getElementById('topbar-business');
  if (bname) bname.textContent = s.businessName || 'KKR Logistics';

  // Global search
  const gs = document.getElementById('global-search');
  if (gs) {
    gs.addEventListener('input', e => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) return;
      // Quick navigate by keyword
      const map = { trip:'trips', vehicle:'vehicles', driver:'drivers', fuel:'fuel', expense:'expenses',
                    invoice:'billing', payment:'payments', customer:'customers', eway:'eway',
                    document:'documents', report:'reports', setting:'settings', alert:'alerts',
                    material:'materials', weigh:'weighbridge', calendar:'calendar' };
      for (const [kw,pg] of Object.entries(map)) {
        if (kw.includes(q) || q.includes(kw)) { navigate(pg); e.target.value=''; return; }
      }
    });
  }

  // Initial render
  navigate('dashboard');
  updateAlertBadge();
  updateSessionChip();

  // Refresh session chip every minute
  setInterval(updateSessionChip, 60 * 1000);
}
