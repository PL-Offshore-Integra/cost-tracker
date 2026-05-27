import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'

const ERP_HOME_URL = 'https://integra.terra-mare.com.ar'

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  getProyectos: async () => {
    const { data, error } = await supabase
      .from('cpt_proyectos')
      .select('id,nombre,cliente')
      .eq('estado','activo')
      .order('created_at',{ascending:false})
    if (error) throw error
    return data || []
  },
  getCategorias: async () => {
    const { data, error } = await supabase
      .from('cpt_categorias')
      .select('id,nombre,color')
      .eq('activa',true)
      .order('nombre')
    if (error) throw error
    return data || []
  },
  getLineas: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_presupuesto_lineas')
      .select('*,cpt_categorias(nombre,color)')
      .eq('proyecto_id',proyectoId)
      .order('item_numero')
    if (error) throw error
    return data || []
  },
  getOCs: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_oc_saldo')
      .select('*')
      .eq('proyecto_id',proyectoId)
    if (error) throw error
    return data || []
  },
  getOCsBasic: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_oc')
      .select('id,numero_oc,proveedor')
      .eq('proyecto_id',proyectoId)
      .order('numero_oc')
    if (error) throw error
    return data || []
  },
  getOCSaldos: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_oc_saldo')
      .select('id,numero_oc,saldo_usd,oc_total_usd')
      .eq('proyecto_id',proyectoId)
    if (error) throw error
    const map = {}
    for (const x of data || []) map[x.id] = x
    return map
  },
  getFacturasCompra: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_facturas_compra')
      .select('*,cpt_oc(numero_oc,proveedor)')
      .eq('proyecto_id',proyectoId)
      .order('fecha_factura',{ascending:false})
    if (error) throw error
    return data || []
  },
  getFacturasVenta: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_facturas_venta')
      .select('*')
      .eq('proyecto_id',proyectoId)
      .order('fecha_emision',{ascending:false})
    if (error) throw error
    return data || []
  },
  getPNL: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_proyecto_pnl')
      .select('*')
      .eq('proyecto_id',proyectoId)
      .maybeSingle()
    if (error) throw error
    return data
  },
  getCashflow: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_cashflow')
      .select('*')
      .eq('proyecto_id',proyectoId)
      .order('fecha')
    if (error) throw error
    return data || []
  },
  getAlertas: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_presupuesto_lineas')
      .select('descripcion,monto_pres_usd,monto_real_usd')
      .eq('proyecto_id',proyectoId)
      .eq('estado','alerta')
    if (error) throw error
    return data || []
  },
  getAllCategorias: async () => {
    const { data, error } = await supabase
      .from('cpt_categorias')
      .select('*')
      .order('nombre')
    if (error) throw error
    return data || []
  },
}

const fmtUSD = (n) => n == null ? '—' : '$' + Number(n).toLocaleString('es-AR',{minimumFractionDigits:0})

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy:#0B1629;--gold:#B8942A;--gold2:#D4AA3A;--blue:#235C96;
  --bg:#F0F4F8;--surface:#fff;--border:#D6E0ED;
  --text:#0B1629;--muted:#6381A7;
  --g:#059669;--r:#DC2626;--w:#D97706;
  --sans:'Montserrat',sans-serif;--mono:'DM Mono',monospace;
}
body{font-family:var(--sans);background:var(--bg);color:var(--text);font-size:13px;min-height:100vh}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

/* APP SHELL */
.app-wrap{display:flex;flex-direction:column;min-height:100vh}

