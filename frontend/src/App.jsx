import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, ChevronDown, ClipboardList, Clock3, Eye, EyeOff, LayoutDashboard, Menu, MessageCircle, Pill, Search, Settings, ShieldCheck, Users, X, Bell, ArrowUpRight, CircleCheck, CircleAlert, MoreHorizontal } from 'lucide-react';

const nav = [
  { title: 'WORKSPACE', links: [['Overview', LayoutDashboard], ['Patients', Users], ['Medication schedules', Pill], ['Appointments', CalendarDays], ['Follow-ups', Clock3], ['WhatsApp messages', MessageCircle]] },
  { title: 'MANAGE', links: [['Reports', ClipboardList], ['Staff & permissions', ShieldCheck], ['WhatsApp settings', MessageCircle], ['Clinic settings', Settings]] },
];
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '');
const reminders = [
  { initials: 'AM', name: 'Ananya Mehta', detail: 'Medication reminder - Metformin', time: '08:00 AM', state: 'Delivered', color: 'mint' },
  { initials: 'RK', name: 'Rohan Kulkarni', detail: 'Appointment - General consultation', time: '09:30 AM', state: 'Confirmed', color: 'blue' },
  { initials: 'SP', name: 'Sara Patel', detail: 'Medication reminder - Doctor-entered', time: '10:00 AM', state: 'Awaiting reply', color: 'peach' },
  { initials: 'VN', name: 'Vikram Nair', detail: 'Follow-up - Clinic visit', time: '11:15 AM', state: 'Queued', color: 'lavender' },
];
const sectionData = {
  Patients: { description: 'Patient directory and communication consent.', metrics: [['Patients', '1,284'], ['Active', '1,216'], ['Consent recorded', '1,102']], columns: ['Patient', 'Phone', 'Consent', 'Status'], rows: [['Ananya Mehta', '+91 ****** 2841', 'Opted in', 'Active'], ['Rohan Kulkarni', '+91 ****** 7310', 'Opted in', 'Active'], ['Sara Patel', '+91 ****** 1942', 'Review needed', 'Active']] },
  'Medication schedules': { description: 'Doctor-entered medication reminder schedules.', metrics: [['Active schedules', '386'], ['Paused', '12'], ['Ending this week', '8']], columns: ['Patient', 'Schedule', 'Reminder times', 'Status'], rows: [['Ananya Mehta', 'Doctor-entered schedule', '8:00 AM - 8:00 PM', 'Active'], ['Rohan Kulkarni', 'Doctor-entered schedule', '9:00 AM - 9:00 PM', 'Active'], ['Sara Patel', 'Doctor-entered schedule', '2:00 PM', 'Paused']] },
  Appointments: { description: 'Upcoming visits and confirmation status.', metrics: [['Today', '24'], ['Confirmed', '18'], ['Awaiting reply', '6']], columns: ['Patient', 'Appointment', 'Date & time', 'Status'], rows: [['Nisha Kapoor', 'Dental check-up', 'Today - 10:30 AM', 'Confirmed'], ['Arjun Singh', 'Follow-up consultation', 'Today - 11:00 AM', 'Awaiting reply'], ['Priya Menon', 'General consultation', 'Today - 12:15 PM', 'Confirmed']] },
  'Follow-ups': { description: 'Clinic-configured follow-up reminders.', metrics: [['Upcoming', '42'], ['Due this week', '11'], ['Paused', '3']], columns: ['Patient', 'Follow-up', 'Due date', 'Status'], rows: [['Vikram Nair', 'Contact the clinic', 'Oct 28, 2026', 'Scheduled'], ['Sara Patel', 'Clinic follow-up', 'Oct 30, 2026', 'Scheduled'], ['Arjun Singh', 'Contact the clinic', 'Nov 02, 2026', 'Paused']] },
  'WhatsApp messages': { description: 'Delivery results and patient replies.', metrics: [['Sent today', '124'], ['Delivered', '119'], ['Needs review', '5']], columns: ['Patient', 'Message type', 'Sent', 'Delivery'], rows: [['Ananya Mehta', 'Medication reminder', '08:00 AM', 'Delivered'], ['Rohan Kulkarni', 'Appointment reminder', '09:00 AM', 'Delivered'], ['Sara Patel', 'Medication reminder', '10:00 AM', 'Awaiting reply']] },
  Reports: { description: 'Clinic activity summaries and exports.', metrics: [['Available reports', '8'], ['This month', '4'], ['Scheduled exports', '0']], columns: ['Report', 'Period', 'Updated', 'Status'], rows: [['Reminder delivery', 'October 2026', 'Today - 8:00 AM', 'Ready'], ['Patient responses', 'October 2026', 'Yesterday', 'Ready'], ['Appointment confirmations', 'October 2026', 'Yesterday', 'Ready']] },
  'Staff & permissions': { description: 'Clinic team members and their assigned roles.', metrics: [['Team members', '8'], ['Administrators', '2'], ['Staff accounts', '6']], columns: ['Team member', 'Role', 'Last active', 'Status'], rows: [['Dr. Riya Sharma', 'Clinic administrator', 'Now', 'Active'], ['Dr. Amit Mehta', 'Doctor', 'Today - 9:12 AM', 'Active'], ['Maya Joshi', 'Clinic staff', 'Yesterday', 'Active']] },
  'WhatsApp settings': { description: 'WhatsApp Business connection and message templates.', metrics: [['Connection', 'Setup required'], ['Templates', '0 approved'], ['Phone number', 'Not connected']], columns: ['Setting', 'Details', 'Action'], rows: [['Business connection', 'Connect a clinic WhatsApp Business account', 'Configure'], ['Message templates', 'Approved templates are required for applicable messages', 'Manage'], ['Webhook', 'Webhook endpoint setup is required', 'View setup']] },
  'Clinic settings': { description: 'Clinic profile, time zone, and reminder preferences.', metrics: [['Clinic status', 'Trial'], ['Time zone', 'Asia/Kolkata'], ['Preferences', 'Review']], columns: ['Setting', 'Current value', 'Status'], rows: [['Clinic name', 'Arbor Health Clinic', 'Configured'], ['Time zone', 'Asia/Kolkata', 'Configured'], ['Reminder quiet hours', 'Not configured', 'Needs setup']] },
};
const initialPatients = [
  { id: 'demo-1', name: 'Ananya Mehta', phone: '9000000001', language: 'English', consent: true, active: true, medications: [] },
  { id: 'demo-2', name: 'Rohan Kulkarni', phone: '9000000002', language: 'English', consent: true, active: true, medications: [] },
  { id: 'demo-3', name: 'Sara Patel', phone: '9000000003', language: 'Hindi', consent: false, active: true, medications: [] },
];
const initialAppointments = [
  { id: 'appointment-1', patientId: 'demo-1', patientName: 'Ananya Mehta', type: 'General consultation', date: '2026-10-29', time: '10:30', reminder: '24 hours before', status: 'Scheduled' },
  { id: 'appointment-2', patientId: 'demo-2', patientName: 'Rohan Kulkarni', type: 'Follow-up consultation', date: '2026-10-30', time: '11:00', reminder: '2 hours before', status: 'Confirmed' },
];
const pathFor = (label) => label === 'Overview' ? '/' : `/${label.toLowerCase().replaceAll(' & ', '-').replaceAll(' ', '-')}`;
const labelFor = (pathname) => nav.flatMap(group => group.links.map(([label]) => [pathFor(label), label])).find(([path]) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)))?.[1] || 'Overview';

