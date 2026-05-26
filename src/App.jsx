import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, useOutletContext } from 'react-router-dom'
import { supabase } from './lib/supabase'

const ERP_HOME_URL = 'https://integra.terra-mare.com.ar'
const MODULO_ID    = 'cost-tracker'

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy:#0B1629; --navy2:#132040; --gold:#B8942A; --gold2:#D4AA3A;
  --bg:#0d1117; --bg2:#161b22; --bg3:#21262d; --border:#30363d;
  --text:#e6edf3; --muted:#8b949e; --g:#10b981; --r:#ef4444;
  --w:#f59e0b; --accent:#3b82f6; --sans:'Montserrat',sans-serif; --mono:'DM Mono',monospace;
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
.login-left-title{font-size:48px;font-weight:900;color:#fff;line-height:0.95;letter-spacing:-2px}
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
.login-fg input:focus{border-color:var(--gold)}
.login-btn{width:100%;padding:12px;margin-top:8px;background:var(--gold);color:var(--navy);border:none;border-radius:8px;font-family:var(--sans);font-size:13px;font-weight:700;cursor:pointer;transition:background .15s;letter-spacing:.5px}
.login-btn:hover{background:var(--gold2)}
.login-btn:disabled{opacity:.5;cursor:not-allowed}
.login-error{background:rgba(239,68,68,0.12);color:#FCA5A5;border:1px solid rgba(239,68,68,0.25);border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:14px}
.login-footer{text-align:center;font-family:var(--mono);font-size:9px;color:rgba(255,255,255,0.2);margin-top:20px;letter-spacing:1px}
.login-back{text-align:center;margin-top:12px;font-size:11px;color:rgba(255,255,255,0.3);cursor:pointer;font-family:var(--mono)}
.login-back:hover{color:var(--gold)}

/* HEADER */
.hdr{background:linear-gradient(135deg,#213363,#235C96);padding:0 24px;display:flex;align-items:center;gap:16px;height:52px;border-bottom:1px solid rgba(255,255,255,.1);flex-shrink:0}
.hdr-logo{font-size:12px;font-weight:700;letter-spacing:2px;color:#fff;text-transform:uppercase}
.hdr-sep{color:rgba(255,255,255,.3)}
.hdr-title{font-size:14px;color:#fff;font-weight:600}
.hdr-right{margin-left:auto;display:flex;align-items:center;gap:12px}
.hdr-email{font-size:10px;font-family:var(--mono);color:rgba(255,255,255,.4)}
.hdr-sel{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);color:#fff;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;width:220px;font-family:var(--sans)}
.hdr-btn{background:transparent;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.6);font-family:var(--sans);font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer}
.hdr-btn:hover{color:#fff;border-color:rgba(255,255,255,.4)}

/* TABS */
.tabs{display:flex;gap:2px;padding:10px 24px 0;background:var(--bg2);border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto}
.tab{padding:8px 16px;font-size:13px;cursor:pointer;border-radius:6px 6px 0 0;color:var(--muted);font-weight:500;border-bottom:2px solid transparent;transition:all .15s;text-decoration:none;white-space:nowrap}
.tab:hover{color:var(--text);background:var(--bg3)}
.tab.active{color:var(--accent);border-bottom-color:var(--accent);background:var(--bg)}

/* MAIN */
.main{padding:20px 24px;flex:1;overflow-y:auto}
.app-wrap{min-height:100vh;display:flex;flex-direction:column}

/* CARD */
.card{background:var(--bg2);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px}
.card-hdr{padding:11px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:var(--bg3)}
.card-title{font-size:13px;font-weight:600}

/* KPI */
.kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.kpi{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
.kpi-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:600}
.kpi-val{font-size:22px;font-weight:700;line-height:1}
.kpi-sub{font-size:11px;color:var(--muted);margin-top:5px}

/* TABLE */
.tbl-wrap{overflow-x:auto;max-height:360px;overflow-y:auto}
table{width:100%;border-collapse:collapse;font-size:12px}
th{padding:7px 12px;text-align:left;color:var(--muted);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);background:var(--bg3);white-space:nowrap}
td{padding:8px 12px;border-bottom:1px solid rgba(48,54,61,.5);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(48,54,61,.35)}
.mono{font-family:'Courier New',monospace;font-size:11px}

/* CHIPS */
.chip{display:inline-flex;align-items:center;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.c-ok{background:rgba(16,185,129,.12);color:#6ee7b7;border:1px solid rgba(16,185,129,.25)}
.c-pend{background:rgba(245,158,11,.12);color:#fcd34d;border:1px solid rgba(245,158,11,.25)}
.c-apr{background:rgba(59,130,246,.12);color:#93c5fd;border:1px solid rgba(59,130,246,.25)}
.c-no{background:var(--bg3);color:var(--muted);border:1px solid var(--border)}

/* TAGS */
.tag{font-size:10px;padding:2px 7px;border-radius:8px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.t-blue{background:rgba(59,130,246,.15);color:#93c5fd}
.t-orange{background:rgba(245,158,11,.15);color:#fcd34d}
.t-green{background:rgba(16,185,129,.15);color:#6ee7b7}
.t-purple{background:rgba(139,92,246,.15);color:#c4b5fd}
.t-gray{background:rgba(156,163,175,.15);color:#d1d5db}

/* COLORS */
.g{color:#10b981}.r{color:#ef4444}.w{color:#f59e0b}.b{color:#3b82f6}

/* BUTTONS */
.btn{background:var(--accent);color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:600;cursor:pointer}
.btn:hover{opacity:.88}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);padding:5px 12px;border-radius:6px;font-size:12px;font-family:var(--sans);cursor:pointer}

/* FORM */
select,input[type=text],input[type=number],input[type=date],input[type=email],textarea{background:var(--bg3);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:6px;font-size:12px;font-family:var(--sans);width:100%;outline:none;transition:border-color .15s}
select:focus,input:focus,textarea:focus{border-color:var(--accent)}
textarea{resize:vertical;min-height:64px}
.form-row{margin-bottom:12px}
.form-row label{display:block;font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;font-weight:600}

/* GRID */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}

/* PROGRESS */
.prog-wrap{height:5px;background:var(--bg3);border-radius:3px;overflow:hidden}
.prog{height:100%;border-radius:3px;transition:width .3s}

/* TABLE FOOTER */
.tbl-foot{padding:10px 16px;background:var(--bg3);border-top:1px solid var(--border);display:flex;gap:20px;font-size:12px;flex-wrap:wrap;align-items:center}

/* ALERTS */
.alert{border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:8px;line-height:1.5}
.alert-warn{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);color:#fcd34d}
.alert-ok{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);color:#6ee7b7}
.alert-err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#fca5a5}

/* MODAL */
.overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:200;align-items:center;justify-content:center}
.overlay.open{display:flex}
.modal{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto}
.modal h3{font-size:15px;font-weight:700;margin-bottom:16px}
.modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}

/* EMPTY / LOADING */
.loading{padding:40px;text-align:center;color:var(--muted)}
.empty{padding:32px;text-align:center;color:var(--muted)}

/* SIN ACCESO */
.sin-acceso{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--navy);gap:16px;padding:24px;text-align:center}

/* MOBILE */
@media(max-width:640px){
  .login-left{display:none}
  .login-right{width:100%;padding:40px 24px}
  .kpi-row{grid-template-columns:1fr 1fr}
  .two-col{grid-template-columns:1fr}
  .hdr-email{display:none}
  .tabs{padding:8px 12px 0}
  .tab{padding:7px 12px;font-size:12px}
  .main{padding:16px}
}
`

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    supabase.from('cpt_proyectos').select('id,nombre,cliente').eq('estado','activo').order('created_at',{ascending:false})
      .then(({ data }) => {
        setProyectos(data || [])
        if (!proyectoId && data?.length === 1) {
          setProyectoId(data[0].id)
          localStorage.setItem('cpt_proyecto_id', data[0].id)
        }
      })
  }, []) // eslint-disable-line

  const handleProyecto = (id) => {
    setProyectoId(id)
    localStorage.setItem('cpt_proyecto_id', id)
  }

  const proyecto = proyectos.find(p => p.id === proyectoId) || null

  return (
    <div className="app-wrap">
      <header className="hdr">
        <span className="hdr-logo">Terra Mare</span>
        <span className="hdr-sep">›</span>
        <span className="hdr-title">Cost Tracker</span>
        <div className="hdr-right">
          <select className="hdr-sel" value={proyectoId} onChange={e => handleProyecto(e.target.value)}>
            <option value="" disabled>Seleccionar proyecto...</option>
            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <span className="hdr-email">{session?.user?.email}</span>
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
          ? <div className="empty" style={{ marginTop: 60 }}>Seleccioná un proyecto para comenzar</div>
          : <Outlet context={{ proyecto }} />
        }
      </div>
    </div>
  )
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
function Overview() {
  const { proyecto } = useOutletContext()
  const [pnl, setPnl]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!proyecto) return
    setLoading(true)
    supabase.from('cpt_proyecto_pnl').select('*').eq('proyecto_id', proyecto.id).maybeSingle()
      .then(({ data }) => { setPnl(data); setLoading(false) })
  }, [proyecto])

  if (loading) return <div className="loading">Cargando...</div>

  const ingreso   = pnl?.ingreso_cotizado_usd    || 0
  const costoPres = pnl?.costo_presupuestado_usd || 0
  const costoReal = pnl?.costo_real_confirmado_usd || 0
  const cobrado   = pnl?.ingreso_cobrado_usd      || 0
  const mbPct     = pnl?.margen_budget_pct        || 0
  const mfPct     = pnl?.margen_forecast_pct      || 0

  return (
    <>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-lbl">Ingresos Cotizados</div><div className="kpi-val b">{fmtUSD(ingreso)}</div><div className="kpi-sub">USD · Propuesta Cliente</div></div>
        <div className="kpi"><div className="kpi-lbl">Costo Presupuestado</div><div className="kpi-val" style={{color:'var(--muted)'}}>{fmtUSD(costoPres)}</div><div className="kpi-sub">USD · todas las líneas</div></div>
        <div className="kpi"><div className="kpi-lbl">Costo Real</div><div className="kpi-val w">{fmtUSD(costoReal)}</div><div className="kpi-sub">OC + facturas cargadas</div></div>
        <div className="kpi"><div className="kpi-lbl">Margen Budget</div><div className="kpi-val g">{mbPct}%</div><div className="kpi-sub">{fmtUSD(ingreso - costoPres)} USD</div></div>
        <div className="kpi"><div className="kpi-lbl">Margen Forecast</div><div className="kpi-val g" style={{fontSize:24}}>{mfPct}%</div><div className="kpi-sub">Con costos reales</div></div>
      </div>
      <div className="two-col">
        <div className="card">
          <div className="card-hdr"><span className="card-title">Ejecución</span></div>
          <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:12}}><span>Cobrado vs Cotizado</span><strong>{fmtUSD(cobrado)} / {fmtUSD(ingreso)}</strong></div>
              <div className="prog-wrap"><div className="prog" style={{width:ingreso>0?`${Math.min(cobrado/ingreso*100,100)}%`:'0%',background:'linear-gradient(90deg,#047857,#10b981)'}} /></div>
            </div>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:12}}><span>Costo ejecutado vs Presupuesto</span><strong>{fmtUSD(costoReal)} / {fmtUSD(costoPres)}</strong></div>
              <div className="prog-wrap"><div className="prog" style={{width:costoPres>0?`${Math.min(costoReal/costoPres*100,100)}%`:'0%',background:'linear-gradient(90deg,#235C96,#3b82f6)'}} /></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-hdr"><span className="card-title">Proyecto</span></div>
          <div style={{padding:'14px 16px',fontSize:13,display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Nombre</span><strong>{proyecto.nombre}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Cliente</span><strong>{proyecto.cliente}</strong></div>
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
  const [form, setForm] = useState({ item_numero:'', descripcion:'', categoria_id:'', frecuencia:'one-time', moneda_pres:'USD', monto_pres:'', fx_pres:'', es_reembolsable:false, handling_fee_pct:'', estado:'estimado' })

  const cargar = async () => {
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from('cpt_presupuesto_lineas').select('*,cpt_categorias(nombre,color)').eq('proyecto_id', proyecto.id).order('item_numero'),
      supabase.from('cpt_categorias').select('id,nombre,color').eq('activa',true).order('nombre'),
    ])
    setLineas(l || []); setCategorias(c || [])
  }

  useEffect(() => { if (!proyecto) return; setLoading(true); cargar().finally(() => setLoading(false)) }, [proyecto]) // eslint-disable-line

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_presupuesto_lineas').insert({ ...form, proyecto_id: proyecto.id, monto_pres: Number(form.monto_pres)||null, fx_pres: Number(form.fx_pres)||null, handling_fee_pct: Number(form.handling_fee_pct)||null })
      if (error) { alert(error.message); return }
      setModal(false)
      setForm({ item_numero:'', descripcion:'', categoria_id:'', frecuencia:'one-time', moneda_pres:'USD', monto_pres:'', fx_pres:'', es_reembolsable:false, handling_fee_pct:'', estado:'estimado' })
      await cargar()
    } finally { setSaving(false) }
  }

  const totalPres = lineas.reduce((s, l) => s + (l.monto_pres_usd || 0), 0)
  const totalReal = lineas.reduce((s, l) => s + (l.monto_real_usd || 0), 0)

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <>
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Líneas de Costo</span>
          <div style={{display:'flex',gap:8}}>
            <select style={{width:180}} onChange={e => {}}><option value="">Todas las categorías</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
            <button className="btn" onClick={() => setModal(true)}>+ Nueva línea</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Item</th><th>Descripción</th><th>Categoría</th><th>Frec.</th><th>Moneda</th><th>Pres. USD</th><th>Real USD</th><th>Delta</th><th>Estado</th></tr></thead>
            <tbody>
              {lineas.length === 0 && <tr><td colSpan={9} className="empty">Sin líneas — agregá la primera</td></tr>}
              {lineas.map(l => {
                const delta = l.monto_real_usd != null ? l.monto_real_usd - (l.monto_pres_usd || 0) : null
                return (
                  <tr key={l.id} style={l.estado==='alerta'?{background:'rgba(239,68,68,.04)'}:{}}>
                    <td style={{color:'var(--muted)',fontSize:11}}>{l.item_numero||'—'}</td>
                    <td>{l.descripcion}</td>
                    <td>{l.cpt_categorias && <span className={`tag t-${l.cpt_categorias.color}`}>{l.cpt_categorias.nombre}</span>}</td>
                    <td style={{color:'var(--muted)',fontSize:11}}>{l.frecuencia}</td>
                    <td className="mono">{l.moneda_pres}</td>
                    <td className="mono">{fmtUSD(l.monto_pres_usd)}</td>
                    <td className="mono">{fmtUSD(l.monto_real_usd)}</td>
                    <td className={`mono ${delta==null?'':delta<=0?'g':'r'}`}>{delta==null?'—':(delta>0?'+':'')+fmtUSD(delta)}</td>
                    <td><span className={`chip ${l.estado==='confirmado'?'c-ok':l.estado==='alerta'?'c-pend':'c-apr'}`}>{l.estado}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>Presupuestado: <strong style={{color:'var(--text)'}}>{fmtUSD(totalPres)}</strong></span>
          <span style={{color:'var(--muted)'}}>Real: <strong className="g">{fmtUSD(totalReal)}</strong></span>
          <span style={{marginLeft:'auto'}} className={totalReal<=totalPres?'g':'r'}>Delta: {fmtUSD(totalReal-totalPres)}</span>
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
              <div className="form-row"><label>Descripción *</label><input required value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))} placeholder="ej. Fixed A-Frame – Material" /></div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Moneda</label><select value={form.moneda_pres} onChange={e => setForm(f=>({...f,moneda_pres:e.target.value}))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
                <div className="form-row"><label>FX {form.moneda_pres==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx_pres} onChange={e => setForm(f=>({...f,fx_pres:e.target.value}))} disabled={form.moneda_pres==='USD'} required={form.moneda_pres==='ARS'} placeholder="ej. 1400" /></div>
              </div>
              <div className="form-row"><label>Monto Presupuestado ({form.moneda_pres}) *</label><input required type="number" step="0.01" value={form.monto_pres} onChange={e => setForm(f=>({...f,monto_pres:e.target.value}))} placeholder="0.00" /></div>
              <div className="two-col" style={{marginBottom:0,gap:12}}>
                <div className="form-row"><label>Frecuencia</label><select value={form.frecuencia} onChange={e => setForm(f=>({...f,frecuencia:e.target.value}))}><option value="one-time">One-time</option><option value="mensual">Mensual</option></select></div>
                <div className="form-row"><label>Estado</label><select value={form.estado} onChange={e => setForm(f=>({...f,estado:e.target.value}))}><option value="estimado">Estimado</option><option value="confirmado">Confirmado</option><option value="pendiente_oc">Pendiente OC</option></select></div>
              </div>
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
      supabase.from('cpt_oc_saldo').select('*').eq('proyecto_id', proyecto.id),
      supabase.from('cpt_categorias').select('id,nombre,color').eq('activa',true).order('nombre'),
    ])
    setOcs(o || []); setCategorias(c || [])
  }

  useEffect(() => { if (!proyecto) return; setLoading(true); cargar().finally(() => setLoading(false)) }, [proyecto]) // eslint-disable-line

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_oc').insert({ ...form, proyecto_id: proyecto.id, monto_sin_iva: Number(form.monto_sin_iva), iva_pct: Number(form.iva_pct), fx: Number(form.fx)||null })
      if (error) { alert(error.message); return }
      setModal(false)
      setForm({ numero_oc:'', proveedor:'', categoria_id:'', descripcion:'', moneda:'USD', monto_sin_iva:'', iva_pct:'21', fx:'', fecha_emision:'', estado:'pendiente_aprobacion' })
      await cargar()
    } finally { setSaving(false) }
  }

  const CHIP = { pendiente_aprobacion:'c-pend', aprobada:'c-apr', activa:'c-ok', completada:'c-ok', cancelada:'c-no' }
  const totalOC   = ocs.reduce((s, o) => s + (o.oc_total_usd || 0), 0)
  const totalPend = ocs.reduce((s, o) => s + (o.saldo_usd || 0), 0)

  if (loading) return <div className="loading">Cargando...</div>

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
              {ocs.length === 0 && <tr><td colSpan={10} className="empty">Sin OC — creá la primera</td></tr>}
              {ocs.map(o => (
                <tr key={o.id}>
                  <td className="mono b">{o.numero_oc}</td>
                  <td><strong>{o.proveedor}</strong></td>
                  <td style={{color:'var(--muted)',fontSize:11}}>{o.descripcion}</td>
                  <td className="mono">{o.moneda}</td>
                  <td className="mono">{fmtUSD(o.oc_total_usd)}</td>
                  <td className="mono">{fmtUSD(o.oc_total_usd_con_iva)}</td>
                  <td>
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      <span className={`mono ${o.pct_facturado>=100?'g':'w'}`} style={{fontSize:11}}>{fmtUSD(o.facturado_usd)} ({o.pct_facturado}%)</span>
                      <div className="prog-wrap" style={{width:80}}><div className="prog" style={{width:`${o.pct_facturado}%`,background:o.pct_facturado>=100?'#10b981':'#3b82f6'}} /></div>
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
          <span style={{color:'var(--muted)'}}>Total: <strong>{fmtUSD(totalOC)}</strong></span>
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
  const [tab, setTab]         = useState('compra')
  const [fcompra, setFcompra] = useState([])
  const [fventa, setFventa]   = useState([])
  const [ocs, setOcs]         = useState([])
  const [ocSaldos, setOcSaldos] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalC, setModalC]   = useState(false)
  const [modalV, setModalV]   = useState(false)
  const [saving, setSaving]   = useState(false)
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
    const map = {}; for (const x of (s||[])) map[x.id]=x; setOcSaldos(map)
  }

  useEffect(() => { if (!proyecto) return; setLoading(true); cargar().finally(() => setLoading(false)) }, [proyecto]) // eslint-disable-line
  useEffect(() => { if (!formC.oc_id) return; const oc = ocs.find(o=>o.id===formC.oc_id); if (oc) setFormC(f=>({...f,proveedor:oc.proveedor})) }, [formC.oc_id]) // eslint-disable-line

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

  const CHIPFC = { pagada:'c-ok', pendiente_pago:'c-apr', vencida:'c-err' }
  const CHIPFV = { cobrada:'c-ok', cobro_parcial:'c-pend', emitida:'c-apr', no_emitida:'c-no' }
  const ocSel  = formC.oc_id ? ocSaldos[formC.oc_id] : null

  if (loading) return <div className="loading">Cargando...</div>

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
              <thead><tr><th>#Factura</th><th>Proveedor</th><th>OC</th><th>USD s/IVA</th><th>USD c/IVA</th><th>% OC</th><th>Fecha</th><th>Estado</th></tr></thead>
              <tbody>
                {fcompra.length===0 && <tr><td colSpan={8} className="empty">Sin facturas registradas</td></tr>}
                {fcompra.map(f => {
                  const s = ocSaldos[f.oc_id]
                  const pct = s?.oc_total_usd>0 ? Math.round(f.monto_usd_sin_iva/s.oc_total_usd*100) : null
                  return (
                    <tr key={f.id}>
                      <td className="mono">{f.numero_factura}</td>
                      <td>{f.proveedor}</td>
                      <td className="mono b">{f.cpt_oc?.numero_oc}</td>
                      <td className="mono">{fmtUSD(f.monto_usd_sin_iva)}</td>
                      <td className="mono">{fmtUSD(f.monto_usd_con_iva)}</td>
                      <td>{pct!=null && <div style={{display:'flex',alignItems:'center',gap:6}}><div className="prog-wrap" style={{width:50}}><div className="prog" style={{width:`${pct}%`,background:pct>=100?'#10b981':'#3b82f6'}} /></div><span style={{fontSize:11,color:pct>=100?'var(--g)':'#93c5fd'}}>{pct}%</span></div>}</td>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{f.fecha_factura}</td>
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
              <thead><tr><th>#Factura</th><th>Concepto</th><th>Monto USD</th><th>Emitida</th><th>Cobrado</th><th>Pendiente</th><th>Estado</th></tr></thead>
              <tbody>
                {fventa.length===0 && <tr><td colSpan={7} className="empty">Sin facturas de venta</td></tr>}
                {fventa.map(f => (
                  <tr key={f.id}>
                    <td className="mono">{f.numero_factura||'—'}</td>
                    <td>{f.concepto}</td>
                    <td className="mono b">{fmtUSD(f.monto_usd)}</td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{f.fecha_emision||'—'}</td>
                    <td className={`mono ${f.monto_cobrado>0?'g':''}`}>{fmtUSD(f.monto_cobrado)}</td>
                    <td className={`mono ${(f.monto_usd-(f.monto_cobrado||0))>0?'w':''}`}>{fmtUSD(f.monto_usd-(f.monto_cobrado||0))}</td>
                    <td><span className={`chip ${CHIPFV[f.estado]||'c-no'}`}>{f.estado.replace('_',' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              {ocSel && <div className="alert" style={{background:'rgba(59,130,246,.08)',border:'1px solid rgba(59,130,246,.2)',color:'#93c5fd',marginBottom:12}}>{ocSel.numero_oc} — Saldo disponible: <strong>{fmtUSD(ocSel.saldo_usd)} USD</strong></div>}
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
              <div className="form-row"><label>Número</label><input value={formV.numero_factura} onChange={e => setFormV(f=>({...f,numero_factura:e.target.value}))} placeholder="ej. FV-001 (vacío si no emitida)" /></div>
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

  if (loading) return <div className="loading">Cargando...</div>

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
            <thead><tr><th>Item</th><th>Descripción</th><th>Categoría</th><th>Costo Pres.</th><th>Costo Real</th><th>Delta</th><th>Remb.</th></tr></thead>
            <tbody>
              {lineas.length===0 && <tr><td colSpan={7} className="empty">Sin líneas cargadas</td></tr>}
              {lineas.map(l => {
                const delta = l.monto_real_usd!=null ? l.monto_real_usd-(l.monto_pres_usd||0) : null
                return (
                  <tr key={l.id} style={delta>0?{background:'rgba(239,68,68,.04)'}:{}}>
                    <td style={{color:'var(--muted)',fontSize:11}}>{l.item_numero||'—'}</td>
                    <td>{l.descripcion}</td>
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
          <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10,fontSize:13}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Ingreso cotizado</span><strong className="b">{fmtUSD(totalCotizado)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo presupuestado</span><strong style={{color:'var(--muted)'}}>{fmtUSD(totalPres)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo real / forecast</span><strong className="g">{fmtUSD(totalReal)}</strong></div>
            <div style={{borderTop:'1px solid var(--border)',paddingTop:10,display:'flex',justifyContent:'space-between'}}><span>Margen budget</span><strong className="g">{mBudget}%</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Margen forecast</span><strong className="g" style={{fontSize:16}}>{mReal}%</strong></div>
          </div>
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Facturas de Venta</span></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Concepto</th><th>Monto</th><th>Cobrado</th></tr></thead>
              <tbody>
                {fventa.length===0 && <tr><td colSpan={3} className="empty">Sin facturas</td></tr>}
                {fventa.map(f => <tr key={f.id}><td style={{fontSize:11}}>{f.concepto}</td><td className="mono b">{fmtUSD(f.monto_usd)}</td><td className={`mono ${f.monto_cobrado>0?'g':''}`}>{fmtUSD(f.monto_cobrado)}</td></tr>)}
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

  if (loading) return <div className="loading">Cargando...</div>

  let acum = 0
  const conAcum = eventos.map(e => { if (e.categoria_cf==='real') acum+=Number(e.monto_usd); return {...e,acum} })
  const totalCobrado = eventos.filter(e=>e.tipo==='ingreso'&&e.categoria_cf==='real').reduce((s,e)=>s+Number(e.monto_usd),0)
  const totalPagado  = eventos.filter(e=>e.tipo==='egreso' &&e.categoria_cf==='real').reduce((s,e)=>s+Math.abs(Number(e.monto_usd)),0)

  return (
    <>
      <div className="two-col">
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Caja del Proyecto</span></div>
          <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:9,fontSize:13}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:9,background:'var(--bg3)',borderRadius:7}}><span style={{color:'var(--muted)'}}>Cobrado</span><strong className="g">+{fmtUSD(totalCobrado)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:9,background:'var(--bg3)',borderRadius:7}}><span style={{color:'var(--muted)'}}>Pagado</span><strong className="r">−{fmtUSD(totalPagado)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:9,background:'rgba(16,185,129,.08)',border:'1px solid rgba(16,185,129,.2)',borderRadius:7}}><span style={{fontWeight:700}}>Caja hoy</span><strong style={{color:'#10b981',fontSize:16}}>{totalCobrado-totalPagado>=0?'+':''}{fmtUSD(totalCobrado-totalPagado)}</strong></div>
          </div>
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Info</span></div>
          <div style={{padding:'14px 16px',fontSize:12,color:'var(--muted)',lineHeight:1.7}}>
            <p>El cashflow se construye automáticamente desde las fechas de pago/cobro cargadas en Facturas.</p>
            <p style={{marginTop:8}}>Registros con fecha vacía aparecen como forecast cuando tengan vencimiento cargado.</p>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Línea de Tiempo</span></div>
        {eventos.length===0
          ? <div className="empty">Sin eventos — cargá fechas de pago en Facturas</div>
          : (
            <div className="tbl-wrap" style={{maxHeight:'none'}}>
              <table>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Contraparte</th><th>Referencia</th><th>Monto USD</th><th>Tipo</th><th>Acumulado</th></tr></thead>
                <tbody>
                  {conAcum.map((e,i) => (
                    <tr key={i}>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{e.fecha}</td>
                      <td><span className={`chip ${e.tipo==='ingreso'?'c-ok':'c-err'}`}>{e.tipo}</span></td>
                      <td>{e.contraparte}</td>
                      <td className="mono" style={{color:'var(--muted)'}}>{e.referencia||'—'}</td>
                      <td className={`mono ${e.tipo==='ingreso'?'g':'r'}`}>{e.tipo==='ingreso'?'+':''}{fmtUSD(Number(e.monto_usd))}</td>
                      <td style={{fontSize:10,color:e.categoria_cf==='real'?'var(--g)':'var(--w)',fontWeight:600,textTransform:'uppercase'}}>{e.categoria_cf==='real'?'● Real':'◌ Forecast'}</td>
                      <td className={`mono ${e.acum>=0?'g':'r'}`}>{e.acum>=0?'+':''}{fmtUSD(e.acum)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
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
    await supabase.from('cpt_categorias').update({ activa: !cat.activa }).eq('id', cat.id)
    await cargar()
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <>
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
                <tr key={c.id} style={{opacity:c.activa?1:0.45}}>
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
          Categorías globales a todos los proyectos. Desactivar oculta del selector sin borrar datos.
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e => e.target===e.currentTarget && setModal(false)}>
          <div className="modal">
            <h3>Nueva Categoría</h3>
            <form onSubmit={handleSave}>
              <div className="form-row"><label>Nombre *</label><input required value={form.nombre} onChange={e => setForm(f=>({...f,nombre:e.target.value}))} placeholder="ej. Pintura y Anticorrosivo" /></div>
              <div className="form-row"><label>Descripción</label><textarea value={form.descripcion} onChange={e => setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Para qué tipo de costos..." /></div>
              <div className="form-row"><label>Color</label><select value={form.color} onChange={e => setForm(f=>({...f,color:e.target.value}))}><option value="blue">Azul</option><option value="orange">Naranja</option><option value="green">Verde</option><option value="purple">Violeta</option><option value="red">Rojo</option><option value="gray">Gris</option></select></div>
              {form.nombre && <div style={{marginBottom:12}}><span style={{fontSize:11,color:'var(--muted)',marginRight:8}}>Preview:</span><span className={`tag t-${form.color}`}>{form.nombre}</span></div>}
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
      <div className="alert alert-err" style={{maxWidth:380,textAlign:'center'}}>Tu usuario no tiene acceso a este módulo.</div>
      <button className="btn-ghost" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
    </div></>
  )

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}