/* HEADER */
.header{background:var(--navy);padding:0 28px;display:flex;align-items:center;justify-content:space-between;height:58px;border-bottom:1px solid rgba(184,148,42,.2);flex-shrink:0}
.hdr-brand{display:flex;align-items:center;gap:12px}
.hdr-logo{width:30px;height:30px;border-radius:50%;object-fit:cover;border:1.5px solid rgba(255,255,255,.2)}
.hdr-divider{width:1px;height:22px;background:rgba(184,148,42,.25)}
.hdr-name{font-size:12px;font-weight:800;color:#fff;letter-spacing:2px;text-transform:uppercase}
.hdr-sub{font-size:9px;color:var(--gold);letter-spacing:1px;font-family:var(--mono);text-transform:uppercase}
.hdr-right{display:flex;align-items:center;gap:10px}
.hdr-sel{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);color:#fff;padding:5px 10px;border-radius:6px;font-size:12px;font-weight:600;width:220px;font-family:var(--sans)}
.hdr-btn{background:transparent;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.55);font-family:var(--sans);font-size:10px;font-weight:600;padding:5px 12px;border-radius:6px;cursor:pointer;letter-spacing:.3px}
.hdr-btn:hover{border-color:rgba(255,255,255,.35);color:#fff}
.hdr-btn-gold{background:var(--gold);color:var(--navy);border:none;font-family:var(--sans);font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;cursor:pointer;letter-spacing:.3px}
.hdr-btn-gold:hover{background:var(--gold2)}
.hdr-email{font-size:10px;font-family:var(--mono);color:rgba(255,255,255,.35)}

/* TABS */
.tabs{display:flex;background:var(--navy);border-bottom:1px solid rgba(184,148,42,.15);padding:0 28px;overflow-x:auto;flex-shrink:0}
.tab{padding:13px 16px;font-size:12px;font-weight:600;cursor:pointer;color:rgba(255,255,255,.4);border-bottom:2px solid transparent;text-decoration:none;white-space:nowrap;letter-spacing:.3px;transition:all .15s}
.tab:hover{color:rgba(255,255,255,.8)}
.tab.active{color:#fff;border-bottom-color:var(--gold)}

/* MAIN */
.main{flex:1;padding:24px 28px;overflow-y:auto}

/* CARD */
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px;box-shadow:0 1px 3px rgba(11,22,41,.06)}
.card-hdr{padding:11px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:#FAFBFC}
.card-title{font-size:13px;font-weight:700;color:var(--navy)}

/* KPI */
.kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:15px 16px;box-shadow:0 1px 3px rgba(11,22,41,.06)}
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
.chip{display:inline-flex;align-items:center;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.c-ok{background:#D1FAE5;color:#065F46;border:1px solid #A7F3D0}
.c-pend{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A}
.c-apr{background:#DBEAFE;color:#1E40AF;border:1px solid #BFDBFE}
.c-no{background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB}

/* TAGS */
.tag{font-size:10px;padding:2px 7px;border-radius:6px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.t-blue{background:#DBEAFE;color:#1E40AF}
.t-orange{background:#FEF3C7;color:#92400E}
.t-green{background:#D1FAE5;color:#065F46}
.t-purple{background:#EDE9FE;color:#5B21B6}
.t-red{background:#FEE2E2;color:#991B1B}
.t-gray{background:#F3F4F6;color:#6B7280}

/* COLORS */
.cg{color:#059669}.cr{color:#DC2626}.cw{color:#D97706}.cb{color:#235C96}

/* BUTTONS */
.btn{background:#235C96;color:#fff;border:none;padding:7px 14px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:700;cursor:pointer;transition:all .15s}
.btn:hover{background:#1a4a7a}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:600;cursor:pointer}
.btn-ghost:hover{color:var(--text);border-color:var(--muted)}

/* FORM */
select,input[type=text],input[type=number],input[type=date],input[type=email],input[type=password],textarea{background:#fff;border:1px solid var(--border);color:var(--text);padding:7px 10px;border-radius:6px;font-size:12px;font-family:var(--sans);width:100%;outline:none;transition:border-color .15s}
select:focus,input:focus,textarea:focus{border-color:#235C96;box-shadow:0 0 0 3px rgba(35,92,150,.1)}
textarea{resize:vertical;min-height:60px}
.form-row{margin-bottom:12px}
.form-row label{display:block;font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;font-weight:700}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:0}

/* PROGRESS */
.prog-wrap{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.prog{height:100%;border-radius:3px;transition:width .3s}

/* TABLE FOOTER */
.tbl-foot{padding:10px 16px;background:#FAFBFC;border-top:1px solid var(--border);display:flex;gap:20px;font-size:12px;flex-wrap:wrap;align-items:center}

/* ALERTS */
.alert{border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:8px;line-height:1.5}
.alert-ok{background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46}
.alert-err{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B}
.alert-warn{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E}
.alert-info{background:#EFF6FF;border:1px solid #BFDBFE;color:#1E40AF}

/* MODAL */
.overlay{display:none;position:fixed;inset:0;background:rgba(11,22,41,.55);z-index:200;align-items:center;justify-content:center}
.overlay.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:26px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(11,22,41,.2)}
.modal h3{font-size:15px;font-weight:800;color:var(--navy);margin-bottom:18px}
.modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}

/* EMPTY / LOADING */
.state-msg{padding:40px;text-align:center;color:var(--muted);font-size:12px}

/* LOGIN */
.login-wrap{min-height:100vh;display:flex;background:var(--navy);position:relative;overflow:hidden}
.login-overlay{position:absolute;inset:0;z-index:1;background:linear-gradient(135deg,rgba(11,22,41,.92) 0%,rgba(11,22,41,.75) 60%,rgba(11,22,41,.92) 100%)}
.login-lines{position:absolute;inset:0;z-index:0;background-image:linear-gradient(rgba(184,148,42,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(184,148,42,.04) 1px,transparent 1px);background-size:60px 60px}
.login-split{position:relative;z-index:2;display:flex;width:100%}
.login-left{flex:1;display:flex;flex-direction:column;justify-content:center;padding:80px 60px;border-right:1px solid rgba(184,148,42,.15)}
.login-eyebrow{font-family:var(--mono);font-size:10px;letter-spacing:3px;color:var(--gold);text-transform:uppercase;margin-bottom:20px}
.login-logo-row{display:flex;align-items:center;gap:14px;margin-bottom:20px}
.login-logo-img{width:50px;height:50px;border-radius:12px;object-fit:cover;border:2px solid rgba(255,255,255,.15)}
.login-title{font-size:50px;font-weight:900;color:#fff;line-height:.95;letter-spacing:-2px}
.login-title span{color:var(--gold);display:block}
.login-line{width:48px;height:3px;background:var(--gold);margin:18px 0}
.login-sub{font-size:13px;color:rgba(255,255,255,.4);line-height:1.7;max-width:300px;font-style:italic}
.login-right{width:420px;flex-shrink:0;display:flex;align-items:center;justify-content:center;padding:60px 44px}
.login-card{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(184,148,42,.2);border-radius:16px;padding:36px;backdrop-filter:blur(20px)}
.login-card-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:4px}
.login-card-sub{font-family:var(--mono);font-size:10px;color:rgba(255,255,255,.35);letter-spacing:1px;margin-bottom:24px;text-transform:uppercase}
.login-fg{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
.login-fg label{font-size:9px;color:rgba(255,255,255,.4);letter-spacing:1px;text-transform:uppercase;font-weight:600}
.login-fg input{border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:10px 13px;font-size:13px;font-family:var(--sans);color:#fff;background:rgba(255,255,255,.06);outline:none;transition:border-color .15s;width:100%}
.login-fg input::placeholder{color:rgba(255,255,255,.2)}
.login-fg input:focus{border-color:var(--gold);background:rgba(255,255,255,.09)}
.login-submit{width:100%;padding:11px;margin-top:8px;background:var(--gold);color:var(--navy);border:none;border-radius:8px;font-family:var(--sans);font-size:13px;font-weight:700;cursor:pointer;transition:background .15s}
.login-submit:hover{background:var(--gold2)}
.login-submit:disabled{opacity:.5;cursor:not-allowed}
.login-err{background:rgba(239,68,68,.12);color:#FCA5A5;border:1px solid rgba(239,68,68,.25);border-radius:8px;padding:10px 13px;font-size:12px;margin-bottom:12px}
.login-foot{text-align:center;font-family:var(--mono);font-size:9px;color:rgba(255,255,255,.2);margin-top:16px;letter-spacing:1px}
.login-back{text-align:center;margin-top:10px;font-size:11px;color:rgba(255,255,255,.3);cursor:pointer;font-family:var(--mono)}
.login-back:hover{color:var(--gold)}
@media(max-width:640px){.login-left{display:none}.login-right{width:100%;padding:40px 24px}.kpi-row{grid-template-columns:1fr 1fr}.two-col{grid-template-columns:1fr}.tabs{padding:0 16px}.main{padding:16px}.hdr-email{display:none}}
`

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

  return (
    <>
      <style>{CSS}</style>
      <div className="login-wrap">
        <div className="login-lines" />
        <div className="login-overlay" />
        <div className="login-split">
          <div className="login-left">
            <div className="login-eyebrow">Cost Project Tracker</div>
            <div className="login-logo-row">
              <img src="/PL.png" alt="Parana Logística" className="login-logo-img" />
            </div>
            <div className="login-title">PARANA<span>LOGÍSTICA</span></div>
            <div className="login-line" />
            <div className="login-sub">Control de costos, órdenes de compra y márgenes de proyecto en tiempo real.</div>
          </div>
          <div className="login-right">
            <div className="login-card">
              <div className="login-card-title">Acceso al módulo</div>
              <div className="login-card-sub">Solo personal autorizado</div>
              {error && <div className="login-err">{error}</div>}
              <div className="login-fg">
                <label>Email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="usuario@paranalogistica.com.ar" autoFocus />
              </div>
              <div className="login-fg">
                <label>Contraseña</label>
                <input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="••••••••" />
              </div>
              <button className="login-submit" onClick={handleLogin} disabled={loading||!email||!pass}>
                {loading ? 'Ingresando...' : 'Ingresar →'}
              </button>
              <div className="login-foot">Parana Logística · Acceso restringido</div>
              <div className="login-back" onClick={()=>window.location.href=ERP_HOME_URL}>← Volver al Portal</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── COST TRACKER APP ─────────────────────────────────────────────────────────
function CostTrackerApp({ session }) {
  const [tab, setTab]               = useState('overview')
  const [proyectos, setProyectos]   = useState([])
  const [proyectoId, setProyectoId] = useState(() => localStorage.getItem('cpt_proyecto_id') || '')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [savingP, setSavingP]       = useState(false)
  const [errorP, setErrorP]         = useState('')
  const [formP, setFormP]           = useState({nombre:'',cliente:'',descripcion:'',fecha_inicio:'',fecha_fin_est:''})

  const loadProyectos = useCallback(async () => {
    try {
      const data = await api.getProyectos()
      setProyectos(data)
      const saved = localStorage.getItem('cpt_proyecto_id')
      if (!saved && data.length === 1) {
        setProyectoId(data[0].id)
        localStorage.setItem('cpt_proyecto_id', data[0].id)
      }
    } catch(e) {
      console.error('Error cargando proyectos:', e.message)
    }
  }, [])

  useEffect(() => { loadProyectos() }, [loadProyectos])

  const proyecto = proyectos.find(p => p.id === proyectoId) || null

  const selProyecto = (id) => {
    setProyectoId(id)
    localStorage.setItem('cpt_proyecto_id', id)
    setTab('overview')
  }

  const handleNuevo = async (e) => {
    e.preventDefault(); setSavingP(true); setErrorP('')
    try {
      const { data, error } = await supabase
        .from('cpt_proyectos')
        .insert({...formP, estado:'activo', moneda_base:'USD', created_by: session.user.id})
        .select('id').single()
      if (error) { setErrorP('No se pudo crear: ' + error.message); return }
      setModalNuevo(false)
      setFormP({nombre:'',cliente:'',descripcion:'',fecha_inicio:'',fecha_fin_est:''})
      await loadProyectos()
      selProyecto(data.id)
    } catch(e) {
      setErrorP('Error de conexión: ' + e.message)
    } finally { setSavingP(false) }
  }

  const TABS = [
    {id:'overview',    label:'Overview'},
    {id:'presupuesto', label:'Presupuesto vs Real'},
    {id:'oc',          label:'Órdenes de Compra'},
    {id:'facturas',    label:'Facturas'},
    {id:'ingresos',    label:'Ingresos & Margen'},
    {id:'cashflow',    label:'Cashflow'},
    {id:'categorias',  label:'Categorías'},
  ]

  return (
    <>
      <style>{CSS}</style>
      <div className="app-wrap">
        {/* HEADER */}
        <header className="header">
          <div className="hdr-brand">
            <img src="/PL.png" alt="PL" className="hdr-logo" />
            <div className="hdr-divider" />
            <div>
              <div className="hdr-name">Parana Logística</div>
              <div className="hdr-sub">Cost Project Tracker</div>
            </div>
          </div>
          <div className="hdr-right">
            <select className="hdr-sel" value={proyectoId} onChange={e=>selProyecto(e.target.value)}>
              <option value="" disabled>Seleccionar proyecto...</option>
              {proyectos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <button className="hdr-btn-gold" onClick={()=>setModalNuevo(true)}>+ Proyecto</button>
            <span className="hdr-email">{session?.user?.email}</span>
            <button className="hdr-btn" onClick={()=>window.location.href=ERP_HOME_URL}>← Portal</button>
            <button className="hdr-btn" onClick={()=>supabase.auth.signOut()}>Salir</button>
          </div>
        </header>

        {/* TABS */}
        <nav className="tabs">
          {TABS.map(t=>(
            <a key={t.id} className={'tab'+(tab===t.id?' active':'')} onClick={()=>setTab(t.id)} style={{cursor:'pointer'}}>
              {t.label}
            </a>
          ))}
        </nav>

        {/* CONTENT */}
        <div className="main">
          {!proyecto ? (
            <div className="state-msg" style={{marginTop:60}}>
              <p style={{fontSize:15,fontWeight:700,color:'var(--navy)',marginBottom:8}}>Seleccioná un proyecto para comenzar</p>
              <p>o creá uno nuevo con el botón <strong>+ Proyecto</strong> arriba a la derecha</p>
            </div>
          ) : (
            <>
              {tab==='overview'    && <TabOverview    proyecto={proyecto} />}
              {tab==='presupuesto' && <TabPresupuesto proyecto={proyecto} />}
              {tab==='oc'          && <TabOC          proyecto={proyecto} />}
              {tab==='facturas'    && <TabFacturas    proyecto={proyecto} />}
              {tab==='ingresos'    && <TabIngresos    proyecto={proyecto} />}
              {tab==='cashflow'    && <TabCashflow    proyecto={proyecto} />}
              {tab==='categorias'  && <TabCategorias />}
            </>
          )}
        </div>
      </div>

      {/* MODAL NUEVO PROYECTO */}
      {modalNuevo && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModalNuevo(false)}>
          <div className="modal">
            <h3>Nuevo Proyecto</h3>
            <form onSubmit={handleNuevo}>
              {errorP && <div className="alert alert-err">{errorP}</div>}
              <div className="form-row"><label>Nombre *</label><input required value={formP.nombre} onChange={e=>setFormP(f=>({...f,nombre:e.target.value}))} placeholder="ej. FUGRO – Fabricación Equipos" /></div>
              <div className="form-row"><label>Cliente *</label><input required value={formP.cliente} onChange={e=>setFormP(f=>({...f,cliente:e.target.value}))} /></div>
              <div className="form-row"><label>Descripción</label><textarea value={formP.descripcion} onChange={e=>setFormP(f=>({...f,descripcion:e.target.value}))} /></div>
              <div className="two-col">
                <div className="form-row"><label>Fecha inicio</label><input type="date" value={formP.fecha_inicio} onChange={e=>setFormP(f=>({...f,fecha_inicio:e.target.value}))} /></div>
                <div className="form-row"><label>Fecha fin est.</label><input type="date" value={formP.fecha_fin_est} onChange={e=>setFormP(f=>({...f,fecha_fin_est:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={()=>setModalNuevo(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={savingP}>{savingP?'Creando...':'Crear Proyecto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB OVERVIEW ─────────────────────────────────────────────────────────────
function TabOverview({ proyecto }) {
  const [pnl, setPnl]         = useState(null)
  const [alertas, setAlertas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p, a] = await Promise.all([api.getPNL(proyecto.id), api.getAlertas(proyecto.id)])
      setPnl(p); setAlertas(a)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="state-msg">Cargando overview...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const ingreso   = pnl?.ingreso_cotizado_usd    || 0
  const costoPres = pnl?.costo_presupuestado_usd || 0
  const costoReal = pnl?.costo_real_confirmado_usd || 0
  const cobrado   = pnl?.ingreso_cobrado_usd     || 0
  const mbPct     = pnl?.margen_budget_pct       || 0
  const mfPct     = pnl?.margen_forecast_pct     || 0

  return (
    <>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-lbl">Ingresos Cotizados</div><div className="kpi-val cb">{fmtUSD(ingreso)}</div><div className="kpi-sub">USD · Propuesta Cliente</div></div>
        <div className="kpi"><div className="kpi-lbl">Costo Presupuestado</div><div className="kpi-val">{fmtUSD(costoPres)}</div><div className="kpi-sub">USD · todas las líneas</div></div>
        <div className="kpi"><div className="kpi-lbl">Costo Real</div><div className="kpi-val cw">{fmtUSD(costoReal)}</div><div className="kpi-sub">OC + facturas cargadas</div></div>
        <div className="kpi"><div className="kpi-lbl">Margen Budget</div><div className="kpi-val cg">{mbPct}%</div><div className="kpi-sub">{fmtUSD(ingreso-costoPres)} USD</div></div>
        <div className="kpi"><div className="kpi-lbl">Margen Forecast</div><div className="kpi-val cg" style={{fontSize:24}}>{mfPct}%</div><div className="kpi-sub">Con costos reales</div></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="card">
          <div className="card-hdr"><span className="card-title">Ejecución</span></div>
          <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:12}}><span style={{color:'var(--muted)'}}>Cobrado vs Cotizado</span><strong>{fmtUSD(cobrado)} / {fmtUSD(ingreso)}</strong></div>
              <div className="prog-wrap"><div className="prog" style={{width:ingreso>0?`${Math.min(cobrado/ingreso*100,100)}%`:'0%',background:'linear-gradient(90deg,#047857,#10b981)'}} /></div>
            </div>
            <div>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:12}}><span style={{color:'var(--muted)'}}>Costo ejecutado vs Presupuesto</span><strong>{fmtUSD(costoReal)} / {fmtUSD(costoPres)}</strong></div>
              <div className="prog-wrap"><div className="prog" style={{width:costoPres>0?`${Math.min(costoReal/costoPres*100,100)}%`:'0%',background:'linear-gradient(90deg,#1a4a7a,#235C96)'}} /></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-hdr"><span className="card-title">Alertas</span></div>
          <div style={{padding:'14px 16px'}}>
            {alertas.length===0
              ? <div className="alert alert-ok">Sin alertas activas</div>
              : alertas.map((a,i)=>{
                  const delta = a.monto_real_usd&&a.monto_pres_usd ? ((a.monto_real_usd-a.monto_pres_usd)/a.monto_pres_usd*100).toFixed(1) : null
                  return <div key={i} className="alert alert-err">{a.descripcion}{delta&&<strong style={{marginLeft:8}}>+{delta}%</strong>}</div>
                })
            }
          </div>
        </div>
      </div>
    </>
  )
}

// ─── TAB PRESUPUESTO ──────────────────────────────────────────────────────────
function TabPresupuesto({ proyecto }) {
  const [lineas, setLineas]         = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [filtroCat, setFiltroCat]   = useState('')
  const [modal, setModal]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({item_numero:'',descripcion:'',categoria_id:'',frecuencia:'one-time',moneda_pres:'USD',monto_pres:'',fx_pres:'',es_reembolsable:false,handling_fee_pct:'',estado:'estimado'})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [l, c] = await Promise.all([api.getLineas(proyecto.id), api.getCategorias()])
      setLineas(l); setCategorias(c)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_presupuesto_lineas').insert({
        ...form, proyecto_id:proyecto.id,
        monto_pres:Number(form.monto_pres)||null,
        fx_pres:Number(form.fx_pres)||null,
        handling_fee_pct:Number(form.handling_fee_pct)||null
      })
      if (error) { alert(error.message); return }
      setModal(false)
      setForm({item_numero:'',descripcion:'',categoria_id:'',frecuencia:'one-time',moneda_pres:'USD',monto_pres:'',fx_pres:'',es_reembolsable:false,handling_fee_pct:'',estado:'estimado'})
      await load()
    } finally { setSaving(false) }
  }

  if (loading) return <div className="state-msg">Cargando presupuesto...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const filtradas = filtroCat ? lineas.filter(l=>l.categoria_id===filtroCat) : lineas
  const totalPres = lineas.reduce((s,l)=>s+(l.monto_pres_usd||0),0)
  const totalReal = lineas.reduce((s,l)=>s+(l.monto_real_usd||0),0)

  return (
    <>
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Líneas de Costo — Presupuesto vs Real</span>
          <div style={{display:'flex',gap:8}}>
            <select style={{width:180}} value={filtroCat} onChange={e=>setFiltroCat(e.target.value)}>
              <option value="">Todas las categorías</option>
              {categorias.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <button className="btn" onClick={()=>setModal(true)}>+ Nueva línea</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Item</th><th>Descripción</th><th>Categoría</th><th>Frec.</th><th>Moneda</th><th>Pres. USD</th><th>Real USD</th><th>Delta</th><th>Remb.</th><th>Estado</th></tr></thead>
            <tbody>
              {filtradas.length===0 && <tr><td colSpan={10} className="state-msg">Sin líneas — agregá la primera</td></tr>}
              {filtradas.map(l=>{
                const delta = l.monto_real_usd!=null ? l.monto_real_usd-(l.monto_pres_usd||0) : null
                return (
                  <tr key={l.id} style={l.estado==='alerta'?{background:'#FEF2F2'}:{}}>
                    <td style={{color:'var(--muted)',fontSize:11}}>{l.item_numero||'—'}</td>
                    <td style={{fontWeight:500}}>{l.descripcion}</td>
                    <td>{l.cpt_categorias&&<span className={`tag t-${l.cpt_categorias.color}`}>{l.cpt_categorias.nombre}</span>}</td>
                    <td style={{color:'var(--muted)',fontSize:11}}>{l.frecuencia}</td>
                    <td className="mono">{l.moneda_pres}</td>
                    <td className="mono">{fmtUSD(l.monto_pres_usd)}</td>
                    <td className="mono">{fmtUSD(l.monto_real_usd)}</td>
                    <td className={`mono ${delta==null?'':delta<=0?'cg':'cr'}`}>{delta==null?'—':(delta>0?'+':'')+fmtUSD(delta)}</td>
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
          <span style={{color:'var(--muted)'}}>Real: <strong className="cg">{fmtUSD(totalReal)}</strong></span>
          <span style={{marginLeft:'auto'}} className={totalReal<=totalPres?'cg':'cr'}>Delta: {totalReal>totalPres?'+':''}{fmtUSD(totalReal-totalPres)}</span>
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Nueva Línea de Costo</h3>
            <form onSubmit={handleSave}>
              <div className="two-col">
                <div className="form-row"><label>Item #</label><input value={form.item_numero} onChange={e=>setForm(f=>({...f,item_numero:e.target.value}))} placeholder="ej. 1a" /></div>
                <div className="form-row"><label>Categoría *</label><select required value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))}><option value="">Seleccionar...</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
              </div>
              <div className="form-row"><label>Descripción *</label><input required value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="ej. Fixed A-Frame – Material hierro" /></div>
              <div className="two-col">
                <div className="form-row"><label>Moneda</label><select value={form.moneda_pres} onChange={e=>setForm(f=>({...f,moneda_pres:e.target.value}))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
                <div className="form-row"><label>FX {form.moneda_pres==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx_pres} onChange={e=>setForm(f=>({...f,fx_pres:e.target.value}))} disabled={form.moneda_pres==='USD'} required={form.moneda_pres==='ARS'} placeholder="ej. 1400" /></div>
              </div>
              <div className="form-row"><label>Monto Presupuestado ({form.moneda_pres}) *</label><input required type="number" step="0.01" value={form.monto_pres} onChange={e=>setForm(f=>({...f,monto_pres:e.target.value}))} placeholder="0.00" /></div>
              <div className="two-col">
                <div className="form-row"><label>Frecuencia</label><select value={form.frecuencia} onChange={e=>setForm(f=>({...f,frecuencia:e.target.value}))}><option value="one-time">One-time</option><option value="mensual">Mensual</option></select></div>
                <div className="form-row"><label>Estado</label><select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}><option value="estimado">Estimado</option><option value="confirmado">Confirmado</option><option value="pendiente_oc">Pendiente OC</option></select></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB OC ───────────────────────────────────────────────────────────────────
function TabOC({ proyecto }) {
  const [ocs, setOcs]               = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [modal, setModal]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({numero_oc:'',proveedor:'',categoria_id:'',descripcion:'',moneda:'USD',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_emision:'',estado:'pendiente_aprobacion'})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [o, c] = await Promise.all([api.getOCs(proyecto.id), api.getCategorias()])
      setOcs(o); setCategorias(c)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_oc').insert({
        ...form, proyecto_id:proyecto.id,
        monto_sin_iva:Number(form.monto_sin_iva),
        iva_pct:Number(form.iva_pct),
        fx:Number(form.fx)||null
      })
      if (error) { alert(error.message); return }
      setModal(false)
      setForm({numero_oc:'',proveedor:'',categoria_id:'',descripcion:'',moneda:'USD',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_emision:'',estado:'pendiente_aprobacion'})
      await load()
    } finally { setSaving(false) }
  }

  const CHIP = {pendiente_aprobacion:'c-pend',aprobada:'c-apr',activa:'c-ok',completada:'c-ok',cancelada:'c-no'}

  if (loading) return <div className="state-msg">Cargando OCs...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const totalOC   = ocs.reduce((s,o)=>s+(o.oc_total_usd||0),0)
  const totalPend = ocs.reduce((s,o)=>s+(o.saldo_usd||0),0)

  return (
    <>
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Órdenes de Compra</span>
          <button className="btn" onClick={()=>setModal(true)}>+ Nueva OC</button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>#OC</th><th>Proveedor</th><th>Descripción</th><th>Moneda</th><th>USD s/IVA</th><th>USD c/IVA</th><th>Facturado</th><th>Pendiente</th><th>Emitida</th><th>Estado</th></tr></thead>
            <tbody>
              {ocs.length===0 && <tr><td colSpan={10} className="state-msg">Sin OC — creá la primera</td></tr>}
              {ocs.map(o=>(
                <tr key={o.id}>
                  <td className="mono cb">{o.numero_oc}</td>
                  <td style={{fontWeight:600}}>{o.proveedor}</td>
                  <td style={{color:'var(--muted)',fontSize:11}}>{o.descripcion}</td>
                  <td className="mono">{o.moneda}</td>
                  <td className="mono">{fmtUSD(o.oc_total_usd)}</td>
                  <td className="mono">{fmtUSD(o.oc_total_usd_con_iva)}</td>
                  <td>
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      <span className={`mono ${o.pct_facturado>=100?'cg':'cw'}`} style={{fontSize:11}}>{fmtUSD(o.facturado_usd)} ({o.pct_facturado}%)</span>
                      <div className="prog-wrap" style={{width:80}}><div className="prog" style={{width:`${o.pct_facturado}%`,background:o.pct_facturado>=100?'#059669':'#235C96'}} /></div>
                    </div>
                  </td>
                  <td className={`mono ${o.saldo_usd>0?'cw':'cg'}`}>{fmtUSD(o.saldo_usd)}</td>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{o.fecha_emision||'—'}</td>
                  <td><span className={`chip ${CHIP[o.estado]||'c-no'}`}>{o.estado.replace(/_/g,' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>Total: <strong style={{color:'var(--navy)'}}>{fmtUSD(totalOC)}</strong></span>
          <span style={{color:'var(--muted)'}}>Pendiente facturar: <strong className="cw">{fmtUSD(totalPend)}</strong></span>
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Nueva Orden de Compra</h3>
            <form onSubmit={handleSave}>
              <div className="two-col">
                <div className="form-row"><label>Número OC *</label><input required value={form.numero_oc} onChange={e=>setForm(f=>({...f,numero_oc:e.target.value}))} placeholder="ej. OC-007" /></div>
                <div className="form-row"><label>Proveedor *</label><input required value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} /></div>
              </div>
              <div className="two-col">
                <div className="form-row"><label>Categoría *</label><select required value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))}><option value="">Seleccionar...</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <div className="form-row"><label>Estado</label><select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}><option value="pendiente_aprobacion">Pendiente aprobación</option><option value="aprobada">Aprobada</option><option value="activa">Activa</option></select></div>
              </div>
              <div className="form-row"><label>Descripción</label><input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} /></div>
              <div className="two-col">
                <div className="form-row"><label>Moneda</label><select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
                <div className="form-row"><label>FX {form.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx} onChange={e=>setForm(f=>({...f,fx:e.target.value}))} disabled={form.moneda==='USD'} required={form.moneda==='ARS'} placeholder="ej. 1425" /></div>
              </div>
              <div className="two-col">
                <div className="form-row"><label>Monto s/IVA ({form.moneda}) *</label><input required type="number" step="0.01" value={form.monto_sin_iva} onChange={e=>setForm(f=>({...f,monto_sin_iva:e.target.value}))} placeholder="0.00" /></div>
                <div className="form-row"><label>IVA %</label><select value={form.iva_pct} onChange={e=>setForm(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div>
              </div>
              <div className="form-row"><label>Fecha emisión</label><input type="date" value={form.fecha_emision} onChange={e=>setForm(f=>({...f,fecha_emision:e.target.value}))} /></div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Crear OC'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB FACTURAS ─────────────────────────────────────────────────────────────
function TabFacturas({ proyecto }) {
  const [subTab, setSubTab]       = useState('compra')
  const [fcompra, setFcompra]     = useState([])
  const [fventa, setFventa]       = useState([])
  const [ocs, setOcs]             = useState([])
  const [ocSaldos, setOcSaldos]   = useState({})
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [modalC, setModalC]       = useState(false)
  const [modalV, setModalV]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [formC, setFormC] = useState({numero_factura:'',oc_id:'',proveedor:'',moneda:'USD',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_factura:'',fecha_vto_pago:''})
  const [formV, setFormV] = useState({numero_factura:'',concepto:'',monto_usd:'',fecha_emision:'',fecha_vto_cobro:''})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [fc, fv, o, s] = await Promise.all([
        api.getFacturasCompra(proyecto.id),
        api.getFacturasVenta(proyecto.id),
        api.getOCsBasic(proyecto.id),
        api.getOCSaldos(proyecto.id),
      ])
      setFcompra(fc); setFventa(fv); setOcs(o); setOcSaldos(s)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!formC.oc_id) return
    const oc = ocs.find(o=>o.id===formC.oc_id)
    if (oc) setFormC(f=>({...f,proveedor:oc.proveedor}))
  }, [formC.oc_id, ocs])

  const handleSaveC = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_facturas_compra').insert({
        ...formC, proyecto_id:proyecto.id,
        monto_sin_iva:Number(formC.monto_sin_iva),
        iva_pct:Number(formC.iva_pct),
        fx:Number(formC.fx)||null
      })
      if (error) { alert(error.message); return }
      setModalC(false)
      setFormC({numero_factura:'',oc_id:'',proveedor:'',moneda:'USD',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_factura:'',fecha_vto_pago:''})
      await load()
    } finally { setSaving(false) }
  }

  const handleSaveV = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_facturas_venta').insert({
        ...formV, proyecto_id:proyecto.id,
        monto_usd:Number(formV.monto_usd),
        estado:formV.fecha_emision?'emitida':'no_emitida'
      })
      if (error) { alert(error.message); return }
      setModalV(false)
      setFormV({numero_factura:'',concepto:'',monto_usd:'',fecha_emision:'',fecha_vto_cobro:''})
      await load()
    } finally { setSaving(false) }
  }

  const CHIPFC = {pagada:'c-ok',pendiente_pago:'c-apr',vencida:'c-pend'}
  const CHIPFV = {cobrada:'c-ok',cobro_parcial:'c-pend',emitida:'c-apr',no_emitida:'c-no'}
  const ocSel  = formC.oc_id ? ocSaldos[formC.oc_id] : null

  if (loading) return <div className="state-msg">Cargando facturas...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const totalFacVta  = fventa.reduce((s,f)=>s+(f.monto_usd||0),0)
  const totalCobrado = fventa.reduce((s,f)=>s+(f.monto_cobrado||0),0)

  return (
    <>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        <button className={subTab==='compra'?'btn':'btn-ghost'} onClick={()=>setSubTab('compra')}>Facturas de Compra</button>
        <button className={subTab==='venta'?'btn':'btn-ghost'} onClick={()=>setSubTab('venta')}>Facturas de Venta</button>
      </div>

      {subTab==='compra' && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">Facturas de Compra</span><button className="btn" onClick={()=>setModalC(true)}>+ Registrar</button></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>#Factura</th><th>Proveedor</th><th>OC</th><th>Moneda</th><th>USD s/IVA</th><th>USD c/IVA</th><th>% OC</th><th>Fecha</th><th>Vto.</th><th>Estado</th></tr></thead>
              <tbody>
                {fcompra.length===0 && <tr><td colSpan={10} className="state-msg">Sin facturas</td></tr>}
                {fcompra.map(f=>{
                  const s=ocSaldos[f.oc_id]
                  const pct=s?.oc_total_usd>0?Math.round(f.monto_usd_sin_iva/s.oc_total_usd*100):null
                  return (
                    <tr key={f.id}>
                      <td className="mono">{f.numero_factura}</td>
                      <td style={{fontWeight:500}}>{f.proveedor}</td>
                      <td className="mono cb">{f.cpt_oc?.numero_oc}</td>
                      <td className="mono">{f.moneda}</td>
                      <td className="mono">{fmtUSD(f.monto_usd_sin_iva)}</td>
                      <td className="mono">{fmtUSD(f.monto_usd_con_iva)}</td>
                      <td>{pct!=null&&<div style={{display:'flex',alignItems:'center',gap:6}}><div className="prog-wrap" style={{width:50}}><div className="prog" style={{width:`${pct}%`,background:pct>=100?'#059669':'#235C96'}} /></div><span style={{fontSize:11,color:pct>=100?'var(--g)':'var(--cb)'}}>{pct}%</span></div>}</td>
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

      {subTab==='venta' && (
        <div className="card">
          <div className="card-hdr"><span className="card-title">Facturas de Venta</span><button className="btn" onClick={()=>setModalV(true)}>+ Nueva</button></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>#Factura</th><th>Concepto</th><th>Monto USD</th><th>Emitida</th><th>Vto. Cobro</th><th>Cobrado</th><th>Pendiente</th><th>Estado</th></tr></thead>
              <tbody>
                {fventa.length===0 && <tr><td colSpan={8} className="state-msg">Sin facturas de venta</td></tr>}
                {fventa.map(f=>(
                  <tr key={f.id}>
                    <td className="mono">{f.numero_factura||'—'}</td>
                    <td style={{fontWeight:500}}>{f.concepto}</td>
                    <td className="mono cb">{fmtUSD(f.monto_usd)}</td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{f.fecha_emision||'—'}</td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{f.fecha_vto_cobro||'—'}</td>
                    <td className={`mono ${f.monto_cobrado>0?'cg':''}`}>{fmtUSD(f.monto_cobrado)}</td>
                    <td className={`mono ${(f.monto_usd-(f.monto_cobrado||0))>0?'cw':''}`}>{fmtUSD(f.monto_usd-(f.monto_cobrado||0))}</td>
                    <td><span className={`chip ${CHIPFV[f.estado]||'c-no'}`}>{f.estado.replace('_',' ')}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tbl-foot">
            <span style={{color:'var(--muted)'}}>Facturado: <strong style={{color:'#5B21B6'}}>{fmtUSD(totalFacVta)}</strong></span>
            <span style={{color:'var(--muted)'}}>Cobrado: <strong className="cg">{fmtUSD(totalCobrado)}</strong></span>
            <span style={{color:'var(--muted)'}}>Pendiente: <strong className="cw">{fmtUSD(totalFacVta-totalCobrado)}</strong></span>
          </div>
        </div>
      )}

      {modalC && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModalC(false)}>
          <div className="modal">
            <h3>Registrar Factura de Compra</h3>
            <form onSubmit={handleSaveC}>
              <div className="two-col">
                <div className="form-row"><label>Número *</label><input required value={formC.numero_factura} onChange={e=>setFormC(f=>({...f,numero_factura:e.target.value}))} placeholder="ej. FC-0045" /></div>
                <div className="form-row"><label>OC vinculada *</label><select required value={formC.oc_id} onChange={e=>setFormC(f=>({...f,oc_id:e.target.value}))}><option value="">Seleccionar...</option>{ocs.map(o=><option key={o.id} value={o.id}>{o.numero_oc} – {o.proveedor}</option>)}</select></div>
              </div>
              {ocSel&&<div className="alert alert-info" style={{marginBottom:12}}>{ocSel.numero_oc} — Saldo disponible: <strong>{fmtUSD(ocSel.saldo_usd)} USD</strong></div>}
              <div className="form-row"><label>Proveedor *</label><input required value={formC.proveedor} onChange={e=>setFormC(f=>({...f,proveedor:e.target.value}))} /></div>
              <div className="two-col">
                <div className="form-row"><label>Moneda</label><select value={formC.moneda} onChange={e=>setFormC(f=>({...f,moneda:e.target.value}))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
                <div className="form-row"><label>FX {formC.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={formC.fx} onChange={e=>setFormC(f=>({...f,fx:e.target.value}))} disabled={formC.moneda==='USD'} required={formC.moneda==='ARS'} placeholder="ej. 1428" /></div>
              </div>
              <div className="two-col">
                <div className="form-row"><label>Monto s/IVA *</label><input required type="number" step="0.01" value={formC.monto_sin_iva} onChange={e=>setFormC(f=>({...f,monto_sin_iva:e.target.value}))} placeholder="0.00" /></div>
                <div className="form-row"><label>IVA %</label><select value={formC.iva_pct} onChange={e=>setFormC(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div>
              </div>
              <div className="two-col">
                <div className="form-row"><label>Fecha factura *</label><input required type="date" value={formC.fecha_factura} onChange={e=>setFormC(f=>({...f,fecha_factura:e.target.value}))} /></div>
                <div className="form-row"><label>Vto. pago</label><input type="date" value={formC.fecha_vto_pago} onChange={e=>setFormC(f=>({...f,fecha_vto_pago:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={()=>setModalC(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalV && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModalV(false)}>
          <div className="modal">
            <h3>Nueva Factura de Venta</h3>
            <form onSubmit={handleSaveV}>
              <div className="form-row"><label>Número</label><input value={formV.numero_factura} onChange={e=>setFormV(f=>({...f,numero_factura:e.target.value}))} placeholder="ej. FV-004 (vacío si no emitida)" /></div>
              <div className="form-row"><label>Concepto *</label><input required value={formV.concepto} onChange={e=>setFormV(f=>({...f,concepto:e.target.value}))} placeholder="ej. Anticipo 30% obra" /></div>
              <div className="form-row"><label>Monto USD *</label><input required type="number" step="0.01" value={formV.monto_usd} onChange={e=>setFormV(f=>({...f,monto_usd:e.target.value}))} placeholder="0.00" /></div>
              <div className="two-col">
                <div className="form-row"><label>Fecha emisión</label><input type="date" value={formV.fecha_emision} onChange={e=>setFormV(f=>({...f,fecha_emision:e.target.value}))} /></div>
                <div className="form-row"><label>Vto. cobro</label><input type="date" value={formV.fecha_vto_cobro} onChange={e=>setFormV(f=>({...f,fecha_vto_cobro:e.target.value}))} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={()=>setModalV(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Emitir'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB INGRESOS ─────────────────────────────────────────────────────────────
function TabIngresos({ proyecto }) {
  const [lineas, setLineas]   = useState([])
  const [fventa, setFventa]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [l, fv] = await Promise.all([api.getLineas(proyecto.id), api.getFacturasVenta(proyecto.id)])
      setLineas(l); setFventa(fv)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="state-msg">Cargando ingresos...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const totalCotizado = fventa.reduce((s,f)=>s+(f.monto_usd||0),0)
  const totalPres     = lineas.reduce((s,l)=>s+(l.monto_pres_usd||0),0)
  const totalReal     = lineas.reduce((s,l)=>s+(l.monto_real_usd||l.monto_pres_usd||0),0)
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
              {lineas.length===0 && <tr><td colSpan={7} className="state-msg">Sin líneas</td></tr>}
              {lineas.map(l=>{
                const delta = l.monto_real_usd!=null ? l.monto_real_usd-(l.monto_pres_usd||0) : null
                return (
                  <tr key={l.id} style={delta>0?{background:'#FEF2F2'}:{}}>
                    <td style={{color:'var(--muted)',fontSize:11}}>{l.item_numero||'—'}</td>
                    <td style={{fontWeight:500}}>{l.descripcion}</td>
                    <td>{l.cpt_categorias?.nombre||'—'}</td>
                    <td className="mono">{fmtUSD(l.monto_pres_usd)}</td>
                    <td className={`mono ${l.monto_real_usd==null?'':delta<=0?'cg':'cr'}`}>{fmtUSD(l.monto_real_usd)}</td>
                    <td className={`mono ${delta==null?'':delta<=0?'cg':'cr'}`}>{delta==null?'—':(delta>0?'+':'')+fmtUSD(delta)}</td>
                    <td style={{textAlign:'center',color:l.es_reembolsable?'var(--g)':'var(--muted)'}}>{l.es_reembolsable?'✓':'—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Margen Resumen</span></div>
          <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:12,fontSize:13}}>
            <div style={{display:'flex',justifyContent:'space-between',paddingBottom:10,borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--muted)'}}>Ingreso cotizado</span><strong className="cb">{fmtUSD(totalCotizado)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo presupuestado</span><strong>{fmtUSD(totalPres)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo real / forecast</span><strong className="cg">{fmtUSD(totalReal)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:10,borderTop:'1px solid var(--border)'}}><span style={{fontWeight:700}}>Margen budget</span><strong className="cg" style={{fontSize:15}}>{mBudget}%</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:700}}>Margen forecast</span><strong className="cg" style={{fontSize:18}}>{mReal}%</strong></div>
          </div>
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Facturas de Venta</span></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Concepto</th><th>Monto USD</th><th>Cobrado</th><th>Estado</th></tr></thead>
              <tbody>
                {fventa.length===0 && <tr><td colSpan={4} className="state-msg">Sin facturas</td></tr>}
                {fventa.map(f=><tr key={f.id}><td style={{fontSize:12}}>{f.concepto}</td><td className="mono cb">{fmtUSD(f.monto_usd)}</td><td className={`mono ${f.monto_cobrado>0?'cg':''}`}>{fmtUSD(f.monto_cobrado)}</td><td><span className="chip c-ok" style={{fontSize:9}}>{f.estado.replace('_',' ')}</span></td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── TAB CASHFLOW ─────────────────────────────────────────────────────────────
function TabCashflow({ proyecto }) {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setEventos(await api.getCashflow(proyecto.id)) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="state-msg">Cargando cashflow...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  let acum = 0
  const conAcum = eventos.map(e=>{ if(e.categoria_cf==='real') acum+=Number(e.monto_usd); return {...e,acum} })
  const totalCobrado = eventos.filter(e=>e.tipo==='ingreso'&&e.categoria_cf==='real').reduce((s,e)=>s+Number(e.monto_usd),0)
  const totalPagado  = eventos.filter(e=>e.tipo==='egreso' &&e.categoria_cf==='real').reduce((s,e)=>s+Math.abs(Number(e.monto_usd)),0)
  const caja = totalCobrado - totalPagado

  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Caja del Proyecto</span></div>
          <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:9,fontSize:13}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:'9px 12px',background:'#F0FDF4',borderRadius:8,border:'1px solid #BBF7D0'}}><span style={{color:'var(--muted)'}}>Cobrado</span><strong className="cg">+{fmtUSD(totalCobrado)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'9px 12px',background:'#FEF2F2',borderRadius:8,border:'1px solid #FECACA'}}><span style={{color:'var(--muted)'}}>Pagado</span><strong className="cr">−{fmtUSD(totalPagado)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between',padding:'9px 12px',background:caja>=0?'#ECFDF5':'#FEF2F2',borderRadius:8,border:`1px solid ${caja>=0?'#A7F3D0':'#FECACA'}`}}><span style={{fontWeight:700}}>Caja hoy</span><strong style={{color:caja>=0?'#059669':'#DC2626',fontSize:16}}>{caja>=0?'+':''}{fmtUSD(caja)}</strong></div>
          </div>
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Nota</span></div>
          <div style={{padding:'14px 16px',fontSize:12,color:'var(--muted)',lineHeight:1.7}}>El cashflow se construye automáticamente desde las fechas de pago/cobro cargadas en Facturas.</div>
        </div>
      </div>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Línea de Tiempo</span></div>
        {eventos.length===0
          ? <div className="state-msg">Sin eventos — cargá fechas de pago en Facturas</div>
          : <div className="tbl-wrap" style={{maxHeight:'none'}}>
              <table>
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Contraparte</th><th>Referencia</th><th>Monto USD</th><th>Real / Forecast</th><th>Acumulado</th></tr></thead>
                <tbody>
                  {conAcum.map((e,i)=>(
                    <tr key={i}>
                      <td style={{fontSize:11,color:'var(--muted)'}}>{e.fecha}</td>
                      <td><span className={`chip ${e.tipo==='ingreso'?'c-ok':'c-pend'}`}>{e.tipo}</span></td>
                      <td style={{fontWeight:500}}>{e.contraparte}</td>
                      <td className="mono" style={{color:'var(--muted)'}}>{e.referencia||'—'}</td>
                      <td className={`mono ${e.tipo==='ingreso'?'cg':'cr'}`}>{e.tipo==='ingreso'?'+':''}{fmtUSD(Number(e.monto_usd))}</td>
                      <td><span style={{fontSize:10,color:e.categoria_cf==='real'?'#059669':'#D97706',fontWeight:700,textTransform:'uppercase'}}>{e.categoria_cf==='real'?'● Real':'◌ Forecast'}</span></td>
                      <td className={`mono ${e.acum>=0?'cg':'cr'}`}>{e.acum>=0?'+':''}{fmtUSD(e.acum)}</td>
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

// ─── TAB CATEGORIAS ───────────────────────────────────────────────────────────
function TabCategorias() {
  const [cats, setCats]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [modal, setModal]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({nombre:'',descripcion:'',color:'blue'})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setCats(await api.getAllCategorias()) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_categorias').insert(form)
      if (error) { alert(error.message); return }
      setModal(false); setForm({nombre:'',descripcion:'',color:'blue'}); await load()
    } finally { setSaving(false) }
  }

  const toggleActiva = async (cat) => {
    try {
      const { error } = await supabase.from('cpt_categorias').update({activa:!cat.activa}).eq('id',cat.id)
      if (error) { alert(error.message); return }
      await load()
    } catch(e) { alert(e.message) }
  }

  if (loading) return <div className="state-msg">Cargando categorías...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">Catálogo de Categorías</span>
            <button className="btn" onClick={()=>setModal(true)}>+ Nueva</button>
          </div>
          <div style={{padding:8}}>
            <table>
              <thead><tr><th>Nombre</th><th>Descripción</th><th>Activa</th></tr></thead>
              <tbody>
                {cats.map(c=>(
                  <tr key={c.id} style={{opacity:c.activa?1:.5}}>
                    <td><span className={`tag t-${c.color}`}>{c.nombre}</span></td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{c.descripcion||'—'}</td>
                    <td><button className="btn-ghost" style={{fontSize:10,padding:'3px 9px',color:c.activa?'var(--g)':'var(--muted)'}} onClick={()=>toggleActiva(c)}>{c.activa?'✓ Activa':'Inactiva'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tbl-foot" style={{fontSize:11,color:'var(--muted)'}}>Categorías globales a todos los proyectos.</div>
        </div>
        <div className="card">
          <div className="card-hdr"><span className="card-title">¿Por qué un catálogo controlado?</span></div>
          <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10,fontSize:12}}>
            <div className="alert alert-err">Sin catálogo, texto libre genera duplicados: "Material Hierro" · "material hierro" · "MH" → 3 categorías distintas que son la misma.</div>
            <div className="alert alert-ok">Con catálogo: cada línea elige de un selector. Renombrar actualiza todo el sistema.</div>
          </div>
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Nueva Categoría</h3>
            <form onSubmit={handleSave}>
              <div className="form-row"><label>Nombre * (label en todos los selectores)</label><input required value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="ej. Pintura y Anticorrosivo" /></div>
              <div className="form-row"><label>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="Para qué tipo de costos..." /></div>
              <div className="form-row"><label>Color</label><select value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}><option value="blue">Azul</option><option value="orange">Naranja</option><option value="green">Verde</option><option value="purple">Violeta</option><option value="red">Rojo</option><option value="gray">Gris</option></select></div>
              {form.nombre&&<div style={{marginBottom:12}}><span style={{fontSize:11,color:'var(--muted)',marginRight:8}}>Preview:</span><span className={`tag t-${form.color}`}>{form.nombre}</span></div>}
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
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
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <>
      <style>{CSS}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--navy)'}}>
        <div style={{fontFamily:'DM Mono',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:3,textTransform:'uppercase'}}>Cargando...</div>
      </div>
    </>
  )

  if (!session) return <LoginPage />

  return <CostTrackerApp session={session} />
}