async function rotateSession(session) {
  if (!session.refresh_token) throw new Error('Your session has expired. Please sign in again.');
  const body = new URLSearchParams({ refresh_token: session.refresh_token });
  if (session.user?.admin_view && session.user.clinic_id) body.set('clinic_id', session.user.clinic_id);
  const response = await fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.detail || 'Your session has expired. Please sign in again.');
  const profile = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${result.access_token}` } });
  if (!profile.ok) throw new Error('Could not restore your session. Please sign in again.');
  return { ...session, ...result, user: await profile.json() };
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const active = labelFor(location.pathname);
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [auth, setAuth] = useState(null);
  const [adminSession, setAdminSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clinic, setClinic] = useState(null);
  const [whatsapp, setWhatsapp] = useState(null);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState(initialAppointments);
  const [textScale, setTextScale] = useState(() => {
    const saved = Number(window.localStorage.getItem('careloop-text-scale-v3'));
    return Number.isFinite(saved) && saved >= 0.8 && saved <= 1.3 ? saved : 1.2;
  });
  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(textScale));
    window.localStorage.setItem('careloop-text-scale-v3', String(textScale));
  }, [textScale]);
  const adjustTextSize = (amount) => setTextScale(current => Math.min(1.3, Math.max(0.8, Math.round((current + amount) * 10) / 10)));
  const today = new Date();
  const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(today).toUpperCase();
  const greeting = today.getHours() < 12 ? 'Good morning' : today.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const persistSession = (session) => {
    const { platform_access_token, ...storedSession } = session;
    window.sessionStorage.setItem('careloop-auth-session', JSON.stringify(storedSession));
    if (platform_access_token && storedSession.user.admin_view) {
      try {
        const platform = JSON.parse(window.sessionStorage.getItem('careloop-platform-session') || '{}');
        const updatedPlatform = { ...platform, access_token: platform_access_token, refresh_token: storedSession.refresh_token };
        window.sessionStorage.setItem('careloop-platform-session', JSON.stringify(updatedPlatform));
        setAdminSession(updatedPlatform);
      } catch { /* Keep the active clinic session even if the saved platform session is unreadable. */ }
    }
    setAuth(storedSession);
  };
  const savePatient = async (patient) => {
    const payload = {
      name: patient.name, phone_e164: patient.phone, preferred_language: patient.language,
      consent: patient.consent,
      medications: patient.medications.map(item => ({
        id: item.id,
        medicine_name: item.name, frequency: item.frequency, food_timing: item.foodTiming,
        duration_days: Number(item.durationDays), reminder_times: item.reminderTimes,
      })),
    };
    const response = await fetch(`${API_BASE}/api/patients${patient.id ? `/${patient.id}` : ''}`, {
      method: patient.id ? 'PUT' : 'POST',
      headers: { Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || 'Could not save patient.');
    const saved = {
      id: result.id, name: result.name, phone: result.phone_e164,
      language: result.preferred_language, consent: result.consent, active: result.is_active,
      medications: result.medications.map(item => ({
        id: item.id, name: item.name, frequency: item.frequency, foodTiming: item.food_timing,
        durationDays: String(item.duration_days), reminderTimes: item.reminder_times,
      })),
    };
    setPatients(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
    return saved;
  };
  const saveAppointment = (appointment) => setAppointments(current => current.some(item => item.id === appointment.id) ? current.map(item => item.id === appointment.id ? appointment : item) : [...current, appointment]);
  useEffect(() => {
    const platformStored = window.sessionStorage.getItem('careloop-platform-session');
    if (platformStored) { try { setAdminSession(JSON.parse(platformStored)); } catch { window.sessionStorage.removeItem('careloop-platform-session'); } }
    const stored = window.sessionStorage.getItem('careloop-auth-session');
    if (!stored) { setAuthLoading(false); return; }
    let active = true;
    (async () => {
      try {
        let session = JSON.parse(stored);
        const response = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (response.ok) session = { ...session, user: await response.json() };
        else session = await rotateSession(session);
        if (active) persistSession(session);
      } catch {
        window.sessionStorage.removeItem('careloop-auth-session');
        if (active) setAuth(null);
      } finally { if (active) setAuthLoading(false); }
    })();
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!auth?.refresh_token) return;
    const timer = window.setInterval(async () => {
      try { persistSession(await rotateSession(auth)); }
      catch { signOut(); }
    }, 12 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [auth?.access_token]);
  useEffect(() => {
    if (!auth || auth.user.role === 'platform_admin') return;
    fetch(`${API_BASE}/api/clinic/me`, { headers: { Authorization: `Bearer ${auth.access_token}` } })
      .then(response => response.ok ? response.json() : null)
      .then(setClinic)
      .catch(() => setClinic(null));
  }, [auth]);
  useEffect(() => {
    if (!auth || auth.user.role === 'platform_admin') return;
    fetch(`${API_BASE}/api/clinic/whatsapp`, { headers: { Authorization: `Bearer ${auth.access_token}` } })
      .then(response => response.ok ? response.json() : null)
      .then(setWhatsapp)
      .catch(() => setWhatsapp(null));
  }, [auth, active]);
  useEffect(() => {
    if (!auth || auth.user.role === 'platform_admin') return;
    fetch(`${API_BASE}/api/patients`, { headers: { Authorization: `Bearer ${auth.access_token}` } })
      .then(response => { if (!response.ok) throw new Error('Unable to load clinic patients'); return response.json(); })
      .then(rows => setPatients(rows.map(patient => ({
        id: patient.id, name: patient.name, phone: patient.phone_e164,
        language: patient.preferred_language, consent: patient.consent, active: patient.is_active,
        medications: patient.medications.map(item => ({
          id: item.id, name: item.name, frequency: item.frequency,
          foodTiming: item.food_timing, durationDays: String(item.duration_days),
          reminderTimes: item.reminder_times,
        })),
      }))))
      .catch(() => setPatients([]));
  }, [auth]);
  const acceptLogin = (session) => { window.sessionStorage.setItem('careloop-auth-session', JSON.stringify(session)); setAuth(session); };
  const signOut = () => {
    const refresh = auth?.refresh_token || adminSession?.refresh_token;
    window.sessionStorage.removeItem('careloop-auth-session');
    window.sessionStorage.removeItem('careloop-platform-session');
    setAdminSession(null); setAuth(null);
    if (refresh) fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: refresh }), keepalive: true }).catch(() => {});
  };
  const returnToPlatform = async () => {
    if (!adminSession) return signOut();
    try {
      const returned = await rotateSession({ ...adminSession, refresh_token: auth?.refresh_token || adminSession.refresh_token });
      const { platform_access_token, ...platformSession } = returned;
      window.sessionStorage.setItem('careloop-auth-session', JSON.stringify(platformSession));
      window.sessionStorage.removeItem('careloop-platform-session');
      setAuth(platformSession); setAdminSession(null);
    } catch { signOut(); }
  };
  if (authLoading) return <div className="auth-loading">Loading your secure workspace...</div>;
  if (!auth) return <LoginPage onLogin={acceptLogin}/>;
  if (auth.user.role === 'platform_admin') return <AdminPortal auth={auth} onLogout={signOut} onOpenClinic={async clinic => { const response=await fetch(`${API_BASE}/api/admin/clinics/${clinic.id}/access`,{method:'POST',headers:{Authorization:`Bearer ${auth.access_token}`}}); const result=await response.json(); if(!response.ok) throw new Error(result.detail||'Could not open clinic workspace.'); window.sessionStorage.setItem('careloop-platform-session',JSON.stringify(auth)); const delegated={access_token:result.access_token,refresh_token:auth.refresh_token,user:{...auth.user,role:'clinic_admin',clinic_id:clinic.id,admin_view:true}}; window.sessionStorage.setItem('careloop-auth-session',JSON.stringify(delegated)); setAdminSession(auth); setAuth(delegated); }}/>;
  return <div className="app-shell">
    {open && <button className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-icon"><Activity size={21}/></div><div><b>careloop</b><span>CLINIC WORKSPACE</span></div><button className="icon-button close-menu" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18}/></button></div>
      <div className="clinic-select"><div className="clinic-mark">{(clinic?.name || 'C').slice(0,1).toUpperCase()}</div><div className="clinic-copy"><b>{clinic?.name || 'Clinic workspace'}</b><span>{auth.user.role.replaceAll('_',' ')}</span></div></div>
      <nav>{nav.map(group => <section className="nav-group" key={group.title}><p>{group.title}</p>{group.links.map(([label, Icon]) => <button key={label} className={`nav-link ${active === label ? 'selected' : ''}`} aria-current={active === label ? 'page' : undefined} onClick={() => {navigate(pathFor(label)); setOpen(false);}}><Icon size={18}/><span>{label}</span></button>)}</section>)}</nav>
      <div className="sidebar-bottom"><div className="help-card"><div className="help-symbol"><MessageCircle size={17}/></div><b>Need a hand?</b><span>Our support team is here for you.</span><button onClick={() => navigate('/clinic-settings')}>Visit help center <ArrowUpRight size={13}/></button></div><div className="user-row"><div className="avatar avatar-user">{auth.user.name.slice(0,2).toUpperCase()}</div><div><b>{auth.user.name}</b><span>{auth.user.email}</span></div><button className="logout-mini" onClick={signOut}>Sign out</button></div></div>
    </aside>
    <main className="main-content"><header className="topbar"><button className="icon-button menu-toggle" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21}/></button><div className="crumb">Workspace <span>/</span> <b>{active}</b></div><div className="top-actions"><div className="searchbox"><Search size={16}/><input placeholder="Search sections..." aria-label="Search sections" onKeyDown={event => { if (event.key === "Enter") { const term=event.currentTarget.value.trim().toLowerCase(); const match=nav.flatMap(group=>group.links.map(([label])=>label)).find(label=>label.toLowerCase().includes(term)); if(match){navigate(pathFor(match));event.currentTarget.value="";} } }}/><kbd>Enter</kbd></div><div className="text-size-controls" aria-label="Text size controls"><button type="button" onClick={() => adjustTextSize(-0.1)} disabled={textScale <= 0.8} aria-label="Decrease text size" title="Decrease text size">A-</button><button type="button" onClick={() => adjustTextSize(0.1)} disabled={textScale >= 1.3} aria-label="Increase text size" title="Increase text size">A+</button></div><button className="icon-button notify" aria-label="Notifications" title="Open messages" onClick={() => navigate(pathFor("WhatsApp messages"))}><Bell size={19}/><i/></button><div className="profile-menu"><button className="top-user top-user-button" onClick={() => setProfileOpen(current => !current)} aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Open account menu" title="Account menu"><div className="avatar avatar-user">{auth.user.name.slice(0,2).toUpperCase()}</div><ChevronDown size={15}/></button>{profileOpen && <div className="profile-dropdown" role="menu"><div className="profile-details"><b>{auth.user.name}</b><span>{auth.user.email}</span></div><button role="menuitem" onClick={signOut}>Sign out</button></div>}</div></div></header>
      {auth.user.admin_view && <div className="demo-notice admin-view-notice"><ShieldCheck size={16}/><span>Platform admin access to {clinic?.name || 'this clinic'}.</span><button className="secondary-button" onClick={returnToPlatform}>Return to platform admin</button></div>}
      <div className="page-wrap">{active === 'Patients' && <PatientsPage patients={patients} onSave={savePatient}/>} {active === 'Appointments' && <AppointmentsPage appointments={appointments} patients={patients} onSave={saveAppointment}/>} {(active === 'Medication schedules' || active === 'WhatsApp messages') && <MedicationActivityPage active={active} auth={auth}/>} {active === 'WhatsApp settings' && <WhatsAppSettingsPage auth={auth}/>} {active !== 'Overview' && active !== 'Patients' && active !== 'Appointments' && active !== 'Medication schedules' && active !== 'WhatsApp messages' && active !== 'WhatsApp settings' && <WorkspacePage key={active} active={active}/>} {active === 'Overview' && <><div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> {dateLabel}</div><h1>{greeting}, {auth.user.name}</h1><p>Here's what's happening at your clinic today.</p></div><div className="date-button"><CalendarDays size={16}/> {today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div></div>
        <div className="demo-notice"><CircleAlert size={16}/><span>Overview metrics, reminder examples, response charts, and appointments are sample data. Patient records, medication schedules, and WhatsApp activity are shown in their respective sections.</span></div>
        <div className="metric-grid"><Metric icon={Users} label="Total patients" number="1,284" change="12.8%" note="vs. last month" tone="teal"/><Metric icon={Pill} label="Active schedules" number="386" change="8.2%" note="vs. last month" tone="purple"/><Metric icon={MessageCircle} label="Messages delivered" number="96.4%" change="2.4%" note="delivery rate today" tone="blue"/><Metric icon={CircleAlert} label="Needs attention" number="12" change="3 pending" note="responses to review" tone="amber" alert/></div>
        <div className="content-grid"><section className="panel reminders-panel"><div className="panel-heading"><div><h2>Today's reminders</h2><p>Your clinic's scheduled patient communications</p></div><button className="text-link" onClick={() => navigate(pathFor("Medication schedules"))}>View all <ArrowUpRight size={14}/></button></div><div className="reminder-summary"><span><i className="legend-dot teal-dot"/> 24 scheduled</span><span><i className="legend-dot gray-dot"/> 8 remaining</span><div className="progress"><i/></div><b>75%</b></div><div className="reminder-list">{reminders.map(r=><div className="reminder-row" key={r.name}><div className={`avatar avatar-${r.color}`}>{r.initials}</div><div className="reminder-person"><b>{r.name}</b><span>{r.detail}</span></div><span className="reminder-time">{r.time}</span><span className={`status status-${r.state.toLowerCase().replace(' ','-')}`}><i/>{r.state}</span><button className="row-more" aria-label={`More options for ${r.name}`}><MoreHorizontal size={18}/></button></div>)}</div><button className="panel-footer" onClick={() => navigate(pathFor("Medication schedules"))}>See all scheduled reminders <ArrowUpRight size={14}/></button></section>
          <section className="panel response-panel"><div className="panel-heading"><div><h2>Patient responses</h2><p>Recent replies from your patients</p></div><button className="icon-button small-more" aria-label="More options"><MoreHorizontal size={19}/></button></div><div className="response-total"><b>18</b><span>responses today</span><div className="response-trend"><ArrowUpRight size={14}/> 4 more than yesterday</div></div><div className="response-bars"><div className="bar-row"><span>Reported taken</span><div className="bar-track"><i style={{width:'72%'}}/></div><b>13</b></div><div className="bar-row"><span>Need follow-up</span><div className="bar-track amber-track"><i style={{width:'28%'}}/></div><b>5</b></div></div><div className="review-note"><div><CircleAlert size={17}/></div><span><b>5 responses need review</b><small>Patients replied "NOT TAKEN" today.</small></span><ArrowUpRight size={14}/></div><button className="panel-footer" onClick={() => navigate(pathFor("WhatsApp messages"))}>Review patient responses <ArrowUpRight size={14}/></button></section></div>
        <div className="bottom-grid"><section className="panel appointments-panel"><div className="panel-heading"><div><h2>Upcoming appointments</h2><p>Preview examples only</p></div><button className="text-link" onClick={() => navigate(pathFor("Appointments"))}>View calendar <ArrowUpRight size={14}/></button></div><div className="appointment-list"><Appointment initials="NK" name="Nisha Kapoor" kind="Dental check-up" time="10:30 AM" tag="In 30 min"/><Appointment initials="AS" name="Arjun Singh" kind="Follow-up consultation" time="11:00 AM" tag="In 1 hr"/><Appointment initials="PM" name="Priya Menon" kind="General consultation" time="12:15 PM" tag="In 2 hrs"/></div></section><section className="panel health-panel"><div className="panel-heading"><div><h2>WhatsApp connection</h2><p>Saved API credentials</p></div><button className="small-more icon-button" aria-label="Connection options"><MoreHorizontal size={19}/></button></div><div className="connection-status"><div className="connection-icon"><MessageCircle size={19}/></div><div><b>{whatsapp?.connected?"Credentials saved":"Setup required"}</b><span>{whatsapp?.display_phone_number||"Connect a clinic WhatsApp account in settings"}</span></div><span className={`connected-pill ${whatsapp?.connected?"":"disconnected-pill"}`}><i/> {whatsapp?.connected?"Saved":"Not connected"}</span></div><div className="health-foot"><span><CircleCheck size={15}/> Send a test to check delivery</span><button onClick={() => navigate(pathFor("WhatsApp settings"))}>Settings <ArrowUpRight size={13}/></button></div></section></div>
        <footer className="page-footer"><span>Copyright 2026 Careloop Health</span><span>Designed for better patient care </span><button>Privacy & security</button></footer></>}
      </div></main>
  </div>
}
function LoginPage({onLogin}) {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [showPassword,setShowPassword] = useState(false);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault();setBusy(true);setError('');
    try {
      const body=new URLSearchParams({username:email.trim(),password});
      const response=await fetch(`${API_BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
      const result=await response.json();
      if(!response.ok)throw new Error(result.detail||'Could not sign in.');
      onLogin(result);
    } catch (err) { setError(err.message==='Failed to fetch'?'Cannot reach the server. Start the backend, then try again.':err.message); }
    finally { setBusy(false); }
  };
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span className="brand-icon"><Activity size={21}/></span><div><b>careloop</b><small>CLINIC WORKSPACE</small></div></div><p className="eyebrow">SECURE SIGN IN</p><h1>Welcome back</h1><p className="auth-intro">Sign in with your platform administrator or clinic account.</p><form onSubmit={submit}><label>Email address<input required type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} placeholder="you@clinic.com"/></label><label>Password<div className="password-input-wrap"><input required type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/><button className="password-visibility" type="button" onClick={()=>setShowPassword(current=>!current)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} title={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'Signing in...':'Sign in'}</button></form><small className="auth-footnote">Clinic accounts are created by the Careloop platform administrator.</small></section></main>;
}
function AdminPortal({auth,onLogout,onOpenClinic}) {
  const [clinics,setClinics] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [form,setForm] = useState({clinic_name:'',admin_name:'',email:'',password:''});
  const [busy,setBusy] = useState(false);
  const [opening,setOpening] = useState('');
  const headers={Authorization:`Bearer ${auth.access_token}`,'Content-Type':'application/json'};
  const loadClinics = async () => {
    setLoading(true);setError('');
    try { const response=await fetch(`${API_BASE}/api/admin/clinics`,{headers});const result=await response.json();if(!response.ok)throw new Error(result.detail||'Unable to load clinics.');setClinics(result); }
    catch(err){setError(err.message==='Failed to fetch'?'Cannot reach the server. Check that the backend is running.':err.message);}
    finally{setLoading(false);}
  };
  useEffect(()=>{loadClinics();},[auth.access_token]);
  const openClinic = async item => { setOpening(item.id); setError(''); try { await onOpenClinic(item); } catch (err) { setError(err.message); setOpening(''); } };
  const toggleClinic = async item => {
    const status=item.status==='suspended'?'active':'suspended';
    setError('');
    try{const response=await fetch(`${API_BASE}/api/admin/clinics/${item.id}?status=${status}`,{method:'PATCH',headers:{Authorization:`Bearer ${auth.access_token}`}});const result=await response.json();if(!response.ok)throw new Error(result.detail||'Could not update clinic status.');setClinics(current=>current.map(clinic=>clinic.id===item.id?{...clinic,...result}:clinic));}
    catch(err){setError(err.message==='Failed to fetch'?'Cannot reach the server. Check that the backend is running.':err.message);}
  };
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{const response=await fetch(`${API_BASE}/api/admin/clinics`,{method:'POST',headers,body:JSON.stringify(form)});const result=await response.json();if(!response.ok)throw new Error(result.detail||'Could not create clinic.');setClinics(current=>[result,...current]);setNotice(`Clinic ${result.name} and its administrator account were created.`);setForm({clinic_name:'',admin_name:'',email:'',password:''});}
    catch(err){setError(err.message==='Failed to fetch'?'Cannot reach the server. Check that the backend is running.':err.message);}
    finally{setBusy(false);}
  };
  return <div className="admin-shell">
    <header className="admin-topbar">
      <div className="auth-brand"><span className="brand-icon"><Activity size={21}/></span><div><b>careloop</b><small>PLATFORM ADMIN</small></div></div>
      <div className="admin-user"><span>{auth.user.name} · {auth.user.email}</span><button className="secondary-button" onClick={onLogout}>Sign out</button></div>
    </header>
    <main className="admin-content">
      <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> PLATFORM MANAGEMENT</div><h1>Clinics</h1><p>Create clinic workspaces and manage their administrator access.</p></div></div>
      <div className="demo-notice"><ShieldCheck size={16}/><span>Platform administrator view. Clinic patient information remains separated by clinic account.</span></div>
      <div className="metric-grid section-metrics">
        <section className="metric-card"><div className="metric-label">Clinic workspaces</div><div className="metric-number">{clinics.length}</div></section>
        <section className="metric-card"><div className="metric-label">Active or trial</div><div className="metric-number">{clinics.filter(item=>item.status==='active'||item.status==='trial').length}</div></section>
        <section className="metric-card"><div className="metric-label">Clinic administrators</div><div className="metric-number">{clinics.length}</div></section>
      </div>
      <div className="admin-grid">
        <section className="panel section-table-panel admin-clinics-panel">
          <div className="panel-heading"><div><h2>Clinic accounts</h2><p>Each clinic signs in with its own administrator account.</p></div><button className="secondary-button" onClick={loadClinics}>Refresh</button></div>
          {error&&<p className="auth-error" role="alert">{error}</p>}
          <div className="table-scroll"><table className="workspace-table"><thead><tr><th>Clinic</th><th>Administrator</th><th>Email</th><th>Status</th><th>Workspace</th></tr></thead><tbody>
            {clinics.map(item=><tr key={item.id}><td>{item.name}</td><td>{item.admin_name}</td><td>{item.admin_email}</td><td><span className="table-status">{item.status}</span></td><td><button className="secondary-button" disabled={item.status==='suspended'||opening===item.id} onClick={()=>openClinic(item)}>{opening===item.id?'Opening...':'Open workspace'}</button></td></tr>)}
            {!loading&&clinics.length===0&&<tr><td colSpan="5" className="empty-row">No clinics yet. Create the first clinic account.</td></tr>}
            {loading&&<tr><td colSpan="5" className="empty-row">Loading clinic accounts...</td></tr>}
          </tbody></table></div>
        </section>
        <section className="panel admin-create-panel">
          <div className="form-section-heading"><h2>Add a clinic</h2><p>Create the clinic and its first administrator account.</p></div>
          <form className="admin-create-form" onSubmit={submit}>
            <label>Clinic or hospital name<input required minLength="2" maxLength="200" value={form.clinic_name} onChange={event=>setForm(current=>({...current,clinic_name:event.target.value}))} placeholder="Example Health Clinic"/></label>
            <label>Administrator name<input required maxLength="160" value={form.admin_name} onChange={event=>setForm(current=>({...current,admin_name:event.target.value}))} placeholder="Clinic administrator"/></label>
            <label>Administrator email<input required type="email" value={form.email} onChange={event=>setForm(current=>({...current,email:event.target.value}))} placeholder="admin@clinic.com"/></label>
            <label>Temporary password<input required type="password" minLength="12" maxLength="128" autoComplete="new-password" value={form.password} onChange={event=>setForm(current=>({...current,password:event.target.value}))}/><small>Use at least 12 characters. Share it securely with the clinic administrator.</small></label>
            {notice&&<p className="auth-success" role="status">{notice}</p>}{error&&<p className="auth-error" role="alert">{error}</p>}
            <button className="primary-button" disabled={busy}>{busy?'Creating clinic...':'Create clinic account'}</button>
          </form>
        </section>
      </div>
      <footer className="page-footer"><span>Copyright 2026 Careloop Health</span><span>Platform administration</span></footer>
    </main>
  </div>;
}
function Metric({icon:Icon,label,number,change,note,tone,alert}) {return <section className="metric-card"><div className="metric-top"><span className={`metric-icon icon-${tone}`}><Icon size={18}/></span><span className={alert?'attention-label':'metric-change'}>{alert?<CircleAlert size={13}/>:<ArrowUpRight size={13}/>} {change}</span></div><div className="metric-number">{number}</div><div className="metric-label">{label}</div><div className="metric-note">{note}</div></section>}
function Appointment({initials,name,kind,time,tag}){return <div className="appointment-row"><div className="appointment-date"><b>26</b><span>OCT</span></div><div className="avatar avatar-blue">{initials}</div><div className="appointment-person"><b>{name}</b><span>{kind}</span></div><span className="appointment-time"><Clock3 size={14}/>{time}</span><span className="appointment-tag">{tag}</span><button className="row-more" aria-label={`More options for ${name}`}><MoreHorizontal size={18}/></button></div>}
function PatientsPage({patients,onSave}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query,setQuery] = useState('');
  const isNew = location.pathname === '/patients/new';
  const patientId = !isNew && location.pathname.startsWith('/patients/') ? location.pathname.slice('/patients/'.length) : null;
  const selected = patients.find(patient=>patient.id===patientId);
  const blank = {name:'',phone:'',language:'English',consent:false,active:true,medications:[]};
  const [form,setForm] = useState(blank);
  const [phoneError,setPhoneError] = useState('');
  const [formError,setFormError] = useState('');
  const [saving,setSaving] = useState(false);
  useEffect(()=>{setForm(selected ? {...selected,medications:(selected.medications||[]).map(item=>({id:item.id,name:item.name||'',frequency:item.frequency||'',foodTiming:item.foodTiming||'',durationDays:item.durationDays||'',reminderTimes:item.reminderTimes||[]}))} : blank);setPhoneError('');setFormError('');},[location.pathname,selected?.id]);
  const editing = Boolean(selected);
  const update = (field,value) => setForm(current=>({...current,[field]:value}));
  const updateMedication = (index,field,value) => setForm(current=>({...current,medications:current.medications.map((item,i)=>i===index?{...item,[field]:value}:item)}));
  const updateReminderTime = (index,timeIndex,value) => setForm(current=>({...current,medications:current.medications.map((item,i)=>i===index?{...item,reminderTimes:item.reminderTimes.map((time,j)=>j===timeIndex?value:time)}:item)}));
  const addPresetReminderTime = (index,value) => setForm(current=>({...current,medications:current.medications.map((item,i)=>{
    if(i!==index||item.reminderTimes.includes(value)) return item;
    const times=item.reminderTimes.filter(Boolean);
    return {...item,reminderTimes:[...times,value]};
  })}));
  const filtered = patients.filter(patient=>`${patient.name} ${patient.phone}`.toLowerCase().includes(query.toLowerCase()));
  const submit = async event => {event.preventDefault();const phone=form.phone.trim();if(!/^\+[1-9]\d{7,14}$/.test(phone)){setPhoneError('Enter the full international number, including + and country code.');return;}setPhoneError('');setFormError('');setSaving(true);try{await onSave({...form,phone});navigate('/patients');}catch(err){setFormError(err.message||'Could not save patient.');}finally{setSaving(false);}};
  if (location.pathname !== '/patients' && !selected && !isNew) return <div className="patients-page"><button className="text-link" onClick={()=>navigate('/patients')}>Back to patients</button><section className="panel patient-form-panel"><h2>Patient not found</h2><p>This patient may have been removed from this browser session.</p></section></div>;
  if (isNew || editing) return <div className="patients-page">
    <button className="back-link" onClick={()=>navigate('/patients')}>Back to patients</button>
    <div className="welcome-row patient-title-row"><div><div className="eyebrow"><span className="live-dot"/> PATIENT MANAGEMENT</div><h1>{editing?'Edit patient':'Add patient'}</h1><p>Record patient details and clinician-approved reminder information.</p></div></div>
    <div className="demo-notice"><CircleAlert size={16}/><span>Patient and medication schedules save to this clinic. WhatsApp reminders send only after recorded consent, a connected WhatsApp account, and an approved reminder template are configured.</span></div>
    <form className="panel patient-form-panel" onSubmit={submit}>
      <div className="form-section-heading"><h2>Patient details</h2><p>Collect only information needed for clinic communication.</p></div>
      <div className="patient-fields"><label>Patient name<input required maxLength={160} value={form.name} onChange={event=>update('name',event.target.value)} placeholder="Full name"/></label><label>WhatsApp number<input required inputMode="tel" maxLength={16} value={form.phone} onChange={event=>{update('phone',event.target.value);setPhoneError('');}} onBlur={event=>update('phone',event.target.value.trim())} aria-invalid={Boolean(phoneError)} aria-describedby="phone-validation" placeholder="+919876543210"/><small id="phone-validation" className={phoneError?'field-error':''}>{phoneError||'Enter the full number with + and country code.'}</small></label><label>Preferred language<select value={form.language} onChange={event=>update('language',event.target.value)}><option>English</option><option>Hindi</option><option>Marathi</option><option>Tamil</option><option>Other</option></select></label></div>
      <label className="consent-row"><input type="checkbox" checked={form.consent} onChange={event=>update('consent',event.target.checked)}/><span><b>Patient has consented to WhatsApp reminders</b><small>Keep unchecked until the clinic has recorded the patient's consent. Unchecking means reminders must not be sent.</small></span></label>
      <div className="form-section-heading medication-heading"><h2>Doctor-entered medication reminders</h2><p>Fill these fields only from an existing prescription confirmed by a qualified clinician. The app does not recommend or change a dose.</p></div>
      {form.medications.map((medication,index)=><section className="medication-card" key={medication.id||index}>
        <div className="medication-edit-row"><MedicineAutocomplete value={medication.name} onChange={value=>updateMedication(index,'name',value)}/><select className="frequency-field" aria-label="Frequency as prescribed" required value={medication.frequency} onChange={event=>updateMedication(index,'frequency',event.target.value)}><option value="">Select frequency</option><option value="1-0-0">1-0-0</option><option value="0-1-0">0-1-0</option><option value="0-0-1">0-0-1</option><option value="1-0-1">1-0-1</option><option value="1-1-1">1-1-1</option><option value="Twice daily">Twice daily</option><option value="Once daily">Once daily</option><option value="As entered by clinician">Other (as entered by clinician)</option></select><select className="preset-time-field" aria-label="Add a preset reminder time" value="" onChange={event=>event.target.value&&addPresetReminderTime(index,event.target.value)}><option value="">+ Preset time</option><option value="07:00">7:00 AM</option><option value="08:30">8:30 AM</option><option value="12:30">12:30 PM</option><option value="17:00">5:00 PM</option><option value="20:30">8:30 PM</option></select><select className="food-field" aria-label="Food timing as prescribed" required value={medication.foodTiming} onChange={event=>updateMedication(index,'foodTiming',event.target.value)}><option value="">Select food timing</option><option value="Before food">Before food</option><option value="After food">After food</option><option value="With food">With food</option><option value="No food instruction">No food instruction</option></select><input className="duration-field" aria-label="Course duration in days" type="number" min="1" max="365" step="1" required value={medication.durationDays} onChange={event=>updateMedication(index,'durationDays',event.target.value)} placeholder="Days"/><button type="button" className="remove-medication" onClick={()=>setForm(current=>({...current,medications:current.medications.filter((_,i)=>i!==index)}))} aria-label="Remove medication">x</button></div>
        <div className="reminder-time-editor"><b>Exact reminder times (clinic local time)</b>{medication.reminderTimes.map((time,timeIndex)=><div className="reminder-time-input" key={timeIndex}><label>Time {timeIndex+1}<input type="time" required value={time} onChange={event=>updateReminderTime(index,timeIndex,event.target.value)}/></label>{medication.reminderTimes.length>1&&<button type="button" className="remove-medication" onClick={()=>updateMedication(index,'reminderTimes',medication.reminderTimes.filter((_,i)=>i!==timeIndex))} aria-label="Remove reminder time">x</button>}</div>)}<button type="button" className="add-medication-button" onClick={()=>updateMedication(index,'reminderTimes',[...medication.reminderTimes,''])}>+ Add reminder time</button></div>
      </section>)}
      <button type="button" className="add-medication-button" onClick={()=>setForm(current=>({...current,medications:[...current.medications,{name:'',frequency:'',foodTiming:'',durationDays:'',reminderTimes:['']}]}))}>+ Add medication</button>
      {formError&&<p className="auth-error" role="alert">{formError}</p>}
      <div className="patient-form-actions"><button type="button" className="secondary-button" onClick={()=>navigate('/patients')}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving?'Saving...':editing?'Save changes':'Save patient'}</button></div>
    </form>
  </div>;
  return <div className="patients-page">
    <div className="welcome-row patient-title-row"><div><div className="eyebrow"><span className="live-dot"/> PATIENT MANAGEMENT</div><h1>Patients</h1><p>Add patients and manage their communication consent and reminder details.</p></div><button className="primary-button" onClick={()=>navigate('/patients/new')}>+ Add patient</button></div>
    <div className="demo-notice"><CircleAlert size={16}/><span>Patient records are clinic-scoped. Reminders are only sent for consented patients with an active schedule.</span></div>
    <div className="metric-grid section-metrics"><section className="metric-card"><div className="metric-label">Patients in this clinic</div><div className="metric-number">{patients.length}</div></section><section className="metric-card"><div className="metric-label">Consent recorded</div><div className="metric-number">{patients.filter(patient=>patient.consent).length}</div></section><section className="metric-card"><div className="metric-label">Active patients</div><div className="metric-number">{patients.filter(patient=>patient.active).length}</div></section></div>
    <section className="panel section-table-panel"><div className="panel-heading"><div><h2>Patient directory</h2><p>Select a patient row to edit their details</p></div><label className="section-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search patients..." aria-label="Search patients"/></label></div>
      <div className="table-scroll"><table className="workspace-table patient-table"><thead><tr><th>Patient</th><th>WhatsApp number</th><th>Language</th><th>Consent</th><th>Medication entries</th></tr></thead><tbody>{filtered.map(patient=><tr className="clickable-patient-row" tabIndex={0} key={patient.id} onClick={()=>navigate(`/patients/${patient.id}`)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate(`/patients/${patient.id}`);}}}><td>{patient.name}</td><td>{patient.phone}</td><td>{patient.language}</td><td><span className={`table-status ${patient.consent?'active':'needs-setup'}`}>{patient.consent?'Consent recorded':'No consent'}</span></td><td>{patient.medications.length}</td></tr>)}{filtered.length===0&&<tr><td className="empty-row" colSpan="5">No matching patients. Add a patient to get started.</td></tr>}</tbody></table></div>
    </section>
    <footer className="page-footer"><span>Copyright 2026 Careloop Health</span><span>Clinic records</span><button>Privacy & security</button></footer>
  </div>;
}
function AppointmentsPage({appointments,patients,onSave}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query,setQuery] = useState('');
  const isNew = location.pathname === '/appointments/new';
  const appointmentId = !isNew && location.pathname.startsWith('/appointments/') ? location.pathname.slice('/appointments/'.length) : null;
  const selected = appointments.find(item=>item.id===appointmentId);
  const blank = {patientId:'',type:'General consultation',date:'',time:'',reminder:'24 hours before',status:'Scheduled'};
  const [form,setForm] = useState(blank);
  useEffect(()=>{setForm(selected?{...selected}:blank);},[location.pathname,selected?.id]);
  const editing = Boolean(selected);
  const update = (field,value) => setForm(current=>({...current,[field]:value}));
  const filtered = appointments.filter(item=>`${item.patientName} ${item.type} ${item.date}`.toLowerCase().includes(query.toLowerCase()));
  const submit = event => {
    event.preventDefault();
    const patient = patients.find(item=>item.id===form.patientId);
    if(!patient)return;
    onSave({...form,patientName:patient.name,id:form.id||`appointment-${Date.now()}`});
    navigate('/appointments');
  };
  if(location.pathname!=='/appointments'&&!selected&&!isNew)return <div className="patients-page"><button className="back-link" onClick={()=>navigate('/appointments')}>Back to appointments</button><section className="panel patient-form-panel"><h2>Appointment not found</h2><p>This appointment may have been removed from this browser session.</p></section></div>;
  if(isNew||editing)return <div className="patients-page">
    <button className="back-link" onClick={()=>navigate('/appointments')}>Back to appointments</button>
    <div className="welcome-row patient-title-row"><div><div className="eyebrow"><span className="live-dot"/> APPOINTMENT MANAGEMENT</div><h1>{editing?'Edit appointment':'Add appointment'}</h1><p>Schedule a clinic visit for one of your patients.</p></div></div>
    <div className="demo-notice"><CircleAlert size={16}/><span>Prototype only: appointments stay in memory for this browser session. No WhatsApp reminders are sent.</span></div>
    <form className="panel patient-form-panel" onSubmit={submit}>
      <div className="form-section-heading"><h2>Appointment details</h2><p>Choose the patient and visit time.</p></div>
      {patients.length===0?<p>No patients are available. <button type="button" className="text-link" onClick={()=>navigate('/patients/new')}>Add a patient first</button>.</p>:<div className="patient-fields">
        <label>Patient<select required value={form.patientId} onChange={event=>update('patientId',event.target.value)}><option value="">Select a patient</option>{patients.map(patient=><option key={patient.id} value={patient.id}>{patient.name}</option>)}</select></label>
        <label>Appointment type<select required value={form.type} onChange={event=>update('type',event.target.value)}><option>General consultation</option><option>Follow-up consultation</option><option>Dental check-up</option><option>Other</option></select></label>
        <label>Date<input required type="date" value={form.date} onChange={event=>update('date',event.target.value)}/></label>
        <label>Time<input required type="time" value={form.time} onChange={event=>update('time',event.target.value)}/></label>
        <label>Reminder interval<select value={form.reminder} onChange={event=>update('reminder',event.target.value)}><option value="None">No reminder</option><option>2 hours before</option><option>24 hours before</option></select></label>
        <label>Status<select value={form.status} onChange={event=>update('status',event.target.value)}><option>Scheduled</option><option>Confirmed</option><option>Cancelled</option></select></label>
      </div>}
      <div className="patient-form-actions"><button type="button" className="secondary-button" onClick={()=>navigate('/appointments')}>Cancel</button><button type="submit" className="primary-button" disabled={patients.length===0}>{editing?'Save changes':'Save appointment'}</button></div>
    </form>
  </div>;
  return <div className="patients-page">
    <div className="welcome-row patient-title-row"><div><div className="eyebrow"><span className="live-dot"/> APPOINTMENT MANAGEMENT</div><h1>Appointments</h1><p>Schedule and manage patient visits at your clinic.</p></div><button className="primary-button" onClick={()=>navigate('/appointments/new')}>+ Add appointment</button></div>
    <div className="demo-notice"><CircleAlert size={16}/><span>Prototype only: appointment records are kept in memory for this browser session. No WhatsApp reminders are sent.</span></div>
    <div className="metric-grid section-metrics"><section className="metric-card"><div className="metric-label">Appointments in this session</div><div className="metric-number">{appointments.length}</div></section><section className="metric-card"><div className="metric-label">Scheduled</div><div className="metric-number">{appointments.filter(item=>item.status==='Scheduled').length}</div></section><section className="metric-card"><div className="metric-label">Confirmed</div><div className="metric-number">{appointments.filter(item=>item.status==='Confirmed').length}</div></section></div>
    <section className="panel section-table-panel"><div className="panel-heading"><div><h2>Appointment list</h2><p>Select an appointment to edit its details</p></div><label className="section-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search appointments..." aria-label="Search appointments"/></label></div>
      <div className="table-scroll"><table className="workspace-table"><thead><tr><th>Patient</th><th>Appointment</th><th>Date &amp; time</th><th>Reminder</th><th>Status</th></tr></thead><tbody>{filtered.map(item=><tr className="clickable-patient-row" tabIndex={0} key={item.id} onClick={()=>navigate(`/appointments/${item.id}`)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate(`/appointments/${item.id}`);}}}><td>{item.patientName}</td><td>{item.type}</td><td>{item.date} - {item.time}</td><td>{item.reminder==='None'?'None':item.reminder}</td><td><span className={`table-status ${item.status.toLowerCase()}`}>{item.status}</span></td></tr>)}{filtered.length===0&&<tr><td className="empty-row" colSpan="5">No appointments found. Add an appointment to get started.</td></tr>}</tbody></table></div>
    </section>
    <footer className="page-footer"><span>Copyright 2026 Careloop Health</span><span>Prototype workspace</span><button>Privacy &amp; security</button></footer>
  </div>;
}
function MedicineAutocomplete({value,onChange}) {
  const [items,setItems] = useState([]);
  const [open,setOpen] = useState(false);
  const [failed,setFailed] = useState(false);
  useEffect(()=>{
    const query=value.trim();
    if(query.length<2){setItems([]);setFailed(false);return undefined;}
    const controller=new AbortController();
    const timer=setTimeout(async()=>{
      try{
        const response=await fetch(`${API_BASE}/api/medicines/search?q=${encodeURIComponent(query)}&limit=10`,{signal:controller.signal});
        if(!response.ok) throw new Error('Medicine search failed');
        const result=await response.json();
        setItems(result.items||[]);setFailed(false);
      }catch(error){if(error.name!=='AbortError'){setItems([]);setFailed(true);}}
    },250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[value]);
  return <div className="medicine-autocomplete">
    <input aria-label="Search medicine name" role="combobox" aria-autocomplete="list" aria-expanded={open&&items.length>0} value={value} required onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),120)} onChange={event=>{onChange(event.target.value);setOpen(true);}} placeholder="Type to search medicines"/>
    {open&&items.length>0&&<div className="medicine-suggestions" role="listbox">{items.map((name,index)=><button type="button" role="option" aria-selected="false" key={`${name}-${index}`} onMouseDown={event=>event.preventDefault()} onClick={()=>{onChange(name);setOpen(false);}}>{name}</button>)}</div>}
    {open&&failed&&<div className="medicine-search-note">Could not load suggestions. Start the backend or enter the clinician-provided name manually.</div>}
  </div>;
}
function MedicationActivityPage({active,auth}) {
  const [rows,setRows] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const refresh = async () => {
    setLoading(true);setError('');
    try{const response=await fetch(`${API_BASE}/api/clinic/medication-reminders`,{headers:{Authorization:`Bearer ${auth.access_token}`}});const result=await response.json();if(!response.ok)throw new Error(result.detail||'Could not load reminder activity.');setRows(result);}
    catch(err){setError(err.message==='Failed to fetch'?'Cannot reach the backend. Check that it is running.':err.message);}
    finally{setLoading(false);}
  };
  useEffect(()=>{refresh();},[auth.access_token]);
  const responses=rows.filter(row=>row.status==='taken'||row.status==='not_taken');
  return <div className="workspace-page">
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CLINIC WORKSPACE</div><h1>{active}</h1><p>Scheduled medication reminder sends and patient replies.</p></div><button className="secondary-button" onClick={refresh}>Refresh</button></div>
    <div className="demo-notice"><MessageCircle size={16}/><span>Patients reply using the WhatsApp buttons. Replies are matched to the reminder and patient number before they are recorded.</span></div>
    <div className="metric-grid section-metrics"><section className="metric-card"><div className="metric-label">Recent reminders</div><div className="metric-number">{rows.length}</div></section><section className="metric-card"><div className="metric-label">Patient responses</div><div className="metric-number">{responses.length}</div></section><section className="metric-card"><div className="metric-label">Not taken</div><div className="metric-number">{responses.filter(row=>row.status==='not_taken').length}</div></section></div>
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <section className="panel section-table-panel"><div className="panel-heading"><div><h2>Reminder activity</h2><p>Latest 100 clinic reminder events</p></div></div><div className="table-scroll"><table className="workspace-table"><thead><tr><th>Patient</th><th>Medication</th><th>Reminder time</th><th>Response</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td>{row.patient_name}</td><td>{row.medicine_name}</td><td>{new Date(row.scheduled_for).toLocaleString()}</td><td><span className={`table-status ${row.status}`}>{row.status.replaceAll('_',' ')}</span></td></tr>)}{!loading&&rows.length===0&&<tr><td colSpan="4" className="empty-row">No reminders yet. Add a consented patient with medication reminder times.</td></tr>}{loading&&<tr><td colSpan="4" className="empty-row">Loading reminder activity...</td></tr>}</tbody></table></div></section>
    <footer className="page-footer"><span>Medication reminder activity</span><span>Clinic account</span></footer>
  </div>;
}

