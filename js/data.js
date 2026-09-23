// KKR Logistics - Data Store (localStorage-backed)

const KKR = {
  // ── helpers ──────────────────────────────────────────────────────────────
  _load(key, def) {
    try { const v = localStorage.getItem('kkr_' + key); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  _save(key, val) {
    try { localStorage.setItem('kkr_' + key, JSON.stringify(val)); } catch {}
  },
  _id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); },

  // ── seed data ─────────────────────────────────────────────────────────────
  seed() {
    if (this._load('seeded', false)) return;

    this._save('settings', {
      businessName: 'KKR Logistics',
      ownerName: 'Ramesh Kumar',
      phone: '+91 98765 43210',
      email: 'kkrlogistics@gmail.com',
      address: '12, Industrial Area, Phase II, Ludhiana, Punjab 141003',
      gstin: '03AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
      bankName: 'Punjab National Bank',
      accountNo: '1234567890123',
      ifsc: 'PUNB0123456',
      currency: 'INR',
      dateFormat: 'DD/MM/YYYY',
      financialYear: '2025-26',
      theme: 'dark',
      alertsEmail: true,
      alertsSMS: false,
    });

    const customers = [
      { id: 'C001', name: 'Tata Steel Ltd', contact: 'Anil Sharma', phone: '9876543210', email: 'anil@tatasteel.com', address: 'Jamshedpur, Jharkhand', gstin: '20AAAAA0000A1Z5', balance: 125000, status: 'active' },
      { id: 'C002', name: 'JSW Steel', contact: 'Priya Nair', phone: '9988776655', email: 'priya@jsw.com', address: 'Vijayanagar, Karnataka', gstin: '29BBBBB0000B1Z5', balance: 85000, status: 'active' },
      { id: 'C003', name: 'Hindalco Industries', contact: 'Suresh Patel', phone: '9871234567', email: 'suresh@hindalco.com', address: 'Renukoot, UP', gstin: '09CCCCC0000C1Z5', balance: 210000, status: 'active' },
      { id: 'C004', name: 'SAIL (Steel Authority)', contact: 'Ravi Kumar', phone: '9654321098', email: 'ravi@sail.in', address: 'Bhilai, Chhattisgarh', gstin: '22DDDDD0000D1Z5', balance: 45000, status: 'active' },
      { id: 'C005', name: 'Vedanta Resources', contact: 'Meena Gupta', phone: '9745632108', email: 'meena@vedanta.com', address: 'Lanjigarh, Odisha', gstin: '21EEEEE0000E1Z5', balance: 0, status: 'inactive' },
    ];
    this._save('customers', customers);

    const vehicles = [
      { id: 'V001', regNo: 'PB-10-AB-1234', type: 'Truck', make: 'Tata', model: 'LPT 2518', year: 2021, capacity: '25 Ton', status: 'active', insurance: '2026-03-15', fitness: '2026-06-20', permit: '2026-09-10', puc: '2025-12-01', driver: 'D001', fuelType: 'Diesel', kmReading: 125400 },
      { id: 'V002', regNo: 'PB-10-CD-5678', type: 'Truck', make: 'Ashok Leyland', model: '3520 8x2', year: 2020, capacity: '35 Ton', status: 'active', insurance: '2026-05-20', fitness: '2026-08-15', permit: '2027-01-10', puc: '2025-11-10', driver: 'D002', fuelType: 'Diesel', kmReading: 198200 },
      { id: 'V003', regNo: 'PB-11-EF-9012', type: 'Tipper', make: 'Tata', model: 'Signa 2825.TK', year: 2022, capacity: '20 Ton', status: 'active', insurance: '2026-07-30', fitness: '2027-02-10', permit: '2026-11-05', puc: '2026-02-20', driver: 'D003', fuelType: 'Diesel', kmReading: 87600 },
      { id: 'V004', regNo: 'HR-55-GH-3456', type: 'Truck', make: 'Mahindra', model: 'BLAZO X 40', year: 2019, capacity: '40 Ton', status: 'maintenance', insurance: '2025-10-12', fitness: '2025-12-05', permit: '2026-03-18', puc: '2025-09-15', driver: 'D004', fuelType: 'Diesel', kmReading: 312800 },
      { id: 'V005', regNo: 'UP-14-IJ-7890', type: 'Container', make: 'Eicher', model: 'Pro 8035', year: 2023, capacity: '30 Ton', status: 'active', insurance: '2027-01-25', fitness: '2027-05-10', permit: '2027-08-20', puc: '2026-04-10', driver: 'D005', fuelType: 'Diesel', kmReading: 34200 },
    ];
    this._save('vehicles', vehicles);

    const drivers = [
      { id: 'D001', name: 'Gurpreet Singh', phone: '9876501234', dob: '1985-06-15', license: 'PB0120185001234', licenseExpiry: '2028-06-14', address: 'Ludhiana, Punjab', status: 'active', vehicle: 'V001', trips: 142, joinDate: '2019-04-01' },
      { id: 'D002', name: 'Ramesh Yadav', phone: '9765432109', dob: '1980-11-22', license: 'UP0120180067890', licenseExpiry: '2027-11-21', address: 'Kanpur, UP', status: 'active', vehicle: 'V002', trips: 218, joinDate: '2018-07-15' },
      { id: 'D003', name: 'Sukhwinder Kaur', phone: '9654321987', dob: '1990-03-08', license: 'PB0520200054321', licenseExpiry: '2029-03-07', address: 'Amritsar, Punjab', status: 'active', vehicle: 'V003', trips: 98, joinDate: '2021-01-10' },
      { id: 'D004', name: 'Ranjit Kumar', phone: '9543210876', dob: '1978-09-30', license: 'HR0820170032456', licenseExpiry: '2026-09-29', address: 'Ambala, Haryana', status: 'on-leave', vehicle: 'V004', trips: 305, joinDate: '2016-03-20' },
      { id: 'D005', name: 'Mohd. Arif', phone: '9432109765', dob: '1992-12-05', license: 'UP1320220078654', licenseExpiry: '2030-12-04', address: 'Agra, UP', status: 'active', vehicle: 'V005', trips: 45, joinDate: '2022-09-01' },
    ];
    this._save('drivers', drivers);

    const materials = [
      { id: 'M001', name: 'Iron Ore', category: 'Metal Ore', unit: 'MT', density: '2.5 t/m³', notes: 'Grade A' },
      { id: 'M002', name: 'Coal', category: 'Mineral', unit: 'MT', density: '1.4 t/m³', notes: 'Thermal grade' },
      { id: 'M003', name: 'Steel Coils', category: 'Finished Steel', unit: 'MT', density: 'N/A', notes: 'HR & CR coils' },
      { id: 'M004', name: 'Limestone', category: 'Mineral', unit: 'MT', density: '2.7 t/m³', notes: 'Used in steel plants' },
      { id: 'M005', name: 'Fly Ash', category: 'By-product', unit: 'MT', density: '1.0 t/m³', notes: '' },
      { id: 'M006', name: 'Alumina', category: 'Metal Ore', unit: 'MT', density: '3.9 t/m³', notes: '' },
      { id: 'M007', name: 'Scrap Metal', category: 'Scrap', unit: 'MT', density: 'N/A', notes: 'Mixed' },
    ];
    this._save('materials', materials);

    const trips = [
      { id: 'TR001', date: '2025-09-20', vehicle: 'V001', driver: 'D001', customer: 'C001', from: 'Ludhiana', to: 'Jamshedpur', material: 'M003', loadedWt: 24.5, billedWt: 24.5, distance: 1820, freight: 87500, status: 'completed', ewayBill: 'EW001', invoiceNo: 'INV-2025-001', remarks: '' },
      { id: 'TR002', date: '2025-09-19', vehicle: 'V002', driver: 'D002', customer: 'C002', from: 'Vijayanagar', to: 'Ludhiana', material: 'M001', loadedWt: 34.8, billedWt: 35.0, distance: 2150, freight: 105000, status: 'completed', ewayBill: 'EW002', invoiceNo: 'INV-2025-002', remarks: '' },
      { id: 'TR003', date: '2025-09-21', vehicle: 'V003', driver: 'D003', customer: 'C003', from: 'Renukoot', to: 'Ludhiana', material: 'M002', loadedWt: 19.2, billedWt: 19.5, distance: 950, freight: 42000, status: 'in-transit', ewayBill: 'EW003', invoiceNo: '', remarks: 'ETA: 22-Sep' },
      { id: 'TR004', date: '2025-09-22', vehicle: 'V005', driver: 'D005', customer: 'C004', from: 'Bhilai', to: 'Delhi', material: 'M004', loadedWt: 29.0, billedWt: 29.0, distance: 1100, freight: 55000, status: 'pending', ewayBill: '', invoiceNo: '', remarks: 'Loading today' },
      { id: 'TR005', date: '2025-09-18', vehicle: 'V001', driver: 'D001', customer: 'C002', from: 'Ludhiana', to: 'Mumbai', material: 'M003', loadedWt: 23.8, billedWt: 24.0, distance: 1920, freight: 96000, status: 'completed', ewayBill: 'EW005', invoiceNo: 'INV-2025-003', remarks: '' },
      { id: 'TR006', date: '2025-09-17', vehicle: 'V002', driver: 'D002', customer: 'C001', from: 'Jamshedpur', to: 'Ludhiana', material: 'M001', loadedWt: 33.5, billedWt: 33.5, distance: 1820, freight: 92000, status: 'completed', ewayBill: 'EW006', invoiceNo: 'INV-2025-004', remarks: '' },
    ];
    this._save('trips', trips);

    const weighbridge = [
      { id: 'WB001', date: '2025-09-20', tripId: 'TR001', vehicle: 'V001', gross: 48.5, tare: 14.0, net: 34.5, material: 'M003', slip: 'WS-001', operator: 'Arun', remarks: '' },
      { id: 'WB002', date: '2025-09-19', tripId: 'TR002', vehicle: 'V002', gross: 55.8, tare: 21.0, net: 34.8, material: 'M001', slip: 'WS-002', operator: 'Arun', remarks: '' },
      { id: 'WB003', date: '2025-09-21', tripId: 'TR003', vehicle: 'V003', gross: 36.2, tare: 17.0, net: 19.2, material: 'M002', slip: 'WS-003', operator: 'Raj', remarks: '' },
      { id: 'WB004', date: '2025-09-18', tripId: 'TR005', vehicle: 'V001', gross: 47.8, tare: 14.0, net: 33.8, material: 'M003', slip: 'WS-004', operator: 'Raj', remarks: 'Rechecked' },
    ];
    this._save('weighbridge', weighbridge);

    const fuel = [
      { id: 'F001', date: '2025-09-20', vehicle: 'V001', driver: 'D001', litres: 120, rate: 93.5, amount: 11220, odometer: 125280, station: 'HP Petrol, Ludhiana', tripId: 'TR001' },
      { id: 'F002', date: '2025-09-19', vehicle: 'V002', driver: 'D002', litres: 150, rate: 94.0, amount: 14100, odometer: 198050, station: 'IOCL, Kanpur', tripId: 'TR002' },
      { id: 'F003', date: '2025-09-21', vehicle: 'V003', driver: 'D003', litres: 90, rate: 93.5, amount: 8415, odometer: 87520, station: 'BPCL, Varanasi', tripId: 'TR003' },
      { id: 'F004', date: '2025-09-18', vehicle: 'V001', driver: 'D001', litres: 135, rate: 93.0, amount: 12555, odometer: 125100, station: 'HP Petrol, Nagpur', tripId: 'TR005' },
      { id: 'F005', date: '2025-09-17', vehicle: 'V002', driver: 'D002', litres: 160, rate: 93.5, amount: 14960, odometer: 197800, station: 'IOCL, Jamshedpur', tripId: 'TR006' },
    ];
    this._save('fuel', fuel);

    const expenses = [
      { id: 'EX001', date: '2025-09-20', category: 'Toll', vehicle: 'V001', tripId: 'TR001', amount: 1850, description: 'Toll charges Ludhiana-Jamshedpur', paidBy: 'driver', receipt: 'R-001' },
      { id: 'EX002', date: '2025-09-19', category: 'Driver Allowance', vehicle: 'V002', tripId: 'TR002', amount: 2000, description: 'Halting allowance', paidBy: 'cash', receipt: 'R-002' },
      { id: 'EX003', date: '2025-09-18', category: 'Repair', vehicle: 'V004', tripId: '', amount: 18500, description: 'Engine overhaul', paidBy: 'bank', receipt: 'R-003' },
      { id: 'EX004', date: '2025-09-15', category: 'Insurance', vehicle: 'V001', tripId: '', amount: 42000, description: 'Annual insurance renewal', paidBy: 'bank', receipt: 'R-004' },
      { id: 'EX005', date: '2025-09-22', category: 'Toll', vehicle: 'V003', tripId: 'TR003', amount: 960, description: 'Toll charges Renukoot-Varanasi', paidBy: 'driver', receipt: 'R-005' },
      { id: 'EX006', date: '2025-09-10', category: 'Tyre', vehicle: 'V002', tripId: '', amount: 24000, description: '4 tyres replaced', paidBy: 'bank', receipt: 'R-006' },
      { id: 'EX007', date: '2025-09-05', category: 'Office', vehicle: '', tripId: '', amount: 3200, description: 'Stationery & printing', paidBy: 'cash', receipt: 'R-007' },
    ];
    this._save('expenses', expenses);

    const invoices = [
      { id: 'INV-2025-001', date: '2025-09-20', dueDate: '2025-10-05', customer: 'C001', tripIds: ['TR001'], subtotal: 87500, tax: 0, discount: 0, total: 87500, paid: 87500, status: 'paid', notes: '' },
      { id: 'INV-2025-002', date: '2025-09-19', dueDate: '2025-10-04', customer: 'C002', tripIds: ['TR002'], subtotal: 105000, tax: 0, discount: 0, total: 105000, paid: 0, status: 'pending', notes: '' },
      { id: 'INV-2025-003', date: '2025-09-18', dueDate: '2025-10-03', customer: 'C002', tripIds: ['TR005'], subtotal: 96000, tax: 0, discount: 0, total: 96000, paid: 0, status: 'overdue', notes: 'Follow up' },
      { id: 'INV-2025-004', date: '2025-09-17', dueDate: '2025-10-02', customer: 'C001', tripIds: ['TR006'], subtotal: 92000, tax: 0, discount: 0, total: 92000, paid: 92000, status: 'paid', notes: '' },
    ];
    this._save('invoices', invoices);

    const payments = [
      { id: 'PAY001', date: '2025-09-21', customer: 'C001', invoiceId: 'INV-2025-001', amount: 87500, mode: 'NEFT', reference: 'TXN8745612', notes: '' },
      { id: 'PAY002', date: '2025-09-20', customer: 'C001', invoiceId: 'INV-2025-004', amount: 92000, mode: 'RTGS', reference: 'TXN9834521', notes: '' },
    ];
    this._save('payments', payments);

    const ewayBills = [
      { id: 'EW001', billNo: 'EW230920001', tripId: 'TR001', date: '2025-09-20', validUpto: '2025-09-23', from: 'Ludhiana', to: 'Jamshedpur', material: 'M003', value: 175000, vehicle: 'V001', status: 'active' },
      { id: 'EW002', billNo: 'EW230919001', tripId: 'TR002', date: '2025-09-19', validUpto: '2025-09-23', from: 'Vijayanagar', to: 'Ludhiana', material: 'M001', value: 140000, vehicle: 'V002', status: 'active' },
      { id: 'EW003', billNo: 'EW230921001', tripId: 'TR003', date: '2025-09-21', validUpto: '2025-09-24', from: 'Renukoot', to: 'Ludhiana', material: 'M002', value: 84000, vehicle: 'V003', status: 'active' },
      { id: 'EW005', billNo: 'EW230918001', tripId: 'TR005', date: '2025-09-18', validUpto: '2025-09-22', from: 'Ludhiana', to: 'Mumbai', material: 'M003', value: 192000, vehicle: 'V001', status: 'expired' },
      { id: 'EW006', billNo: 'EW230917001', tripId: 'TR006', date: '2025-09-17', validUpto: '2025-09-21', from: 'Jamshedpur', to: 'Ludhiana', material: 'M001', value: 168000, vehicle: 'V002', status: 'expired' },
    ];
    this._save('ewayBills', ewayBills);

    const documents = [
      { id: 'DOC001', name: 'V001 Insurance Certificate', type: 'insurance', vehicle: 'V001', expiry: '2026-03-15', uploaded: '2025-03-16', size: '1.2 MB', fileType: 'pdf' },
      { id: 'DOC002', name: 'V002 Fitness Certificate', type: 'fitness', vehicle: 'V002', expiry: '2026-08-15', uploaded: '2025-08-16', size: '0.8 MB', fileType: 'pdf' },
      { id: 'DOC003', name: 'D001 Driving License', type: 'license', vehicle: '', driver: 'D001', expiry: '2028-06-14', uploaded: '2024-01-10', size: '0.5 MB', fileType: 'jpg' },
      { id: 'DOC004', name: 'GST Registration', type: 'gst', vehicle: '', expiry: '', uploaded: '2023-04-01', size: '0.3 MB', fileType: 'pdf' },
      { id: 'DOC005', name: 'V003 RC Book', type: 'rc', vehicle: 'V003', expiry: '', uploaded: '2022-06-01', size: '0.6 MB', fileType: 'pdf' },
      { id: 'DOC006', name: 'V004 Permit', type: 'permit', vehicle: 'V004', expiry: '2026-03-18', uploaded: '2024-03-19', size: '0.4 MB', fileType: 'pdf' },
    ];
    this._save('documents', documents);

    const alerts = [
      { id: 'AL001', type: 'insurance', priority: 'high', title: 'Insurance Expiring Soon', message: 'V004 (HR-55-GH-3456) insurance expires on 12-Oct-2025. Renew immediately.', date: '2025-09-22', read: false },
      { id: 'AL002', type: 'fitness', priority: 'high', title: 'Fitness Certificate Expiring', message: 'V004 fitness cert expires on 05-Dec-2025. Schedule inspection.', date: '2025-09-22', read: false },
      { id: 'AL003', type: 'payment', priority: 'medium', title: 'Overdue Invoice', message: 'Invoice INV-2025-003 (JSW Steel, ₹96,000) is overdue since 03-Oct-2025.', date: '2025-09-22', read: false },
      { id: 'AL004', type: 'license', priority: 'medium', title: 'Driver License Expiry Approaching', message: 'D004 (Ranjit Kumar) license expires on 29-Sep-2026. Start renewal process.', date: '2025-09-20', read: true },
      { id: 'AL005', type: 'trip', priority: 'low', title: 'Trip Awaiting Invoice', message: 'Trip TR004 (Bhilai→Delhi) is pending. Generate invoice after delivery.', date: '2025-09-22', read: false },
      { id: 'AL006', type: 'eway', priority: 'high', title: 'E-Way Bill Expired', message: 'E-Way Bill EW230918001 for TR005 has expired. Generate extension if needed.', date: '2025-09-22', read: true },
    ];
    this._save('alerts', alerts);

    this._save('seeded', true);
  },

  // ── GETTERS ───────────────────────────────────────────────────────────────
  getSettings()    { return this._load('settings', {}); },
  getCustomers()   { return this._load('customers', []); },
  getVehicles()    { return this._load('vehicles', []); },
  getDrivers()     { return this._load('drivers', []); },
  getMaterials()   { return this._load('materials', []); },
  getTrips()       { return this._load('trips', []); },
  getWeighbridge() { return this._load('weighbridge', []); },
  getFuel()        { return this._load('fuel', []); },
  getExpenses()    { return this._load('expenses', []); },
  getInvoices()    { return this._load('invoices', []); },
  getPayments()    { return this._load('payments', []); },
  getEwayBills()   { return this._load('ewayBills', []); },
  getDocuments()   { return this._load('documents', []); },
  getAlerts()      { return this._load('alerts', []); },

  // ── LOOKUP HELPERS ────────────────────────────────────────────────────────
  customerName(id)  { return (this.getCustomers().find(c=>c.id===id)||{}).name || id; },
  vehicleReg(id)    { return (this.getVehicles().find(v=>v.id===id)||{}).regNo || id; },
  driverName(id)    { return (this.getDrivers().find(d=>d.id===id)||{}).name || id; },
  materialName(id)  { return (this.getMaterials().find(m=>m.id===id)||{}).name || id; },

  // ── SAVERS ────────────────────────────────────────────────────────────────
  saveCustomers(d)   { this._save('customers', d); },
  saveVehicles(d)    { this._save('vehicles', d); },
  saveDrivers(d)     { this._save('drivers', d); },
  saveMaterials(d)   { this._save('materials', d); },
  saveTrips(d)       { this._save('trips', d); },
  saveWeighbridge(d) { this._save('weighbridge', d); },
  saveFuel(d)        { this._save('fuel', d); },
  saveExpenses(d)    { this._save('expenses', d); },
  saveInvoices(d)    { this._save('invoices', d); },
  savePayments(d)    { this._save('payments', d); },
  saveEwayBills(d)   { this._save('ewayBills', d); },
  saveDocuments(d)   { this._save('documents', d); },
  saveAlerts(d)      { this._save('alerts', d); },
  saveSettings(d)    { this._save('settings', d); },

  // ── STATS FOR DASHBOARD ───────────────────────────────────────────────────
  dashboardStats() {
    const trips     = this.getTrips();
    const vehicles  = this.getVehicles();
    const drivers   = this.getDrivers();
    const invoices  = this.getInvoices();
    const expenses  = this.getExpenses();
    const fuel      = this.getFuel();
    const alerts    = this.getAlerts();

    const totalRevenue   = invoices.reduce((s,i) => s + i.total, 0);
    const totalPaid      = invoices.reduce((s,i) => s + i.paid, 0);
    const outstanding    = totalRevenue - totalPaid;
    const totalExpenses  = expenses.reduce((s,e) => s + e.amount, 0);
    const totalFuel      = fuel.reduce((s,f) => s + f.amount, 0);
    const activeVehicles = vehicles.filter(v=>v.status==='active').length;
    const activeDrivers  = drivers.filter(d=>d.status==='active').length;
    const activeTrips    = trips.filter(t=>t.status==='in-transit').length;
    const completedTrips = trips.filter(t=>t.status==='completed').length;
    const pendingTrips   = trips.filter(t=>t.status==='pending').length;
    const unreadAlerts   = alerts.filter(a=>!a.read).length;

    return { totalRevenue, outstanding, totalExpenses, totalFuel,
             activeVehicles, activeDrivers, activeTrips, completedTrips, pendingTrips, unreadAlerts };
  },

  unreadAlertCount() { return this.getAlerts().filter(a=>!a.read).length; },
};
