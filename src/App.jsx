import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'

const PORTAL_URL = 'https://integra.terra-mare.com.ar'
const MODULO_ID  = 'cost-tracker'

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  getProyectos: async () => {
    const { data, error } = await supabase.from('cpt_proyectos').select('id,nombre,cliente').eq('estado','activo').order('created_at',{ascending:false})
    if (error) throw error
    return data || []
  },
  getCategorias: async () => {
    const { data, error } = await supabase.from('cpt_categorias').select('id,nombre,color').eq('activa',true).order('nombre')
    if (error) throw error
    return data || []
  },
  getAllCategorias: async () => {
    const { data, error } = await supabase.from('cpt_categorias').select('*').order('nombre')
    if (error) throw error
    return data || []
  },
  getLineas: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_presupuesto_lineas').select('*,cpt_categorias(nombre,color)').eq('proyecto_id',proyectoId).order('item_numero')
    if (error) throw error
    return data || []
  },
  // OC con estado incluido — join cpt_oc para obtener estado que no está en la vista
  getOCs: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_oc')
      .select('id,proyecto_id,numero_oc,proveedor,descripcion,moneda,monto_sin_iva,iva_pct,fx,monto_usd_sin_iva,monto_usd_con_iva,fecha_emision,estado,categoria_id,cpt_categorias(nombre,color)')
      .eq('proyecto_id',proyectoId)
      .order('numero_oc')
    if (error) throw error
    // Enriquecer con saldos
    const { data: saldos } = await supabase.from('cpt_oc_saldo').select('id,facturado_usd,saldo_usd,pct_facturado,oc_total_usd,oc_total_usd_con_iva').eq('proyecto_id',proyectoId)
    const sMap = {}
    for (const s of saldos||[]) sMap[s.id] = s
    return (data||[]).map(o => {
      const s = sMap[o.id] || {}
      // For ARS OCs, total USD = (monto_sin_iva * (1 + iva_pct/100)) / fx
      const totalConIvaUSD = o.moneda === 'ARS' && o.fx
        ? (o.monto_sin_iva * (1 + (o.iva_pct||0)/100)) / o.fx
        : (o.monto_usd_con_iva || o.monto_usd_sin_iva)
      return {
        ...o,
        total_alocar_usd: totalConIvaUSD,
        ...s,
        facturado_usd: s.facturado_usd||0,
        saldo_usd: s.saldo_usd||o.monto_usd_sin_iva,
        pct_facturado: s.pct_facturado||0
      }
    })
  },
  getOCsBasic: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_oc').select('id,numero_oc,proveedor').eq('proyecto_id',proyectoId).order('numero_oc')
    if (error) throw error
    return data || []
  },
  getOCSaldos: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_oc_saldo').select('id,numero_oc,saldo_usd,oc_total_usd').eq('proyecto_id',proyectoId)
    if (error) throw error
    const map = {}
    for (const x of data||[]) map[x.id] = x
    return map
  },
  getFacturasCompra: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_facturas_compra').select('*,cpt_oc(numero_oc,proveedor)').eq('proyecto_id',proyectoId).order('fecha_factura',{ascending:false})
    if (error) throw error
    return data || []
  },
  getFacturasVenta: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_facturas_venta').select('*').eq('proyecto_id',proyectoId).order('fecha_emision',{ascending:false})
    if (error) throw error
    return data || []
  },
  getPNL: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_proyecto_pnl').select('*').eq('proyecto_id',proyectoId).maybeSingle()
    if (error) throw error
    return data
  },
  getCashflow: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_cashflow').select('*').eq('proyecto_id',proyectoId).order('fecha')
    if (error) throw error
    return data || []
  },
  getItems: async (proyectoId) => {
    const [{ data, error }, { data: alocs }] = await Promise.all([
      supabase.from('cpt_items_proyecto').select('*').eq('proyecto_id', proyectoId).order('orden'),
      supabase.from('cpt_alocaciones').select('item_id,categoria,monto_usd').eq('proyecto_id', proyectoId)
    ])
    if (error) throw error
    // compute real costs from alocaciones per item+categoria
    const realMap = {}
    for (const a of alocs||[]) {
      if (!realMap[a.item_id]) realMap[a.item_id] = {}
      realMap[a.item_id][a.categoria] = (realMap[a.item_id][a.categoria]||0) + (a.monto_usd||0)
    }
    return (data||[]).map(item => ({
      ...item,
      costos_real: realMap[item.id] || {} // {material: 600, mano_obra: 400, ...}
    }))
  },
  getAlocaciones: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_alocaciones')
      .select('*, cpt_oc(numero_oc,proveedor), cpt_items_proyecto(descripcion)')
      .eq('proyecto_id', proyectoId)
    if (error) throw error
    return data || []
  },
  getAlocacionesByOC: async (ocId) => {
    const { data, error } = await supabase
      .from('cpt_alocaciones')
      .select('*, cpt_items_proyecto(descripcion)')
      .eq('oc_id', ocId)
    if (error) throw error
    return data || []
  },
  getAlocacionesResumen: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_alocaciones')
      .select('planificacion, monto_usd, categoria, cpt_items_proyecto(descripcion), cpt_oc(numero_oc,proveedor)')
      .eq('proyecto_id', proyectoId)
    if (error) throw error
    return data || []
  },
  getAlertas: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_presupuesto_lineas').select('descripcion,monto_pres_usd,monto_real_usd').eq('proyecto_id',proyectoId).eq('estado','alerta')
    if (error) throw error
    return data || []
  },
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtUSD  = (n) => {
  if (n == null) return '—'
  const num = Number(n)
  const dec = Math.abs(num % 1) > 0.004 ? 2 : 0
  return '$' + num.toLocaleString('es-AR', {minimumFractionDigits:dec, maximumFractionDigits:dec})
}
const fmtDate = (d) => d ? new Date(d+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const safeReplace = (s) => (s||'').replace(/_/g,' ')

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
.hdr-sel option{background:#0B1629;color:#fff}
.hdr-btn{background:transparent;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.55);font-family:var(--sans);font-size:10px;font-weight:600;padding:5px 12px;border-radius:6px;cursor:pointer;letter-spacing:.3px}
.hdr-btn:hover{border-color:rgba(255,255,255,.35);color:#fff}
.hdr-btn-gold{background:var(--gold);color:var(--navy);border:none;font-family:var(--sans);font-size:10px;font-weight:700;padding:5px 12px;border-radius:6px;cursor:pointer}
.hdr-btn-gold:hover{background:var(--gold2)}
.hdr-email{font-size:10px;font-family:var(--mono);color:rgba(255,255,255,.35)}
/* TABS */
.tabs{display:flex;background:var(--navy);border-bottom:1px solid rgba(184,148,42,.15);padding:0 28px;overflow-x:auto;flex-shrink:0}
.tab{padding:13px 16px;font-size:12px;font-weight:600;cursor:pointer;color:rgba(255,255,255,.4);border-bottom:2px solid transparent;white-space:nowrap;letter-spacing:.3px;transition:all .15s;user-select:none}
.tab:hover{color:rgba(255,255,255,.8)}
.tab.active{color:#fff;border-bottom-color:var(--gold)}
/* SUB TABS */
.sub-tabs{display:flex;gap:8px;margin-bottom:16px}
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
.tbl-wrap{overflow-x:auto;max-height:400px;overflow-y:auto}
table{width:100%;border-collapse:collapse;font-size:12px}
th{padding:8px 12px;text-align:left;color:var(--muted);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);background:#FAFBFC;white-space:nowrap}
td{padding:8px 12px;border-bottom:1px solid var(--border);vertical-align:middle;color:var(--text)}
tr:last-child td{border-bottom:none}
tr:hover td{background:#F7F9FC}
.mono{font-family:'Courier New',monospace;font-size:11px}
/* INLINE EDIT */
.inline-edit{background:#fff;border:1px solid var(--blue);color:var(--text);padding:3px 6px;border-radius:4px;font-size:11px;font-family:'Courier New',monospace;width:90px}
.inline-edit:focus{outline:none;box-shadow:0 0 0 2px rgba(35,92,150,.2)}
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
.btn-active{background:#235C96;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:700;cursor:pointer}
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
/* STATES */
.state-msg{padding:32px;text-align:center;color:var(--muted);font-size:12px}
/* SECTION LABEL */
.section-label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--border)}
/* REMINDER badge */
.reminder-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap}
.r-due{background:#FEE2E2;color:#991B1B;border:1px solid #FECACA}
.r-soon{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A}
.r-ok{background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB}
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
.login-submit{width:100%;padding:11px;margin-top:8px;background:var(--gold);color:var(--navy);border:none;border-radius:8px;font-family:var(--sans);font-size:13px;font-weight:700;cursor:pointer}
.login-submit:hover{background:var(--gold2)}
.login-submit:disabled{opacity:.5;cursor:not-allowed}
.login-err{background:rgba(239,68,68,.12);color:#FCA5A5;border:1px solid rgba(239,68,68,.25);border-radius:8px;padding:10px 13px;font-size:12px;margin-bottom:12px}
.login-foot{text-align:center;font-family:var(--mono);font-size:9px;color:rgba(255,255,255,.2);margin-top:16px;letter-spacing:1px}
.login-back{text-align:center;margin-top:10px;font-size:11px;color:rgba(255,255,255,.3);cursor:pointer;font-family:var(--mono)}
.login-back:hover{color:var(--gold)}
@media(max-width:640px){.login-left{display:none}.login-right{width:100%;padding:40px 24px}.kpi-row{grid-template-columns:1fr 1fr}.two-col{grid-template-columns:1fr}.tabs{padding:0 16px}.main{padding:16px}.hdr-email{display:none}}
`

// ─── REMINDER HELPER ─────────────────────────────────────────────────────────
function getReminderStatus(fechaStr) {
  if (!fechaStr) return null
  const today = new Date()
  const fecha = new Date(fechaStr + 'T00:00:00')
  const diff  = Math.ceil((fecha - today) / (1000*60*60*24))
  if (diff < 0)  return { label: 'Vencida', cls: 'r-due' }
  if (diff <= 7) return { label: `En ${diff}d`, cls: 'r-soon' }
  return { label: fmtDate(fechaStr), cls: 'r-ok' }
}

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
    } finally { setLoading(false) }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="login-wrap">
        <div className="login-lines" /><div className="login-overlay" />
        <div className="login-split">
          <div className="login-left">
            <div className="login-eyebrow">Cost Project Tracker</div>
            <div className="login-logo-row"><img src="/PL.png" alt="PL" className="login-logo-img" /></div>
            <div className="login-title">PARANA<span>LOGÍSTICA</span></div>
            <div className="login-line" />
            <div className="login-sub">Control de costos, órdenes de compra y márgenes de proyecto en tiempo real.</div>
          </div>
          <div className="login-right">
            <div className="login-card">
              <div className="login-card-title">Acceso al módulo</div>
              <div className="login-card-sub">Solo personal autorizado</div>
              {error && <div className="login-err">{error}</div>}
              <div className="login-fg"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="usuario@paranalogistica.com.ar" autoFocus /></div>
              <div className="login-fg"><label>Contraseña</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()} placeholder="••••••••" /></div>
              <button className="login-submit" onClick={handleLogin} disabled={loading||!email||!pass}>{loading?'Ingresando...':'Ingresar →'}</button>
              <div className="login-foot">Parana Logística · Acceso restringido</div>
              <div className="login-back" onClick={()=>window.location.href=PORTAL_URL}>← Volver al Portal</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── TAB OVERVIEW ─────────────────────────────────────────────────────────────
function TabOverview({ proyecto }) {
  const [pnl, setPnl]         = useState(null)
  const [alertas, setAlertas] = useState([])
  const [noPlan, setNoPlan]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p, a, alocs] = await Promise.all([api.getPNL(proyecto.id), api.getAlertas(proyecto.id), api.getAlocacionesResumen(proyecto.id)])
      setPnl(p); setAlertas(a)
      setNoPlan(alocs.filter(a => a.planificacion === 'no_planeado'))
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
  const cm        = ingreso > 0 ? ((ingreso - costoReal) / ingreso * 100).toFixed(1) : 0

  return (
    <>
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-lbl">Ingresos Cotizados</div><div className="kpi-val cb">{fmtUSD(ingreso)}</div><div className="kpi-sub">USD · Propuesta Cliente</div></div>
        <div className="kpi"><div className="kpi-lbl">Costo Presupuestado</div><div className="kpi-val">{fmtUSD(costoPres)}</div><div className="kpi-sub">USD · todas las líneas</div></div>
        <div className="kpi"><div className="kpi-lbl">Costo Real</div><div className="kpi-val cw">{fmtUSD(costoReal)}</div><div className="kpi-sub">OC + facturas cargadas</div></div>
        <div className="kpi"><div className="kpi-lbl">Margen Contribución</div><div className="kpi-val cg">{cm}%</div><div className="kpi-sub">(Ingreso − Costo Real) / Ingreso</div></div>
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
          <div className="card-hdr"><span className="card-title">Alertas de Costo</span></div>
          <div style={{padding:'14px 16px'}}>
            {alertas.length===0
              ? <div className="alert alert-ok">Sin alertas activas</div>
              : alertas.map((a,i)=>{
                  const delta = a.monto_real_usd&&a.monto_pres_usd?((a.monto_real_usd-a.monto_pres_usd)/a.monto_pres_usd*100).toFixed(1):null
                  return <div key={i} className="alert alert-err">{a.descripcion}{delta&&<strong style={{marginLeft:8}}>+{delta}%</strong>}</div>
                })
            }
          </div>
        </div>
      </div>
      {noPlan.length > 0 && (
        <div className="card">
          <div className="card-hdr">
            <span className="card-title">⚠ Costos No Planeados</span>
            <span style={{fontSize:12,color:'#92400E',fontWeight:700}}>{fmtUSD(noPlan.reduce((s,a)=>s+(a.monto_usd||0),0))} USD</span>
          </div>
          <div className="tbl-wrap" style={{maxHeight:220}}>
            <table>
              <thead><tr><th>OC</th><th>Proveedor</th><th>Ítem</th><th>Categoría</th><th style={{textAlign:'right'}}>USD</th></tr></thead>
              <tbody>
                {noPlan.map((a,i) => (
                  <tr key={i} style={{background:'#FFFBEB'}}>
                    <td className="mono" style={{color:'var(--blue)'}}>{a.cpt_oc?.numero_oc}</td>
                    <td style={{fontSize:11}}>{a.cpt_oc?.proveedor}</td>
                    <td style={{fontSize:11}}>{a.cpt_items_proyecto?.descripcion}</td>
                    <td><span className={`tag t-${a.categoria==='material'?'blue':a.categoria==='mano_obra'?'orange':a.categoria==='instalacion'?'green':'red'}`}>{CATS_LABEL[a.categoria]}</span></td>
                    <td className="mono cw" style={{textAlign:'right'}}>{fmtUSD(a.monto_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB PRESUPUESTO ──────────────────────────────────────────────────────────
const CATS = ['material', 'mano_obra', 'instalacion', 'consumibles']
const CATS_LABEL = { material: 'Material', mano_obra: 'Mano de Obra', instalacion: 'Instalación', consumibles: 'Consumibles' }

function ModalEditarItem({ item, onClose, onSave }) {
  const emptyC = () => ({ moneda:'USD', monto:'', fx:'' })
  const initCostos = (costos, tipo) => {
    const result = {}
    for (const cat of CATS) {
      const c = costos?.[cat]?.[tipo] || {}
      result[cat] = { moneda: c.moneda||'USD', monto: c.monto||'', fx: c.fx||'' }
    }
    return result
  }

  const [form, setForm] = useState({
    descripcion: item?.descripcion || '',
    precio_cliente: item?.precio_cliente || '',
    pres: initCostos(item?.costos, 'pres'),
    real: initCostos(item?.costos, 'real'),
  })
  const [saving, setSaving] = useState(false)

  const setC = (tipo, cat, field, val) => {
    setForm(f => ({ ...f, [tipo]: { ...f[tipo], [cat]: { ...f[tipo][cat], [field]: val } } }))
  }

  const calcUSD = (obj) => {
    if (!obj || !obj.monto) return null
    if (obj.moneda === 'ARS' && obj.fx) return Number(obj.monto) / Number(obj.fx)
    if (obj.moneda === 'USD') return Number(obj.monto)
    return null
  }

  const totalPres = CATS.reduce((s, cat) => s + (calcUSD(form.pres[cat]) || 0), 0)
  const totalReal = CATS.reduce((s, cat) => s + (item?.costos_real?.[cat]||0), 0)
  const precio    = Number(form.precio_cliente) || 0
  const cmPres    = precio > 0 ? ((precio - totalPres) / precio * 100).toFixed(1) : null
  const cmReal    = precio > 0 && totalReal > 0 ? ((precio - totalReal) / precio * 100).toFixed(1) : null

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const costos = {}
      for (const cat of CATS) {
        costos[cat] = {
          pres: { ...form.pres[cat], usd: calcUSD(form.pres[cat]) },
          real: { ...form.real[cat], usd: calcUSD(form.real[cat]) },
        }
      }
      await onSave({ descripcion: form.descripcion, precio_cliente: precio || null, costos })
    } finally { setSaving(false) }
  }

  const CAT_COLORS = { material:'#EFF6FF', mano_obra:'#FEF3C7', instalacion:'#F0FDF4', consumibles:'#FEF2F2' }

  return (
    <div className="overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{width:700,maxWidth:'98vw'}}>
        <h3>{item ? 'Editar Ítem' : 'Nuevo Ítem Cotizado'}</h3>
        <form onSubmit={handleSave}>
          <div className="form-row">
            <label>Descripción * (tal como figura en la cotización al cliente)</label>
            <input required value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="ej. A-Frame Fabricación" />
          </div>
          <div className="form-row">
            <label>Precio cotizado al cliente (USD) *</label>
            <input required type="number" step="0.01" value={form.precio_cliente} onChange={e=>setForm(f=>({...f,precio_cliente:e.target.value}))} placeholder="0.00" />
          </div>

          <div style={{borderTop:'1px solid var(--border)',paddingTop:14,marginTop:4}}>
            <div className="section-label">Desglose de Costos</div>

            {/* Header */}
            <div style={{display:'grid',gridTemplateColumns:'130px 1fr 1fr',gap:8,marginBottom:6,padding:'0 12px'}}>
              <div />
              <div style={{fontSize:10,fontWeight:700,color:'var(--blue)',textTransform:'uppercase',letterSpacing:.5}}>Presupuestado</div>
              <div style={{fontSize:10,fontWeight:700,color:'#059669',textTransform:'uppercase',letterSpacing:.5}}>Real / Ejecutado</div>
            </div>

            {CATS.map(cat => {
              const p = form.pres[cat]; const r = form.real[cat]
              const pUSD = calcUSD(p); const rUSD = calcUSD(r)
              const delta = pUSD != null && rUSD != null ? rUSD - pUSD : null
              return (
                <div key={cat} style={{background:CAT_COLORS[cat],border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',marginBottom:8}}>
                  <div style={{display:'grid',gridTemplateColumns:'130px 1fr 1fr',gap:8,alignItems:'start'}}>
                    {/* Label + delta */}
                    <div>
                      <div style={{fontWeight:700,fontSize:12,color:'var(--navy)',marginBottom:4}}>{CATS_LABEL[cat]}</div>
                      {pUSD!=null && <div style={{fontSize:10,color:'var(--blue)',fontFamily:'Courier New'}}>{fmtUSD(pUSD)}</div>}
                      {rUSD!=null && <div style={{fontSize:10,color:'#059669',fontFamily:'Courier New'}}>{fmtUSD(rUSD)}</div>}
                      {delta!=null && <div style={{fontSize:10,fontWeight:700,color:delta<=0?'#059669':'#DC2626',fontFamily:'Courier New'}}>{delta>0?'+':''}{fmtUSD(delta)}</div>}
                    </div>
                    {/* Presupuestado */}
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      <div style={{display:'grid',gridTemplateColumns:'70px 1fr',gap:4}}>
                        <select value={p.moneda} onChange={e=>setC('pres',cat,'moneda',e.target.value)} style={{padding:'4px 5px',fontSize:11}}>
                          <option value="USD">USD</option><option value="ARS">ARS</option>
                        </select>
                        <input type="number" step="0.01" value={p.monto} onChange={e=>setC('pres',cat,'monto',e.target.value)} placeholder="Monto" style={{padding:'4px 7px',fontSize:11}} />
                      </div>
                      {p.moneda==='ARS' && <input type="number" value={p.fx} onChange={e=>setC('pres',cat,'fx',e.target.value)} placeholder="FX ej. 1400" style={{padding:'4px 7px',fontSize:11}} />}
                    </div>
                    {/* Real — read only from alocaciones */}
                    <div style={{display:'flex',flexDirection:'column',gap:4,justifyContent:'center'}}>
                      {item?.costos_real?.[cat] > 0
                        ? <div style={{padding:'8px 10px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:6,fontFamily:'Courier New',fontSize:13,fontWeight:700,color:'#059669'}}>{fmtUSD(item.costos_real[cat])}</div>
                        : <div style={{padding:'8px 10px',background:'#F8FAFC',border:'1px solid var(--border)',borderRadius:6,fontSize:11,color:'var(--muted)',fontStyle:'italic'}}>Sin alocaciones</div>
                      }
                      <div style={{fontSize:10,color:'var(--muted)'}}>Calculado desde OC alocadas</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Resumen */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
            <div style={{background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>Presupuestado</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <strong style={{fontFamily:'Courier New'}}>{fmtUSD(totalPres)}</strong>
                <span style={{fontWeight:800,fontSize:14,color:'#1E40AF'}}>CM: {cmPres!=null?cmPres+'%':'—'}</span>
              </div>
            </div>
            <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:8,padding:'10px 14px'}}>
              <div style={{fontSize:11,color:'var(--muted)',marginBottom:4}}>Real ejecutado</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <strong style={{fontFamily:'Courier New'}}>{fmtUSD(totalReal||null)}</strong>
                <span style={{fontWeight:800,fontSize:14,color:'#059669'}}>CM: {cmReal!=null?cmReal+'%':'—'}</span>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TabPresupuesto({ proyecto }) {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [modalItem, setModalItem] = useState(null) // null=cerrado, 'new'=nuevo, item=editar

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await api.getItems(proyecto.id)) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    try {
      if (modalItem === 'new') {
        const { error } = await supabase.from('cpt_items_proyecto').insert({
          ...data, proyecto_id: proyecto.id, orden: items.length
        })
        if (error) { alert(error.message); return }
      } else {
        const { error } = await supabase.from('cpt_items_proyecto').update({
          descripcion: data.descripcion,
          precio_cliente: data.precio_cliente,
          costos: data.costos,
          updated_at: new Date().toISOString()
        }).eq('id', modalItem.id)
        if (error) { alert(error.message); return }
      }
      setModalItem(null)
      await load()
    } catch(e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este ítem?')) return
    const { error } = await supabase.from('cpt_items_proyecto').delete().eq('id', id)
    if (error) { alert(error.message); return }
    await load()
  }

  if (loading) return <div className="state-msg">Cargando ítems...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const totalPrecio = items.reduce((s,i) => s + (i.precio_cliente||0), 0)
  const totalCostoPres = items.reduce((s,i) => s + CATS.reduce((sc,cat) => sc+(i.costos?.[cat]?.pres?.usd||0),0), 0)
  const totalCostoReal = items.reduce((s,i) => s + CATS.reduce((sc,cat) => sc+(i.costos_real?.[cat]||0),0), 0)
  const totalCosto = totalCostoReal > 0 ? totalCostoReal : totalCostoPres
  const cmTotal = totalPrecio > 0 ? ((totalPrecio - totalCosto) / totalPrecio * 100).toFixed(1) : null

  return (
    <>
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Ítems Cotizados al Cliente — Presupuesto vs Costo Real</span>
          <button className="btn" onClick={() => setModalItem('new')}>+ Nuevo ítem</button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Precio Cliente</th>
                <th style={{background:'#EFF6FF'}}>Material</th>
                <th style={{background:'#FEF3C7'}}>Mano de Obra</th>
                <th style={{background:'#F0FDF4'}}>Instalación</th>
                <th style={{background:'#FEF2F2'}}>Consumibles</th>
                <th>Costo Total</th>
                <th>Margen $</th>
                <th>CM %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={10} className="state-msg">Sin ítems — agregá el primero</td></tr>
              )}
              {items.map(item => {
                const costoPresTotal = CATS.reduce((s, cat) => s + (item.costos?.[cat]?.pres?.usd||0), 0)
                const costoRealTotal = CATS.reduce((s, cat) => s + (item.costos_real?.[cat]||0), 0)
                const costoTotal = costoRealTotal > 0 ? costoRealTotal : costoPresTotal
                const margenUSD  = (item.precio_cliente||0) - costoTotal
                const cm         = item.precio_cliente > 0 ? (margenUSD / item.precio_cliente * 100).toFixed(1) : null
                return (
                  <tr key={item.id}>
                    <td style={{fontWeight:600}}>{item.descripcion}</td>
                    <td className="mono cb">{fmtUSD(item.precio_cliente)}</td>
                    {CATS.map(cat => {
                      const pUSD = item.costos?.[cat]?.pres?.usd
                      const rUSD = item.costos_real?.[cat] || null
                      const delta = pUSD!=null && rUSD!=null ? rUSD - pUSD : null
                      return (
                        <td key={cat} className="mono" style={{fontSize:11}}>
                          {pUSD!=null && <div style={{color:'var(--blue)'}}>{fmtUSD(pUSD)}</div>}
                          {rUSD!=null && rUSD>0 && <div style={{color:'#059669'}}>{fmtUSD(rUSD)}</div>}
                          {delta!=null && <div style={{fontWeight:500,fontSize:10,color:delta<=0?'#059669':'#DC2626'}}>{delta<=0?'▲':'▼'} {fmtUSD(Math.abs(delta))}</div>}
                          {pUSD==null && (rUSD==null||rUSD===0) && <span style={{color:'var(--muted)'}}>—</span>}
                        </td>
                      )
                    })}
                    <td className="mono" style={{fontSize:11}}>
                      {costoPresTotal>0&&<div style={{color:'var(--blue)'}}>{fmtUSD(item.precio_cliente-costoPresTotal)}</div>}
                      {costoRealTotal>0&&<div style={{color:'#059669',fontWeight:700}}>{fmtUSD(item.precio_cliente-costoRealTotal)}</div>}
                      {costoPresTotal>0&&costoRealTotal>0&&(()=>{const d=(item.precio_cliente-costoRealTotal)-(item.precio_cliente-costoPresTotal);return <div style={{fontWeight:500,fontSize:11,color:d>=0?'#059669':'#DC2626'}}>{d>=0?'▲':'▼'} {fmtUSD(Math.abs(d))}</div>})()}
                    </td>
                    <td style={{fontSize:11}}>
                      {costoPresTotal>0&&item.precio_cliente>0&&<div style={{color:'var(--blue)',fontWeight:600}}>{(((item.precio_cliente||0)-costoPresTotal)/item.precio_cliente*100).toFixed(1)}%</div>}
                      {costoRealTotal>0&&item.precio_cliente>0&&(()=>{const cmR=(((item.precio_cliente||0)-costoRealTotal)/item.precio_cliente*100);return <div style={{fontWeight:800,color:cmR>=30?'#059669':cmR>=15?'#D97706':'#DC2626'}}>{cmR.toFixed(1)}%</div>})()}
                      {costoPresTotal>0&&costoRealTotal>0&&item.precio_cliente>0&&(()=>{const d=((item.precio_cliente-costoRealTotal)-(item.precio_cliente-costoPresTotal))/item.precio_cliente*100;return <div style={{fontWeight:500,fontSize:11,color:d>=0?'#059669':'#DC2626'}}>{d>=0?'▲':'▼'} {Math.abs(d).toFixed(1)}pp</div>})()}
                    </td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn-ghost" style={{padding:'3px 8px',fontSize:10}} onClick={() => setModalItem(item)}>Editar</button>
                        <button className="btn-ghost" style={{padding:'3px 8px',fontSize:10,color:'var(--r)'}} onClick={() => handleDelete(item.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {items.length > 0 && (
          <div className="tbl-foot">
            <span style={{color:'var(--muted)'}}>Precio total cotizado: <strong className="cb">{fmtUSD(totalPrecio)}</strong></span>
            <span style={{color:'var(--muted)'}}>Costo pres.: <strong className="cb">{fmtUSD(totalCostoPres)}</strong></span>
            <span style={{color:'var(--muted)'}}>Costo real: <strong className="cg">{fmtUSD(totalCostoReal||null)}</strong></span>
            <span style={{marginLeft:'auto',fontWeight:700,fontSize:13,color:Number(cmTotal)>=30?'#059669':Number(cmTotal)>=15?'#D97706':'#DC2626'}}>
              CM Total: {cmTotal}%
            </span>
          </div>
        )}
      </div>

      {modalItem && (
        <ModalEditarItem
          item={modalItem === 'new' ? null : modalItem}
          onClose={() => setModalItem(null)}
          onSave={handleSave}
        />
      )}
    </>
  )
}

// ─── TAB COSTOS (OC + Facturas de Compra) ─────────────────────────────────────
function TabCostos({ proyecto }) {
  const [subTab, setSubTab] = useState('oc')
  return (
    <>
      <div className="sub-tabs">
        <button className={subTab==='oc'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab('oc')}>Órdenes de Compra</button>
        <button className={subTab==='facturas'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab('facturas')}>Facturas de Compra</button>
      </div>
      {subTab==='oc'       && <SubTabOC       proyecto={proyecto} />}
      {subTab==='facturas' && <SubTabFacturasCompra proyecto={proyecto} />}
    </>
  )
}

// ─── MODAL ALOCAR OC ─────────────────────────────────────────────────────────
function ModalAlocar({ oc, proyecto, onClose, onSave }) {
  const [items, setItems]         = useState([])
  const [alocaciones, setAloc]    = useState([]) // existing alocaciones for this OC
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ item_id:'', categoria:'material', monto_usd:'', notas:'', planificacion:'planeado' })

  const ocTotal = oc.total_alocar_usd || oc.monto_usd_sin_iva || 0

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [its, alocs] = await Promise.all([
        api.getItems(proyecto.id),
        api.getAlocacionesByOC(oc.id)
      ])
      setItems(its); setAloc(alocs)
    } catch(e) { alert(e.message) }
    finally { setLoading(false) }
  }, [oc.id, proyecto.id])

  useEffect(() => { load() }, [load])

  const totalAlocado = alocaciones.reduce((s,a) => s + (a.monto_usd||0), 0)
  const saldo = ocTotal - totalAlocado

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const monto = Number(form.monto_usd)
      if (monto > saldo + 0.01) { alert(`Superás el saldo disponible (${fmtUSD(saldo)})`); return }
      const { error } = await supabase.from('cpt_alocaciones').insert({
        proyecto_id: proyecto.id,
        oc_id: oc.id,
        item_id: form.item_id,
        categoria: form.categoria,
        monto_usd: monto,
        notas: form.notas || null,
        planificacion: form.planificacion || 'planeado'
      })
      if (error) { alert(error.message); return }
      setForm({ item_id:'', categoria:'material', monto_usd:'', notas:'' })
      await load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    await supabase.from('cpt_alocaciones').delete().eq('id', id)
    await load()
  }

  return (
    <div className="overlay open" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{width:620}}>
        <h3>Alocar OC — {oc.numero_oc}</h3>
        <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',background:'#F8FAFC',border:'1px solid var(--border)',borderRadius:8,marginBottom:16,fontSize:13}}>
          <span style={{color:'var(--muted)'}}>Proveedor: <strong style={{color:'var(--navy)'}}>{oc.proveedor}</strong></span>
          <span style={{color:'var(--muted)'}}>Total OC: <strong className="cb">{fmtUSD(ocTotal)}</strong></span>
          <span style={{color:'var(--muted)'}}>Alocado: <strong className="cg">{fmtUSD(totalAlocado)}</strong></span>
          <span style={{color: saldo < 0.01 ? '#059669' : '#D97706', fontWeight:700}}>Saldo: {fmtUSD(saldo)}</span>
        </div>

        {/* Alocaciones existentes */}
        {alocaciones.length > 0 && (
          <div style={{marginBottom:16}}>
            <div className="section-label">Alocaciones cargadas</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr><th style={{padding:'6px 8px',textAlign:'left',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>Ítem</th><th style={{padding:'6px 8px',textAlign:'left',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>Categoría</th><th style={{padding:'6px 8px',textAlign:'left',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>Plan.</th><th style={{padding:'6px 8px',textAlign:'right',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>USD</th><th style={{width:32,borderBottom:'1px solid var(--border)'}}></th></tr></thead>
              <tbody>
                {alocaciones.map(a => (
                  <tr key={a.id}>
                    <td style={{padding:'6px 8px',fontSize:12}}>{a.cpt_items_proyecto?.descripcion}</td>
                    <td style={{padding:'6px 8px'}}><span className={`tag t-${a.categoria==='material'?'blue':a.categoria==='mano_obra'?'orange':a.categoria==='instalacion'?'green':'red'}`}>{CATS_LABEL[a.categoria]}</span></td>
                    <td style={{padding:'6px 8px'}}><span style={{fontSize:10,padding:'2px 6px',borderRadius:8,fontWeight:600,background:a.planificacion==='no_planeado'?'#FEF3C7':'#F3F4F6',color:a.planificacion==='no_planeado'?'#92400E':'#6B7280'}}>{a.planificacion==='no_planeado'?'⚠ No planeado':'✓ Planeado'}</span></td>
                    <td style={{padding:'6px 8px',textAlign:'right',fontFamily:'Courier New',fontWeight:700,color:'#059669'}}>{fmtUSD(a.monto_usd)}</td>
                    <td style={{padding:'4px'}}><button onClick={()=>handleDelete(a.id)} style={{background:'none',border:'none',color:'#DC2626',cursor:'pointer',fontSize:12}}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Agregar nueva alocación */}
        {saldo > 0.01 && (
          <form onSubmit={handleAdd}>
            <div className="section-label">Nueva alocación — saldo disponible: {fmtUSD(saldo)}</div>
            <div className="two-col" style={{marginBottom:8}}>
              <div className="form-row">
                <label>Ítem cotizado *</label>
                <select required value={form.item_id} onChange={e=>setForm(f=>({...f,item_id:e.target.value}))}>
                  <option value="">Seleccionar ítem...</option>
                  {items.map(i=><option key={i.id} value={i.id}>{i.descripcion}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Categoría *</label>
                <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>
                  {CATS.map(c=><option key={c} value={c}>{CATS_LABEL[c]}</option>)}
                </select>
              </div>
            </div>
            <div className="two-col" style={{marginBottom:0}}>
              <div className="form-row">
                <label>Monto USD *</label>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <input required type="number" step="0.01" value={form.monto_usd} onChange={e=>setForm(f=>({...f,monto_usd:e.target.value}))} placeholder={`máx. ${fmtUSD(saldo)}`} style={{flex:1}} />
                  <input type="number" min="0" max="100" step="1" placeholder="%" onChange={e=>{const p=Number(e.target.value);if(p>0&&p<=100)setForm(f=>({...f,monto_usd:(saldo*p/100).toFixed(2)}))}} style={{width:64,textAlign:'center'}} />
                  <span style={{fontSize:11,color:'var(--muted)',whiteSpace:'nowrap'}}>% del saldo</span>
                </div>
              </div>
              <div className="form-row">
                <label>Planificación *</label>
                <select value={form.planificacion} onChange={e=>setForm(f=>({...f,planificacion:e.target.value}))}>
                  <option value="planeado">✓ Planeado</option>
                  <option value="no_planeado">⚠ No planeado</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <label>Notas</label>
              <input value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Opcional" />
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
              <button type="submit" className="btn" disabled={saving||loading}>{saving?'Guardando...':'Alocar'}</button>
            </div>
          </form>
        )}
        {saldo <= 0.01 && (
          <div className="alert alert-ok">✓ OC completamente alocada</div>
        )}
        {saldo > 0.01 && alocaciones.length > 0 && <div style={{height:8}} />}
      </div>
    </div>
  )
}

// ─── MODAL EDITAR OC ─────────────────────────────────────────────────────────
function ModalEditarOC({ oc, categorias, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    numero_oc:    oc.numero_oc    || '',
    proveedor:    oc.proveedor    || '',
    descripcion:  oc.descripcion  || '',
    moneda:       oc.moneda       || 'ARS',
    monto_sin_iva: oc.monto_sin_iva || '',
    iva_pct:      oc.iva_pct      ?? '21',
    fx:           oc.fx           || '',
    fecha_emision: oc.fecha_emision || '',
    estado:       oc.estado       || 'activa',
    categoria_id: oc.categoria_id || '',
    cuit_proveedor: oc.cuit_proveedor || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await onSave(form) }
    finally { setSaving(false) }
  }

  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:560}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <h3 style={{margin:0}}>Editar OC — {oc.numero_oc}</h3>
          <button type="button" onClick={onClose} style={{background:'none',border:'none',fontSize:20,cursor:'pointer',color:'var(--muted)',lineHeight:1}}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="two-col">
            <div className="form-row"><label>Número OC *</label><input required value={form.numero_oc} onChange={e=>setForm(f=>({...f,numero_oc:e.target.value}))} /></div>
            <div className="form-row"><label>Proveedor *</label><input required value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} /></div>
          </div>
          <div className="form-row"><label>CUIT Proveedor</label><input value={form.cuit_proveedor} onChange={e=>setForm(f=>({...f,cuit_proveedor:e.target.value}))} placeholder="ej. 30-70733736-9" /></div>
          <div className="two-col">
            <div className="form-row"><label>Categoría *</label><select required value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))}><option value="">Seleccionar...</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="form-row"><label>Estado</label><select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}><option value="pendiente_aprobacion">Pendiente aprobación</option><option value="aprobada">Aprobada</option><option value="activa">Activa</option><option value="completada">Completada</option><option value="cancelada">Cancelada</option></select></div>
          </div>
          <div className="form-row"><label>Descripción</label><input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} /></div>
          <div className="two-col">
            <div className="form-row"><label>Moneda</label><select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))}><option value="ARS">ARS</option><option value="USD">USD</option></select></div>
            <div className="form-row"><label>FX {form.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx} onChange={e=>setForm(f=>({...f,fx:e.target.value}))} disabled={form.moneda==='USD'} placeholder="ej. 1425" /></div>
          </div>
          <div className="two-col">
            <div className="form-row"><label>Monto s/IVA ({form.moneda}) * — el sistema calcula c/IVA</label><input required type="number" step="0.01" value={form.monto_sin_iva} onChange={e=>setForm(f=>({...f,monto_sin_iva:e.target.value}))} /></div>
            <div className="form-row"><label>IVA %</label><select value={form.iva_pct} onChange={e=>setForm(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div>
          </div>
          <div className="form-row"><label>Fecha emisión</label><input type="date" value={form.fecha_emision} onChange={e=>setForm(f=>({...f,fecha_emision:e.target.value}))} /></div>
          <div className="modal-footer" style={{justifyContent:'space-between'}}>
            <button type="button" onClick={async ()=>{
              if(!confirm('¿Eliminar esta OC? También se eliminarán sus alocaciones.')) return
              await onDelete()
            }} style={{background:'#FEF2F2',border:'1px solid #FECACA',color:'#DC2626',padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer'}}>
              🗑 Eliminar OC
            </button>
            <div style={{display:'flex',gap:8}}>
              <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Guardar cambios'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── MODAL NUEVA OC CON PDF PARSER ───────────────────────────────────────────
function ModalNuevaOC({ categorias, form, setForm, saving, onClose, onSubmit }) {
  const [parsing, setParsing] = useState(false)
  const [parseMsg, setParseMsg] = useState('')

  const handlePDF = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setParsing(true)
    setParseMsg('Leyendo PDF...')
    try {
      // Convert PDF to base64
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = rej
        r.readAsDataURL(file)
      })

      setParseMsg('Interpretando con IA...')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 }
              },
              {
                type: 'text',
                text: `Extraé los siguientes campos de esta Orden de Compra de Parana Logística y respondé SOLO con un JSON válido, sin texto adicional, sin markdown:
{
  "numero_oc": "número de OC (solo el número, ej: 2395)",
  "proveedor": "nombre del proveedor (Sr. (es):)",
  "cuit_proveedor": "CUIT del proveedor",
  "fecha_emision": "fecha en formato YYYY-MM-DD",
  "moneda": "ARS si dice Pesos Argentinos, USD si dice Dólares",
  "monto_sin_iva": número sin IVA (campo Bruto),
  "iva_pct": porcentaje de IVA como número (21 si hay impuestos ~21%, 0 si no hay),
  "monto_total": número total con IVA,
  "descripcion": "descripción breve del primer artículo o descripción general",
  "observaciones": "texto del campo Observaciones"
}`
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.find(b => b.type === 'text')?.text || ''
      const clean = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      // Pre-fill form
      setForm(f => ({
        ...f,
        numero_oc:    parsed.numero_oc    || f.numero_oc,
        proveedor:    parsed.proveedor    || f.proveedor,
        fecha_emision: parsed.fecha_emision || f.fecha_emision,
        moneda:       parsed.moneda       || f.moneda,
        monto_sin_iva: parsed.monto_sin_iva ? String(parsed.monto_sin_iva) : f.monto_sin_iva,
        iva_pct:      parsed.iva_pct !== undefined ? String(parsed.iva_pct) : f.iva_pct,
        descripcion:  parsed.descripcion  || f.descripcion,
        notas:        parsed.observaciones || f.notas || '',
      }))
      setParseMsg('✓ PDF interpretado — revisá los campos')
    } catch(err) {
      setParseMsg('No se pudo leer el PDF. Completá los campos manualmente.')
      console.error(err)
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:560}}>
        <h3>Nueva Orden de Compra</h3>

        {/* PDF Upload */}
        <div style={{background:'#EFF6FF',border:'1px dashed #93C5FD',borderRadius:8,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:'#1E40AF',marginBottom:2}}>📎 Subir PDF de OC</div>
            <div style={{fontSize:11,color:'#6381A7'}}>Se interpreta automáticamente y pre-llena los campos</div>
          </div>
          <label style={{
            background: parsing ? '#9CA3AF' : '#235C96',
            color:'#fff', border:'none', padding:'6px 14px', borderRadius:6,
            fontSize:11, fontWeight:700, cursor: parsing ? 'not-allowed' : 'pointer',
            whiteSpace:'nowrap'
          }}>
            {parsing ? 'Leyendo...' : 'Seleccionar PDF'}
            <input type="file" accept=".pdf" onChange={handlePDF} disabled={parsing} style={{display:'none'}} />
          </label>
        </div>
        {parseMsg && (
          <div className={`alert ${parseMsg.startsWith('✓')?'alert-ok':'alert-warn'}`} style={{marginBottom:12}}>
            {parseMsg}
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className="two-col">
            <div className="form-row"><label>Número OC *</label><input required value={form.numero_oc} onChange={e=>setForm(f=>({...f,numero_oc:e.target.value}))} placeholder="ej. 2395" /></div>
            <div className="form-row"><label>Proveedor *</label><input required value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} /></div>
          </div>
          <div className="two-col">
            <div className="form-row"><label>Categoría *</label><select required value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))}><option value="">Seleccionar...</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="form-row"><label>Estado</label><select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}><option value="pendiente_aprobacion">Pendiente aprobación</option><option value="aprobada">Aprobada</option><option value="activa">Activa</option></select></div>
          </div>
          <div className="form-row"><label>Descripción</label><input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder="ej. Caño cuadrado 50x50" /></div>
          <div className="two-col">
            <div className="form-row"><label>Moneda</label><select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))}><option value="ARS">ARS</option><option value="USD">USD</option></select></div>
            <div className="form-row"><label>FX {form.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx} onChange={e=>setForm(f=>({...f,fx:e.target.value}))} disabled={form.moneda==='USD'} required={form.moneda==='ARS'} placeholder="ej. 1425" /></div>
          </div>
          <div className="two-col">
            <div className="form-row"><label>Monto s/IVA ({form.moneda}) *</label><input required type="number" step="0.01" value={form.monto_sin_iva} onChange={e=>setForm(f=>({...f,monto_sin_iva:e.target.value}))} placeholder="0.00" /></div>
            <div className="form-row"><label>IVA %</label><select value={form.iva_pct} onChange={e=>setForm(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div>
          </div>
          <div className="form-row"><label>Fecha emisión</label><input type="date" value={form.fecha_emision} onChange={e=>setForm(f=>({...f,fecha_emision:e.target.value}))} /></div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn" disabled={saving||parsing}>{saving?'Guardando...':'Crear OC'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SubTabOC({ proyecto }) {
  const [ocs, setOcs]               = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [modal, setModal]           = useState(false)
  const [modalAlocar, setModalAlocar] = useState(null)
  const [modalEditar, setModalEditar] = useState(null) // oc object to edit
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({numero_oc:'',proveedor:'',cuit_proveedor:'',categoria_id:'',descripcion:'',moneda:'USD',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_emision:'',estado:'pendiente_aprobacion'})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [o, c, alocs] = await Promise.all([api.getOCs(proyecto.id), api.getCategorias(), api.getAlocaciones(proyecto.id)])
      // enrich ocs with alocado desde alocaciones (más preciso que la vista)
      const alocMap = {}
      for (const a of alocs) {
        alocMap[a.oc_id] = (alocMap[a.oc_id]||0) + (a.monto_usd||0)
      }
      const enriched = o.map(oc => ({...oc, alocado_usd: alocMap[oc.id]||0, sin_alocar: (oc.monto_usd_sin_iva||0)-(alocMap[oc.id]||0)}))
      setOcs(enriched); setCategorias(c)
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
        fx:Number(form.fx)||null,
        cuit_proveedor: form.cuit_proveedor||null
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
          <span className="card-title">Órdenes de Compra — Parana Logística</span>
          <button className="btn" onClick={()=>setModal(true)}>+ Nueva OC</button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>#OC</th><th>Proveedor</th><th>Descripción</th><th>Moneda</th><th>Total USD c/IVA</th><th>Facturado</th><th>Alocado</th><th>Sin Alocar</th><th>Emitida</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {ocs.length===0 && <tr><td colSpan={10} className="state-msg">Sin OC — creá la primera</td></tr>}
              {ocs.map(o=>(
                <tr key={o.id}>
                  <td className="mono cb">{o.numero_oc}</td>
                  <td style={{fontWeight:600}}>{o.proveedor}</td>
                  <td style={{color:'var(--muted)',fontSize:11}}>{o.descripcion}</td>
                  <td className="mono">{o.moneda}</td>
                  <td className="mono"><strong>{fmtUSD(o.total_alocar_usd)}</strong></td>
                  <td>
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      <span className={`mono ${(o.pct_facturado||0)>=100?'cg':'cw'}`} style={{fontSize:11}}>{fmtUSD(o.facturado_usd)} ({o.pct_facturado||0}%)</span>
                      <div className="prog-wrap" style={{width:80}}><div className="prog" style={{width:`${o.pct_facturado||0}%`,background:(o.pct_facturado||0)>=100?'#059669':'#235C96'}} /></div>
                    </div>
                  </td>
                  <td className="mono cg">{fmtUSD(o.alocado_usd)}</td>
                  <td className={`mono ${(o.total_alocar_usd-o.alocado_usd)>0.01?'cw':'cg'}`}>
                    {(o.total_alocar_usd-o.alocado_usd)>0.01
                      ? <div>
                          <div>{fmtUSD(o.total_alocar_usd-o.alocado_usd)}</div>
                          <div style={{fontSize:10,color:'var(--muted)'}}>de {fmtUSD(o.total_alocar_usd)}</div>
                        </div>
                      : <span style={{color:'#059669'}}>✓</span>}
                  </td>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(o.fecha_emision)}</td>
                  <td><span className={`chip ${CHIP[o.estado]||'c-no'}`}>{safeReplace(o.estado)}</span></td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn-ghost" style={{padding:'3px 8px',fontSize:10}} onClick={()=>setModalEditar(o)}>Editar</button>
                      <button className="btn" style={{padding:'4px 10px',fontSize:10,whiteSpace:'nowrap'}} onClick={()=>setModalAlocar(o)}>Alocar →</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>Total c/IVA: <strong style={{color:'var(--navy)'}}>{fmtUSD(ocs.reduce((s,o)=>s+(o.total_alocar_usd||0),0))}</strong></span>
          <span style={{color:'var(--muted)'}}>Pendiente facturar: <strong className="cw">{fmtUSD(totalPend)}</strong></span>
        </div>
      </div>

      {modalEditar && (
        <ModalEditarOC
          oc={modalEditar}
          categorias={categorias}
          onClose={() => setModalEditar(null)}
          onSave={async (data) => {
            const { error } = await supabase.from('cpt_oc').update({
              numero_oc: data.numero_oc,
              proveedor: data.proveedor,
              descripcion: data.descripcion,
              moneda: data.moneda,
              monto_sin_iva: Number(data.monto_sin_iva),
              iva_pct: Number(data.iva_pct),
              fx: Number(data.fx)||null,
              fecha_emision: data.fecha_emision||null,
              estado: data.estado,
              categoria_id: data.categoria_id,
              cuit_proveedor: data.cuit_proveedor||null,
            }).eq('id', modalEditar.id)
            if (error) { alert(error.message); return }
            setModalEditar(null)
            await load()
          }}
          onDelete={async () => {
            const { error: e1 } = await supabase.from('cpt_alocaciones').delete().eq('oc_id', modalEditar.id)
            if (e1) { alert(e1.message); return }
            const { error: e2 } = await supabase.from('cpt_oc').delete().eq('id', modalEditar.id)
            if (e2) { alert(e2.message); return }
            setModalEditar(null)
            await load()
          }}
        />
      )}

      {modalAlocar && (
        <ModalAlocar
          oc={modalAlocar}
          proyecto={proyecto}
          onClose={() => { setModalAlocar(null); load() }}
          onSave={() => { setModalAlocar(null); load() }}
        />
      )}

      {modal && (
        <ModalNuevaOC
          categorias={categorias}
          form={form}
          setForm={setForm}
          saving={saving}
          onClose={()=>setModal(false)}
          onSubmit={handleSave}
        />
      )}
    </>
  )
}

function SubTabFacturasCompra({ proyecto }) {
  const [fcompra, setFcompra]   = useState([])
  const [ocs, setOcs]           = useState([])
  const [ocSaldos, setOcSaldos] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [formC, setFormC] = useState({numero_factura:'',oc_id:'',proveedor:'',cuit_proveedor:'',moneda:'USD',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_factura:'',fecha_vto_pago:''})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [fc, o, s] = await Promise.all([
        api.getFacturasCompra(proyecto.id),
        api.getOCsBasic(proyecto.id),
        api.getOCSaldos(proyecto.id),
      ])
      setFcompra(fc); setOcs(o); setOcSaldos(s)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!formC.oc_id) return
    const oc = ocs.find(o=>o.id===formC.oc_id)
    if (oc) setFormC(f=>({...f,proveedor:oc.proveedor}))
  }, [formC.oc_id, ocs])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_facturas_compra').insert({
        ...formC, proyecto_id:proyecto.id,
        monto_sin_iva:Number(formC.monto_sin_iva),
        iva_pct:Number(formC.iva_pct),
        fx:Number(formC.fx)||null,
        cuit_proveedor: formC.cuit_proveedor||null
      })
      if (error) { alert(error.message); return }
      setModal(false)
      setFormC({numero_factura:'',oc_id:'',proveedor:'',moneda:'USD',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_factura:'',fecha_vto_pago:''})
      await load()
    } finally { setSaving(false) }
  }

  const CHIPFC = {pagada:'c-ok',pendiente_pago:'c-apr',vencida:'c-pend'}
  const ocSel  = formC.oc_id ? ocSaldos[formC.oc_id] : null
  const totalPagado   = fcompra.filter(f=>f.estado==='pagada').reduce((s,f)=>s+(f.monto_usd_con_iva||0),0)
  const totalPendPago = fcompra.filter(f=>f.estado!=='pagada').reduce((s,f)=>s+(f.monto_usd_con_iva||0),0)

  if (loading) return <div className="state-msg">Cargando facturas...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  return (
    <>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Facturas de Compra — Parana Logística</span><button className="btn" onClick={()=>setModal(true)}>+ Registrar</button></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>#Factura</th><th>Proveedor</th><th>OC</th><th>Moneda</th><th>USD s/IVA</th><th>USD c/IVA</th><th>% OC</th><th>Fecha</th><th>Vto. Pago</th><th>Estado</th></tr></thead>
            <tbody>
              {fcompra.length===0 && <tr><td colSpan={10} className="state-msg">Sin facturas registradas</td></tr>}
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
                    <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(f.fecha_factura)}</td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(f.fecha_vto_pago)}</td>
                    <td><span className={`chip ${CHIPFC[f.estado]||'c-no'}`}>{safeReplace(f.estado)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>Pagadas: <strong className="cg">{fmtUSD(totalPagado)}</strong></span>
          <span style={{color:'var(--muted)'}}>Pendiente pago: <strong className="cw">{fmtUSD(totalPendPago)}</strong></span>
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Registrar Factura de Compra</h3>
            <form onSubmit={handleSave}>
              <div className="two-col">
                <div className="form-row"><label>Número *</label><input required value={formC.numero_factura} onChange={e=>setFormC(f=>({...f,numero_factura:e.target.value}))} placeholder="ej. FC-0045" /></div>
                <div className="form-row"><label>OC vinculada *</label><select required value={formC.oc_id} onChange={e=>setFormC(f=>({...f,oc_id:e.target.value}))}><option value="">Seleccionar...</option>{ocs.map(o=><option key={o.id} value={o.id}>{o.numero_oc} – {o.proveedor}</option>)}</select></div>
              </div>
              {ocSel&&<div className="alert alert-info" style={{marginBottom:12}}>{ocSel.numero_oc} — Saldo disponible: <strong>{fmtUSD(ocSel.saldo_usd)} USD</strong></div>}
              <div className="form-row"><label>Proveedor *</label><input required value={formC.proveedor} onChange={e=>setFormC(f=>({...f,proveedor:e.target.value}))} /></div>
              <div className="form-row"><label>CUIT Proveedor</label><input value={formC.cuit_proveedor} onChange={e=>setFormC(f=>({...f,cuit_proveedor:e.target.value}))} placeholder="ej. 30-70733736-9" /></div>
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
                <button type="button" className="btn-ghost" onClick={()=>setModal(false)}>Cancelar</button>
                <button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB INGRESOS (Facturas al Cliente + Proyecciones) ────────────────────────
function TabIngresos({ proyecto }) {
  const [subTab, setSubTab] = useState('facturas')
  return (
    <>
      <div className="sub-tabs">
        <button className={subTab==='facturas'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab('facturas')}>Facturas al Cliente</button>
        <button className={subTab==='margen'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab('margen')}>Margen & Costos</button>
      </div>
      {subTab==='facturas' && <SubTabFacturasVenta proyecto={proyecto} />}
      {subTab==='margen'   && <SubTabMargen        proyecto={proyecto} />}
    </>
  )
}

function SubTabFacturasVenta({ proyecto }) {
  const [fventa, setFventa]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [modal, setModal]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [formV, setFormV] = useState({
    numero_factura:'', concepto:'', monto_usd:'',
    cuit_cliente:'',
    fecha_emision:'', fecha_vto_cobro:'',
    fecha_proforma_planned:'', fecha_invoice_planned:'',
    notas:''
  })

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setFventa(await api.getFacturasVenta(proyecto.id)) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_facturas_venta').insert({
        proyecto_id: proyecto.id,
        numero_factura: formV.numero_factura || null,
        concepto: formV.concepto,
        monto_usd: Number(formV.monto_usd),
        cuit_cliente: formV.cuit_cliente || null,
        fecha_emision: formV.fecha_emision || null,
        fecha_vto_cobro: formV.fecha_vto_cobro || null,
        notas: formV.notas || null,
        estado: formV.fecha_emision ? 'emitida' : 'no_emitida',
        monto_cobrado: 0,
      })
      if (error) { alert(error.message); return }
      setModal(false)
      setFormV({numero_factura:'',concepto:'',monto_usd:'',fecha_emision:'',fecha_vto_cobro:'',fecha_proforma_planned:'',fecha_invoice_planned:'',notas:''})
      await load()
    } finally { setSaving(false) }
  }

  const CHIPFV = {cobrada:'c-ok',cobro_parcial:'c-pend',emitida:'c-apr',no_emitida:'c-no'}
  const totalFacVta  = fventa.reduce((s,f)=>s+(f.monto_usd||0),0)
  const totalCobrado = fventa.reduce((s,f)=>s+(f.monto_cobrado||0),0)

  if (loading) return <div className="state-msg">Cargando facturas...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  return (
    <>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Facturas al Cliente</span><button className="btn" onClick={()=>setModal(true)}>+ Nueva</button></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>#Factura</th><th>Concepto</th><th>Monto USD</th>
                <th>Emitida</th><th>Vto. Cobro</th>
                <th>Cobrado</th><th>Pendiente</th>
                <th>Proforma</th><th>Invoice</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {fventa.length===0 && <tr><td colSpan={10} className="state-msg">Sin facturas al cliente</td></tr>}
              {fventa.map(f=>{
                const proforma = f.notas ? JSON.parse(f.notas.includes('{') ? f.notas : '{}') : {}
                return (
                  <tr key={f.id}>
                    <td className="mono">{f.numero_factura||'—'}</td>
                    <td style={{fontWeight:500}}>{f.concepto}</td>
                    <td className="mono cb">{fmtUSD(f.monto_usd)}</td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(f.fecha_emision)}</td>
                    <td>
                      {f.fecha_vto_cobro ? (() => {
                        const r = getReminderStatus(f.fecha_vto_cobro)
                        return <span className={`reminder-badge ${r.cls}`}>{r.label}</span>
                      })() : <span style={{color:'var(--muted)',fontSize:11}}>—</span>}
                    </td>
                    <td className={`mono ${(f.monto_cobrado||0)>0?'cg':''}`}>{fmtUSD(f.monto_cobrado)}</td>
                    <td className={`mono ${(f.monto_usd-(f.monto_cobrado||0))>0?'cw':''}`}>{fmtUSD(f.monto_usd-(f.monto_cobrado||0))}</td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{proforma.proforma || '—'}</td>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{proforma.invoice || '—'}</td>
                    <td><span className={`chip ${CHIPFV[f.estado]||'c-no'}`}>{safeReplace(f.estado)}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>Facturado: <strong style={{color:'#5B21B6'}}>{fmtUSD(totalFacVta)}</strong></span>
          <span style={{color:'var(--muted)'}}>Cobrado: <strong className="cg">{fmtUSD(totalCobrado)}</strong></span>
          <span style={{color:'var(--muted)'}}>Pendiente: <strong className="cw">{fmtUSD(totalFacVta-totalCobrado)}</strong></span>
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Nueva Factura al Cliente</h3>
            <form onSubmit={handleSave}>
              <div className="form-row"><label>Número</label><input value={formV.numero_factura} onChange={e=>setFormV(f=>({...f,numero_factura:e.target.value}))} placeholder="ej. FV-004 (vacío si no emitida)" /></div>
              <div className="form-row"><label>Concepto *</label><input required value={formV.concepto} onChange={e=>setFormV(f=>({...f,concepto:e.target.value}))} placeholder="ej. Anticipo 30% obra" /></div>
              <div className="form-row"><label>CUIT Cliente</label><input value={formV.cuit_cliente} onChange={e=>setFormV(f=>({...f,cuit_cliente:e.target.value}))} placeholder="ej. 30-71234567-8" /></div>
              <div className="form-row"><label>Monto USD *</label><input required type="number" step="0.01" value={formV.monto_usd} onChange={e=>setFormV(f=>({...f,monto_usd:e.target.value}))} placeholder="0.00" /></div>
              <div className="two-col">
                <div className="form-row"><label>Fecha emisión</label><input type="date" value={formV.fecha_emision} onChange={e=>setFormV(f=>({...f,fecha_emision:e.target.value}))} /></div>
                <div className="form-row"><label>Vto. cobro</label><input type="date" value={formV.fecha_vto_cobro} onChange={e=>setFormV(f=>({...f,fecha_vto_cobro:e.target.value}))} /></div>
              </div>
              <div style={{borderTop:'1px solid var(--border)',paddingTop:12,marginTop:4,marginBottom:8}}>
                <div className="section-label">Recordatorios de envío</div>
                <div className="two-col">
                  <div className="form-row"><label>Fecha envío Proforma</label><input type="date" value={formV.fecha_proforma_planned} onChange={e=>setFormV(f=>({...f,fecha_proforma_planned:e.target.value}))} /></div>
                  <div className="form-row"><label>Fecha envío Invoice</label><input type="date" value={formV.fecha_invoice_planned} onChange={e=>setFormV(f=>({...f,fecha_invoice_planned:e.target.value}))} /></div>
                </div>
              </div>
              <div className="form-row"><label>Notas</label><textarea value={formV.notas} onChange={e=>setFormV(f=>({...f,notas:e.target.value}))} placeholder="Observaciones..." /></div>
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

function SubTabMargen({ proyecto }) {
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

  if (loading) return <div className="state-msg">Cargando margen...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const totalCotizado = fventa.reduce((s,f)=>s+(f.monto_usd||0),0)
  const totalPres     = lineas.reduce((s,l)=>s+(l.monto_pres_usd||0),0)
  const totalReal     = lineas.reduce((s,l)=>s+(l.monto_real_usd||l.monto_pres_usd||0),0)
  const mBudget = totalCotizado>0 ? ((totalCotizado-totalPres)/totalCotizado*100).toFixed(1) : 0
  const mReal   = totalCotizado>0 ? ((totalCotizado-totalReal)/totalCotizado*100).toFixed(1) : 0
  const cm      = totalCotizado>0 ? ((totalCotizado-totalReal)/totalCotizado*100).toFixed(1) : 0

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div className="card" style={{marginBottom:0}}>
        <div className="card-hdr"><span className="card-title">Resumen de Márgenes</span></div>
        <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:12,fontSize:13}}>
          <div style={{display:'flex',justifyContent:'space-between',paddingBottom:10,borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--muted)'}}>Ingreso cotizado</span><strong className="cb">{fmtUSD(totalCotizado)}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo presupuestado</span><strong>{fmtUSD(totalPres)}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo real / forecast</span><strong className="cg">{fmtUSD(totalReal)}</strong></div>
          <div style={{borderTop:'1px solid var(--border)',paddingTop:10,display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',justifyContent:'space-between',padding:'8px 10px',background:'#F0FDF4',borderRadius:6,border:'1px solid #BBF7D0'}}>
              <span style={{fontWeight:700}}>Margen Contribución (CM)</span>
              <strong className="cg" style={{fontSize:16}}>{cm}%</strong>
            </div>
            <div style={{fontSize:11,color:'var(--muted)',paddingLeft:4}}>CM = (Ingreso − Costo Real) / Ingreso</div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Margen budget</span><strong className="cg">{mBudget}%</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span>Margen forecast</span><strong className="cg">{mReal}%</strong></div>
          </div>
        </div>
      </div>
      <div className="card" style={{marginBottom:0}}>
        <div className="card-hdr"><span className="card-title">Detalle por Línea</span></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Item</th><th>Descripción</th><th>Costo Pres.</th><th>Costo Real</th><th>Delta</th></tr></thead>
            <tbody>
              {lineas.length===0 && <tr><td colSpan={5} className="state-msg">Sin líneas</td></tr>}
              {lineas.map(l=>{
                const delta = l.monto_real_usd!=null ? l.monto_real_usd-(l.monto_pres_usd||0) : null
                return (
                  <tr key={l.id} style={delta>0?{background:'#FEF2F2'}:{}}>
                    <td style={{color:'var(--muted)',fontSize:11}}>{l.item_numero||'—'}</td>
                    <td style={{fontWeight:500,fontSize:11}}>{l.descripcion}</td>
                    <td className="mono">{fmtUSD(l.monto_pres_usd)}</td>
                    <td className={`mono ${l.monto_real_usd==null?'':delta<=0?'cg':'cr'}`}>{fmtUSD(l.monto_real_usd)}</td>
                    <td className={`mono ${delta==null?'':delta<=0?'cg':'cr'}`}>{delta==null?'—':(delta>0?'+':'')+fmtUSD(delta)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
                      <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(e.fecha)}</td>
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
          <div className="card-hdr"><span className="card-title">Catálogo de Categorías</span><button className="btn" onClick={()=>setModal(true)}>+ Nueva</button></div>
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
            <div className="alert alert-err">Sin catálogo, texto libre genera duplicados: "Material Hierro" · "material hierro" · "MH" → 3 categorías distintas.</div>
            <div className="alert alert-ok">Con catálogo: cada línea elige de un selector. Renombrar actualiza todo el sistema.</div>
          </div>
        </div>
      </div>

      {modal && (
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Nueva Categoría</h3>
            <form onSubmit={handleSave}>
              <div className="form-row"><label>Nombre *</label><input required value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="ej. Pintura y Anticorrosivo" /></div>
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
    } catch(e) { console.error('Error cargando proyectos:', e.message) }
  }, [])

  useEffect(() => { loadProyectos() }, [loadProyectos])

  const proyecto = proyectos.find(p=>p.id===proyectoId) || null

  const selProyecto = (id) => {
    setProyectoId(id)
    localStorage.setItem('cpt_proyecto_id', id)
    setTab('overview')
  }

  const handleNuevo = async (e) => {
    e.preventDefault(); setSavingP(true); setErrorP('')
    try {
      const { data, error } = await supabase.from('cpt_proyectos')
        .insert({...formP, estado:'activo', moneda_base:'USD', created_by: session.user.id})
        .select('id').single()
      if (error) { setErrorP('No se pudo crear: ' + error.message); return }
      setModalNuevo(false)
      setFormP({nombre:'',cliente:'',descripcion:'',fecha_inicio:'',fecha_fin_est:''})
      await loadProyectos()
      selProyecto(data.id)
    } catch(e) { setErrorP('Error de conexión: ' + e.message) }
    finally { setSavingP(false) }
  }

  const TABS = [
    {id:'overview',    label:'Overview'},
    {id:'presupuesto', label:'Presupuesto vs Real'},
    {id:'costos',      label:'Costos'},
    {id:'ingresos',    label:'Ingresos'},
    {id:'cashflow',    label:'Cashflow'},
    {id:'categorias',  label:'Categorías'},
  ]

  return (
    <>
      <style>{CSS}</style>
      <div className="app-wrap">
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
            <button className="hdr-btn" onClick={()=>window.location.href=PORTAL_URL}>← Portal</button>
            <button className="hdr-btn" onClick={()=>supabase.auth.signOut()}>Salir</button>
          </div>
        </header>

        <nav className="tabs">
          {TABS.map(t=>(
            <a key={t.id} className={'tab'+(tab===t.id?' active':'')} onClick={()=>setTab(t.id)} style={{cursor:'pointer'}}>
              {t.label}
            </a>
          ))}
        </nav>

        <div className="main">
          {!proyecto
            ? <div className="state-msg" style={{marginTop:60}}>
                <p style={{fontSize:15,fontWeight:700,color:'var(--navy)',marginBottom:8}}>Seleccioná un proyecto para comenzar</p>
                <p>o creá uno nuevo con el botón <strong>+ Proyecto</strong> arriba a la derecha</p>
              </div>
            : <>
                {tab==='overview'    && <TabOverview    proyecto={proyecto} />}
                {tab==='presupuesto' && <TabPresupuesto proyecto={proyecto} />}
                {tab==='costos'      && <TabCostos      proyecto={proyecto} />}
                {tab==='ingresos'    && <TabIngresos    proyecto={proyecto} />}
                {tab==='cashflow'    && <TabCashflow    proyecto={proyecto} />}
                {tab==='categorias'  && <TabCategorias />}
              </>
          }
        </div>
      </div>

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

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
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
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0B1629'}}>
        <div style={{fontFamily:'DM Mono',fontSize:10,color:'rgba(255,255,255,.3)',letterSpacing:3,textTransform:'uppercase'}}>Cargando...</div>
      </div>
    </>
  )

  if (!session) return <LoginPage />
  return <CostTrackerApp session={session} />
}
