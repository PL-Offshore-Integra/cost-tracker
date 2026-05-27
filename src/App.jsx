import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, NavLink, Outlet, useOutletContext } from 'react-router-dom'
import { supabase } from './lib/supabase'

const ERP_HOME_URL = 'https://integra.terra-mare.com.ar'
const MODULO_ID    = 'cost-tracker'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy:#0B1629; --navy2:#132040; --navy3:#1a2a5e;
  --gold:#B8942A; --gold2:#D4AA3A; --blue:#235C96;
  --mid:#6381A7; --light:#A5B5CC;
  --bg:#F0F4F8; --surface:#FFFFFF; --border:#D6E0ED;
  --text:#0B1629; --muted:#6381A7;
  --g:#10b981; --r:#ef4444; --w:#f59e0b; --accent:#235C96;
  --sans:'Montserrat',sans-serif; --mono:'DM Mono',monospace;
}
body{font-family:var(--sans);background:var(--bg);color:var(--text);min-height:100vh;font-size:13px}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

/* LOADING */
.loading-screen{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--navy)}
.loading-text{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:3px;text-transform:uppercase}

/* LOGIN */
.login-page{min-height:100vh;display:flex;background:var(--navy);position:relative;overflow:hidden}
.login-bg-lines{position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(184,148,42,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(184,148,42,0.04) 1px,transparent 1px);background-size:60px 60px}
.login-bg-overlay{position:absolute;inset:0;z-index:1;background:linear-gradient(135deg,rgba(11,22,41,0.92) 0%,rgba(11,22,41,0.75) 60%,rgba(11,22,41,0.92) 100%)}
.login-split{position:relative;z-index:2;display:flex;width:100%}
.login-left{flex:1;display:flex;flex-direction:column;justify-content:center;padding:80px 60px;border-right:1px solid rgba(184,148,42,0.15)}
.login-left-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;margin-bottom:20px}
.login-left-logo{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.login-left-logo img{width:52px;height:52px;border-radius:12px;object-fit:cover;border:2px solid rgba(255,255,255,0.15)}
.login-left-title{font-size:52px;font-weight:900;color:#fff;line-height:0.95;letter-spacing:-2px}
.login-left-title span{color:var(--gold);display:block}
.login-left-line{width:48px;height:3px;background:var(--gold);margin:20px 0}
.login-left-sub{font-size:13px;color:rgba(255,255,255,0.45);line-height:1.7;max-width:320px;font-style:italic}
.login-right{width:440px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:60px 48px}
.login-card{width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(184,148,42,0.2);border-radius:16px;padding:40px 36px;backdrop-filter:blur(20px)}
.login-card-title{font-size:16px;font-weight:700;color:#fff;margin-bottom:4px}
.login-card-sub{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:1px;margin-bottom:28px;text-transform:uppercase}
.login-fg{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.login-fg label{font-size:9px;color:rgba(255,255,255,0.4);letter-spacing:1px;text-transform:uppercase;font-weight:600}
.login-fg input{border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:11px 14px;font-size:13px;font-family:var(--sans);color:#fff;background:rgba(255,255,255,0.06);outline:none;transition:border-color .15s;width:100%}
.login-fg input::placeholder{color:rgba(255,255,255,0.2)}
.login-fg input:focus{border-color:var(--gold);background:rgba(255,255,255,0.09)}
.login-btn{width:100%;padding:12px;margin-top:8px;background:var(--gold);color:var(--navy);border:none;border-radius:8px;font-family:var(--sans);font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;letter-spacing:.5px}
.login-btn:hover{background:var(--gold2)}
.login-btn:disabled{opacity:.5;cursor:not-allowed}
.login-error{background:rgba(239,68,68,0.12);color:#FCA5A5;border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:14px}
.login-footer{text-align:center;font-family:var(--mono);font-size:9px;color:rgba(255,255,255,0.2);margin-top:20px;letter-spacing:1px}
.login-back{text-align:center;margin-top:12px;font-size:11px;color:rgba(255,255,255,0.3);cursor:pointer;font-family:var(--mono)}
.login-back:hover{color:var(--gold)}

/* HEADER */
.header{background:var(--navy);padding:0 32px;display:flex;align-items:center;justify-content:space-between;height:60px;position:sticky;top:0;z-index:10;border-bottom:1px solid rgba(184,148,42,0.2);flex-shrink:0}
.header-brand{display:flex;align-items:center;gap:14px}
.header-logo-img{width:32px;height:32px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(255,255,255,0.2)}
.header-divider{width:1px;height:24px;background:rgba(184,148,42,0.25);margin:0 2px}
.header-main{font-size:13px;font-weight:800;color:#fff;letter-spacing:2px;text-transform:uppercase}
.header-sub{font-size:9px;color:var(--gold);letter-spacing:1px;font-family:var(--mono);margin-top:1px;text-transform:uppercase}
.header-right{display:flex;align-items:center;gap:12px}
.header-email{font-size:10px;font-family:var(--mono);color:rgba(255,255,255,0.35)}
.header-sel{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#fff;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:600;width:220px;font-family:var(--sans)}
.hdr-btn{background:transparent;border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);font-family:var(--sans);font-size:10px;font-weight:600;padding:5px 12px;border-radius:6px;cursor:pointer;transition:all .15s;letter-spacing:.3px}
.hdr-btn:hover{border-color:rgba(255,255,255,0.35);color:#fff}

/* TABS */
.tabs{display:flex;gap:0;padding:0 32px;background:var(--navy);border-bottom:1px solid rgba(184,148,42,0.15);flex-shrink:0;overflow-x:auto}
.tab{padding:14px 18px;font-size:12px;font-weight:600;cursor:pointer;color:rgba(255,255,255,0.45);border-bottom:2px solid transparent;transition:all .15s;text-decoration:none;white-space:nowrap;letter-spacing:.3px}
.tab:hover{color:rgba(255,255,255,0.8)}
.tab.active{color:#fff;border-bottom-color:var(--gold)}

/* MAIN */
.main{padding:28px 32px;flex:1;overflow-y:auto}
.app-wrap{min-height:100vh;display:flex;flex-direction:column}

/* CARD */
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px;box-shadow:0 1px 4px rgba(11,22,41,0.06)}
.card-hdr{padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:#FAFBFC}
.card-title{font-size:13px;font-weight:700;color:var(--navy)}

/* KPI */
.kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(11,22,41,0.06)}
.kpi-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:600}
.kpi-val{font-size:22px;font-weight:800;line-height:1;color:var(--navy)}
.kpi-sub{font-size:11px;color:var(--muted);margin-top:5px}

/* TABLE */
.tbl-wrap{overflow-x:auto;max-height:360px;overflow-y:auto}
table{width:100%;border-collapse:collapse;font-size:12px}
th{padding:8px 12px;text-align:left;color:var(--muted);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);background:#FAFBFC;white-space:nowrap}
td{padding:9px 12px;border-bottom:1px solid var(--border);vertical-align:middle;color:var(--text)}
tr:last-child td{border-bottom:none}
tr:hover td{background:#F7F9FC}
.mono{font-family:'Courier New',monospace;font-size:11px}

/* CHIPS */
.chip{display:inline-flex;align-items:center;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.c-ok{background:#D1FAE5;color:#065F46;border:1px solid #A7F3D0}
.c-pend{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A}
.c-apr{background:#DBEAFE;color:#1E40AF;border:1px solid #BFDBFE}
.c-no{background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB}

/* TAGS */
.tag{font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.t-blue{background:#DBEAFE;color:#1E40AF}
.t-orange{background:#FEF3C7;color:#92400E}
.t-green{background:#D1FAE5;color:#065F46}
.t-purple{background:#EDE9FE;color:#5B21B6}
.t-red{background:#FEE2E2;color:#991B1B}
.t-gray{background:#F3F4F6;color:#6B7280}

/* COLORS */
.g{color:#059669}.r{color:#DC2626}.w{color:#D97706}.b{color:var(--blue)}

/* BUTTONS */
.btn{background:var(--blue);color:#fff;border:none;padding:7px 16px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:700;cursor:pointer;transition:all .15s;letter-spacing:.3px}
.btn:hover{background:#1a4a7a}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:600;cursor:pointer;transition:all .15s}
.btn-ghost:hover{color:var(--text);border-color:var(--mid)}
.btn-gold{background:var(--gold);color:var(--navy);border:none;padding:7px 16px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:700;cursor:pointer;transition:background .15s}
.btn-gold:hover{background:var(--gold2)}

/* FORM */
select,input[type=text],input[type=number],input[type=date],input[type=email],textarea{background:#fff;border:1px solid var(--border);color:var(--text);padding:7px 10px;border-radius:6px;font-size:12px;font-family:var(--sans);width:100%;outline:none;transition:border-color .15s}
select:focus,input:focus,textarea:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(35,92,150,0.1)}
textarea{resize:vertical;min-height:64px}
.form-row{margin-bottom:12px}
.form-row label{display:block;font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;font-weight:700}

/* GRID */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}

/* PROGRESS */
.prog-wrap{height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.prog{height:100%;border-radius:3px;transition:width .3s}

/* TABLE FOOTER */
.tbl-foot{padding:10px 16px;background:#FAFBFC;border-top:1px solid var(--border);display:flex;gap:20px;font-size:12px;flex-wrap:wrap;align-items:center}

/* ALERTS */
.alert{border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:8px;line-height:1.5}
.alert-warn{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E}
.alert-ok{background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46}
.alert-err{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B}
.alert-info{background:#EFF6FF;border:1px solid #BFDBFE;color:#1E40AF}

/* MODAL */
.overlay{display:none;position:fixed;inset:0;background:rgba(11,22,41,0.6);z-index:200;align-items:center;justify-content:center}
.overlay.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:28px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(11,22,41,0.2)}
.modal h3{font-size:15px;font-weight:800;color:var(--navy);margin-bottom:20px}
.modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}

/* EMPTY / LOADING */
.loading{padding:40px;text-align:center;color:var(--muted);font-family:var(--mono);font-size:11px;letter-spacing:1px}
.empty{padding:32px;text-align:center;color:var(--muted);font-size:12px}

/* SIN ACCESO */
.sin-acceso{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--navy);gap:16px;padding:24px;text-align:center}

/* MOBILE */
@media(max-width:640px){
  .login-left{display:none}
  .login-right{width:100%;padding:40px 24px}
  .kpi-row{grid-template-columns:1fr 1fr}
  .two-col{grid-template-columns:1fr}
  .header-email{display:none}
  .tabs{padding:0 16px}
  .tab{padding:12px 12px;font-size:11px}
  .main{padding:16px}
}
`

const fmtUSD = (n) => n == null ? '—' : '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 })

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage() {
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleLogin = async () => {
    setLoading(true); setError('')
    try {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (e) setError('Credenciales incorrectas. Verificá tu email y contraseña.')
    } catch {
      setError('Error de conexión. Verificá tu red e intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleLogin() }

  return (
    <div className="login-page">
      <div className="login-bg-lines" />
      <div className="login-bg-overlay" />
      <div className="login-split">
        <div className="login-left">
          <div className="login-left-eyebrow">Cost Project Tracker</div>
          <div className="login-left-logo">
            <img src="/PL.png" alt="Parana Logística" />
          </div>
          <div className="login-left-title">PARANA<span>LOGÍSTICA</span></div>
          <div className="login-left-line" />
          <div className="login-left-sub">Control de costos, órdenes de compra y márgenes de proyecto en tiempo real.</div>
        </div>
        <div className="login-right">
          <div className="login-card">
            <div className="login-card-title">Acceso al módulo</div>
            <div className="login-card-sub">Solo personal autorizado</div>
            {error && <div className="login-error">{error}</div>}
            <div className="login-fg">
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKey} placeholder="usuario@paranalogistica.com.ar" autoFocus />
            </div>
            <div className="login-fg">
              <label>Contraseña</label>
              <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={handleKey} placeholder="••••••••" />
            </div>
            <button className="login-btn" onClick={handleLogin} disabled={loading || !email || !pass}>
              {loading ? 'Ingresando...' : 'Ingresar →'}
            </button>
            <div className="login-footer">Parana Logística · Acceso restringido</div>
            <div className="login-back" onClick={() => window.location.href = ERP_HOME_URL}>← Volver al Portal</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── LAYOUT ───────────────────────────────────────────────────────────────────
const TABS = [
  { to: 'overview',    label: 'Overview' },
  { to: 'presupuesto', label: 'Presupuesto vs Real' },
  { to: 'oc',          label: 'Órdenes de Compra' },
  { to: 'facturas',    label: 'Facturas' },
  { to: 'ingresos',    label: 'Ingresos & Margen' },
  { to: 'cashflow',    label: 'Cashflow' },
  { to: 'categorias',  label: 'Categorías' },
]

function Layout({ session }) {
  const [proyectos, setProyectos]   = useState([])
  const [proyectoId, setProyectoId] = useState(() => localStorage.getItem('cpt_proyecto_id') || '')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [errorProyecto, setErrorProyecto] = useState('')
  const [formP, setFormP] = useState({ nombre:'', cliente:'', descripcion:'', fecha_inicio:'', fecha_fin_est:'' })

  const cargarProyectos = async () => {
    try {
      const { data, error } = await supabase.from('cpt_proyectos').select('id,nombre,cliente').eq('estado','activo').order('created_at',{ascending:false})
      if (error) throw error
      setProyectos(data || [])
      if (!proyectoId && data?.length === 1) {
        setProyectoId(data[0].id)
        localStorage.setItem('cpt_proyecto_id', data[0].id)
      }
    } catch {
      // no bloquea la UI, proyectos queda vacío con mensaje en selector
    }
  }

  useEffect(() => { cargarProyectos() }, []) // eslint-disable-line

  const handleProyecto = (id) => {
    setProyectoId(id)
    localStorage.setItem('cpt_proyecto_id', id)
  }

  const handleNuevoProyecto = async (e) => {
    e.preventDefault(); setSaving(true); setErrorProyecto('')
    try {
      const { data, error } = await supabase
        .from('cpt_proyectos')
        .insert({ ...formP, estado:'activo', moneda_base:'USD', created_by: session.user.id })
        .select('id')
        .single()
      if (error) { setErrorProyecto('No se pudo crear el proyecto. Verificá tu conexión e intentá nuevamente.'); return }
      setModalNuevo(false)
      setFormP({ nombre:'', cliente:'', descripcion:'', fecha_inicio:'', fecha_fin_est:'' })
      await cargarProyectos()
      handleProyecto(data.id)
    } catch {
      setErrorProyecto('Error de conexión. Intentá nuevamente.')
    } finally { setSaving(false) }
  }

  const proyecto = proyectos.find(p => p.id === proyectoId) || null

  return (
    <div className="app-wrap">
      <header className="header">
        <div className="header-brand">
          <img src="/PL.png" alt="Parana Logística" className="header-logo-img" />
          <div className="header-divider" />
          <div>
            <div className="header-main">Parana Logística</div>
            <div className="header-sub">Cost Project Tracker</div>
          </div>
        </div>
        <div className="header-right">
          <select className="header-sel" value={proyectoId} onChange={e => handleProyecto(e.target.value)}>
            <option value="" disabled>Seleccionar proyecto...</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <button className="hdr-btn btn-gold" style={{background:'var(--gold)',color:'var(--navy)',border:'none',fontWeight:700}} onClick={() => setModalNuevo(true)}>+ Proyecto</button>
          <span className="header-email">{session?.user?.email}</span>
          <button className="hdr-btn" onClick={() => window.location.href = ERP_HOME_URL}>← Portal</button>
          <button className="hdr-btn" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>
            {t.label}
          </NavLink>
        ))}
      </nav>

      <div className="main">
        {!proyecto
          ? <div className="empty" style={{ marginTop: 60 }}>
              <p style={{fontSize:15,fontWeight:700,color:'var(--navy)',marginBottom:8}}>Seleccioná un proyecto para comenzar</p>
              <p style={{color:'var(--muted)'}}>o creá uno nuevo con el botón <strong>+ Proyecto</strong> arriba a la derecha</p>
            </div>
          : <Outlet context={{ proyecto }} />
        }
      </div>

      {modalNuevo && (
        <div className="overlay open" onClick={e => e.target===e.currentTarget && setModalNuevo(false)}>
          <div className="modal">
            <h3>Nuevo Proyecto</h3>
            <form onSubmit={handleNuevoProyecto}>
              {errorProyecto && <div className="alert alert-err" style={{marginBottom:12}}>{errorProyecto}</div>}
              <div className="form-row"><label>Nombre del proyecto *</label><input required value={formP.nombre} onChange={e => setFormP(f=>({...f,nombre:e.target.value}))} placeholder="ej. FUGRO – Fabricación Equipos" /></div>
              <div className="form-row"><label>Cliente *</label><input required value={formP.cliente} onChange={e => setFormP(f=>({...f,cliente:e.target.value}))} placeholder="ej. Fugro" /></div>
              <div className="form-row"><label>Descripción</label><textarea value={formP.descripcion} onChange={e => setFormP(f=>({...f,descripcion:e.target.value}))} placeholder="Descripción breve del proyecto..." /></div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Fecha inicio</label><input type="date" value={formP.fecha_inicio} onChange={e => setFormP(f=>({...f,fecha_inicio:e.target.value}))} /></div>
                <div className="form-row"><label>Fecha fin estimada</label><input type="date" value={formP.fecha_fin_est} onChange={e => setFormP(f=>({...f,fecha_fin_est:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Creando...':'Crear Proyecto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
function Overview() {
  const { proyecto } = useOutletContext()
  const [pnl, setPnl]         = useState(null)
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!proyecto) return
    setLoading(true)
    Promise.all([
      supabase.from('cpt_proyecto_pnl').select('*').eq('proyecto_id',proyecto.id).maybeSingle(),
      supabase.from('cpt_presupuesto_lineas').select('descripcion,monto_pres_usd,monto_real_usd').eq('proyecto_id',proyecto.id).eq('estado','alerta'),
    ]).then(([{data:p},{data:a}]) => { setPnl(p); setAlertas(a||[]); setLoading(false) })
  }, [proyecto])

  if (loading) return <div className="loading">Cargando overview...</div>

  const ingreso   = pnl?.ingreso_cotizado_usd    || 0
  const costoPres = pnl?.costo_presupuestado_usd || 0
  const costoReal = pnl?.costo_real_confirmado_usd || 0
  const cobrado   = pnl?.ingreso_cobrado_usd     || 0
  const mbPct     = pnl?.margen_budget_pct       || 0
  const mfPct     = pnl?.margen_forecast_pct     || 0

  return (
    <>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-lbl">Ingresos Cotizados</div><div className="kpi-val b">{fmtUSD(ingreso)}</div><div className="kpi-sub">USD · Propuesta Cliente</div></div>
        <div className="kpi"><div className="kpi-lbl">Costo Presupuestado</div><div className="kpi-val">{fmtUSD(costoPres)}</div><div className="kpi-sub">USD · todas las líneas</div></div>
        <div className="kpi"><div className="kpi-lbl">Costo Real</div><div className="kpi-val w">{fmtUSD(costoReal)}</div><div className="kpi-sub">OC + facturas cargadas</div></div>
        <div className="kpi"><div className="kpi-lbl">Margen Budget</div><div className="kpi-val g">{mbPct}%</div><div className="kpi-sub">{fmtUSD(ingreso-costoPres)} USD</div></div>
        <div className="kpi"><div className="kpi-lbl">Margen Forecast</div><div className="kpi-val g" style={{fontSize:24}}>{mfPct}%</div><div className="kpi-sub">Con costos reales</div></div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-hdr"><span className="card-title">Ejecución</span></div>
          <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:12}}><span style={{color:'var(--muted)'}}>Cobrado vs Cotizado</span><strong>{fmtUSD(cobrado)} / {fmtUSD(ingreso)}</strong></div>
              <div className="prog-wrap"><div className="prog" style={{width:ingreso>0?`${Math.min(cobrado/ingreso*100,100)}%`:'0%',background:'linear-gradient(90deg,#059669,#10b981)'}} /></div>
            </div>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,fontSize:12}}><span style={{color:'var(--muted)'}}>Costo ejecutado vs Presupuesto</span><strong>{fmtUSD(costoReal)} / {fmtUSD(costoPres)}</strong></div>
              <div className="prog-wrap"><div className="prog" style={{width:costoPres>0?`${Math.min(costoReal/costoPres*100,100)}%`:'0%',background:'linear-gradient(90deg,#1a4a7a,#235C96)'}} /></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-hdr"><span className="card-title">Alertas</span></div>
          <div style={{padding:'14px 16px'}}>
            {alertas.length===0
              ? <div className="alert alert-ok">Sin alertas activas</div>
              : alertas.map((a,i) => {
                  const delta = a.monto_real_usd&&a.monto_pres_usd ? ((a.monto_real_usd-a.monto_pres_usd)/a.monto_pres_usd*100).toFixed(1) : null
                  return <div key={i} className="alert alert-err">{a.descripcion}{delta&&<span style={{marginLeft:8,fontWeight:700}}>+{delta}%</span>}</div>
                })
            }
          </div>
        </div>
      </div>
    </>
  )
}

// ─── PRESUPUESTO ──────────────────────────────────────────────────────────────
function Presupuesto() {
  const { proyecto } = useOutletContext()
  const [lineas, setLineas]         = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [filtroCat, setFiltroCat]   = useState('')
  const [form, setForm] = useState({ item_numero:'', descripcion:'', categoria_id:'', frecuencia:'one-time', moneda_pres:'USD', monto_pres:'', fx_pres:'', es_reembolsable:false, handling_fee_pct:'', estado:'estimado' })

  const cargar = async () => {
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from('cpt_presupuesto_lineas').select('*,cpt_categorias(nombre,color)').eq('proyecto_id',proyecto.id).order('item_numero'),
      supabase.from('cpt_categorias').select('id,nombre,color').eq('activa',true).order('nombre'),
    ])
    setLineas(l||[]); setCategorias(c||[])
  }

  useEffect(() => { if (!proyecto) return; setLoading(true); cargar().finally(() => setLoading(false)) }, [proyecto]) // eslint-disable-line

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_presupuesto_lineas').insert({ ...form, proyecto_id:proyecto.id, monto_pres:Number(form.monto_pres)||null, fx_pres:Number(form.fx_pres)||null, handling_fee_pct:Number(form.handling_fee_pct)||null })
      if (error) { alert(error.message); return }
      setModal(false)
      setForm({ item_numero:'', descripcion:'', categoria_id:'', frecuencia:'one-time', moneda_pres:'USD', monto_pres:'', fx_pres:'', es_reembolsable:false, handling_fee_pct:'', estado:'estimado' })
      await cargar()
    } finally { setSaving(false) }
  }

  const totalPres = lineas.reduce((s,l) => s+(l.monto_pres_usd||0),0)
  const totalReal = lineas.reduce((s,l) => s+(l.monto_real_usd||0),0)
  const lineasFiltradas = filtroCat ? lineas.filter(l => l.categoria_id === filtroCat) : lineas

  if (loading) return <div className="loading">Cargando presupuesto...</div>

  return (
    <>
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Líneas de Costo — Presupuesto vs Real</span>
          <div style={{display:'flex',gap:8}}>
            <select style={{width:180}} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}><option value="">Todas las categorías</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
            <button className="btn" onClick={() => setModal(true)}>+ Nueva línea</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Item</th><th>Descripción</th><th>Categoría</th><th>Frec.</th><th>Moneda</th><th>Pres. USD</th><th>Real USD</th><th>Delta</th><th>Remb.</th><th>Estado</th></tr></thead>
            <tbody>
              {lineasFiltradas.length===0 && <tr><td colSpan={10} className="empty">Sin líneas — agregá la primera</td></tr>}
              {lineasFiltradas.map(l => {
                const delta = l.monto_real_usd!=null ? l.monto_real_usd-(l.monto_pres_usd||0) : null
                return (
                  <tr key={l.id} style={l.estado==='alerta'?{background:'#FEF2F2'}:{}}>
                    <td style={{color:'var(--muted)',fontSize:11}}>{l.item_numero||'—'}</td>
                    <td style={{fontWeight:500}}>{l.descripcion}</td>
                    <td>{l.cpt_categorias&&<span className={`tag t-${l.cpt_categorias.color}`}>{l.cpt_categorias.nombre}</span>}</td>
                    <td style={{color:'var(--muted)',fontSize:11,textTransform:'capitalize'}}>{l.frecuencia}</td>
                    <td className="mono">{l.moneda_pres}</td>
                    <td className="mono">{fmtUSD(l.monto_pres_usd)}</td>
                    <td className="mono">{fmtUSD(l.monto_real_usd)}</td>
                    <td className={`mono ${delta==null?'':delta<=0?'g':'r'}`}>{delta==null?'—':(delta>0?'+':'')+fmtUSD(delta)}</td>
                    <td style={{textAlign:'center',color:l.es_reembolsable?'var(--g)':'var(--muted)'}}>{l.es_reembolsable?'✓':'—'}</td>
                    <td><span className={`chip ${l.estado==='confirmado'?'c-ok':l.estado==='alerta'?'c-pend':'c-apr'}`}>{l.estado.replace('_',' ')}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>Presupuestado: <strong style={{color:'var(--navy)'}}>{fmtUSD(totalPres)}</strong></span>
          <span style={{color:'var(--muted)'}}>Real confirmado: <strong className="g">{fmtUSD(totalReal)}</strong></span>
          <span style={{marginLeft:'auto'}} className={totalReal<=totalPres?'g':'r'}>Delta: {totalReal>totalPres?'+':''}{fmtUSD(totalReal-totalPres)}</span>
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal">
            <h3>Nueva Línea de Costo</h3>
            <form onSubmit={handleSave}>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Item #</label><input value={form.item_numero} onChange={e => setForm(f=>({...f,item_numero:e.target.value}))} placeholder="ej. 1a" /></div>
                <div className="form-row"><label>Categoría *</label><select required value={form.categoria_id} onChange={e => setForm(f=>({...f,categoria_id:e.target.value}))}><option value="">Seleccionar...</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
              </div>
              <div className="form-row"><label>Descripción *</label><input required value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))} placeholder="ej. Fixed A-Frame – Material hierro" /></div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Moneda</label><select value={form.moneda_pres} onChange={e => setForm(f=>({...f,moneda_pres:e.target.value}))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
                <div className="form-row"><label>FX {form.moneda_pres==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx_pres} onChange={e => setForm(f=>({...f,fx_pres:e.target.value}))} disabled={form.moneda_pres==='USD'} required={form.moneda_pres==='ARS'} placeholder="ej. 1400" /></div>
              </div>
              <div className="form-row"><label>Monto Presupuestado ({form.moneda_pres}) *</label><input required type="number" step="0.01" value={form.monto_pres} onChange={e => setForm(f=>({...f,monto_pres:e.target.value}))} placeholder="0.00" /></div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Frecuencia</label><select value={form.frecuencia} onChange={e => setForm(f=>({...f,frecuencia:e.target.value}))}><option value="one-time">One-time</option><option value="mensual">Mensual</option></select></div>
                <div className="form-row"><label>Estado</label><select value={form.estado} onChange={e => setForm(f=>({...f,estado:e.target.value}))}><option value="estimado">Estimado</option><option value="confirmado">Confirmado</option><option value="pendiente_oc">Pendiente OC</option></select></div>
              </div>
              <div className="form-row" style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" id="remb" checked={form.es_reembolsable} onChange={e => setForm(f=>({...f,es_reembolsable:e.target.checked}))} style={{width:'auto'}} />
                <label htmlFor="remb" style={{fontSize:12,color:'var(--text)',textTransform:'none',letterSpacing:0,fontWeight:600,cursor:'pointer'}}>Es reembolsable</label>
              </div>
              {form.es_reembolsable && <div className="form-row"><label>Handling Fee % (sobre costo+IVA)</label><input type="number" step="0.1" value={form.handling_fee_pct} onChange={e => setForm(f=>({...f,handling_fee_pct:e.target.value}))} placeholder="ej. 5" /></div>}
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── OC ───────────────────────────────────────────────────────────────────────
function OC() {
  const { proyecto } = useOutletContext()
  const [ocs, setOcs]               = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading]       = useState(true)
  const [modal, setModal]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({ numero_oc:'', proveedor:'', categoria_id:'', descripcion:'', moneda:'USD', monto_sin_iva:'', iva_pct:'21', fx:'', fecha_emision:'', estado:'pendiente_aprobacion' })

  const cargar = async () => {
    const [{ data: o }, { data: c }] = await Promise.all([
      supabase.from('cpt_oc_saldo').select('*').eq('proyecto_id',proyecto.id),
      supabase.from('cpt_categorias').select('id,nombre,color').eq('activa',true).order('nombre'),
    ])
    setOcs(o||[]); setCategorias(c||[])
  }

  useEffect(() => { if (!proyecto) return; setLoading(true); cargar().finally(() => setLoading(false)) }, [proyecto]) // eslint-disable-line

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_oc').insert({ ...form, proyecto_id:proyecto.id, monto_sin_iva:Number(form.monto_sin_iva), iva_pct:Number(form.iva_pct), fx:Number(form.fx)||null })
      if (error) { alert(error.message); return }
      setModal(false)
      setForm({ numero_oc:'', proveedor:'', categoria_id:'', descripcion:'', moneda:'USD', monto_sin_iva:'', iva_pct:'21', fx:'', fecha_emision:'', estado:'pendiente_aprobacion' })
      await cargar()
    } finally { setSaving(false) }
  }

  const CHIP = { pendiente_aprobacion:'c-pend', aprobada:'c-apr', activa:'c-ok', completada:'c-ok', cancelada:'c-no' }
  const totalOC   = ocs.reduce((s,o) => s+(o.oc_total_usd||0),0)
  const totalPend = ocs.reduce((s,o) => s+(o.saldo_usd||0),0)

  if (loading) return <div className="loading">Cargando OCs...</div>

  return (
    <>
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Órdenes de Compra</span>
          <button className="btn" onClick={() => setModal(true)}>+ Nueva OC</button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>#OC</th><th>Proveedor</th><th>Descripción</th><th>Moneda</th><th>USD s/IVA</th><th>USD c/IVA</th><th>Facturado</th><th>Pendiente</th><th>Emitida</th><th>Estado</th></tr></thead>
            <tbody>
              {ocs.length===0 && <tr><td colSpan={10} className="empty">Sin OC — creá la primera</td></tr>}
              {ocs.map(o => (
                <tr key={o.id}>
                  <td className="mono b">{o.numero_oc}</td>
                  <td style={{fontWeight:600}}>{o.proveedor}</td>
                  <td style={{color:'var(--muted)',fontSize:11}}>{o.descripcion}</td>
                  <td className="mono">{o.moneda}</td>
                  <td className="mono">{fmtUSD(o.oc_total_usd)}</td>
                  <td className="mono">{fmtUSD(o.oc_total_usd_con_iva)}</td>
                  <td>
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      <span className={`mono ${o.pct_facturado>=100?'g':'w'}`} style={{fontSize:11}}>{fmtUSD(o.facturado_usd)} ({o.pct_facturado}%)</span>
                      <div className="prog-wrap" style={{width:80}}><div className="prog" style={{width:`${o.pct_facturado}%`,background:o.pct_facturado>=100?'#059669':'#235C96'}} /></div>
                    </div>
                  </td>
                  <td className={`mono ${o.saldo_usd>0?'w':'g'}`}>{fmtUSD(o.saldo_usd)}</td>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{o.fecha_emision||'—'}</td>
                  <td><span className={`chip ${CHIP[o.estado]||'c-no'}`}>{o.estado.replace(/_/g,' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>Total: <strong style={{color:'var(--navy)'}}>{fmtUSD(totalOC)}</strong></span>
          <span style={{color:'var(--muted)'}}>Pendiente facturar: <strong className="w">{fmtUSD(totalPend)}</strong></span>
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal">
            <h3>Nueva Orden de Compra</h3>
            <form onSubmit={handleSave}>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Número OC *</label><input required value={form.numero_oc} onChange={e => setForm(f=>({...f,numero_oc:e.target.value}))} placeholder="ej. OC-001" /></div>
                <div className="form-row"><label>Proveedor *</label><input required value={form.proveedor} onChange={e => setForm(f=>({...f,proveedor:e.target.value}))} /></div>
              </div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Categoría *</label><select required value={form.categoria_id} onChange={e => setForm(f=>({...f,categoria_id:e.target.value}))}><option value="">Seleccionar...</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <div className="form-row"><label>Estado</label><select value={form.estado} onChange={e => setForm(f=>({...f,estado:e.target.value}))}><option value="pendiente_aprobacion">Pendiente aprobación</option><option value="aprobada">Aprobada</option><option value="activa">Activa</option></select></div>
              </div>
              <div className="form-row"><label>Descripción</label><input value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))} /></div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Moneda</label><select value={form.moneda} onChange={e => setForm(f=>({...f,moneda:e.target.value}))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
                <div className="form-row"><label>FX {form.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx} onChange={e => setForm(f=>({...f,fx:e.target.value}))} disabled={form.moneda==='USD'} required={form.moneda==='ARS'} placeholder="ej. 1425" /></div>
              </div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Monto s/IVA ({form.moneda}) *</label><input required type="number" step="0.01" value={form.monto_sin_iva} onChange={e => setForm(f=>({...f,monto_sin_iva:e.target.value}))} placeholder="0.00" /></div>
                <div className="form-row"><label>IVA %</label><select value={form.iva_pct} onChange={e => setForm(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div>
              </div>
              <div className="form-row"><label>Fecha emisión</label><input type="date" value={form.fecha_emision} onChange={e => setForm(f=>({...f,fecha_emision:e.target.value}))} /></div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Crear OC'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── FACTURAS ─────────────────────────────────────────────────────────────────
function Facturas() {
  const { proyecto } = useOutletContext()
  const [tab, setTab]           = useState('compra')
  const [fcompra, setFcompra]   = useState([])
  const [fventa, setFventa]     = useState([])
  const [ocs, setOcs]           = useState([])
  const [ocSaldos, setOcSaldos] = useState({})
  const [loading, setLoading]   = useState(true)
  const [modalC, setModalC]     = useState(false)
  const [modalV, setModalV]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [formC, setFormC] = useState({ numero_factura:'', oc_id:'', proveedor:'', moneda:'USD', monto_sin_iva:'', iva_pct:'21', fx:'', fecha_factura:'', fecha_vto_pago:'' })
  const [formV, setFormV] = useState({ numero_factura:'', concepto:'', monto_usd:'', fecha_emision:'', fecha_vto_cobro:'' })

  const cargar = async () => {
    const [{ data: fc }, { data: fv }, { data: o }, { data: s }] = await Promise.all([
      supabase.from('cpt_facturas_compra').select('*,cpt_oc(numero_oc,proveedor)').eq('proyecto_id',proyecto.id).order('fecha_factura',{ascending:false}),
      supabase.from('cpt_facturas_venta').select('*').eq('proyecto_id',proyecto.id).order('fecha_emision',{ascending:false}),
      supabase.from('cpt_oc').select('id,numero_oc,proveedor').eq('proyecto_id',proyecto.id).order('numero_oc'),
      supabase.from('cpt_oc_saldo').select('id,numero_oc,saldo_usd,oc_total_usd').eq('proyecto_id',proyecto.id),
    ])
    setFcompra(fc||[]); setFventa(fv||[]); setOcs(o||[])
    const map={}; for (const x of (s||[])) map[x.id]=x; setOcSaldos(map)
  }

  useEffect(() => { if (!proyecto) return; setLoading(true); cargar().finally(() => setLoading(false)) }, [proyecto]) // eslint-disable-line
  useEffect(() => { if (!formC.oc_id) return; const oc=ocs.find(o=>o.id===formC.oc_id); if (oc) setFormC(f=>({...f,proveedor:oc.proveedor})) }, [formC.oc_id]) // eslint-disable-line

  const handleSaveC = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_facturas_compra').insert({ ...formC, proyecto_id:proyecto.id, monto_sin_iva:Number(formC.monto_sin_iva), iva_pct:Number(formC.iva_pct), fx:Number(formC.fx)||null })
      if (error) { alert(error.message); return }
      setModalC(false); setFormC({ numero_factura:'', oc_id:'', proveedor:'', moneda:'USD', monto_sin_iva:'', iva_pct:'21', fx:'', fecha_factura:'', fecha_vto_pago:'' })
      await cargar()
    } finally { setSaving(false) }
  }

  const handleSaveV = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_facturas_venta').insert({ ...formV, proyecto_id:proyecto.id, monto_usd:Number(formV.monto_usd), estado:formV.fecha_emision?'emitida':'no_emitida' })
      if (error) { alert(error.message); return }
      setModalV(false); setFormV({ numero_factura:'', concepto:'', monto_usd:'', fecha_emision:'', fecha_vto_cobro:'' })
      await cargar()
    } finally { setSaving(false) }
  }

  const CHIPFC = { pagada:'c-ok', pendiente_pago:'c-apr', vencida:'c-pend' }
  const CHIPFV = { cobrada:'c-ok', cobro_parcial:'c-pend', emitida:'c-apr', no_emitida:'c-no' }
  const ocSel  = formC.oc_id ? ocSaldos[formC.oc_id] : null
  const totalFacVta  = fventa.reduce((s,f) => s+(f.monto_usd||0),0)
  const totalCobrado = fventa.reduce((s,f) => s+(f.monto_cobrado||0),0)

  if (loading) return <div className="loading">Cargando facturas...</div>

  return (
    <>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button className={tab==='compra'?'btn':'btn-ghost'} onClick={() => setTab('compra')}>Facturas de Compra</button>
        <button className={tab==='venta'?'btn':'btn-ghost'} onClick={() => setTab('venta')}>Facturas de Venta</button>
      </div>

      {tab==='compra' && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">Facturas de Compra</span><button className="btn" onClick={() => setModalC(true)}>+ Registrar</button></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>#Factura</th><th>Proveedor</th><th>OC</th><th>Moneda</th><th>USD s/IVA</th><th>USD c/IVA</th><th>% OC</th><th>Fecha</th><th>Vto. Pago</th><th>Estado</th></tr></thead>
              <tbody>
                {fcompra.length===0 && <tr><td colSpan={10} className="empty">Sin facturas registradas</td></tr>}
                {fcompra.map(f => {
                  const s=ocSaldos[f.oc_id]
                  const pct=s?.oc_total_usd>0 ? Math.round(f.monto_usd_sin_iva/s.oc_total_usd*100) : null
                  return (
                    <tr key={f.id}>
                      <td className="mono">{f.numero_factura}</td>
                      <td style={{fontWeight:500}}>{f.proveedor}</td>
                      <td className="mono b">{f.cpt_oc?.numero_oc}</td>
                      <td className="mono">{f.moneda}</td>
                      <td className="mono">{fmtUSD(f.monto_usd_sin_iva)}</td>
                      <td className="mono">{fmtUSD(f.monto_usd_con_iva)}</td>
                      <td>{pct!=null&&<div style={{display:'flex',alignItems:'center',gap:6}}><div className="prog-wrap" style={{width:50}}><div className="prog" style={{width:`${pct}%`,background:pct>=100?'#059669':'#235C96'}} /></div><span style={{fontSize:11,color:pct>=100?'var(--g)':'var(--blue)'}}>{pct}%</span></div>}</td>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{f.fecha_factura}</td>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{f.fecha_vto_pago||'—'}</td>
                      <td><span className={`chip ${CHIPFC[f.estado]||'c-no'}`}>{f.estado.replace('_',' ')}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==='venta' && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">Facturas de Venta</span><button className="btn" onClick={() => setModalV(true)}>+ Nueva</button></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>#Factura</th><th>Concepto</th><th>Monto USD</th><th>Emitida</th><th>Vto. Cobro</th><th>Cobrado</th><th>Pendiente</th><th>Estado</th></tr></thead>
              <tbody>
                {fventa.length===0 && <tr><td colSpan={8} className="empty">Sin facturas de venta</td></tr>}
                {fventa.map(f => (
                  <tr key={f.id}>
                    <td className="mono">{f.numero_factura||'—'}</td>
                    <td style={{fontWeight:500}}>{f.concepto}</td>
                    <td className="mono b">{fmtUSD(f.monto_usd)}</td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{f.fecha_emision||'—'}</td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{f.fecha_vto_cobro||'—'}</td>
                    <td className={`mono ${f.monto_cobrado>0?'g':''}`}>{fmtUSD(f.monto_cobrado)}</td>
                    <td className={`mono ${(f.monto_usd-(f.monto_cobrado||0))>0?'w':''}`}>{fmtUSD(f.monto_usd-(f.monto_cobrado||0))}</td>
                    <td><span className={`chip ${CHIPFV[f.estado]||'c-no'}`}>{f.estado.replace('_',' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tbl-foot">
            <span style={{color:'var(--muted)'}}>Facturado: <strong style={{color:'var(--navy)'}}>{fmtUSD(totalFacVta)}</strong></span>
            <span style={{color:'var(--muted)'}}>Cobrado: <strong className="g">{fmtUSD(totalCobrado)}</strong></span>
            <span style={{color:'var(--muted)'}}>Pendiente: <strong className="w">{fmtUSD(totalFacVta-totalCobrado)}</strong></span>
          </div>
        </div>
      )}

      {modalC && (
        <div className="overlay open" onClick={e => e.target===e.currentTarget && setModalC(false)}>
          <div className="modal">
            <h3>Registrar Factura de Compra</h3>
            <form onSubmit={handleSaveC}>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Número *</label><input required value={formC.numero_factura} onChange={e => setFormC(f=>({...f,numero_factura:e.target.value}))} placeholder="ej. FC-0045" /></div>
                <div className="form-row"><label>OC vinculada *</label><select required value={formC.oc_id} onChange={e => setFormC(f=>({...f,oc_id:e.target.value}))}><option value="">Seleccionar...</option>{ocs.map(o => <option key={o.id} value={o.id}>{o.numero_oc} – {o.proveedor}</option>)}</select></div>
              </div>
              {ocSel&&<div className="alert alert-info" style={{marginBottom:12}}>{ocSel.numero_oc} — Saldo disponible: <strong>{fmtUSD(ocSel.saldo_usd)} USD</strong></div>}
              <div className="form-row"><label>Proveedor *</label><input required value={formC.proveedor} onChange={e => setFormC(f=>({...f,proveedor:e.target.value}))} /></div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Moneda</label><select value={formC.moneda} onChange={e => setFormC(f=>({...f,moneda:e.target.value}))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
                <div className="form-row"><label>FX {formC.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={formC.fx} onChange={e => setFormC(f=>({...f,fx:e.target.value}))} disabled={formC.moneda==='USD'} required={formC.moneda==='ARS'} placeholder="ej. 1428" /></div>
              </div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Monto s/IVA *</label><input required type="number" step="0.01" value={formC.monto_sin_iva} onChange={e => setFormC(f=>({...f,monto_sin_iva:e.target.value}))} placeholder="0.00" /></div>
                <div className="form-row"><label>IVA %</label><select value={formC.iva_pct} onChange={e => setFormC(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div>
              </div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Fecha factura *</label><input required type="date" value={formC.fecha_factura} onChange={e => setFormC(f=>({...f,fecha_factura:e.target.value}))} /></div>
                <div className="form-row"><label>Vto. pago</label><input type="date" value={formC.fecha_vto_pago} onChange={e => setFormC(f=>({...f,fecha_vto_pago:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setModalC(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalV && (
        <div className="overlay open" onClick={e => e.target===e.currentTarget && setModalV(false)}>
          <div className="modal">
            <h3>Nueva Factura de Venta</h3>
            <form onSubmit={handleSaveV}>
              <div className="form-row"><label>Número</label><input value={formV.numero_factura} onChange={e => setFormV(f=>({...f,numero_factura:e.target.value}))} placeholder="ej. FV-001 (vacío si no emitida aún)" /></div>
              <div className="form-row"><label>Concepto *</label><input required value={formV.concepto} onChange={e => setFormV(f=>({...f,concepto:e.target.value}))} placeholder="ej. Anticipo 30% obra" /></div>
              <div className="form-row"><label>Monto USD *</label><input required type="number" step="0.01" value={formV.monto_usd} onChange={e => setFormV(f=>({...f,monto_usd:e.target.value}))} placeholder="0.00" /></div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Fecha emisión</label><input type="date" value={formV.fecha_emision} onChange={e => setFormV(f=>({...f,fecha_emision:e.target.value}))} /></div>
                <div className="form-row"><label>Vto. cobro</label><input type="date" value={formV.fecha_vto_cobro} onChange={e => setFormV(f=>({...f,fecha_vto_cobro:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setModalV(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Emitir'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── INGRESOS ─────────────────────────────────────────────────────────────────
function Ingresos() {
  const { proyecto } = useOutletContext()
  const [lineas, setLineas]   = useState([])
  const [fventa, setFventa]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!proyecto) return
    setLoading(true)
    Promise.all([
      supabase.from('cpt_presupuesto_lineas').select('*,cpt_categorias(nombre)').eq('proyecto_id',proyecto.id).order('item_numero'),
      supabase.from('cpt_facturas_venta').select('*').eq('proyecto_id',proyecto.id).order('fecha_emision'),
    ]).then(([{data:l},{data:fv}]) => { setLineas(l||[]); setFventa(fv||[]); setLoading(false) })
  }, [proyecto])

  if (loading) return <div className="loading">Cargando ingresos...</div>

  const totalCotizado = fventa.reduce((s,f) => s+(f.monto_usd||0),0)
  const totalPres     = lineas.reduce((s,l) => s+(l.monto_pres_usd||0),0)
  const totalReal     = lineas.reduce((s,l) => s+(l.monto_real_usd||l.monto_pres_usd||0),0)
  const mBudget = totalCotizado>0 ? ((totalCotizado-totalPres)/totalCotizado*100).toFixed(1) : 0
  const mReal   = totalCotizado>0 ? ((totalCotizado-totalReal)/totalCotizado*100).toFixed(1) : 0

  return (
    <>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Costos vs Ingresos — Margen Vivo</span></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Item</th><th>Descripción</th><th>Categoría</th><th>Costo Pres. USD</th><th>Costo Real USD</th><th>Delta USD</th><th>Remb.</th></tr></thead>
            <tbody>
              {lineas.length===0 && <tr><td colSpan={7} className="empty">Sin líneas cargadas</td></tr>}
              {lineas.map(l => {
                const delta = l.monto_real_usd!=null ? l.monto_real_usd-(l.monto_pres_usd||0) : null
                return (
                  <tr key={l.id} style={delta>0?{background:'#FEF2F2'}:{}}>
                    <td style={{color:'var(--muted)',fontSize:11}}>{l.item_numero||'—'}</td>
                    <td style={{fontWeight:500}}>{l.descripcion}</td>
                    <td>{l.cpt_categorias?.nombre||'—'}</td>
                    <td className="mono">{fmtUSD(l.monto_pres_usd)}</td>
                    <td className={`mono ${l.monto_real_usd==null?'':delta<=0?'g':'r'}`}>{fmtUSD(l.monto_real_usd)}</td>
                    <td className={`mono ${delta==null?'':delta<=0?'g':'r'}`}>{delta==null?'—':(delta>0?'+':'')+fmtUSD(delta)}</td>
                    <td style={{textAlign:'center',color:l.es_reembolsable?'var(--g)':'var(--muted)'}}>{l.es_reembolsable?'✓':'—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="two-col">
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Margen Resumen</span></div>
          <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:12,fontSize:13}}>
            <div style={{display:'flex',justifyContent:'space-between',paddingBottom:12,borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--muted)'}}>Ingreso cotizado</span><strong className="b">{fmtUSD(totalCotizado)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo presupuestado</span><strong>{fmtUSD(totalPres)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo real / forecast</span><strong className="g">{fmtUSD(totalReal)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:12,borderTop:'1px solid var(--border)'}}><span style={{fontWeight:700}}>Margen budget</span><strong className="g" style={{fontSize:15}}>{mBudget}%</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:700}}>Margen forecast</span><strong className="g" style={{fontSize:18}}>{mReal}%</strong></div>
          </div>
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Facturas de Venta</span></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Concepto</th><th>Monto USD</th><th>Cobrado</th><th>Estado</th></tr></thead>
              <tbody>
                {fventa.length===0 && <tr><td colSpan={4} className="empty">Sin facturas</td></tr>}
                {fventa.map(f => <tr key={f.id}><td style={{fontSize:12}}>{f.concepto}</td><td className="mono b">{fmtUSD(f.monto_usd)}</td><td className={`mono ${f.monto_cobrado>0?'g':''}`}>{fmtUSD(f.monto_cobrado)}</td><td><span className="chip c-ok" style={{fontSize:9}}>{f.estado.replace('_',' ')}</span></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── CASHFLOW ─────────────────────────────────────────────────────────────────
function Cashflow() {
  const { proyecto } = useOutletContext()
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!proyecto) return
    setLoading(true)
    supabase.from('cpt_cashflow').select('*').eq('proyecto_id',proyecto.id).order('fecha')
      .then(({ data }) => { setEventos(data||[]); setLoading(false) })
  }, [proyecto])

  if (loading) return <div className="loading">Cargando cashflow...</div>

  let acum = 0
  const conAcum = eventos.map(e => { if (e.categoria_cf==='real') acum+=Number(e.monto_usd); return {...e,acum} })
  const totalCobrado = eventos.filter(e=>e.tipo==='ingreso'&&e.categoria_cf==='real').reduce((s,e)=>s+Number(e.monto_usd),0)
  const totalPagado  = eventos.filter(e=>e.tipo==='egreso' &&e.categoria_cf==='real').reduce((s,e)=>s+Math.abs(Number(e.monto_usd)),0)
  const caja = totalCobrado - totalPagado

  return (
    <>
      <div className="two-col">
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Caja del Proyecto</span></div>
          <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:10,fontSize:13}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',background:'#F0FDF4',borderRadius:8,border:'1px solid #BBF7D0'}}><span style={{color:'var(--muted)'}}>Cobrado</span><strong className="g">+{fmtUSD(totalCobrado)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',background:'#FEF2F2',borderRadius:8,border:'1px solid #FECACA'}}><span style={{color:'var(--muted)'}}>Pagado</span><strong className="r">−{fmtUSD(totalPagado)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',background:caja>=0?'#ECFDF5':'#FEF2F2',borderRadius:8,border:`1px solid ${caja>=0?'#A7F3D0':'#FECACA'}`}}><span style={{fontWeight:700}}>Caja hoy</span><strong style={{color:caja>=0?'#059669':'#DC2626',fontSize:16}}>{caja>=0?'+':''}{fmtUSD(caja)}</strong></div>
          </div>
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Nota</span></div>
          <div style={{padding:'16px',fontSize:12,color:'var(--muted)',lineHeight:1.7}}>
            <p>El cashflow se construye automáticamente desde las fechas de pago/cobro cargadas en Facturas.</p>
            <p style={{marginTop:8}}>Registros sin fecha de pago aparecen como forecast cuando tengan vencimiento cargado.</p>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Línea de Tiempo</span></div>
        {eventos.length===0
          ? <div className="empty">Sin eventos — cargá fechas de pago en Facturas</div>
          : <div className="tbl-wrap" style={{maxHeight:'none'}}>
              <table>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Contraparte</th><th>Referencia</th><th>Monto USD</th><th>Real / Forecast</th><th>Acumulado</th></tr></thead>
                <tbody>
                  {conAcum.map((e,i) => (
                    <tr key={i}>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{e.fecha}</td>
                      <td><span className={`chip ${e.tipo==='ingreso'?'c-ok':'c-pend'}`}>{e.tipo}</span></td>
                      <td style={{fontWeight:500}}>{e.contraparte}</td>
                      <td className="mono" style={{color:'var(--muted)'}}>{e.referencia||'—'}</td>
                      <td className={`mono ${e.tipo==='ingreso'?'g':'r'}`}>{e.tipo==='ingreso'?'+':''}{fmtUSD(Number(e.monto_usd))}</td>
                      <td><span style={{fontSize:10,color:e.categoria_cf==='real'?'#059669':'#D97706',fontWeight:700,textTransform:'uppercase'}}>{e.categoria_cf==='real'?'● Real':'◌ Forecast'}</span></td>
                      <td className={`mono ${e.acum>=0?'g':'r'}`}>{e.acum>=0?'+':''}{fmtUSD(e.acum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>
    </>
  )
}

// ─── CATEGORIAS ───────────────────────────────────────────────────────────────
function Categorias() {
  const [cats, setCats]       = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm] = useState({ nombre:'', descripcion:'', color:'blue' })

  const cargar = async () => {
    const { data } = await supabase.from('cpt_categorias').select('*').order('nombre')
    setCats(data||[])
  }

  useEffect(() => { setLoading(true); cargar().finally(() => setLoading(false)) }, [])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_categorias').insert(form)
      if (error) { alert(error.message); return }
      setModal(false); setForm({ nombre:'', descripcion:'', color:'blue' }); await cargar()
    } finally { setSaving(false) }
  }

  const toggleActiva = async (cat) => {
    try {
      const { error } = await supabase.from('cpt_categorias').update({ activa:!cat.activa }).eq('id',cat.id)
      if (error) { alert('No se pudo actualizar la categoría. Intentá nuevamente.'); return }
      await cargar()
    } catch {
      alert('Error de conexión. Intentá nuevamente.')
    }
  }

  if (loading) return <div className="loading">Cargando categorías...</div>

  return (
    <>
      <div className="two-col">
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">Catálogo de Categorías</span>
            <button className="btn" onClick={() => setModal(true)}>+ Nueva</button>
          </div>
          <div style={{padding:8}}>
            <table>
              <thead><tr><th>Nombre</th><th>Descripción</th><th>Color</th><th>Activa</th></tr></thead>
              <tbody>
                {cats.map(c => (
                  <tr key={c.id} style={{opacity:c.activa?1:0.5}}>
                    <td><span className={`tag t-${c.color}`}>{c.nombre}</span></td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{c.descripcion||'—'}</td>
                    <td style={{fontSize:11,color:'var(--muted)',textTransform:'capitalize'}}>{c.color}</td>
                    <td><button className="btn-ghost" style={{fontSize:10,padding:'3px 9px',color:c.activa?'var(--g)':'var(--muted)'}} onClick={() => toggleActiva(c)}>{c.activa?'✓ Activa':'Inactiva'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tbl-foot" style={{fontSize:11,color:'var(--muted)'}}>
            Categorías globales. Desactivar oculta del selector sin borrar datos existentes.
          </div>
        </div>
        <div className="card">
          <div className="card-hdr"><span className="card-title">¿Por qué un catálogo controlado?</span></div>
          <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:10,fontSize:12}}>
            <div className="alert alert-err">Sin catálogo, texto libre genera duplicados:<br/><span style={{fontFamily:'monospace'}}>"Material Hierro" · "material hierro" · "MH"</span><br/>→ 3 categorías distintas que son la misma.</div>
            <div className="alert alert-ok">Con catálogo: cada línea elige de un selector. No es posible escribir a mano. Renombrar actualiza todo el sistema.</div>
          </div>
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal">
            <h3>Nueva Categoría</h3>
            <form onSubmit={handleSave}>
              <div className="form-row"><label>Nombre * (label en todos los selectores)</label><input required value={form.nombre} onChange={e => setForm(f=>({...f,nombre:e.target.value}))} placeholder="ej. Pintura y Anticorrosivo" /></div>
              <div className="form-row"><label>Descripción</label><textarea value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Para qué tipo de costos..." /></div>
              <div className="form-row"><label>Color</label><select value={form.color} onChange={e => setForm(f=>({...f,color:e.target.value}))}><option value="blue">Azul</option><option value="orange">Naranja</option><option value="green">Verde</option><option value="purple">Violeta</option><option value="red">Rojo</option><option value="gray">Gris</option></select></div>
              {form.nombre&&<div style={{marginBottom:12}}><span style={{fontSize:11,color:'var(--muted)',marginRight:8}}>Preview:</span><span className={`tag t-${form.color}`}>{form.nombre}</span></div>}
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]       = useState(null)
  const [autorizado, setAutorizado] = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadPermisos(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      if (session) loadPermisos(session.user.id)
      else { setAutorizado(false); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadPermisos = async (userId) => {
    try {
      const { data } = await supabase.from('user_roles').select('modulos').eq('user_id',userId).maybeSingle()
      const mods = data?.modulos || []
      setAutorizado(mods.length===0 || mods.includes(MODULO_ID))
    } catch { setAutorizado(false) }
    finally { setLoading(false) }
  }

  if (loading) return <><style>{CSS}</style><div className="loading-screen"><div className="loading-text">Cargando...</div></div></>
  if (!session) return <><style>{CSS}</style><LoginPage /></>
  if (!autorizado) return (
    <><style>{CSS}</style>
    <div className="sin-acceso">
      <div className="alert alert-err" style={{maxWidth:380,textAlign:'center',fontSize:14}}>Tu usuario no tiene acceso a este módulo.<br/>Contactá al administrador.</div>
      <button className="btn-ghost" onClick={() => supabase.auth.signOut()} style={{color:'#fff',borderColor:'rgba(255,255,255,.3)'}}>Cerrar sesión</button>
    </div></>
  )

  return (
    <HashRouter>
      <style>{CSS}</style>
      <Routes>
        <Route element={<Layout session={session} />}>
          <Route index              element={<Navigate to="overview" replace />} />
          <Route path="overview"    element={<Overview />} />
          <Route path="presupuesto" element={<Presupuesto />} />
          <Route path="oc"          element={<OC />} />
          <Route path="facturas"    element={<Facturas />} />
          <Route path="ingresos"    element={<Ingresos />} />
          <Route path="cashflow"    element={<Cashflow />} />
          <Route path="categorias"  element={<Categorias />} />
          <Route path="*"           element={<Navigate to="overview" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
