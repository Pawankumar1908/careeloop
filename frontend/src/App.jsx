import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, ChevronDown, ClipboardList, Clock3, Eye, EyeOff, LayoutDashboard, Menu, MessageCircle, Pill, Search, Settings, ShieldCheck, Users, X, Bell, ArrowUpRight, CircleCheck, CircleAlert, MoreHorizontal } from 'lucide-react';

const nav = [
  { title: 'WORKSPACE', links: [['Overview', LayoutDashboard], ['Patients', Users], ['Medication schedules', Pill], ['Appointments', CalendarDays], ['Follow-ups', Clock3], ['WhatsApp messages', MessageCircle]] },
  { title: 'MANAGE', links: [['Reports', ClipboardList], ['Staff & permissions', ShieldCheck], ['WhatsApp settings', MessageCircle], ['Clinic settings', Settings]] },
];
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:8000' : '');
const errorText = detail => {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(item => item?.msg || item?.message || JSON.stringify(item)).join('; ');
  if (detail && typeof detail === 'object') return detail.message || JSON.stringify(detail);
  return 'Could not sign in.';
};
const sectionData = {
  Appointments: { description: 'Appointment tracking will show saved clinic records here once configured.' },
  'Follow-ups': { description: 'Follow-up tracking will show clinic records here once configured.' },
  Reports: { description: "Reports will be generated from the clinic's recorded activity." },
  'Staff & permissions': { description: 'Clinic staff accounts and permissions.' },
  'Clinic settings': { description: 'Clinic profile and workspace settings.' },
};
const pathFor = (label) => label === 'Overview' ? '/' : `/${label.toLowerCase().replaceAll(' & ', '-').replaceAll(' ', '-')}`;
const labelFor = (pathname) => nav.flatMap(group => group.links.map(([label]) => [pathFor(label), label])).find(([path]) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)))?.[1] || 'Overview';
const clinicDateKey = (value,timeZone='Asia/Kolkata') => {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value instanceof Date?value:new Date(value));
  const part=Object.fromEntries(parts.map(item=>[item.type,item.value]));
  return `${part.year}-${part.month}-${part.day}`;
};
const clinicDateTimeInput = (value,timeZone='Asia/Kolkata') => {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(value);
  const part=Object.fromEntries(parts.map(item=>[item.type,item.value]));
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
};
const clinicDateTimeLabel = (value,timeZone='Asia/Kolkata') => new Intl.DateTimeFormat('en-IN',{timeZone,dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
const clockLabel = value => {const [hour,minute]=value.split(':').map(Number);return `${hour%12||12}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}`;};
const localPhone = value => {
  const digits=String(value||'').replace(/\D/g,'');
  return digits.startsWith('91')&&digits.length===12?digits.slice(2):digits;
};

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
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState('');
  const [whatsapp, setWhatsapp] = useState(null);
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState('');
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
      name: patient.name, age: patient.age === '' || patient.age == null ? null : Number(patient.age), gender: patient.gender || null,
      phone_e164: patient.phone, preferred_language: patient.language, consent: patient.consent,
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
      id: result.id, name: result.name, age: result.age, gender: result.gender, phone: result.phone_e164,
      language: result.preferred_language, consent: result.consent, active: result.is_active,
      nextAppointment: patient.nextAppointment,
      medications: result.medications.map(item => ({
        id: item.id, name: item.name, frequency: item.frequency, foodTiming: item.food_timing,
        durationDays: String(item.duration_days), reminderTimes: item.reminder_times,
      })),
    };
    setPatients(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
    return saved;
  };
  const refreshPatients = async () => {
    const response=await fetch(`${API_BASE}/api/patients`,{headers:{Authorization:`Bearer ${auth.access_token}`}});
    const rows=await response.json();
    if(!response.ok)throw new Error('Could not refresh patient records.');
    setPatients(rows.map(patient=>({
      id:patient.id,name:patient.name,age:patient.age,gender:patient.gender,phone:patient.phone_e164,
      language:patient.preferred_language,consent:patient.consent,active:patient.is_active,nextAppointment:patient.next_appointment,
      medications:patient.medications.map(item=>({id:item.id,name:item.name,frequency:item.frequency,foodTiming:item.food_timing,durationDays:String(item.duration_days),reminderTimes:item.reminder_times})),
    })));
  };
  const updateNextAppointment = (patientId, appointment) => {
    setPatients(current => current.map(patient => {
      if (patient.id !== patientId) return patient;
      const currentTime = patient.nextAppointment ? new Date(patient.nextAppointment.starts_at).getTime() : Infinity;
      return new Date(appointment.starts_at).getTime() < currentTime ? { ...patient, nextAppointment: appointment } : patient;
    }));
  };
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
    const controller = new AbortController();
    setDashboard(null);
    setDashboardError('');
    setDashboardLoading(true);
    fetch(`${API_BASE}/api/clinic/me`, { headers: { Authorization: `Bearer ${auth.access_token}` }, signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(setClinic)
      .catch(error => { if (error.name !== 'AbortError') setClinic(null); });
    fetch(`${API_BASE}/api/clinic/dashboard`, { headers: { Authorization: `Bearer ${auth.access_token}` }, signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Could not load clinic dashboard.');
        setDashboard(result);
      })
      .catch(error => { if (error.name !== 'AbortError') setDashboardError(error.message || 'Could not load clinic dashboard.'); })
      .finally(() => { if (!controller.signal.aborted) setDashboardLoading(false); });
    return () => controller.abort();
  }, [auth?.access_token, auth?.user?.clinic_id, active, patients.length]);
  useEffect(() => {
    if (!auth || auth.user.role === 'platform_admin') return;
    fetch(`${API_BASE}/api/clinic/whatsapp`, { headers: { Authorization: `Bearer ${auth.access_token}` } })
      .then(response => response.ok ? response.json() : null)
      .then(setWhatsapp)
      .catch(() => setWhatsapp(null));
  }, [auth, active]);
  useEffect(() => {
    if (!auth || auth.user.role === 'platform_admin') return;
    const sendPresence = () => {
      if (document.visibilityState !== 'visible') return;
      fetch(`${API_BASE}/api/clinic/presence`, { method: 'POST', headers: { Authorization: `Bearer ${auth.access_token}` } }).catch(() => {});
    };
    sendPresence();
    const timer = window.setInterval(sendPresence, 30 * 1000);
    document.addEventListener('visibilitychange', sendPresence);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', sendPresence); };
  }, [auth?.access_token, auth?.user?.role]);
  useEffect(() => {
    if (!auth || auth.user.role === 'platform_admin') return;
    const controller = new AbortController();
    setPatientsLoading(true);
    setPatientsError('');
    fetch(`${API_BASE}/api/patients`, { headers: { Authorization: `Bearer ${auth.access_token}` }, signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Unable to load clinic patients'); return response.json(); })
      .then(rows => setPatients(rows.map(patient => ({
        id: patient.id, name: patient.name, age: patient.age, gender: patient.gender, phone: patient.phone_e164,
        language: patient.preferred_language, consent: patient.consent, active: patient.is_active,
        nextAppointment: patient.next_appointment,
        medications: patient.medications.map(item => ({
          id: item.id, name: item.name, frequency: item.frequency,
          foodTiming: item.food_timing, durationDays: String(item.duration_days),
          reminderTimes: item.reminder_times,
        })),
      }))))
      .catch(error => { if (error.name !== 'AbortError') { setPatients([]); setPatientsError('Could not load patient records.'); } })
      .finally(() => { if (!controller.signal.aborted) setPatientsLoading(false); });
    return () => controller.abort();
  }, [auth, active]);
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
      const platformSession = {
        ...returned,
        access_token: returned.platform_access_token,
        user: adminSession.user,
      };
      delete platformSession.platform_access_token;
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
      <div className="sidebar-bottom"><div className="help-card"><div className="help-symbol"><MessageCircle size={17}/></div><b>Need a hand?</b><span>Our support team is here for you.</span><button onClick={() => navigate('/clinic-settings')}>Visit help center <ArrowUpRight size={13}/></button></div><div className="user-row"><div className="avatar avatar-user">{auth.user.name.slice(0,2).toUpperCase()}</div><div><b>{auth.user.name}</b><span>{auth.user.email || localPhone(auth.user.phone_e164)}</span></div><button className="logout-mini" onClick={signOut}>Sign out</button></div></div>
    </aside>
    <main className="main-content"><header className="topbar"><button className="icon-button menu-toggle" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={21}/></button><div className="crumb">Workspace <span>/</span> <b>{active}</b></div><div className="top-actions"><div className="searchbox"><Search size={16}/><input placeholder="Search sections..." aria-label="Search sections" onKeyDown={event => { if (event.key === "Enter") { const term=event.currentTarget.value.trim().toLowerCase(); const match=nav.flatMap(group=>group.links.map(([label])=>label)).find(label=>label.toLowerCase().includes(term)); if(match){navigate(pathFor(match));event.currentTarget.value="";} } }}/><kbd>Enter</kbd></div><div className="text-size-controls" aria-label="Text size controls"><button type="button" onClick={() => adjustTextSize(-0.1)} disabled={textScale <= 0.8} aria-label="Decrease text size" title="Decrease text size">A-</button><button type="button" onClick={() => adjustTextSize(0.1)} disabled={textScale >= 1.3} aria-label="Increase text size" title="Increase text size">A+</button></div><button className="icon-button notify" aria-label="Notifications" title="Open messages" onClick={() => navigate(pathFor("WhatsApp messages"))}><Bell size={19}/><i/></button><div className="profile-menu"><button className="top-user top-user-button" onClick={() => setProfileOpen(current => !current)} aria-haspopup="menu" aria-expanded={profileOpen} aria-label="Open account menu" title="Account menu"><div className="avatar avatar-user">{auth.user.name.slice(0,2).toUpperCase()}</div><ChevronDown size={15}/></button>{profileOpen && <div className="profile-dropdown" role="menu"><div className="profile-details"><b>{auth.user.name}</b><span>{auth.user.email || localPhone(auth.user.phone_e164)}</span></div><button role="menuitem" onClick={signOut}>Sign out</button></div>}</div></div></header>
      {auth.user.admin_view && <div className="demo-notice admin-view-notice"><ShieldCheck size={16}/><span>Platform admin access to {clinic?.name || 'this clinic'}.</span><button className="secondary-button" onClick={returnToPlatform}>Return to platform admin</button></div>}
      <div className="page-wrap">{active === 'Patients' && <PatientsPage auth={auth} patients={patients} loading={patientsLoading} error={patientsError} onSave={savePatient} onAppointmentCreated={updateNextAppointment} clinicTimezone={clinic?.timezone||'Asia/Kolkata'}/>} {active === 'Appointments' && <AppointmentsPage auth={auth} patients={patients} onSavePatient={savePatient} onAppointmentCreated={updateNextAppointment} onPatientDataChanged={refreshPatients} clinic={clinic} clinicTimezone={clinic?.timezone||'Asia/Kolkata'}/> } {(active === 'Medication schedules' || active === 'WhatsApp messages') && <MedicationActivityPage active={active} auth={auth}/>} {active === 'WhatsApp settings' && <WhatsAppSettingsPage auth={auth}/>} {active === 'Staff & permissions' && <StaffPage auth={auth}/>} {active === 'Clinic settings' && <ClinicSettingsPage auth={auth} clinic={clinic} onClinicUpdated={setClinic}/>} {active !== 'Overview' && active !== 'Patients' && active !== 'Appointments' && active !== 'Medication schedules' && active !== 'WhatsApp messages' && active !== 'WhatsApp settings' && active !== 'Staff & permissions' && active !== 'Clinic settings' && <WorkspacePage key={active} active={active}/>} {active === 'Overview' && <><div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> {dateLabel}</div><h1>{greeting}, {auth.user.admin_view ? (clinic?.name || auth.user.name) : auth.user.name}</h1><p>Here's what's happening at your clinic today.</p></div><div className="date-button"><CalendarDays size={16}/> {today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div></div>
        {dashboardError&&<p className="auth-error" role="alert">{dashboardError}</p>}
        <div className="metric-grid"><Metric icon={Users} label="Total patients" number={dashboardLoading?'—':dashboard?.patient_count ?? '—'} note="registered in this clinic" tone="teal"/><Metric icon={Pill} label="Active schedules" number={dashboardLoading?'—':dashboard?.active_schedule_count ?? '—'} note="currently active" tone="purple"/><Metric icon={MessageCircle} label="Messages delivered today" number={dashboardLoading?'—':dashboard?.delivered_today ?? '—'} note={dashboardLoading?'Loading activity':`${dashboard?.reminders_today ?? '—'} reminders scheduled today`} tone="blue"/><Metric icon={CircleAlert} label="Needs attention" number={dashboardLoading?'—':dashboard?.needs_attention ?? '—'} note="patient replies marked not taken" tone="amber" alert={dashboard?.needs_attention > 0}/></div>
        <div className="content-grid"><section className="panel reminders-panel"><div className="panel-heading"><div><h2>Today's reminders</h2><p>Live medication reminder activity for this clinic</p></div><button className="text-link" onClick={() => navigate(pathFor("Medication schedules"))}>View all <ArrowUpRight size={14}/></button></div><div className="reminder-summary"><span><i className="legend-dot teal-dot"/> {dashboardLoading?'—':dashboard?.reminders_today ?? '—'} scheduled</span><span><i className="legend-dot gray-dot"/> {dashboardLoading?'—':dashboard?.delivered_today ?? '—'} delivered</span></div><div className="reminder-list">{(dashboard?.reminders || []).map(reminder=><div className="reminder-row" key={reminder.id}><div className="avatar avatar-mint">{reminder.patient_name.slice(0,2).toUpperCase()}</div><div className="reminder-person"><b>{reminder.patient_name}</b><span>Medication reminder - {reminder.medicine_name}</span></div><span className="reminder-time">{new Date(reminder.scheduled_for).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span><span className={`status status-${reminder.status.replaceAll('_','-')}`}><i/>{reminder.status.replaceAll('_',' ')}</span></div>)}{dashboardLoading && <div className="empty-row">Loading reminders...</div>}{dashboardError && <div className="empty-row">Reminder data is unavailable.</div>}{dashboard && dashboard.reminders.length===0 && <div className="empty-row">No reminders scheduled today.</div>}</div><button className="panel-footer" onClick={() => navigate(pathFor("Medication schedules"))}>See reminder activity <ArrowUpRight size={14}/></button></section>
          <section className="panel response-panel"><div className="panel-heading"><div><h2>Patient responses today</h2><p>Recorded from WhatsApp reminder replies</p></div><button className="text-link" onClick={() => navigate(pathFor("WhatsApp messages"))}>View activity <ArrowUpRight size={14}/></button></div><div className="response-total"><b>{dashboardLoading||dashboardError?'-':dashboard?.responses_today ?? 0}</b><span>responses today</span></div><div className="bar-row"><span>Needs attention</span><div className="bar-track amber-track"><i style={{width: `${dashboard?.responses_today ? Math.round(dashboard.needs_attention/dashboard.responses_today*100) : 0}%`}}/></div><b>{dashboardLoading||dashboardError?'-':dashboard?.needs_attention ?? 0}</b></div><div className="review-note"><div><CircleAlert size={17}/></div><span><b>{dashboardLoading||dashboardError?'-':dashboard?.needs_attention ?? 0} replies marked not taken</b><small>Counts reflect this clinic's recorded patient responses.</small></span></div><button className="panel-footer" onClick={() => navigate(pathFor("WhatsApp messages"))}>Review patient responses <ArrowUpRight size={14}/></button></section></div>
        <div className="bottom-grid"><section className="panel health-panel"><div className="panel-heading"><div><h2>WhatsApp connection</h2><p>Saved API credentials</p></div><button className="small-more icon-button" aria-label="Connection options"><MoreHorizontal size={19}/></button></div><div className="connection-status"><div className="connection-icon"><MessageCircle size={19}/></div><div><b>{whatsapp?.connected?"Credentials saved":"Setup required"}</b><span>{whatsapp?.display_phone_number||"Connect a clinic WhatsApp account in settings"}</span></div><span className={`connected-pill ${whatsapp?.connected?"":"disconnected-pill"}`}><i/> {whatsapp?.connected?"Saved":"Not connected"}</span></div><div className="health-foot"><span><CircleCheck size={15}/> Send a test to check delivery</span><button onClick={() => navigate(pathFor("WhatsApp settings"))}>Settings <ArrowUpRight size={13}/></button></div></section></div>
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
      if(!response.ok)throw new Error(errorText(result.detail));
      onLogin(result);
    } catch (err) { setError(err.message==='Failed to fetch'?'Cannot reach the server. Start the backend, then try again.':err.message); }
    finally { setBusy(false); }
  };
  return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span className="brand-icon"><Activity size={21}/></span><div><b>careloop</b><small>CLINIC WORKSPACE</small></div></div><p className="eyebrow">SECURE SIGN IN</p><h1>Welcome back</h1><p className="auth-intro">Sign in with your platform administrator or clinic account.</p><form onSubmit={submit}><label htmlFor="login-email">Email address or phone number<input id="login-email" name="username" required type="text" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)}/></label><label htmlFor="login-password">Password<div className="password-input-wrap"><input id="login-password" name="password" required type={showPassword?'text':'password'} autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/><button className="password-visibility" type="button" onClick={()=>setShowPassword(current=>!current)} aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} title={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'Signing in...':'Sign in'}</button></form><small className="auth-footnote">Clinic accounts are created by the Careloop platform administrator or clinic admin.</small></section></main>;
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
        <section className="metric-card"><div className="metric-label">Active clinics</div><div className="metric-number">{clinics.filter(item=>item.status==='active').length}</div></section>
        <section className="metric-card"><div className="metric-label">Clinic administrators</div><div className="metric-number">{clinics.filter(item=>item.admin_email && item.admin_email!=='Not assigned').length}</div></section>
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
function Metric({icon:Icon,label,number,note,tone,alert}) {return <section className="metric-card"><div className="metric-top"><span className={`metric-icon icon-${tone}`}><Icon size={18}/></span>{alert&&<span className="attention-label"><CircleAlert size={13}/></span>}</div><div className="metric-number">{number}</div><div className="metric-label">{label}</div><div className="metric-note">{note}</div></section>}
function PatientsPage({auth,patients,onSave,onAppointmentCreated,clinicTimezone='Asia/Kolkata',loading,error}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query,setQuery] = useState('');
  const isNew = location.pathname === '/patients/new';
  const patientId = !isNew && location.pathname.startsWith('/patients/') ? location.pathname.slice('/patients/'.length) : null;
  const selected = patients.find(patient=>patient.id===patientId);
  const blank = {name:'',age:'',gender:'',phone:'',language:'English',consent:false,active:true,medications:[]};
  const [form,setForm] = useState(blank);
  const [phoneError,setPhoneError] = useState('');
  const [formError,setFormError] = useState('');
  const [saving,setSaving] = useState(false);
  const [appointmentForm,setAppointmentForm] = useState({title:'Follow-up consultation',starts_at:'',reminder_minutes_before:''});
  const [appointmentSaving,setAppointmentSaving] = useState(false);
  const [appointmentError,setAppointmentError] = useState('');
  const [appointmentNotice,setAppointmentNotice] = useState('');
  useEffect(()=>{setForm(selected ? {...selected,medications:(selected.medications||[]).map(item=>({id:item.id,name:item.name||'',frequency:item.frequency||'',foodTiming:item.foodTiming||'',durationDays:item.durationDays||'',reminderTimes:item.reminderTimes||[]}))} : blank);setPhoneError('');setFormError('');},[location.pathname,selected?.id]);
  const editing = Boolean(selected);
  const update = (field,value) => setForm(current=>({...current,[field]:value}));
  const updateMedication = (index,field,value) => setForm(current=>({...current,medications:current.medications.map((item,i)=>i===index?{...item,[field]:value}:item)}));
  const updateReminderTime = (index,timeIndex,value) => setForm(current=>({...current,medications:current.medications.map((item,i)=>i===index?{...item,reminderTimes:item.reminderTimes.map((time,j)=>j===timeIndex?value:time)}:item)}));
  const schedulePatientAppointment = async event => {
    event.preventDefault();setAppointmentSaving(true);setAppointmentError('');setAppointmentNotice('');
    try {
      const response=await fetch(`${API_BASE}/api/clinic/appointments`,{method:'POST',headers:{Authorization:`Bearer ${auth.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({patient_id:selected.id,title:appointmentForm.title,starts_at:appointmentForm.starts_at,notes:'',reminder_minutes_before:appointmentForm.reminder_minutes_before===''?null:Number(appointmentForm.reminder_minutes_before)})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.detail||'Could not schedule this appointment.');
      onAppointmentCreated(selected.id,result);
      setAppointmentNotice('Appointment saved. It is also listed in Appointments.');
      setAppointmentForm(current=>({...current,starts_at:''}));
    } catch(err) {setAppointmentError(err.message);}
    finally {setAppointmentSaving(false);}
  };
  const addPresetReminderTime = (index,value) => setForm(current=>({...current,medications:current.medications.map((item,i)=>{
    if(i!==index||item.reminderTimes.includes(value)) return item;
    const times=item.reminderTimes.filter(Boolean);
    return {...item,reminderTimes:[...times,value]};
  })}));
  const filtered = patients.filter(patient=>`${patient.name} ${patient.phone}`.toLowerCase().includes(query.toLowerCase()));
    const submit = async event => {event.preventDefault();const phone=form.phone.replace(/\D/g,'');if(!/^\d{10}$/.test(phone)){setPhoneError('Enter a valid 10 digit mobile number.');return;}setPhoneError('');setFormError('');setSaving(true);try{await onSave({...form,phone});navigate('/patients');}catch(err){setFormError(err.message||'Could not save patient.');}finally{setSaving(false);}};
  if (location.pathname !== '/patients' && !selected && !isNew) return <div className="patients-page"><button className="text-link" onClick={()=>navigate('/patients')}>Back to patients</button><section className="panel patient-form-panel"><h2>Patient not found</h2><p>This patient may have been removed from this browser session.</p></section></div>;
  if (isNew || editing) return <div className="patients-page">
    <button className="back-link" onClick={()=>navigate('/patients')}>Back to patients</button>
    <div className="welcome-row patient-title-row"><div><div className="eyebrow"><span className="live-dot"/> PATIENT MANAGEMENT</div><h1>{editing?'Edit patient':'Add patient'}</h1><p>Record patient details and clinician-approved reminder information.</p></div></div>
    <div className="demo-notice"><CircleAlert size={16}/><span>Patient and medication schedules save to this clinic. WhatsApp reminders send only after recorded consent, a connected WhatsApp account, and an approved reminder template are configured.</span></div>
    <form className="panel patient-form-panel" onSubmit={submit}>
      <div className="form-section-heading"><h2>Patient details</h2><p>Collect only information needed for clinic communication.</p></div>
      <div className="patient-fields"><label>Patient name<input required maxLength={160} value={form.name} onChange={event=>update('name',event.target.value)} placeholder="Full name"/></label><label>Age<input type="number" min="0" max="120" value={form.age??''} onChange={event=>update('age',event.target.value)} placeholder="Age in years"/></label><label>Gender<select value={form.gender||''} onChange={event=>update('gender',event.target.value)}><option value="">Select gender</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select></label><label>WhatsApp number<input required inputMode="numeric" maxLength={10} value={localPhone(form.phone)} onChange={event=>{update('phone',event.target.value.replace(/\D/g,'').slice(0,10));setPhoneError('');}} aria-invalid={Boolean(phoneError)} aria-describedby="phone-validation" placeholder="9876543210"/><small id="phone-validation" className={phoneError?'field-error':''}>{phoneError||'Enter the 10 digit mobile number.'}</small></label><label>Preferred language<select value={form.language} onChange={event=>update('language',event.target.value)}><option>English</option><option>Hindi</option><option>Marathi</option><option>Tamil</option><option>Other</option></select></label></div>
      {editing&&<><section className="patient-next-appointment"><div><b>Next appointment</b><span>{selected.nextAppointment?`${selected.nextAppointment.title} · ${clinicDateTimeLabel(selected.nextAppointment.starts_at,clinicTimezone)}`:'No upcoming appointment scheduled'}</span><small>{selected.nextAppointment?.reminder_status==='sent'?'WhatsApp reminder sent':selected.nextAppointment?.reminder_status==='pending'?'Appointment reminder is scheduled':selected.nextAppointment?.reminder_status==='failed'?'Appointment reminder failed to send':''}</small></div><button type="button" className="secondary-button" onClick={()=>navigate(`/appointments?${new URLSearchParams({patient:selected.id,return:location.pathname})}`)}>View calendar</button></section><section className="patient-appointment-editor"><div className="form-section-heading"><h2>Add next appointment</h2><p>It will also appear in the clinic calendar.</p></div><div className="patient-fields appointment-inline-fields"><label>Appointment type<input required minLength="2" maxLength="160" value={appointmentForm.title} onChange={event=>setAppointmentForm(current=>({...current,title:event.target.value}))}/></label><label>Date and time<input required type="datetime-local" min={clinicDateTimeInput(new Date(),clinicTimezone)} value={appointmentForm.starts_at} onChange={event=>setAppointmentForm(current=>({...current,starts_at:event.target.value}))}/></label><label>WhatsApp confirmation alert<select value={appointmentForm.reminder_minutes_before} onChange={event=>setAppointmentForm(current=>({...current,reminder_minutes_before:event.target.value}))}><option value="">No reminder</option><option value="1440">24 hours before</option><option value="60">1 hour before</option><option value="30">30 minutes before</option></select></label></div>{!selected.consent&&appointmentForm.reminder_minutes_before!==''&&<p className="field-error">Record the patient's WhatsApp reminder consent before requesting a reminder.</p>}{appointmentError&&<p className="auth-error" role="alert">{appointmentError}</p>}{appointmentNotice&&<p className="auth-success" role="status">{appointmentNotice}</p>}<button type="button" className="primary-button" disabled={appointmentSaving||(!selected.consent&&appointmentForm.reminder_minutes_before!=='')} onClick={schedulePatientAppointment}>{appointmentSaving?'Saving appointment...':'Save appointment'}</button></section></>}
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
    {error&&<p className="auth-error" role="alert">{error}</p>}
    <div className="metric-grid section-metrics"><section className="metric-card"><div className="metric-label">Patients in this clinic</div><div className="metric-number">{loading||error?'—':patients.length}</div></section><section className="metric-card"><div className="metric-label">Consent recorded</div><div className="metric-number">{loading||error?'—':patients.filter(patient=>patient.consent).length}</div></section><section className="metric-card"><div className="metric-label">Active patients</div><div className="metric-number">{loading||error?'—':patients.filter(patient=>patient.active).length}</div></section></div>
    <section className="panel section-table-panel"><div className="panel-heading"><div><h2>Patient directory</h2><p>Select a patient row to edit their details</p></div><label className="section-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search patients..." aria-label="Search patients"/></label></div>
      <div className="table-scroll"><table className="workspace-table patient-table"><thead><tr><th>Patient</th><th>Age</th><th>Gender</th><th>WhatsApp number</th><th>Language</th><th>Consent</th><th>Medication entries</th><th>Next appointment</th></tr></thead><tbody>{filtered.map(patient=><tr className="clickable-patient-row" tabIndex={0} key={patient.id} onClick={()=>navigate(`/patients/${patient.id}`)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();navigate(`/patients/${patient.id}`);}}}><td>{patient.name}</td><td>{patient.age??'Not recorded'}</td><td>{patient.gender||'Not recorded'}</td><td>{localPhone(patient.phone)}</td><td>{patient.language}</td><td><span className={`table-status ${patient.consent?'active':'needs-setup'}`}>{patient.consent?'Consent recorded':'No consent'}</span></td><td>{patient.medications.length}</td><td>{patient.nextAppointment?<>{clinicDateTimeLabel(patient.nextAppointment.starts_at,clinicTimezone)} <button type="button" className="text-link" onClick={event=>{event.stopPropagation();navigate(`/appointments/day/${clinicDateKey(patient.nextAppointment.starts_at,clinicTimezone)}`);}}>View</button></>:<button type="button" className="text-link" onClick={event=>{event.stopPropagation();navigate(`/appointments/new?${new URLSearchParams({patient:patient.id,date:clinicDateKey(new Date(),clinicTimezone),return:'/patients'})}`);}}>Schedule</button>}</td></tr>)}{loading&&<tr><td className="empty-row" colSpan="8">Loading patients...</td></tr>}{!loading&&!error&&filtered.length===0&&<tr><td className="empty-row" colSpan="8">No matching patients. Add a patient to get started.</td></tr>}</tbody></table></div>
    </section>
    <footer className="page-footer"><span>Copyright 2026 Careloop Health</span><span>Clinic records</span><button>Privacy & security</button></footer>
  </div>;
}

function AppointmentsPage({auth,patients,onSavePatient,onAppointmentCreated,onPatientDataChanged,clinic,clinicTimezone='Asia/Kolkata'}) {
  const location=useLocation();
  const navigate=useNavigate();
  const params=new URLSearchParams(location.search);
  const preferredPatient=params.get('patient')||'';
  const requestedReturn=params.get('return')||'';
  const returnTo=requestedReturn.startsWith('/')&&!requestedReturn.startsWith('//')?requestedReturn:'/patients';
  const isAddPage=location.pathname==='/appointments/new';
  const selectedDayRoute=location.pathname.match(/^\/appointments\/day\/(\d{4}-\d{2}-\d{2})$/)?.[1]||'';
  const isDayView=Boolean(selectedDayRoute);
  const todayKey=clinicDateKey(new Date(),clinicTimezone);
  const [month,setMonth]=useState((params.get('date')||todayKey).slice(0,7));
  const [selectedDate,setSelectedDate]=useState(params.get('date')||todayKey);
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [patientMode,setPatientMode]=useState('existing');
  const [patientSearch,setPatientSearch]=useState('');
  const [patientPickerOpen,setPatientPickerOpen]=useState(false);
  const [showTimeSlots,setShowTimeSlots]=useState(false);
  const [daySlots,setDaySlots]=useState(null);
  const [slotsLoading,setSlotsLoading]=useState(false);
  const [slotsSaving,setSlotsSaving]=useState(false);
  const [newPatient,setNewPatient]=useState({name:'',age:'',gender:'',phone:'',consent:false});
  const [form,setForm]=useState({patient_id:preferredPatient,title:'Follow-up consultation',starts_at:'',duration_minutes:null,notes:'',reminder_minutes_before:''});
  const request=async(url,options={})=>{
    const response=await fetch(`${API_BASE}${url}`,{...options,headers:{Authorization:`Bearer ${auth.access_token}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
    const result=response.status===204?null:await response.json();
    if(!response.ok)throw new Error(typeof result?.detail==='string'?result.detail:'Could not complete the appointment request.');
    return result;
  };
  const load=async()=>{
    setLoading(true);setError('');
    try {
      const query=new URLSearchParams({month:selectedDayRoute?selectedDayRoute.slice(0,7):month});
      setRows(await request(`/api/clinic/appointments?${query}`));
    } catch(err) {setError(err.message);}
    finally {setLoading(false);}
  };
  const loadDaySlots=async()=>{
    if(!selectedDayRoute)return;
    setSlotsLoading(true);
    try {setDaySlots(await request(`/api/clinic/appointments/slots?local_date=${selectedDayRoute}`));}
    catch(err) {setError(err.message);setDaySlots(null);}
    finally {setSlotsLoading(false);}
  };
  useEffect(()=>{load();},[auth.access_token,selectedDayRoute,month]);
  useEffect(()=>{if(showTimeSlots&&isDayView)loadDaySlots();},[showTimeSlots,selectedDayRoute,auth.access_token]);
  useEffect(()=>{
    if(selectedDayRoute){setSelectedDate(selectedDayRoute);setMonth(selectedDayRoute.slice(0,7));}
    else if(params.get('date')){setSelectedDate(params.get('date'));setMonth(params.get('date').slice(0,7));}
    if(preferredPatient){setForm(current=>({...current,patient_id:preferredPatient}));setPatientMode('existing');}
    if(isAddPage){
      const appointmentDate=params.get('date')||todayKey;
      const selectedTime=params.get('time');
      const selectedDuration=Number(params.get('duration'));
      setSelectedDate(appointmentDate);
      setForm(current=>({...current,patient_id:preferredPatient||current.patient_id,starts_at:selectedTime?`${appointmentDate}T${selectedTime}`:current.starts_at.startsWith(`${appointmentDate}T`)?current.starts_at:`${appointmentDate}T09:00`,duration_minutes:[3,5,10,15].includes(selectedDuration)?selectedDuration:null}));
    }
  },[location.pathname,location.search,patients.length]);
  const effectiveMonth=selectedDayRoute?selectedDayRoute.slice(0,7):month;
  const shiftMonth=(offset)=>{
    const [year,monthNumber]=effectiveMonth.split('-').map(Number);
    const value=new Date(year,monthNumber-1+offset,1);
    const nextMonth=`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}`;
    setMonth(nextMonth);setSelectedDate(`${nextMonth}-01`);navigate(`/appointments?date=${nextMonth}-01`);
  };
  const firstOfMonth=new Date(`${effectiveMonth}-01T12:00:00`);
  const daysInMonth=new Date(firstOfMonth.getFullYear(),firstOfMonth.getMonth()+1,0).getDate();
  const firstWeekday=new Date(firstOfMonth.getFullYear(),firstOfMonth.getMonth(),1).getDay();
  const calendarCells=[...Array(firstWeekday).fill(null),...Array.from({length:daysInMonth},(_,index)=>index+1)];
  const countsByDate=rows.reduce((counts,row)=>{const key=clinicDateKey(row.starts_at,clinicTimezone);counts[key]=(counts[key]||0)+1;return counts;},{});
  const dayRows=rows.filter(row=>clinicDateKey(row.starts_at,clinicTimezone)===selectedDate);
  const selectedPatient=patients.find(patient=>patient.id===form.patient_id);
  const normalizedPatientQuery=patientSearch.trim().toLocaleLowerCase();
  const normalizedPhoneQuery=normalizedPatientQuery.replace(/\D/g,'');
  const matchingPatients=patients.filter(patient=>
    !normalizedPatientQuery || patient.name.toLocaleLowerCase().includes(normalizedPatientQuery) ||
    (normalizedPhoneQuery && patient.phone.replace(/\D/g,'').includes(normalizedPhoneQuery))
  );
  const patientOptionLabel=patient=>`${patient.name}${patient.age!==null&&patient.age!==undefined?` · age ${patient.age}`:''} · ${localPhone(patient.phone)}`;
  const duplicatePatient=patientMode==='new'?patients.find(patient=>patient.name.trim().toLocaleLowerCase()===newPatient.name.trim().toLocaleLowerCase()&&localPhone(patient.phone)===localPhone(newPatient.phone)):null;
  const openAddForm=(date=selectedDate)=>navigate(`/appointments/new?${new URLSearchParams({date,...(preferredPatient?{patient:preferredPatient}:{}),...(requestedReturn?{return:requestedReturn}:{})})}`);
  const updateSlotsPerHour=async slots_per_hour=>{
    setSlotsSaving(true);setError('');
    try {
      await request('/api/clinic/appointments/settings',{method:'PUT',body:JSON.stringify({local_date:selectedDayRoute,slots_per_hour})});
      await loadDaySlots();
    } catch(err) {setError(err.message);}
    finally {setSlotsSaving(false);}
  };
  const chooseTimeSlot=slot=>navigate(`/appointments/new?${new URLSearchParams({date:selectedDayRoute,time:slot.local_time,duration:String(slot.duration_minutes),...(preferredPatient?{patient:preferredPatient}:{})})}`);
  const submit=async event=>{
    event.preventDefault();setSaving(true);setError('');setNotice('');
    try {
      let patient=patients.find(item=>item.id===form.patient_id);
      if(patientMode==='new'){
        patient=await onSavePatient({...newPatient,age:Number(newPatient.age),gender:newPatient.gender,phone:newPatient.phone.trim(),language:'English',active:true,medications:[]});
        setPatientMode('existing');setForm(current=>({...current,patient_id:patient.id}));
      }
      if(!patient)throw new Error('Choose an existing patient or enter the new patient details.');
      if(form.reminder_minutes_before!==''&&!patient.consent)throw new Error('WhatsApp confirmation needs the patient\'s recorded consent.');
      const payload={...form,patient_id:patient.id,reminder_minutes_before:form.reminder_minutes_before===''?null:Number(form.reminder_minutes_before)};
      const created=await request('/api/clinic/appointments',{method:'POST',body:JSON.stringify(payload)});
      onAppointmentCreated?.(patient.id,created);
      navigate(`/appointments/day/${clinicDateKey(created.starts_at,clinicTimezone)}`);
    } catch(err) {setError(err.message);}
    finally {setSaving(false);}
  };
  const updateStatus=async(appointment,status)=>{
    setError('');
    try {const result=await request(`/api/clinic/appointments/${appointment.id}`,{method:'PATCH',body:JSON.stringify({status})});setRows(current=>current.map(row=>row.id===result.id?{...row,...result}:row));if(showTimeSlots)await loadDaySlots();await onPatientDataChanged?.();}
    catch(err) {setError(err.message);}
  };
  const updateAttendance=async(appointment,attendance_status)=>{
    setError('');
    try {const result=await request(`/api/clinic/appointments/${appointment.id}`,{method:'PATCH',body:JSON.stringify({attendance_status})});setRows(current=>current.map(row=>row.id===result.id?{...row,...result}:row));}
    catch(err) {setError(err.message);}
  };
  const isPastSelectedDate=selectedDate<todayKey;
  const registered=dayRows.filter(row=>row.status!=='cancelled');
  const overlappingAppointmentIds=new Set();
  for(let first=0;first<dayRows.length;first++)for(let second=first+1;second<dayRows.length;second++){
    const a=dayRows[first],b=dayRows[second];
    if(!['scheduled','confirmed'].includes(a.status)||!['scheduled','confirmed'].includes(b.status))continue;
    const aStart=new Date(a.starts_at).getTime(),bStart=new Date(b.starts_at).getTime();
    if(aStart<bStart+(b.duration_minutes||15)*60000&&bStart<aStart+(a.duration_minutes||15)*60000){overlappingAppointmentIds.add(a.id);overlappingAppointmentIds.add(b.id);}
  }
  const attended=registered.filter(row=>row.attendance_status==='attended').length;
  const missed=registered.filter(row=>row.attendance_status==='missed').length;
  const coming=registered.filter(row=>row.confirmation_status==='coming').length;
  const notComing=registered.filter(row=>row.confirmation_status==='not_coming').length;
  const awaiting=registered.filter(row=>['pending','sent','delivered','read'].includes(row.confirmation_status)).length;
  const confirmationNotRequested=registered.filter(row=>row.confirmation_status==='not_requested').length;
  if(isAddPage)return <div className="workspace-page appointment-create-page">
    <button className="back-link" onClick={()=>navigate(requestedReturn?returnTo:`/appointments/day/${selectedDate}`)}>{requestedReturn?'Back':'Back to selected date'}</button>
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> APPOINTMENT MANAGEMENT</div><h1>Add appointment</h1><p>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div></div>
    <section className="panel patient-form-panel"><div className="form-section-heading"><h2>Choose patient</h2><p>Use a registered patient or add a new patient. Family members may share a mobile number.</p></div>
      <div className="appointment-patient-tabs"><button type="button" className={patientMode==='existing'?'selected-tab':''} onClick={()=>{setPatientMode('existing');setPatientPickerOpen(false);setError('');}}>Existing patient</button><button type="button" className={patientMode==='new'?'selected-tab':''} onClick={()=>{setPatientMode('new');setPatientPickerOpen(false);setForm(current=>({...current,patient_id:''}));setError('');}}>New patient</button></div>
      <form className="admin-create-form" onSubmit={submit}>
        {patientMode==='existing'?<label>Patient<div className="appointment-patient-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPatientPickerOpen(false);}}><input type="search" role="combobox" aria-expanded={patientPickerOpen} aria-controls="appointment-patient-options" aria-autocomplete="list" autoComplete="off" required={!form.patient_id} placeholder="Search by name or phone number" value={patientPickerOpen?patientSearch:(selectedPatient?patientOptionLabel(selectedPatient):patientSearch)} onFocus={()=>{setPatientPickerOpen(true);if(selectedPatient)setPatientSearch('');}} onChange={event=>{setPatientSearch(event.target.value);setForm(current=>({...current,patient_id:''}));setPatientPickerOpen(true);}}/>{patientPickerOpen&&<div className="appointment-patient-options" id="appointment-patient-options" role="listbox">{matchingPatients.length?matchingPatients.map(patient=><button type="button" role="option" aria-selected={form.patient_id===patient.id} key={patient.id} onMouseDown={event=>event.preventDefault()} onClick={()=>{setForm(current=>({...current,patient_id:patient.id}));setPatientSearch('');setPatientPickerOpen(false);}}>{patientOptionLabel(patient)}</button>):<div className="appointment-patient-empty">{patients.length?'No patients match that name or phone number.':'No patients yet. Choose New patient to register one.'}</div>}</div>}</div></label>:<><div className="patient-fields appointment-new-patient-fields"><label>Patient name<input required maxLength={160} value={newPatient.name} onChange={event=>setNewPatient(current=>({...current,name:event.target.value}))}/></label><label>Age<input required type="number" min="0" max="120" value={newPatient.age} onChange={event=>setNewPatient(current=>({...current,age:event.target.value}))}/></label><label>Gender<select required value={newPatient.gender} onChange={event=>setNewPatient(current=>({...current,gender:event.target.value}))}><option value="">Select gender</option><option value="Female">Female</option><option value="Male">Male</option><option value="Other">Other</option><option value="Prefer not to say">Prefer not to say</option></select></label><label>Mobile number<input required type="tel" inputMode="tel" maxLength={10} placeholder="9876543210" value={newPatient.phone} onChange={event=>setNewPatient(current=>({...current,phone:event.target.value.replace(/\D/g,'').slice(0,10)}))}/><small>Enter the 10 digit mobile number.</small></label><label className="appointment-consent"><input type="checkbox" checked={newPatient.consent} onChange={event=>setNewPatient(current=>({...current,consent:event.target.checked}))}/> Patient has consented to WhatsApp reminders</label></div>{duplicatePatient&&<div className="appointment-duplicate-match" role="status"><span>{duplicatePatient.name} is already registered with this mobile number.</span><button type="button" className="text-link" onClick={()=>{setForm(current=>({...current,patient_id:duplicatePatient.id}));setPatientMode('existing');setError('');}}>Use existing patient</button></div>}</>}
        <div className="form-section-heading appointment-form-subheading"><h2>Appointment details</h2></div>
        <label>Appointment type<input required minLength="2" maxLength="160" value={form.title} onChange={event=>setForm(current=>({...current,title:event.target.value}))}/></label>
        <label>Date and time<input required type="datetime-local" min={clinicDateTimeInput(new Date(),clinicTimezone)} value={form.starts_at} onChange={event=>setForm(current=>({...current,starts_at:event.target.value,duration_minutes:null}))}/></label>
        <label>WhatsApp confirmation alert<select value={form.reminder_minutes_before} onChange={event=>setForm(current=>({...current,reminder_minutes_before:event.target.value}))}><option value="">No alert</option><option value="1440">24 hours before</option><option value="60">1 hour before</option><option value="30">30 minutes before</option></select><small>An approved appointment template and patient consent are required.</small></label>
        {patientMode==='existing'&&form.reminder_minutes_before!==''&&!selectedPatient?.consent&&<p className="auth-error">This patient has no recorded WhatsApp consent. Record consent before requesting an alert.</p>}
        <label>Notes<textarea maxLength={2000} value={form.notes} onChange={event=>setForm(current=>({...current,notes:event.target.value}))} rows="3"/></label>
        {error&&<p className="auth-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={saving||(patientMode==='existing'&&patients.length===0)||Boolean(duplicatePatient)||(form.reminder_minutes_before!==''&&(patientMode==='new'?!newPatient.consent:!selectedPatient?.consent))}>{saving?(patientMode==='new'?'Saving patient and appointment...':'Saving appointment...'):patientMode==='new'?'Create patient and appointment':'Save appointment'}</button>
      </form>
    </section>
  </div>;
  return <div className="workspace-page">
    {!isDayView?<><div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CLINIC WORKSPACE</div><h1>Appointments</h1><p>Choose a date to view its appointments and attendance.</p></div><button className="primary-button" onClick={()=>openAddForm(todayKey)}>+ Add appointment</button></div>
      <div className="demo-notice"><CalendarDays size={16}/><span>WhatsApp confirmations require patient consent, a connected clinic WhatsApp account, and an approved appointment_reminder Utility template with body fields for patient name, appointment type, and date/time plus Coming and Not coming quick replies.</span></div>
      {error&&<p className="auth-error" role="alert">{error}</p>}
      <section className="panel appointment-calendar-panel">
        <div className="appointment-calendar-heading"><button className="secondary-button" onClick={()=>shiftMonth(-1)}>Previous</button><h2>{firstOfMonth.toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</h2><div className="appointment-calendar-actions"><input type="month" value={effectiveMonth} onChange={event=>{if(event.target.value){setMonth(event.target.value);setSelectedDate(`${event.target.value}-01`);navigate(`/appointments?date=${event.target.value}-01`);}}} aria-label="Select appointment month"/><button className="secondary-button" onClick={()=>shiftMonth(1)}>Next</button></div></div>
        <div className="appointment-calendar-grid">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><div className="appointment-weekday" key={day}>{day}</div>)}{calendarCells.map((day,index)=>{if(!day)return <div className="appointment-calendar-blank" key={`blank-${index}`}/>;const key=`${effectiveMonth}-${String(day).padStart(2,'0')}`;const count=countsByDate[key]||0;return <button type="button" key={key} className={`appointment-calendar-day ${selectedDate===key?'selected-day':''} ${key===todayKey?'today-day':''} ${count?'has-appointments':''}`} aria-label={`${key}, ${count} appointments`} onClick={()=>navigate(`/appointments/day/${key}`)}><span>{day}</span>{count>0&&<small>{count} appointment{count===1?'':'s'}</small>}</button>;})}</div>
        <div className="appointment-calendar-legend"><span><i className="calendar-today-dot"/> Today</span><span>Select a day to open its appointment dashboard.</span></div>
      </section>
    </>:<><button className="back-link" onClick={()=>navigate(`/appointments?date=${selectedDate}`)}>Back to calendar</button>
      <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> SELECTED DATE</div><h1>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h1><p>{registered.length} registered appointment{registered.length===1?'':'s'}</p></div><button className="primary-button" onClick={()=>openAddForm(selectedDate)}>+ Add appointment</button></div>
      <div className="demo-notice"><CalendarDays size={16}/><span>{isPastSelectedDate?'Mark each registered patient as attended or missed.':'Coming and Not coming totals update from WhatsApp replies when a confirmation alert was requested.'}</span></div>
      <label className="appointment-time-toggle"><input type="checkbox" checked={showTimeSlots} onChange={event=>setShowTimeSlots(event.target.checked)}/> Show time slots</label>
      {showTimeSlots&&<section className="panel appointment-slot-panel"><div className="appointment-slot-heading"><div><h2>Available appointment times</h2><p>{clinic?.opening_time||'08:00'}–{clinic?.closing_time||'20:00'} clinic hours · green is available, red is booked</p></div><div className="appointment-slot-presets" aria-label="Appointments per hour">{[4,6,12,20].map(count=><button type="button" key={count} className={daySlots?.slots_per_hour===count?'selected-slot-preset':''} disabled={slotsSaving||slotsLoading} onClick={()=>updateSlotsPerHour(count)}>{count}</button>)}</div></div>{slotsLoading?<p className="appointment-patient-empty">Loading time slots...</p>:daySlots?.hours.map(group=><details className="appointment-slot-hour" key={group.hour}><summary>{group.label}</summary><div className="appointment-slot-grid">{group.slots.map(slot=><button type="button" key={slot.local_time} disabled={!slot.available} className={`appointment-slot ${slot.available?'slot-available':'slot-booked'}`} onClick={()=>chooseTimeSlot(slot)}><b>{clockLabel(slot.local_time)}</b><small>{slot.available?'Available':slot.past?'Time passed':`Booked${slot.patient_name?` · ${slot.patient_name}`:''}`}</small></button>)}</div></details>)}</section>}
      {error&&<p className="auth-error" role="alert">{error}</p>}
      <section className="panel section-table-panel appointment-day-panel">
        <div className="panel-heading"><div><h2>{isPastSelectedDate?'Attendance summary':'Confirmation summary'}</h2><p>{registered.length} registered{dayRows.length!==registered.length?` ? ${dayRows.length-registered.length} cancelled`:''}</p></div><button className="secondary-button" onClick={()=>openAddForm(selectedDate)}>+ Add appointment for this date</button></div>
        <div className="metric-grid section-metrics appointment-day-metrics">{isPastSelectedDate?<><section className="metric-card"><div className="metric-label">Registered</div><div className="metric-number">{registered.length}</div></section><section className="metric-card"><div className="metric-label">Attended</div><div className="metric-number">{attended}</div></section><section className="metric-card"><div className="metric-label">Missed</div><div className="metric-number">{missed}</div></section><section className="metric-card"><div className="metric-label">Not marked</div><div className="metric-number">{registered.length-attended-missed}</div></section></>:<><section className="metric-card"><div className="metric-label">Registered</div><div className="metric-number">{registered.length}</div></section><section className="metric-card"><div className="metric-label">Coming</div><div className="metric-number">{coming}</div></section><section className="metric-card"><div className="metric-label">Not coming</div><div className="metric-number">{notComing}</div></section><section className="metric-card"><div className="metric-label">Awaiting reply</div><div className="metric-number">{awaiting}</div></section><section className="metric-card"><div className="metric-label">Alert not requested</div><div className="metric-number">{confirmationNotRequested}</div></section></>}</div>
        <div className="table-scroll"><table className="workspace-table appointment-attendance-table"><thead><tr><th>Time</th><th>Patient</th><th>Appointment</th><th>Notes</th><th>{isPastSelectedDate?'Attendance':'WhatsApp reply'}</th><th>Appointment status</th></tr></thead><tbody>{dayRows.map(row=><tr key={row.id}><td>{clinicDateTimeLabel(row.starts_at,clinicTimezone)}</td><td>{row.patient_name}</td><td>{row.title}{overlappingAppointmentIds.has(row.id)&&<small className="appointment-overlap-warning">Time conflict</small>}</td><td>{row.notes||'?'}</td><td>{isPastSelectedDate?(row.status==='cancelled'?'Cancelled':<select aria-label={`Attendance for ${row.patient_name}`} value={row.attendance_status} onChange={event=>updateAttendance(row,event.target.value)}><option value="unmarked">Not marked</option><option value="attended">Attended</option><option value="missed">Missed</option></select>):row.status==='cancelled'?'Cancelled':row.confirmation_status==='coming'?'Coming':row.confirmation_status==='not_coming'?'Not coming':['pending','sent','delivered','read'].includes(row.confirmation_status)?'Awaiting reply':row.confirmation_status==='failed'?'Message failed':row.confirmation_status==='skipped'?'Skipped':'Not requested'}</td><td><select aria-label={`Appointment status for ${row.patient_name}`} value={row.status} onChange={event=>updateStatus(row,event.target.value)}><option value="scheduled">Scheduled</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></td></tr>)}{loading&&<tr><td colSpan="6" className="empty-row">Loading appointments...</td></tr>}{!loading&&!error&&dayRows.length===0&&<tr><td colSpan="6" className="empty-row">No appointments for this date. Use Add appointment to schedule one.</td></tr>}</tbody></table></div>
      </section>
    </>}
    <footer className="page-footer"><span>Clinic appointment management</span><span>{isDayView?'Selected date':'Month calendar'}</span></footer>
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
    <div className="demo-notice"><ShieldCheck size={16}/><span>Tokens are encrypted before they are saved. Use a system-user token for a durable connection; never paste tokens into chat or frontend environment files. Approve the medication_reminder template with Taken and Not taken replies, and the appointment_reminder template with Coming and Not coming replies.</span></div>
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
    {connection?.connected&&<section className="panel patient-form-panel"><div className="form-section-heading"><h2>Send a test message</h2><p>Sends Meta's approved hello_world template. With a test number, the recipient must first be added to the allowed test recipients in Meta.</p></div><form className="admin-create-form whatsapp-test-form" onSubmit={sendTest}><label>Recipient WhatsApp number<input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={recipient} onChange={event=>setRecipient(event.target.value)} placeholder="9876543210"/><small>Enter the 10 digit mobile number. Only use a number you control for this test.</small></label><button className="primary-button" disabled={busy}>{busy?'Sending...':'Send test template'}</button></form></section>}
    <footer className="page-footer"><span>WhatsApp Cloud API setup</span><span>Clinic account</span></footer>
  </div>;
}

function StaffPage({auth}) {
  const [members,setMembers] = useState([]);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [form,setForm] = useState({name:'',designation:'Receptionist',phone_e164:'',password:''});
  const request = async (url,options={}) => {
    const response=await fetch(`${API_BASE}${url}`,{...options,headers:{Authorization:`Bearer ${auth.access_token}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
    const result=response.status===204?null:await response.json();
    if(!response.ok)throw new Error(result?.detail||'Could not update clinic members.');
    return result;
  };
  const canManage = auth.user.role === 'clinic_admin';
  const loadMembers = async () => {
    if (!canManage) { setLoading(false); return; }
    setError('');
    try { setMembers(await request('/api/clinic/members')); }
    catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };
  useEffect(()=>{
    if (!canManage) return;
    loadMembers();
    const timer=window.setInterval(loadMembers,30*1000);
    return ()=>window.clearInterval(timer);
  },[auth.access_token,canManage]);
  const submit=async event=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const created=await request('/api/clinic/members',{method:'POST',body:JSON.stringify(form)});
      setNotice(`${created.name} was added. Share the password securely; their phone number is their sign-in ID.`);
      setForm({name:'',designation:'Receptionist',phone_e164:'',password:''});
      await loadMembers();
    } catch(err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const toggle=async member=>{
    setError('');
    try {
      const updated=await request(`/api/clinic/members/${member.id}?active=${!member.is_active}`,{method:'PATCH'});
      setMembers(current=>current.map(item=>item.id===updated.id?{...item,...updated}:item));
    } catch(err) { setError(err.message); }
  };
  if (!canManage) return <div className="workspace-page"><div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CLINIC WORKSPACE</div><h1>Staff &amp; permissions</h1><p>Only the clinic administrator can manage team accounts.</p></div></div></div>;
  return <div className="workspace-page">
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CLINIC WORKSPACE</div><h1>Staff &amp; permissions</h1><p>Add clinic team members and see who is currently online.</p></div><button className="secondary-button" onClick={loadMembers}>Refresh</button></div>
    <div className="demo-notice"><ShieldCheck size={16}/><span>Clinic admins create accounts with a phone number and password. Phone numbers are not OTP-verified. Designations are labels; added members share the same clinic-staff permissions.</span></div>
    {error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="auth-success" role="status">{notice}</p>}
    <section className="panel section-table-panel"><div className="panel-heading"><div><h2>Clinic team</h2><p>Online status updates while a member has this workspace open.</p></div></div><div className="table-scroll"><table className="workspace-table"><thead><tr><th>Member</th><th>Designation</th><th>Phone</th><th>Status</th><th>Access</th></tr></thead><tbody>
      {members.map(member=><tr key={member.id}><td>{member.name}</td><td>{member.designation}</td><td>{(member.phone_e164?localPhone(member.phone_e164):member.email)||'—'}</td><td><span className={`member-presence ${member.is_online?'member-online':''}`}><i/>{member.is_online?'Online':'Offline'}</span></td><td>{member.role==='clinic_admin'?<span className="table-status">Clinic admin</span>:<button className="secondary-button" onClick={()=>toggle(member)}>{member.is_active?'Deactivate':'Reactivate'}</button>}</td></tr>)}
      {loading&&<tr><td colSpan="5" className="empty-row">Loading clinic members...</td></tr>}{!loading&&members.length===0&&<tr><td colSpan="5" className="empty-row">No clinic members found yet.</td></tr>}
    </tbody></table></div></section>
    <section className="panel patient-form-panel"><div className="form-section-heading"><h2>Add a team member</h2><p>Create a receptionist, manager, doctor, or other clinic staff account.</p></div><form className="admin-create-form" onSubmit={submit}>
      <label>Full name<input required minLength="1" maxLength="160" value={form.name} onChange={event=>setForm(current=>({...current,name:event.target.value}))}/></label>
      <label>Designation<input required minLength="2" maxLength="80" value={form.designation} onChange={event=>setForm(current=>({...current,designation:event.target.value}))} placeholder="Receptionist, Manager, Nurse"/></label>
      <label>Phone number<input required inputMode="tel" pattern="[0-9]{10}" maxLength={10} value={form.phone_e164} onChange={event=>setForm(current=>({...current,phone_e164:event.target.value}))} placeholder="9876543210"/><small>Enter the 10 digit mobile number.</small></label>
      <label>Account password<input required type="password" minLength="12" maxLength="128" autoComplete="new-password" value={form.password} onChange={event=>setForm(current=>({...current,password:event.target.value}))}/><small>At least 12 characters. Share it securely with the member.</small></label>
      <button className="primary-button" disabled={busy}>{busy?'Adding member...':'Add member'}</button>
    </form></section>
    <footer className="page-footer"><span>Clinic member management</span><span>Presence expires after two minutes offline</span></footer>
  </div>;
}

function ClinicSettingsPage({auth,clinic,onClinicUpdated}) {
  const [form,setForm]=useState({opening_time:clinic?.opening_time||'08:00',closing_time:clinic?.closing_time||'20:00'});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  useEffect(()=>{if(clinic)setForm({opening_time:clinic.opening_time||'08:00',closing_time:clinic.closing_time||'20:00'});},[clinic?.opening_time,clinic?.closing_time]);
  const save=async event=>{
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try {
      const response=await fetch(`${API_BASE}/api/clinic/me`,{method:'PATCH',headers:{Authorization:`Bearer ${auth.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(form)});
      const result=await response.json();
      if(!response.ok)throw new Error(result.detail||'Could not save clinic hours.');
      onClinicUpdated(result);setNotice('Clinic hours saved. Appointment time slots now use these hours.');
    } catch(err) {setError(err.message);}
    finally {setBusy(false);}
  };
  return <div className="workspace-page"><div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CLINIC WORKSPACE</div><h1>Clinic settings</h1><p>Set the hours used to build the appointment time slots.</p></div></div>{error&&<p className="auth-error" role="alert">{error}</p>}{notice&&<p className="auth-success" role="status">{notice}</p>}<section className="panel patient-form-panel"><div className="form-section-heading"><h2>Appointment hours</h2><p>These hours appear in the daily slot view. Hours use full hour increments.</p></div>{auth.user.role==='clinic_admin'?<form className="admin-create-form" onSubmit={save}><label>Opening time<input required type="time" step="3600" value={form.opening_time} onChange={event=>setForm(current=>({...current,opening_time:event.target.value}))}/></label><label>Closing time<input required type="time" step="3600" value={form.closing_time} onChange={event=>setForm(current=>({...current,closing_time:event.target.value}))}/></label><button className="primary-button" disabled={busy}>{busy?'Saving...':'Save clinic hours'}</button></form>:<p>{clinic?.opening_time||'08:00'}–{clinic?.closing_time||'20:00'}</p>}</section></div>;
}

function WorkspacePage({active}) {
  const data = sectionData[active];
  return <div className="workspace-page">
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> CLINIC WORKSPACE</div><h1>{active}</h1><p>{data.description}</p></div></div>
    <section className="panel section-table-panel"><div className="form-section-heading"><h2>No records yet</h2><p>This clinic starts with zero records. Values will appear here when real records are added.</p></div></section>
    <footer className="page-footer"><span>Copyright 2026 Careloop Health</span><span>Clinic workspace</span><button>Privacy & security</button></footer>
  </div>;
}
export default App;
