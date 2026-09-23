// Calendar Page
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-indexed

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function renderCalendar() {
  return `
  <div class="page-content">
    <div class="page-header">
      <div class="page-header-left">
        <div class="title">Calendar</div>
        <div class="subtitle">Trips, maintenance schedules, and due dates at a glance</div>
      </div>
    </div>

    <div class="grid-2-1">
      <div class="card">
        <!-- Month nav -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px">
          <button class="btn btn-secondary btn-sm" onclick="calMonth--; if(calMonth<0){calMonth=11;calYear--;} rerenderPage()">${icon('chevronLeft',16)}</button>
          <div style="font-size:18px; font-weight:800">${MONTH_NAMES[calMonth]} ${calYear}</div>
          <button class="btn btn-secondary btn-sm" onclick="calMonth++; if(calMonth>11){calMonth=0;calYear++;} rerenderPage()">${icon('chevronRight',16)}</button>
        </div>
        <!-- Day headers -->
        <div class="cal-grid">
          ${DAY_NAMES.map(d=>`<div class="cal-header-cell">${d}</div>`).join('')}
          ${buildCalendarCells()}
        </div>
      </div>

      <!-- Sidebar: upcoming events -->
      <div style="display:flex; flex-direction:column; gap:16px">
        <div class="card">
          <div class="card-header"><div class="card-title">Upcoming Events</div></div>
          <div id="cal-upcoming">${renderUpcoming()}</div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Legend</div></div>
          <div style="display:flex; flex-direction:column; gap:8px">
            <div class="flex items-center gap-2"><div style="width:12px; height:12px; border-radius:3px; background:rgba(37,99,235,0.5)"></div><span style="font-size:12px">Trip</span></div>
            <div class="flex items-center gap-2"><div style="width:12px; height:12px; border-radius:3px; background:rgba(245,158,11,0.5)"></div><span style="font-size:12px">Maintenance / Expiry</span></div>
            <div class="flex items-center gap-2"><div style="width:12px; height:12px; border-radius:3px; background:rgba(16,185,129,0.5)"></div><span style="font-size:12px">Invoice Due</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function buildCalendarCells() {
  const today    = new Date();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const daysInPrev  = new Date(calYear, calMonth, 0).getDate();

  // Build events map
  const events = {};
  const addEvent = (dateStr, ev) => { if(!events[dateStr]) events[dateStr]=[]; events[dateStr].push(ev); };

  KKR.getTrips().forEach(t => {
    if (t.date) addEvent(t.date, { type:'trip', label: t.id + ' ' + t.from + '→' + t.to });
  });
  KKR.getInvoices().filter(i=>i.status!=='paid').forEach(i => {
    if (i.dueDate) addEvent(i.dueDate, { type:'billing', label: i.id + ' due' });
  });
  KKR.getVehicles().forEach(v => {
    if (v.insurance) addEvent(v.insurance, { type:'maintenance', label: v.regNo + ' insurance' });
    if (v.fitness)   addEvent(v.fitness,   { type:'maintenance', label: v.regNo + ' fitness' });
    if (v.puc)       addEvent(v.puc,       { type:'maintenance', label: v.regNo + ' PUC' });
  });
  KKR.getDrivers().forEach(d => {
    if (d.licenseExpiry) addEvent(d.licenseExpiry, { type:'maintenance', label: d.name + ' license' });
  });

  let cells = '';
  // Prev month cells
  for (let i=firstDay-1; i>=0; i--) {
    cells += `<div class="cal-cell other-month"><div class="cal-day">${daysInPrev-i}</div></div>`;
  }
  // Current month
  for (let d=1; d<=daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===d;
    const dayEvents = events[dateStr] || [];
    cells += `
    <div class="cal-cell ${isToday?'today':''}">
      <div class="cal-day">${d}</div>
      ${dayEvents.slice(0,3).map(e=>`<div class="cal-event ${e.type}" title="${e.label}">${e.label}</div>`).join('')}
      ${dayEvents.length>3?`<div style="font-size:9px; color:var(--text-muted)">+${dayEvents.length-3} more</div>`:''}
    </div>`;
  }
  // Fill remaining
  const totalCells = firstDay + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let d=1; d<=remaining; d++) {
    cells += `<div class="cal-cell other-month"><div class="cal-day">${d}</div></div>`;
  }
  return cells;
}

function renderUpcoming() {
  const today = new Date();
  const upcoming = [];

  KKR.getTrips().filter(t=>t.status==='in-transit'||t.status==='pending').forEach(t=>{
    upcoming.push({ date: t.date, label: `Trip ${t.id}: ${t.from}→${t.to}`, type:'trip', days: daysFromNow(t.date) });
  });
  KKR.getInvoices().filter(i=>i.status!=='paid').forEach(i=>{
    if (i.dueDate) upcoming.push({ date: i.dueDate, label: `Invoice ${i.id} due (${KKR.customerName(i.customer)})`, type:'billing', days: daysFromNow(i.dueDate) });
  });
  KKR.getVehicles().forEach(v=>{
    if (v.insurance) {
      const d=daysFromNow(v.insurance);
      if(d!==null&&d>=0&&d<=90) upcoming.push({ date:v.insurance, label:`${v.regNo} insurance expires`, type:'maintenance', days:d });
    }
  });

  upcoming.sort((a,b)=>a.date.localeCompare(b.date));
  const shown = upcoming.slice(0,8);

  if (!shown.length) return `<div class="text-muted text-center" style="padding:20px 0">No upcoming events</div>`;

  return shown.map(ev=>`
    <div class="timeline-item">
      <div class="timeline-dot ${ev.type==='trip'?'blue':ev.type==='billing'?'green':'amber'}"></div>
      <div class="timeline-content">
        <div class="t-title">${ev.label}</div>
        <div class="t-time">${fmtDate(ev.date)} ${ev.days===0?'(Today)':ev.days>0?`(in ${ev.days}d)`:`(${Math.abs(ev.days)}d ago)`}</div>
      </div>
    </div>`).join('');
}