function WhatsAppSettingsPage({auth}) {
  const [connection,setConnection] = useState(null);
  const [form,setForm] = useState({business_account_id:'',phone_number_id:'',access_token:''});
  const [recipient,setRecipient] = useState('');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const request = async (url,options={}) => {
    const response=await fetch(`${API_BASE}${url}`,{...options,headers:{Authorization:`Bearer ${auth.access_token}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
    const result=response.status===204?null:await response.json();
    if(!response.ok)throw new Error(result?.detail||'WhatsApp request failed.');
    return result;
  };
  const loadConnection = async () => {
    setLoading(true);setError('');
    try{setConnection(await request('/api/clinic/whatsapp'));}
    catch(err){setError(err.message==='Failed to fetch'?'Cannot reach the backend. Check that it is running.':err.message);}
    finally{setLoading(false);}
  };
  useEffect(()=>{loadConnection();},[auth.access_token]);
  const connect = async event => {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{const result=await request('/api/clinic/whatsapp',{method:'PUT',body:JSON.stringify(form)});setConnection(result);setForm(current=>({...current,access_token:''}));setNotice(`Connected ${result.verified_name||result.display_phone_number||'WhatsApp phone number'}.`);}
    catch(err){setError(err.message==='Failed to fetch'?'Cannot reach the backend. Check that it is running.':err.message);}
    finally{setBusy(false);}
  };
  const disconnect = async () => {
    setBusy(true);setError('');setNotice('');
    try{await request('/api/clinic/whatsapp',{method:'DELETE'});setConnection({connected:false});setNotice('WhatsApp account disconnected.');}
    catch(err){setError(err.message);}
    finally{setBusy(false);}
  };
  const sendTest = async event => {
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{const result=await request('/api/clinic/whatsapp/test-message',{method:'POST',body:JSON.stringify({to:recipient.replace(/\D/g,'')})});setNotice(`Meta accepted the test message${result.message_id?` (${result.message_id})`:''}.`);}
    catch(err){setError(err.message==='Failed to fetch'?'Cannot reach the backend. Check that it is running.':err.message);}
    finally{setBusy(false);}
  };
  return <div className="workspace-page">
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CLINIC WORKSPACE</div><h1>WhatsApp settings</h1><p>Connect this clinic's WhatsApp Business phone number to the Cloud API.</p></div></div>
    <div className="demo-notice"><ShieldCheck size={16}/><span>Tokens are encrypted before they are saved. Use a system-user token for a durable connection; never paste tokens into chat or frontend environment files. For reminders, approve a Utility template named medication_reminder with three body placeholders and Quick Reply buttons titled Taken and Not taken.</span></div>
    {error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="auth-success" role="status">{notice}</p>}
    <section className="panel patient-form-panel">
      <div className="form-section-heading"><h2>{connection?.connected?'WhatsApp account connected':'Connect WhatsApp Cloud API'}</h2><p>Find the WhatsApp Business Account ID and Phone Number ID in Meta's WhatsApp Manager or developer dashboard. The token needs the whatsapp_business_messaging permission.</p></div>
      {loading?<p>Loading connection...</p>:<>
        {connection?.connected&&<div className="connection-status"><div className="connection-icon"><MessageCircle size={19}/></div><div><b>{connection.verified_name||'WhatsApp Business account'}</b><span>{connection.display_phone_number||'Phone number connected'}</span></div><span className="connected-pill"><i/> Connected</span></div>}
        <form className="admin-create-form whatsapp-connect-form" onSubmit={connect}>
          <label>WhatsApp Business Account ID<input required inputMode="numeric" pattern="[0-9]+" value={form.business_account_id} onChange={event=>setForm(current=>({...current,business_account_id:event.target.value}))} placeholder="Numeric WABA ID"/></label>
          <label>Phone Number ID<input required inputMode="numeric" pattern="[0-9]+" value={form.phone_number_id} onChange={event=>setForm(current=>({...current,phone_number_id:event.target.value}))} placeholder="Numeric phone number ID"/></label>
          <label>Access token<input required type="password" autoComplete="new-password" value={form.access_token} onChange={event=>setForm(current=>({...current,access_token:event.target.value}))} placeholder={connection?.connected?'Enter a replacement token to update':'Paste the system-user access token'}/><small>The token is sent to the backend over the current connection and is never returned by the API.</small></label>
          <div className="whatsapp-actions"><button className="primary-button" disabled={busy}>{busy?'Verifying...':connection?.connected?'Update connection':'Connect account'}</button>{connection?.connected&&<button type="button" className="secondary-button" disabled={busy} onClick={disconnect}>Disconnect</button>}</div>
        </form>
      </>}
    </section>
    {connection?.connected&&<section className="panel patient-form-panel"><div className="form-section-heading"><h2>Send a test message</h2><p>Sends Meta's approved hello_world template. With a test number, the recipient must first be added to the allowed test recipients in Meta.</p></div><form className="admin-create-form whatsapp-test-form" onSubmit={sendTest}><label>Recipient WhatsApp number<input required inputMode="numeric" pattern="[1-9][0-9]{7,14}" value={recipient} onChange={event=>setRecipient(event.target.value)} placeholder="Country code and number, digits only"/><small>Include the country code, without a leading plus sign. Only use a number you control for this test.</small></label><button className="primary-button" disabled={busy}>{busy?'Sending...':'Send test template'}</button></form></section>}
    <footer className="page-footer"><span>WhatsApp Cloud API setup</span><span>Clinic account</span></footer>
  </div>;
}

function WorkspacePage({active}) {
  const [query, setQuery] = useState('');
  const data = sectionData[active];
  const rows = data.rows.filter(row => row.join(' ').toLowerCase().includes(query.toLowerCase()));
  return <div className="workspace-page">
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CLINIC WORKSPACE</div><h1>{active}</h1><p>{data.description}</p></div></div>
    <div className="demo-notice"><CircleAlert size={16}/><span>Preview content only. Clinic records and actions are not connected to the backend yet.</span></div>
    <div className="metric-grid section-metrics">{data.metrics.map(([label, value])=><section className="metric-card" key={label}><div className="metric-label">{label}</div><div className="metric-number">{value}</div></section>)}</div>
    <section className="panel section-table-panel"><div className="panel-heading"><div><h2>{active}</h2><p>{rows.length} preview records</p></div><label className="section-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={`Search ${active.toLowerCase()}...`} aria-label={`Search ${active}`}/></label></div>
      <div className="table-scroll"><table className="workspace-table"><thead><tr>{data.columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={`${row[0]}-${index}`}>{row.map((cell,cellIndex)=><td key={cellIndex}>{cellIndex === row.length-1 ? <span className={`table-status ${cell.toLowerCase().replaceAll(' ','-')}`}>{cell}</span> : cell}</td>)}</tr>)}{rows.length===0&&<tr><td className="empty-row" colSpan={data.columns.length}>No matching records.</td></tr>}</tbody></table></div>
    </section>
    <footer className="page-footer"><span>Copyright 2026 Careloop Health</span><span>Preview workspace</span><button>Privacy & security</button></footer>
  </div>;
}
export default App;
