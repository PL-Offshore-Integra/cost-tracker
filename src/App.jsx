import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'

const PORTAL_URL = 'https://erp-portal-fawn.vercel.app/'

// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
  getProyectos: async () => {
    const { data, error } = await supabase.from('cpt_proyectos').select('id,nombre,cliente').eq('estado','activo').order('created_at',{ascending:false})
    if (error) throw error
    return data || []
  },
  getCategorias: async (tipo) => {
    let q = supabase.from('cpt_categorias').select('id,nombre,color,tipo').eq('activa',true).order('nombre')
    if (tipo) q = q.eq('tipo', tipo)
    const { data, error } = await q
    if (error) throw error
    return data || []
  },
  getAllCategorias: async () => {
    const { data, error } = await supabase.from('cpt_categorias').select('*').order('tipo').order('nombre')
    if (error) throw error
    return data || []
  },
  getLineas: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_presupuesto_lineas').select('*,cpt_categorias(nombre,color)').eq('proyecto_id',proyectoId).order('item_numero')
    if (error) throw error
    return data || []
  },
  getOCs: async (proyectoId) => {
    const { data, error } = await supabase
      .from('cpt_oc')
      .select('id,proyecto_id,numero_oc,proveedor,cuit_proveedor,descripcion,moneda,monto_sin_iva,iva_pct,fx,monto_usd_sin_iva,monto_usd_con_iva,fecha_emision,estado,categoria_id,cpt_categorias(nombre,color)')
      .eq('proyecto_id',proyectoId).order('numero_oc')
    if (error) throw error
    const { data: saldos } = await supabase.from('cpt_oc_saldo').select('id,facturado_usd,saldo_usd,pct_facturado,oc_total_usd,oc_total_usd_con_iva').eq('proyecto_id',proyectoId)
    const sMap = {}
    for (const s of saldos||[]) sMap[s.id] = s
    return (data||[]).map(o => {
      const s = sMap[o.id] || {}
      const totalConIvaUSD = o.moneda==='ARS'&&o.fx ? (o.monto_sin_iva*(1+(o.iva_pct||0)/100))/o.fx : (o.monto_usd_con_iva||o.monto_usd_sin_iva)
      return { ...o, total_alocar_usd: totalConIvaUSD, ...s, facturado_usd:s.facturado_usd||0, saldo_usd:s.saldo_usd||o.monto_usd_sin_iva, pct_facturado:s.pct_facturado||0 }
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
  getCashflow: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_cashflow').select('*').eq('proyecto_id',proyectoId).order('fecha')
    if (error) throw error
    return data || []
  },
  getItems: async (proyectoId) => {
    const [{ data, error }, { data: alocs }] = await Promise.all([
      supabase.from('cpt_items_proyecto').select('*').eq('proyecto_id',proyectoId).order('orden'),
      supabase.from('cpt_alocaciones').select('item_id,categoria,monto_usd').eq('proyecto_id',proyectoId)
    ])
    if (error) throw error
    const realMap = {}
    for (const a of alocs||[]) {
      if (!realMap[a.item_id]) realMap[a.item_id] = {}
      realMap[a.item_id][a.categoria] = (realMap[a.item_id][a.categoria]||0)+(a.monto_usd||0)
    }
    return (data||[]).map(item => ({ ...item, costos_real: realMap[item.id]||{} }))
  },
  getAlocaciones: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_alocaciones').select('*, cpt_oc(numero_oc,proveedor), cpt_items_proyecto(descripcion)').eq('proyecto_id',proyectoId)
    if (error) throw error
    return data || []
  },
  getAlocacionesByOC: async (ocId) => {
    const { data, error } = await supabase.from('cpt_alocaciones').select('*, cpt_items_proyecto(descripcion)').eq('oc_id',ocId)
    if (error) throw error
    return data || []
  },
  getAlocacionesResumen: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_alocaciones').select('planificacion,monto_usd,categoria,cpt_items_proyecto(descripcion),cpt_oc(numero_oc,proveedor)').eq('proyecto_id',proyectoId)
    if (error) throw error
    return data || []
  },
  // ─── No Facturables ───────────────────────────────────────────────────────
  getOCsNF: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_oc_nf').select('*,cpt_zonas_trabajo(nombre)').eq('proyecto_id',proyectoId).order('numero_oc')
    if (error) throw error
    return (data||[]).map(o => {
      const sinIvaUSD = o.moneda==='ARS'&&o.fx ? o.monto_sin_iva/o.fx : o.monto_sin_iva
      const conIvaUSD = o.moneda==='ARS'&&o.fx ? (o.monto_sin_iva*(1+(o.iva_pct||0)/100))/o.fx : (o.monto_sin_iva*(1+(o.iva_pct||0)/100))
      return { ...o, monto_usd_sin_iva: sinIvaUSD, monto_usd_con_iva: conIvaUSD }
    })
  },
  getFacturasNF: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_facturas_nf').select('*,cpt_oc_nf(numero_oc,proveedor)').eq('proyecto_id',proyectoId).order('fecha_factura',{ascending:false})
    if (error) throw error
    return data || []
  },
  getZonas: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_zonas_trabajo').select('*').eq('proyecto_id',proyectoId).order('nombre')
    if (error) throw error
    return data || []
  },
  // ─── Operación ────────────────────────────────────────────────────────────
  getOpCostos: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_op_costos').select('*,cpt_categorias(nombre,color)').eq('proyecto_id',proyectoId).order('fecha',{ascending:false})
    if (error) throw error
    return data || []
  },
  getOpIngresos: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_op_ingresos').select('*,cpt_categorias(nombre,color)').eq('proyecto_id',proyectoId).order('fecha',{ascending:false})
    if (error) throw error
    return data || []
  },
  getOpPresupuesto: async (proyectoId) => {
    const { data, error } = await supabase.from('cpt_op_presupuesto').select('*,cpt_categorias(nombre,color)').eq('proyecto_id',proyectoId)
    if (error) throw error
    return data || []
  },
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtUSD = (n) => {
  if (n==null) return '—'
  const num = Number(n)
  const dec = Math.abs(num%1)>0.004?2:0
  return '$'+num.toLocaleString('es-AR',{minimumFractionDigits:dec,maximumFractionDigits:dec})
}
const fmtDate = (d) => d ? new Date(d+'T00:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—'
const safeReplace = (s) => (s||'').replace(/_/g,' ')

function getReminderStatus(fechaStr) {
  if (!fechaStr) return null
  const today = new Date()
  const fecha = new Date(fechaStr+'T00:00:00')
  const diff  = Math.ceil((fecha-today)/(1000*60*60*24))
  if (diff<0)  return { label:'Vencida', cls:'r-due' }
  if (diff<=7) return { label:`En ${diff}d`, cls:'r-soon' }
  return { label:fmtDate(fechaStr), cls:'r-ok' }
}

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
.tabs-main{display:flex;background:var(--navy);border-bottom:1px solid rgba(184,148,42,.15);padding:0 28px;overflow-x:auto;flex-shrink:0}
.tabs-sub{display:flex;background:#F8FAFC;border-bottom:1px solid var(--border);padding:0 16px;overflow-x:auto;flex-shrink:0;gap:6px;align-items:center;min-height:40px}
.tab{padding:13px 16px;font-size:12px;font-weight:600;cursor:pointer;color:rgba(255,255,255,.4);border-bottom:2px solid transparent;white-space:nowrap;letter-spacing:.3px;transition:all .15s;user-select:none}
.tab:hover{color:rgba(255,255,255,.8)}
.tab.active{color:#fff;border-bottom-color:var(--gold)}
.stab{padding:5px 14px;font-size:11px;font-weight:600;cursor:pointer;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-family:var(--sans);transition:all .15s;white-space:nowrap}
.stab:hover{color:var(--text);border-color:var(--muted)}
.stab.active{background:var(--blue);color:#fff;border-color:var(--blue)}
.sub-tabs{display:flex;gap:8px;margin-bottom:16px}
.main{flex:1;padding:24px 28px;overflow-y:auto}
.card{background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px;box-shadow:0 1px 3px rgba(11,22,41,.06)}
.card-hdr{padding:11px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border);background:#FAFBFC}
.card-title{font-size:13px;font-weight:700;color:var(--navy)}
.kpi-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:15px 16px;box-shadow:0 1px 3px rgba(11,22,41,.06)}
.kpi-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;font-weight:600}
.kpi-val{font-size:22px;font-weight:800;line-height:1;color:var(--navy)}
.kpi-sub{font-size:11px;color:var(--muted);margin-top:5px}
.tbl-wrap{overflow-x:auto;max-height:400px;overflow-y:auto}
table{width:100%;border-collapse:collapse;font-size:12px}
th{padding:8px 12px;text-align:left;color:var(--muted);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);background:#FAFBFC;white-space:nowrap}
td{padding:8px 12px;border-bottom:1px solid var(--border);vertical-align:middle;color:var(--text)}
tr:last-child td{border-bottom:none}
tr:hover td{background:#F7F9FC}
.mono{font-family:'Courier New',monospace;font-size:11px}
.inline-edit{background:#fff;border:1px solid var(--blue);color:var(--text);padding:3px 6px;border-radius:4px;font-size:11px;font-family:'Courier New',monospace;width:90px}
.inline-edit:focus{outline:none;box-shadow:0 0 0 2px rgba(35,92,150,.2)}
.chip{display:inline-flex;align-items:center;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.c-ok{background:#D1FAE5;color:#065F46;border:1px solid #A7F3D0}
.c-pend{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A}
.c-apr{background:#DBEAFE;color:#1E40AF;border:1px solid #BFDBFE}
.c-no{background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB}
.c-forecast{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A}
.tag{font-size:10px;padding:2px 7px;border-radius:6px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.t-blue{background:#DBEAFE;color:#1E40AF}
.t-orange{background:#FEF3C7;color:#92400E}
.t-green{background:#D1FAE5;color:#065F46}
.t-purple{background:#EDE9FE;color:#5B21B6}
.t-red{background:#FEE2E2;color:#991B1B}
.t-gray{background:#F3F4F6;color:#6B7280}
.cg{color:#059669}.cr{color:#DC2626}.cw{color:#D97706}.cb{color:#235C96}
.btn{background:#235C96;color:#fff;border:none;padding:7px 14px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:700;cursor:pointer;transition:all .15s}
.btn:hover{background:#1a4a7a}
.btn:disabled{opacity:.45;cursor:not-allowed}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--border);padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:600;cursor:pointer}
.btn-ghost:hover{color:var(--text);border-color:var(--muted)}
.btn-active{background:#235C96;color:#fff;border:none;padding:6px 14px;border-radius:6px;font-size:12px;font-family:var(--sans);font-weight:700;cursor:pointer}
select,input[type=text],input[type=number],input[type=date],input[type=email],input[type=password],textarea{background:#fff;border:1px solid var(--border);color:var(--text);padding:7px 10px;border-radius:6px;font-size:12px;font-family:var(--sans);width:100%;outline:none;transition:border-color .15s}
select:focus,input:focus,textarea:focus{border-color:#235C96;box-shadow:0 0 0 3px rgba(35,92,150,.1)}
textarea{resize:vertical;min-height:60px}
.form-row{margin-bottom:12px}
.form-row label{display:block;font-size:10px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.4px;font-weight:700}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:0}
.prog-wrap{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.prog{height:100%;border-radius:3px;transition:width .3s}
.tbl-foot{padding:10px 16px;background:#FAFBFC;border-top:1px solid var(--border);display:flex;gap:20px;font-size:12px;flex-wrap:wrap;align-items:center}
.alert{border-radius:8px;padding:10px 14px;font-size:12px;margin-bottom:8px;line-height:1.5}
.alert-ok{background:#ECFDF5;border:1px solid #A7F3D0;color:#065F46}
.alert-err{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B}
.alert-warn{background:#FFFBEB;border:1px solid #FDE68A;color:#92400E}
.alert-info{background:#EFF6FF;border:1px solid #BFDBFE;color:#1E40AF}
.overlay{display:none;position:fixed;inset:0;background:rgba(11,22,41,.55);z-index:200;align-items:center;justify-content:center}
.overlay.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:26px;width:500px;max-width:95vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(11,22,41,.2)}
.modal h3{font-size:15px;font-weight:800;color:var(--navy);margin-bottom:18px}
.modal-footer{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}
.state-msg{padding:32px;text-align:center;color:var(--muted);font-size:12px}
.section-label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid var(--border)}
.reminder-badge{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:2px 8px;border-radius:10px;font-weight:600;white-space:nowrap}
.r-due{background:#FEE2E2;color:#991B1B;border:1px solid #FECACA}
.r-soon{background:#FEF3C7;color:#92400E;border:1px solid #FDE68A}
.r-ok{background:#F3F4F6;color:#6B7280;border:1px solid #E5E7EB}
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
    } catch { setError('Error de conexión.') }
    finally { setLoading(false) }
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

// ─── CONSTANTES CATEGORÍAS ────────────────────────────────────────────────────
const CATS = ['material','mano_obra','instalacion','consumibles','alquiler','mob_demob']
const CATS_LABEL = {material:'Material',mano_obra:'Mano de Obra',instalacion:'Instalación',consumibles:'Consumibles',alquiler:'Alquiler',mob_demob:'Mob/Demob'}

// ─── TAB OVERVIEW ─────────────────────────────────────────────────────────────
function TabOverview({ proyecto }) {
  const [items, setItems]           = useState([])
  const [fventa, setFventa]         = useState([])
  const [alocs, setAlocs]           = useState([])
  const [opCostos, setOpCostos]     = useState([])
  const [opIngresos, setOpIngresos] = useState([])
  const [ocsNF, setOcsNF]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  // Secciones expandibles
  const [expandFact, setExpandFact]   = useState(false)
  const [expandNF, setExpandNF]       = useState(false)
  const [expandOp, setExpandOp]       = useState(false)

  // Tabla pivot
  const [pivotFila, setPivotFila]     = useState('proveedor')   // proveedor | categoria | cuit | mes
  const [pivotCol, setPivotCol]       = useState('tipo')        // tipo | categoria | mes
  const [pivotMoneda, setPivotMoneda] = useState('USD_sin') // USD_sin | USD_con | ARS_sin | ARS_con
  const [pivotFiltroTipo, setPivotFiltroTipo] = useState('todos') // todos | facturable | nofacturable | operacion

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [its, fv, al, opc, opi, onf] = await Promise.all([
        api.getItems(proyecto.id),
        api.getFacturasVenta(proyecto.id),
        api.getAlocacionesResumen(proyecto.id),
        api.getOpCostos(proyecto.id),
        api.getOpIngresos(proyecto.id),
        api.getOCsNF(proyecto.id),
      ])
      setItems(its); setFventa(fv); setAlocs(al)
      setOpCostos(opc); setOpIngresos(opi); setOcsNF(onf)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="state-msg">Cargando overview...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  // ── Cálculos por bloque ────────────────────────────────────────────────────
  const ingreso      = items.reduce((s,i)=>s+(i.precio_cliente||0),0)
  const costoPres    = items.reduce((s,i)=>s+CATS.reduce((sc,cat)=>sc+(i.costos?.[cat]?.pres?.usd||0),0),0)
  const costoReal    = items.reduce((s,i)=>s+CATS.reduce((sc,cat)=>sc+(i.costos_real?.[cat]||0),0),0)
  const cobrado      = fventa.reduce((s,f)=>s+(f.monto_cobrado||0),0)
  const cm           = ingreso>0?((ingreso-costoReal)/ingreso*100).toFixed(1):0
  const noPlan       = alocs.filter(a=>a.planificacion==='no_planeado')

  const totalNFsinIVA = ocsNF.reduce((s,o)=>s+(o.monto_usd_sin_iva||0),0)
  const totalNFconIVA = ocsNF.reduce((s,o)=>s+(o.monto_usd_con_iva||0),0)

  const totalOpCosto = opCostos.reduce((s,r)=>s+(r.monto_usd||0),0)
  const totalOpIng   = opIngresos.filter(r=>!r.es_forecast).reduce((s,r)=>s+(r.monto_usd||0),0)
  const totalOpFcast = opIngresos.filter(r=>r.es_forecast).reduce((s,r)=>s+(r.monto_usd||0),0)
  const resultadoOp  = totalOpIng - totalOpCosto

  // ── Construcción de filas para la pivot ───────────────────────────────────
  // esIngreso = true → valor positivo (entrada de dinero)
  // esIngreso = false/undefined → valor negativo (salida de dinero)
  const buildPivotData = () => {
    const rows = []

    // Facturables — Ingresos (facturas al cliente)
    fventa.forEach(f => {
      rows.push({
        tipo: 'Fact. Ingreso',
        bloque: 'Facturables',
        proveedor: proyecto.cliente || '—',
        cuit: '—',
        categoria: 'Ingreso cliente',
        mes: f.fecha_emision ? f.fecha_emision.slice(0,7) : '—',
        usd_sin: f.monto_usd || 0,
        usd_con: f.monto_usd || 0,
        ars_sin: null,
        ars_con: null,
        moneda_orig: 'USD',
        esIngreso: true,
      })
    })

    // Facturables — Costos (alocaciones de OC)
    alocs.forEach(a => {
      const oc = a.cpt_oc || {}
      rows.push({
        tipo: 'Fact. Costo',
        bloque: 'Facturables',
        proveedor: oc.proveedor || '—',
        cuit: '—',
        categoria: a.categoria ? (CATS_LABEL[a.categoria] || a.categoria) : '—',
        mes: '—',
        usd_sin: a.monto_usd || 0,
        usd_con: a.monto_usd || 0,
        ars_sin: null,
        ars_con: null,
        moneda_orig: 'USD',
        esIngreso: false,
      })
    })

    // No Facturables — Costos (OCs NF)
    ocsNF.forEach(o => {
      const mes = o.fecha_emision ? o.fecha_emision.slice(0,7) : '—'
      rows.push({
        tipo: 'No Facturable',
        bloque: 'No Facturables',
        proveedor: o.proveedor || '—',
        cuit: o.cuit_proveedor || '—',
        categoria: o.descripcion || '—',
        mes,
        usd_sin: o.monto_usd_sin_iva || 0,
        usd_con: o.monto_usd_con_iva || 0,
        ars_sin: o.moneda === 'ARS' ? (o.monto_sin_iva || 0) : null,
        ars_con: o.moneda === 'ARS' ? (o.monto_sin_iva * (1 + (o.iva_pct||0)/100)) : null,
        moneda_orig: o.moneda || 'ARS',
        esIngreso: false,
      })
    })

    // Operación — Costos
    opCostos.forEach(r => {
      const mes = r.fecha ? r.fecha.slice(0,7) : '—'
      rows.push({
        tipo: 'Op. Costo',
        bloque: 'Operación',
        proveedor: r.descripcion || '—',
        cuit: '—',
        categoria: r.cpt_categorias?.nombre || '—',
        mes,
        usd_sin: r.monto_usd || 0,
        usd_con: r.monto_usd || 0,
        ars_sin: r.moneda === 'ARS' ? (r.monto || 0) : null,
        ars_con: r.moneda === 'ARS' ? (r.monto || 0) : null,
        moneda_orig: r.moneda || 'USD',
        esIngreso: false,
      })
    })

    // Operación — Ingresos
    opIngresos.forEach(r => {
      const mes = r.fecha ? r.fecha.slice(0,7) : '—'
      rows.push({
        tipo: 'Op. Ingreso',
        bloque: 'Operación',
        proveedor: r.descripcion || '—',
        cuit: '—',
        categoria: r.cpt_categorias?.nombre || '—',
        mes,
        usd_sin: r.monto_usd || 0,
        usd_con: r.monto_usd || 0,
        ars_sin: r.moneda === 'ARS' ? (r.monto || 0) : null,
        ars_con: r.moneda === 'ARS' ? (r.monto || 0) : null,
        moneda_orig: r.moneda || 'USD',
        esIngreso: true,
      })
    })

    return rows
  }

  const FILA_OPTS = [
    {id:'proveedor', label:'Proveedor'},
    {id:'cuit',      label:'CUIT'},
    {id:'categoria', label:'Categoría'},
    {id:'mes',       label:'Mes'},
  ]
  const COL_OPTS = [
    {id:'tipo',   label:'Tipo'},
    {id:'bloque', label:'Bloque'},
    {id:'mes',    label:'Mes'},
  ]
  const TIPO_OPTS = [
    {id:'todos',          label:'Todos'},
    {id:'Fact. Ingreso',  label:'Fact. Ingresos'},
    {id:'Fact. Costo',    label:'Fact. Costos'},
    {id:'No Facturable',  label:'No Facturables'},
    {id:'Op. Costo',      label:'Op. Costos'},
    {id:'Op. Ingreso',    label:'Op. Ingresos'},
  ]

  const allRows  = buildPivotData()
  const filtered = pivotFiltroTipo === 'todos' ? allRows : allRows.filter(r=>r.tipo===pivotFiltroTipo)

  const getAbsVal = (r) => {
    if (pivotMoneda === 'USD_sin') return r.usd_sin || 0
    if (pivotMoneda === 'USD_con') return r.usd_con || 0
    if (pivotMoneda === 'ARS_sin') return r.ars_sin != null ? r.ars_sin : (r.usd_sin || 0)
    if (pivotMoneda === 'ARS_con') return r.ars_con != null ? r.ars_con : (r.usd_con || 0)
    return r.usd_sin || 0
  }
  // Ingresos suman positivo, costos restan
  const getSignedVal = (r) => r.esIngreso ? getAbsVal(r) : -getAbsVal(r)

  const getFila = (r) => r[pivotFila] || '—'
  const getCol  = (r) => r[pivotCol]  || '—'

  // Construir pivot con valores con signo
  const filaKeys = [...new Set(filtered.map(getFila))].sort()
  const colKeys  = [...new Set(filtered.map(getCol))].sort()
  const pivot    = {}
  const totFila  = {}
  const totCol   = {}
  const costoFila = {}; const ingresoFila = {}
  let grandTotal = 0, grandCosto = 0, grandIngreso = 0

  filtered.forEach(r => {
    const f = getFila(r); const c = getCol(r)
    const v = getSignedVal(r); const abs = getAbsVal(r)
    if (!pivot[f]) pivot[f] = {}
    pivot[f][c] = (pivot[f][c] || 0) + v
    totFila[f]  = (totFila[f]  || 0) + v
    totCol[c]   = (totCol[c]   || 0) + v
    grandTotal += v
    if (r.esIngreso) { ingresoFila[f] = (ingresoFila[f]||0)+abs; grandIngreso+=abs }
    else             { costoFila[f]   = (costoFila[f]  ||0)+abs; grandCosto  +=abs }
  })

  const esARS = pivotMoneda.startsWith('ARS')
  const fmtAbs = (v) => {
    if (v == null || v === 0) return '—'
    if (esARS) return '$'+Number(v).toLocaleString('es-AR',{maximumFractionDigits:0})
    return fmtUSD(v)
  }
  const fmtSigned = (v) => {
    if (v == null || v === 0) return <span style={{color:'var(--muted)'}}>—</span>
    const abs = Math.abs(v)
    const str = esARS ? '$'+Number(abs).toLocaleString('es-AR',{maximumFractionDigits:0}) : fmtUSD(abs)
    if (v > 0) return <span className="mono" style={{fontSize:11,color:'#059669',fontWeight:600}}>+{str}</span>
    return <span className="mono" style={{fontSize:11,color:'#DC2626'}}>−{str}</span>
  }

  const SectionToggle = ({label, color, open, onToggle, children}) => (
    <div className="card">
      <div className="card-hdr" style={{cursor:'pointer',userSelect:'none'}} onClick={onToggle}>
        <span className="card-title" style={{color}}>{open?'▼':'▶'} {label}</span>
      </div>
      {open && <div style={{padding:'14px 16px'}}>{children}</div>}
    </div>
  )

  return (
    <>
      {/* ── KPIs globales ── */}
      <div className="kpi-row" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <div className="kpi"><div className="kpi-lbl">Ingresos Facturables</div><div className="kpi-val cb">{fmtUSD(ingreso)}</div><div className="kpi-sub">Cotizado al cliente</div></div>
        <div className="kpi"><div className="kpi-lbl">No Facturables (c/IVA)</div><div className="kpi-val cw">{fmtUSD(totalNFconIVA)}</div><div className="kpi-sub">Alistamiento · {ocsNF.length} OC</div></div>
        <div className="kpi"><div className="kpi-lbl">Resultado Operativo</div><div className="kpi-val" style={{color:resultadoOp>=0?'#059669':'#DC2626'}}>{fmtUSD(resultadoOp)}</div><div className="kpi-sub">Ing. − Costo operativo</div></div>
        <div className="kpi"><div className="kpi-lbl">CM Facturables</div><div className="kpi-val cg">{cm}%</div><div className="kpi-sub">(Ing − Costo real) / Ing</div></div>
      </div>

      {/* ── 3 cards resumen por bloque ── */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16}}>

        {/* Facturables */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title" style={{color:'#1E40AF'}}>Facturables</span></div>
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8,fontSize:12}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Ingreso cotizado</span><strong className="cb">{fmtUSD(ingreso)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo presupuestado</span><strong>{fmtUSD(costoPres)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo real (alocado)</span><strong className="cg">{fmtUSD(costoReal)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Cobrado al cliente</span><strong className="cg">{fmtUSD(cobrado)}</strong></div>
            <div style={{marginTop:4}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:11}}><span style={{color:'var(--muted)'}}>Cobro</span><span>{cobrado>0?Math.round(cobrado/ingreso*100):0}%</span></div>
              <div className="prog-wrap"><div className="prog" style={{width:ingreso>0?`${Math.min(cobrado/ingreso*100,100)}%`:'0%',background:'#059669'}} /></div>
            </div>
            {noPlan.length>0&&<div style={{marginTop:4,fontSize:11,color:'#92400E',fontWeight:600}}>⚠ {noPlan.length} costos no planeados: {fmtUSD(noPlan.reduce((s,a)=>s+(a.monto_usd||0),0))}</div>}
          </div>
        </div>

        {/* No Facturables */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title" style={{color:'#92400E'}}>No Facturables</span></div>
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8,fontSize:12}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>OC s/IVA equiv. USD</span><strong>{fmtUSD(totalNFsinIVA)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>OC c/IVA equiv. USD</span><strong className="cw">{fmtUSD(totalNFconIVA)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Total OC</span><strong>{ocsNF.length}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Sin zona asignada</span>
              <strong style={{color:ocsNF.filter(o=>!o.zona_id).length>0?'#DC2626':'#059669'}}>
                {ocsNF.filter(o=>!o.zona_id).length}
              </strong>
            </div>
            <div style={{marginTop:4}}>
              {[...new Map(ocsNF.map(o=>[o.zona_id||'__nz__',o.cpt_zonas_trabajo?.nombre||'Sin zona'])).entries()].slice(0,4).map(([k,nombre])=>{
                const tot = ocsNF.filter(o=>(o.zona_id||'__nz__')===k).reduce((s,o)=>s+(o.monto_usd_con_iva||0),0)
                return <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--muted)',marginBottom:2}}><span>{nombre}</span><span className="mono">{fmtUSD(tot)}</span></div>
              })}
            </div>
          </div>
        </div>

        {/* Operación */}
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title" style={{color:'#065F46'}}>Operación</span></div>
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8,fontSize:12}}>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Ingresos confirmados</span><strong className="cg">+{fmtUSD(totalOpIng)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Ingresos forecast</span><strong className="cw">{fmtUSD(totalOpFcast)}</strong></div>
            <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costos operativos</span><strong className="cr">−{fmtUSD(totalOpCosto)}</strong></div>
            <div style={{borderTop:'1px solid var(--border)',paddingTop:8,display:'flex',justifyContent:'space-between'}}>
              <span style={{fontWeight:700}}>Resultado</span>
              <strong style={{fontSize:14,color:resultadoOp>=0?'#059669':'#DC2626'}}>{resultadoOp>=0?'+':''}{fmtUSD(resultadoOp)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── Secciones expandibles ── */}
      <SectionToggle label="Facturables — detalle por categoría" color="#1E40AF" open={expandFact} onToggle={()=>setExpandFact(v=>!v)}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead><tr><th style={{padding:'6px 8px',textAlign:'left',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>Categoría</th><th style={{padding:'6px 8px',textAlign:'right',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>Costo Pres.</th><th style={{padding:'6px 8px',textAlign:'right',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>Costo Real</th><th style={{padding:'6px 8px',textAlign:'right',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>% del total</th></tr></thead>
          <tbody>
            {CATS.map(cat=>{
              const pres = items.reduce((s,i)=>s+(i.costos?.[cat]?.pres?.usd||0),0)
              const real = items.reduce((s,i)=>s+(i.costos_real?.[cat]||0),0)
              const pct  = costoReal>0?(real/costoReal*100).toFixed(1):0
              if (!pres && !real) return null
              return (
                <tr key={cat}>
                  <td style={{padding:'7px 8px'}}><span className="tag t-blue">{CATS_LABEL[cat]}</span></td>
                  <td style={{padding:'7px 8px',textAlign:'right'}} className="mono">{fmtUSD(pres)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right'}} className={`mono ${real>pres?'cr':'cg'}`}>{fmtUSD(real)}</td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontSize:11,color:'var(--muted)'}}>{pct}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {noPlan.length>0&&(
          <div style={{marginTop:12}}>
            <div style={{fontSize:11,fontWeight:700,color:'#92400E',marginBottom:6}}>⚠ Costos no planeados</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
              <thead><tr><th style={{padding:'4px 8px',textAlign:'left',color:'var(--muted)',fontSize:10,borderBottom:'1px solid var(--border)'}}>OC</th><th style={{padding:'4px 8px',textAlign:'left',color:'var(--muted)',fontSize:10,borderBottom:'1px solid var(--border)'}}>Proveedor</th><th style={{padding:'4px 8px',textAlign:'left',color:'var(--muted)',fontSize:10,borderBottom:'1px solid var(--border)'}}>Ítem</th><th style={{padding:'4px 8px',textAlign:'right',color:'var(--muted)',fontSize:10,borderBottom:'1px solid var(--border)'}}>USD</th></tr></thead>
              <tbody>
                {noPlan.map((a,i)=>(
                  <tr key={i} style={{background:'#FFFBEB'}}>
                    <td style={{padding:'4px 8px'}} className="mono cb">{a.cpt_oc?.numero_oc}</td>
                    <td style={{padding:'4px 8px'}}>{a.cpt_oc?.proveedor}</td>
                    <td style={{padding:'4px 8px'}}>{a.cpt_items_proyecto?.descripcion}</td>
                    <td style={{padding:'4px 8px',textAlign:'right'}} className="mono cw">{fmtUSD(a.monto_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionToggle>

      <SectionToggle label="No Facturables — detalle por proveedor" color="#92400E" open={expandNF} onToggle={()=>setExpandNF(v=>!v)}>
        {ocsNF.length===0
          ? <div style={{color:'var(--muted)',fontSize:12}}>Sin OC de alistamiento cargadas</div>
          : (() => {
              const porProv = {}
              ocsNF.forEach(o=>{
                const k = o.proveedor||'—'
                if (!porProv[k]) porProv[k]={sinIVA:0,conIVA:0,count:0,cuit:o.cuit_proveedor||'—'}
                porProv[k].sinIVA += o.monto_usd_sin_iva||0
                porProv[k].conIVA += o.monto_usd_con_iva||0
                porProv[k].count++
              })
              return (
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr>
                    <th style={{padding:'6px 8px',textAlign:'left',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>Proveedor</th>
                    <th style={{padding:'6px 8px',textAlign:'left',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>CUIT</th>
                    <th style={{padding:'6px 8px',textAlign:'center',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>OC</th>
                    <th style={{padding:'6px 8px',textAlign:'right',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>USD s/IVA</th>
                    <th style={{padding:'6px 8px',textAlign:'right',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>USD c/IVA</th>
                    <th style={{padding:'6px 8px',textAlign:'right',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>% del total</th>
                  </tr></thead>
                  <tbody>
                    {Object.entries(porProv).sort((a,b)=>b[1].conIVA-a[1].conIVA).map(([prov,v])=>(
                      <tr key={prov}>
                        <td style={{padding:'7px 8px',fontWeight:600}}>{prov}</td>
                        <td style={{padding:'7px 8px'}} className="mono" style={{fontSize:10,color:'var(--muted)'}}>{v.cuit}</td>
                        <td style={{padding:'7px 8px',textAlign:'center',color:'var(--muted)'}}>{v.count}</td>
                        <td style={{padding:'7px 8px',textAlign:'right'}} className="mono">{fmtUSD(v.sinIVA)}</td>
                        <td style={{padding:'7px 8px',textAlign:'right'}} className="mono cw">{fmtUSD(v.conIVA)}</td>
                        <td style={{padding:'7px 8px',textAlign:'right',fontSize:11,color:'var(--muted)'}}>{totalNFconIVA>0?(v.conIVA/totalNFconIVA*100).toFixed(1):0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            })()
        }
      </SectionToggle>

      <SectionToggle label="Operación — detalle por categoría" color="#065F46" open={expandOp} onToggle={()=>setExpandOp(v=>!v)}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'var(--r)',marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Costos</div>
            {(() => {
              const porCat = {}
              opCostos.forEach(r=>{ const k=r.cpt_categorias?.nombre||'—'; porCat[k]=(porCat[k]||0)+(r.monto_usd||0) })
              return Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <span style={{color:'var(--text)'}}>{k}</span><span className="mono cr">{fmtUSD(v)}</span>
                </div>
              ))
            })()}
            <div style={{borderTop:'1px solid var(--border)',marginTop:6,paddingTop:6,display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:700}}>
              <span>Total costos</span><span className="mono cr">{fmtUSD(totalOpCosto)}</span>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'var(--g)',marginBottom:8,textTransform:'uppercase',letterSpacing:.5}}>Ingresos</div>
            {(() => {
              const porCat = {}
              opIngresos.forEach(r=>{ const k=r.cpt_categorias?.nombre||'—'; porCat[k]=(porCat[k]||0)+(r.monto_usd||0) })
              return Object.entries(porCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                  <span style={{color:'var(--text)'}}>{k}</span><span className="mono cg">{fmtUSD(v)}</span>
                </div>
              ))
            })()}
            <div style={{borderTop:'1px solid var(--border)',marginTop:6,paddingTop:6,display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:700}}>
              <span>Total ingresos</span><span className="mono cg">{fmtUSD(totalOpIng+totalOpFcast)}</span>
            </div>
          </div>
        </div>
      </SectionToggle>

      {/* ── Tabla Pivot ── */}
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Tabla Pivot</span>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:10,color:'var(--muted)',fontWeight:700,textTransform:'uppercase'}}>Filas</span>
              <select value={pivotFila} onChange={e=>setPivotFila(e.target.value)} style={{fontSize:11,padding:'3px 7px',width:'auto'}}>
                {FILA_OPTS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:10,color:'var(--muted)',fontWeight:700,textTransform:'uppercase'}}>Columnas</span>
              <select value={pivotCol} onChange={e=>setPivotCol(e.target.value)} style={{fontSize:11,padding:'3px 7px',width:'auto'}}>
                {COL_OPTS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:10,color:'var(--muted)',fontWeight:700,textTransform:'uppercase'}}>Filtro</span>
              <select value={pivotFiltroTipo} onChange={e=>setPivotFiltroTipo(e.target.value)} style={{fontSize:11,padding:'3px 7px',width:'auto'}}>
                {TIPO_OPTS.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <span style={{fontSize:10,color:'var(--muted)',fontWeight:700,textTransform:'uppercase'}}>Valores</span>
              <select value={pivotMoneda} onChange={e=>setPivotMoneda(e.target.value)} style={{fontSize:11,padding:'3px 7px',width:'auto'}}>
                <option value="USD_sin">USD s/IVA</option>
                <option value="USD_con">USD c/IVA</option>
                <option value="ARS_sin">ARS s/IVA</option>
                <option value="ARS_con">ARS c/IVA</option>
              </select>
            </div>
          </div>
        </div>

        {/* KPIs de la selección activa */}
        {filtered.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:0,borderBottom:'1px solid var(--border)'}}>
            <div style={{padding:'10px 16px',borderRight:'1px solid var(--border)'}}>
              <div style={{fontSize:10,color:'var(--muted)',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Ingresos (selección)</div>
              <div style={{fontSize:16,fontWeight:800,color:'#059669'}}>+{fmtAbs(grandIngreso)}</div>
            </div>
            <div style={{padding:'10px 16px',borderRight:'1px solid var(--border)'}}>
              <div style={{fontSize:10,color:'var(--muted)',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Costos (selección)</div>
              <div style={{fontSize:16,fontWeight:800,color:'#DC2626'}}>−{fmtAbs(grandCosto)}</div>
            </div>
            <div style={{padding:'10px 16px'}}>
              <div style={{fontSize:10,color:'var(--muted)',fontWeight:700,textTransform:'uppercase',marginBottom:4}}>Resultado neto</div>
              <div style={{fontSize:16,fontWeight:800,color:grandTotal>=0?'#059669':'#DC2626'}}>
                {grandTotal>=0?'+':''}{fmtAbs(Math.abs(grandTotal))}
              </div>
            </div>
          </div>
        )}

        {filaKeys.length === 0
          ? <div className="state-msg">Sin datos para los filtros seleccionados</div>
          : <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                <thead>
                  <tr style={{background:'#FAFBFC'}}>
                    <th style={{padding:'8px 12px',textAlign:'left',color:'var(--muted)',fontWeight:700,fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)',position:'sticky',left:0,background:'#FAFBFC',minWidth:160}}>
                      {FILA_OPTS.find(o=>o.id===pivotFila)?.label} \ {COL_OPTS.find(o=>o.id===pivotCol)?.label}
                    </th>
                    {colKeys.map(c=>(
                      <th key={c} style={{padding:'8px 12px',textAlign:'right',color:'var(--muted)',fontWeight:700,fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}}>
                        {c}
                      </th>
                    ))}
                    <th style={{padding:'8px 12px',textAlign:'right',color:'var(--navy)',fontWeight:800,fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)',background:'#F0F4F8',whiteSpace:'nowrap'}}>
                      Resultado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filaKeys.map((fila,fi)=>(
                    <tr key={fila} style={{background:fi%2===0?'#fff':'#FAFBFC'}}>
                      <td style={{padding:'7px 12px',fontWeight:600,position:'sticky',left:0,background:fi%2===0?'#fff':'#FAFBFC',borderBottom:'1px solid var(--border)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={fila}>
                        {fila}
                      </td>
                      {colKeys.map(col=>(
                        <td key={col} style={{padding:'7px 12px',textAlign:'right',borderBottom:'1px solid var(--border)'}}>
                          {fmtSigned(pivot[fila]?.[col])}
                        </td>
                      ))}
                      <td style={{padding:'7px 12px',textAlign:'right',fontWeight:700,borderBottom:'1px solid var(--border)',background:'#F0F4F8'}}>
                        {fmtSigned(totFila[fila])}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{background:'#E8EDF5'}}>
                    <td style={{padding:'8px 12px',fontWeight:800,fontSize:11,position:'sticky',left:0,background:'#E8EDF5'}}>Total</td>
                    {colKeys.map(col=>(
                      <td key={col} style={{padding:'8px 12px',textAlign:'right',fontWeight:700,fontSize:11}}>
                        {fmtSigned(totCol[col])}
                      </td>
                    ))}
                    <td style={{padding:'8px 12px',textAlign:'right',fontWeight:800,fontSize:12,color:grandTotal>=0?'#059669':'#DC2626'}}>
                      {grandTotal>=0?'+':''}{fmtAbs(Math.abs(grandTotal))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
        }
      </div>
    </>
  )
}

// ─── TAB PRESUPUESTO ──────────────────────────────────────────────────────────
function ModalEditarItem({ item, onClose, onSave }) {
  const initCostos = (costos, tipo) => {
    const result = {}
    for (const cat of CATS) {
      const c = costos?.[cat]?.[tipo] || {}
      result[cat] = { moneda:c.moneda||'USD', monto:c.monto||'', fx:c.fx||'' }
    }
    return result
  }
  const [form, setForm] = useState({
    descripcion: item?.descripcion||'', precio_cliente: item?.precio_cliente||'',
    pres: initCostos(item?.costos,'pres'), real: initCostos(item?.costos,'real'),
  })
  const [saving, setSaving] = useState(false)

  const setC = (tipo,cat,field,val) => setForm(f=>({...f,[tipo]:{...f[tipo],[cat]:{...f[tipo][cat],[field]:val}}}))
  const calcUSD = (obj) => {
    if (!obj||!obj.monto) return null
    if (obj.moneda==='ARS'&&obj.fx) return Number(obj.monto)/Number(obj.fx)
    if (obj.moneda==='USD') return Number(obj.monto)
    return null
  }
  const totalPres = CATS.reduce((s,cat)=>s+(calcUSD(form.pres[cat])||0),0)
  const totalReal = CATS.reduce((s,cat)=>s+(item?.costos_real?.[cat]||0),0)
  const precio    = Number(form.precio_cliente)||0
  const cmPres    = precio>0?((precio-totalPres)/precio*100).toFixed(1):null
  const cmReal    = precio>0&&totalReal>0?((precio-totalReal)/precio*100).toFixed(1):null

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const costos = {}
      for (const cat of CATS) costos[cat] = { pres:{...form.pres[cat],usd:calcUSD(form.pres[cat])}, real:{...form.real[cat],usd:calcUSD(form.real[cat])} }
      await onSave({ descripcion:form.descripcion, precio_cliente:precio||null, costos })
    } finally { setSaving(false) }
  }
  const CC = {material:'#EFF6FF',mano_obra:'#FEF3C7',instalacion:'#F0FDF4',consumibles:'#FEF2F2',alquiler:'#F5F3FF',mob_demob:'#FFF7ED'}
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:700,maxWidth:'98vw'}}>
        <h3>{item?'Editar Ítem':'Nuevo Ítem Cotizado'}</h3>
        <form onSubmit={handleSave}>
          <div className="form-row"><label>Descripción *</label><input required value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} /></div>
          <div className="form-row"><label>Precio cotizado al cliente (USD) *</label><input required type="number" step="0.01" value={form.precio_cliente} onChange={e=>setForm(f=>({...f,precio_cliente:e.target.value}))} /></div>
          <div style={{borderTop:'1px solid var(--border)',paddingTop:14,marginTop:4}}>
            <div className="section-label">Desglose de Costos</div>
            {CATS.map(cat=>{
              const p=form.pres[cat]; const r=form.real[cat]
              const pUSD=calcUSD(p); const rUSD=calcUSD(r)
              const delta=pUSD!=null&&rUSD!=null?rUSD-pUSD:null
              return (
                <div key={cat} style={{background:CC[cat],border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',marginBottom:8}}>
                  <div style={{display:'grid',gridTemplateColumns:'130px 1fr 1fr',gap:8,alignItems:'start'}}>
                    <div>
                      <div style={{fontWeight:700,fontSize:12,color:'var(--navy)',marginBottom:4}}>{CATS_LABEL[cat]}</div>
                      {pUSD!=null&&<div style={{fontSize:10,color:'var(--blue)',fontFamily:'Courier New'}}>{fmtUSD(pUSD)}</div>}
                      {rUSD!=null&&<div style={{fontSize:10,color:'#059669',fontFamily:'Courier New'}}>{fmtUSD(rUSD)}</div>}
                      {delta!=null&&<div style={{fontSize:10,fontWeight:700,color:delta<=0?'#059669':'#DC2626',fontFamily:'Courier New'}}>{delta>0?'+':''}{fmtUSD(delta)}</div>}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:4}}>
                      <div style={{display:'grid',gridTemplateColumns:'70px 1fr',gap:4}}>
                        <select value={p.moneda} onChange={e=>setC('pres',cat,'moneda',e.target.value)} style={{padding:'4px 5px',fontSize:11}}><option value="USD">USD</option><option value="ARS">ARS</option></select>
                        <input type="number" step="0.01" value={p.monto} onChange={e=>setC('pres',cat,'monto',e.target.value)} placeholder="Monto" style={{padding:'4px 7px',fontSize:11}} />
                      </div>
                      {p.moneda==='ARS'&&<input type="number" value={p.fx} onChange={e=>setC('pres',cat,'fx',e.target.value)} placeholder="FX ej. 1400" style={{padding:'4px 7px',fontSize:11}} />}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:4,justifyContent:'center'}}>
                      {item?.costos_real?.[cat]>0
                        ? <div style={{padding:'8px 10px',background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:6,fontFamily:'Courier New',fontSize:13,fontWeight:700,color:'#059669'}}>{fmtUSD(item.costos_real[cat])}</div>
                        : <div style={{padding:'8px 10px',background:'#F8FAFC',border:'1px solid var(--border)',borderRadius:6,fontSize:11,color:'var(--muted)',fontStyle:'italic'}}>Sin alocaciones</div>
                      }
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
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
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [modalItem, setModalItem] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await api.getItems(proyecto.id)) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (data) => {
    try {
      if (modalItem==='new') {
        const { error } = await supabase.from('cpt_items_proyecto').insert({...data,proyecto_id:proyecto.id,orden:items.length})
        if (error) { alert(error.message); return }
      } else {
        const { error } = await supabase.from('cpt_items_proyecto').update({descripcion:data.descripcion,precio_cliente:data.precio_cliente,costos:data.costos,updated_at:new Date().toISOString()}).eq('id',modalItem.id)
        if (error) { alert(error.message); return }
      }
      setModalItem(null); await load()
    } catch(e) { alert(e.message) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este ítem?')) return
    const { error } = await supabase.from('cpt_items_proyecto').delete().eq('id',id)
    if (error) { alert(error.message); return }
    await load()
  }

  if (loading) return <div className="state-msg">Cargando ítems...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const totalPrecio    = items.reduce((s,i)=>s+(i.precio_cliente||0),0)
  const totalCostoPres = items.reduce((s,i)=>s+CATS.reduce((sc,cat)=>sc+(i.costos?.[cat]?.pres?.usd||0),0),0)
  const totalCostoReal = items.reduce((s,i)=>s+CATS.reduce((sc,cat)=>sc+(i.costos_real?.[cat]||0),0),0)
  const totalCosto     = totalCostoReal>0?totalCostoReal:totalCostoPres
  const cmTotal        = totalPrecio>0?((totalPrecio-totalCosto)/totalPrecio*100).toFixed(1):null

  return (
    <>
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">Ítems Cotizados — Presupuesto vs Costo Real</span>
          <button className="btn" onClick={()=>setModalItem('new')}>+ Nuevo ítem</button>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Descripción</th><th>Precio Cliente</th><th>Material</th><th>M.Obra</th><th>Instalación</th><th>Consumibles</th><th>Alquiler</th><th>Mob/Demob</th><th>Costo Total</th><th>CM %</th><th></th></tr>
            </thead>
            <tbody>
              {items.length===0&&<tr><td colSpan={11} className="state-msg">Sin ítems</td></tr>}
              {items.map(item=>{
                const cpT=CATS.reduce((s,cat)=>s+(item.costos?.[cat]?.pres?.usd||0),0)
                const crT=CATS.reduce((s,cat)=>s+(item.costos_real?.[cat]||0),0)
                const cT=crT>0?crT:cpT
                return (
                  <tr key={item.id}>
                    <td style={{fontWeight:600}}>{item.descripcion}</td>
                    <td className="mono cb">{fmtUSD(item.precio_cliente)}</td>
                    {CATS.map(cat=>{
                      const pUSD=item.costos?.[cat]?.pres?.usd; const rUSD=item.costos_real?.[cat]||null
                      return (
                        <td key={cat} className="mono" style={{fontSize:11}}>
                          {pUSD!=null&&<div style={{color:'var(--blue)'}}>{fmtUSD(pUSD)}</div>}
                          {rUSD!=null&&rUSD>0&&<div style={{color:'#059669'}}>{fmtUSD(rUSD)}</div>}
                          {pUSD==null&&(!rUSD||rUSD===0)&&<span style={{color:'var(--muted)'}}>—</span>}
                        </td>
                      )
                    })}
                    <td className="mono" style={{fontSize:11}}>
                      {cpT>0&&<div style={{color:'var(--blue)'}}>{fmtUSD(cpT)}</div>}
                      {crT>0&&<div style={{color:'#059669',fontWeight:600}}>{fmtUSD(crT)}</div>}
                      {cpT===0&&crT===0&&<span style={{color:'var(--muted)'}}>—</span>}
                    </td>
                    <td style={{fontSize:11}}>
                      {cT>0&&item.precio_cliente>0&&(()=>{const cm=((item.precio_cliente-cT)/item.precio_cliente*100);return <span style={{fontWeight:700,color:cm>=30?'#059669':cm>=15?'#D97706':'#DC2626'}}>{cm.toFixed(1)}%</span>})()}
                    </td>
                    <td>
                      <div style={{display:'flex',gap:4}}>
                        <button className="btn-ghost" style={{padding:'3px 8px',fontSize:10}} onClick={()=>setModalItem(item)}>Editar</button>
                        <button className="btn-ghost" style={{padding:'3px 8px',fontSize:10,color:'var(--r)'}} onClick={()=>handleDelete(item.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {items.length>0&&(
          <div className="tbl-foot">
            <span style={{color:'var(--muted)'}}>Precio total: <strong className="cb">{fmtUSD(totalPrecio)}</strong></span>
            <span style={{color:'var(--muted)'}}>Costo pres.: <strong className="cb">{fmtUSD(totalCostoPres)}</strong></span>
            <span style={{color:'var(--muted)'}}>Costo real: <strong className="cg">{fmtUSD(totalCostoReal||null)}</strong></span>
            {cmTotal!=null&&<span style={{marginLeft:'auto',fontWeight:700,fontSize:13,color:Number(cmTotal)>=30?'#059669':Number(cmTotal)>=15?'#D97706':'#DC2626'}}>CM Total: {cmTotal}%</span>}
          </div>
        )}
      </div>
      {modalItem&&<ModalEditarItem item={modalItem==='new'?null:modalItem} onClose={()=>setModalItem(null)} onSave={handleSave} />}
    </>
  )
}

// ─── MODAL ALOCAR ─────────────────────────────────────────────────────────────
function ModalAlocar({ oc, proyecto, onClose }) {
  const [items, setItems]     = useState([])
  const [alocaciones, setAloc] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [form, setForm]       = useState({item_id:'',categoria:'material',monto_usd:'',notas:'',planificacion:'planeado'})

  const ocTotal = oc.total_alocar_usd||oc.monto_usd_sin_iva||0

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [its,alocs] = await Promise.all([api.getItems(proyecto.id), api.getAlocacionesByOC(oc.id)])
      setItems(its); setAloc(alocs)
    } catch(e) { alert(e.message) }
    finally { setLoading(false) }
  }, [oc.id, proyecto.id])

  useEffect(() => { load() }, [load])

  const totalAlocado = alocaciones.reduce((s,a)=>s+(a.monto_usd||0),0)
  const saldo = ocTotal-totalAlocado

  const handleAdd = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const monto = Number(form.monto_usd)
      if (monto>saldo+0.01) { alert(`Superás el saldo disponible (${fmtUSD(saldo)})`); return }
      const { error } = await supabase.from('cpt_alocaciones').insert({
        proyecto_id:proyecto.id,oc_id:oc.id,item_id:form.item_id,
        categoria:form.categoria,monto_usd:monto,notas:form.notas||null,planificacion:form.planificacion||'planeado'
      })
      if (error) { alert(error.message); return }
      setForm({item_id:'',categoria:'material',monto_usd:'',notas:'',planificacion:'planeado'})
      await load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    await supabase.from('cpt_alocaciones').delete().eq('id',id)
    await load()
  }

  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:620}}>
        <h3>Alocar OC — {oc.numero_oc}</h3>
        <div style={{display:'flex',justifyContent:'space-between',padding:'10px 14px',background:'#F8FAFC',border:'1px solid var(--border)',borderRadius:8,marginBottom:16,fontSize:13}}>
          <span style={{color:'var(--muted)'}}>Proveedor: <strong style={{color:'var(--navy)'}}>{oc.proveedor}</strong></span>
          <span style={{color:'var(--muted)'}}>Total OC: <strong className="cb">{fmtUSD(ocTotal)}</strong></span>
          <span style={{color:'var(--muted)'}}>Alocado: <strong className="cg">{fmtUSD(totalAlocado)}</strong></span>
          <span style={{color:saldo<0.01?'#059669':'#D97706',fontWeight:700}}>Saldo: {fmtUSD(saldo)}</span>
        </div>
        {alocaciones.length>0&&(
          <div style={{marginBottom:16}}>
            <div className="section-label">Alocaciones cargadas</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead><tr>
                {['Ítem','Categoría','Plan.','USD',''].map(h=><th key={h} style={{padding:'6px 8px',textAlign:h==='USD'?'right':'left',color:'var(--muted)',fontSize:10,textTransform:'uppercase',borderBottom:'1px solid var(--border)'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {alocaciones.map(a=>(
                  <tr key={a.id}>
                    <td style={{padding:'6px 8px',fontSize:12}}>{a.cpt_items_proyecto?.descripcion}</td>
                    <td style={{padding:'6px 8px'}}><span className={`tag t-${a.categoria==='material'?'blue':a.categoria==='mano_obra'?'orange':'green'}`}>{CATS_LABEL[a.categoria]}</span></td>
                    <td style={{padding:'6px 8px'}}><span style={{fontSize:10,padding:'2px 6px',borderRadius:8,fontWeight:600,background:a.planificacion==='no_planeado'?'#FEF3C7':'#F3F4F6',color:a.planificacion==='no_planeado'?'#92400E':'#6B7280'}}>{a.planificacion==='no_planeado'?'⚠ No planeado':'✓ Planeado'}</span></td>
                    <td style={{padding:'6px 8px',textAlign:'right',fontFamily:'Courier New',fontWeight:700,color:'#059669'}}>{fmtUSD(a.monto_usd)}</td>
                    <td style={{padding:'4px'}}><button onClick={()=>handleDelete(a.id)} style={{background:'none',border:'none',color:'#DC2626',cursor:'pointer',fontSize:12}}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {saldo>0.01?(
          <form onSubmit={handleAdd}>
            <div className="section-label">Nueva alocación — saldo: {fmtUSD(saldo)}</div>
            <div className="two-col" style={{marginBottom:8}}>
              <div className="form-row"><label>Ítem cotizado *</label><select required value={form.item_id} onChange={e=>setForm(f=>({...f,item_id:e.target.value}))}><option value="">Seleccionar ítem...</option>{items.map(i=><option key={i.id} value={i.id}>{i.descripcion}</option>)}</select></div>
              <div className="form-row"><label>Categoría *</label><select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))}>{CATS.map(c=><option key={c} value={c}>{CATS_LABEL[c]}</option>)}</select></div>
            </div>
            <div className="two-col">
              <div className="form-row"><label>Monto USD *</label><input required type="number" step="0.01" value={form.monto_usd} onChange={e=>setForm(f=>({...f,monto_usd:e.target.value}))} placeholder={`máx. ${fmtUSD(saldo)}`} /></div>
              <div className="form-row"><label>Planificación</label><select value={form.planificacion} onChange={e=>setForm(f=>({...f,planificacion:e.target.value}))}><option value="planeado">✓ Planeado</option><option value="no_planeado">⚠ No planeado</option></select></div>
            </div>
            <div className="form-row"><label>Notas</label><input value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Opcional" /></div>
            <div className="modal-footer">
              <button type="button" className="btn-ghost" onClick={onClose}>Cerrar</button>
              <button type="submit" className="btn" disabled={saving||loading}>{saving?'Guardando...':'Alocar'}</button>
            </div>
          </form>
        ):(
          <div className="alert alert-ok">✓ OC completamente alocada</div>
        )}
      </div>
    </div>
  )
}

// ─── MODAL NUEVA OC (con PDF parser) ─────────────────────────────────────────
function ModalNuevaOC({ categorias, form, setForm, saving, onClose, onSubmit }) {
  const [parsing, setParsing]   = useState(false)
  const [parseMsg, setParseMsg] = useState('')

  const handlePDF = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setParsing(true); setParseMsg('Leyendo PDF...')
    try {
      const base64 = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(',')[1]); r.onerror=rej; r.readAsDataURL(file) })
      setParseMsg('Interpretando con IA...')
      const response = await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,messages:[{role:'user',content:[
          {type:'document',source:{type:'base64',media_type:'application/pdf',data:base64}},
          {type:'text',text:'Extraé los campos de esta OC y respondé SOLO con JSON sin markdown: {"numero_oc":"","proveedor":"","cuit_proveedor":"","fecha_emision":"YYYY-MM-DD","moneda":"ARS o USD","monto_sin_iva":0,"iva_pct":0,"descripcion":"","observaciones":""}'}
        ]}]})
      })
      const data = await response.json()
      const text = data.content?.find(b=>b.type==='text')?.text||''
      const parsed = JSON.parse(text.replace(/```json|```/g,'').trim())
      setForm(f=>({...f,
        numero_oc:parsed.numero_oc||f.numero_oc, proveedor:parsed.proveedor||f.proveedor,
        fecha_emision:parsed.fecha_emision||f.fecha_emision, moneda:parsed.moneda||f.moneda,
        monto_sin_iva:parsed.monto_sin_iva?String(parsed.monto_sin_iva):f.monto_sin_iva,
        iva_pct:parsed.iva_pct!==undefined?String(parsed.iva_pct):f.iva_pct,
        descripcion:parsed.descripcion||f.descripcion, cuit_proveedor:parsed.cuit_proveedor||f.cuit_proveedor,
      }))
      setParseMsg('✓ PDF interpretado — revisá los campos')
    } catch(err) { setParseMsg('No se pudo leer el PDF. Completá manualmente.'); console.error(err) }
    finally { setParsing(false) }
  }

  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:560}}>
        <h3>Nueva Orden de Compra</h3>
        <div style={{background:'#EFF6FF',border:'1px dashed #93C5FD',borderRadius:8,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,color:'#1E40AF',marginBottom:2}}>📎 Subir PDF de OC</div><div style={{fontSize:11,color:'#6381A7'}}>Pre-llena los campos automáticamente</div></div>
          <label style={{background:parsing?'#9CA3AF':'#235C96',color:'#fff',border:'none',padding:'6px 14px',borderRadius:6,fontSize:11,fontWeight:700,cursor:parsing?'not-allowed':'pointer',whiteSpace:'nowrap'}}>
            {parsing?'Leyendo...':'Seleccionar PDF'}<input type="file" accept=".pdf" onChange={handlePDF} disabled={parsing} style={{display:'none'}} />
          </label>
        </div>
        {parseMsg&&<div className={`alert ${parseMsg.startsWith('✓')?'alert-ok':'alert-warn'}`} style={{marginBottom:12}}>{parseMsg}</div>}
        <form onSubmit={onSubmit}>
          <div className="two-col"><div className="form-row"><label>Número OC *</label><input required value={form.numero_oc} onChange={e=>setForm(f=>({...f,numero_oc:e.target.value}))} /></div><div className="form-row"><label>Proveedor *</label><input required value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} /></div></div>
          <div className="form-row"><label>CUIT Proveedor</label><input value={form.cuit_proveedor||''} onChange={e=>setForm(f=>({...f,cuit_proveedor:e.target.value}))} placeholder="ej. 30-70733736-9" /></div>
          <div className="two-col"><div className="form-row"><label>Categoría *</label><select required value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))}><option value="">Seleccionar...</option>{categorias.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div><div className="form-row"><label>Estado</label><select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}><option value="pendiente_aprobacion">Pend. aprobación</option><option value="aprobada">Aprobada</option><option value="activa">Activa</option></select></div></div>
          <div className="form-row"><label>Descripción</label><input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} /></div>
          <div className="two-col"><div className="form-row"><label>Moneda</label><select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))}><option value="ARS">ARS</option><option value="USD">USD</option></select></div><div className="form-row"><label>FX {form.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx} onChange={e=>setForm(f=>({...f,fx:e.target.value}))} disabled={form.moneda==='USD'} required={form.moneda==='ARS'} placeholder="ej. 1425" /></div></div>
          <div className="two-col"><div className="form-row"><label>Monto s/IVA ({form.moneda}) *</label><input required type="number" step="0.01" value={form.monto_sin_iva} onChange={e=>setForm(f=>({...f,monto_sin_iva:e.target.value}))} /></div><div className="form-row"><label>IVA %</label><select value={form.iva_pct} onChange={e=>setForm(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div></div>
          <div className="form-row"><label>Fecha emisión</label><input type="date" value={form.fecha_emision} onChange={e=>setForm(f=>({...f,fecha_emision:e.target.value}))} /></div>
          <div className="modal-footer"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button type="submit" className="btn" disabled={saving||parsing}>{saving?'Guardando...':'Crear OC'}</button></div>
        </form>
      </div>
    </div>
  )
}

// ─── SUB TAB OC (Facturables) ─────────────────────────────────────────────────
function SubTabOC({ proyecto }) {
  const [ocs, setOcs]               = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [modal, setModal]           = useState(false)
  const [modalAlocar, setModalAlocar] = useState(null)
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({numero_oc:'',proveedor:'',cuit_proveedor:'',categoria_id:'',descripcion:'',moneda:'ARS',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_emision:'',estado:'pendiente_aprobacion'})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [o,c,alocs] = await Promise.all([api.getOCs(proyecto.id), api.getCategorias('facturable'), api.getAlocaciones(proyecto.id)])
      const alocMap = {}
      for (const a of alocs) alocMap[a.oc_id]=(alocMap[a.oc_id]||0)+(a.monto_usd||0)
      setOcs(o.map(oc=>({...oc,alocado_usd:alocMap[oc.id]||0}))); setCategorias(c)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_oc').insert({
        proyecto_id:proyecto.id, numero_oc:form.numero_oc, proveedor:form.proveedor,
        cuit_proveedor:form.cuit_proveedor||null, categoria_id:form.categoria_id,
        descripcion:form.descripcion, moneda:form.moneda,
        monto_sin_iva:Number(form.monto_sin_iva), iva_pct:Number(form.iva_pct),
        fx:Number(form.fx)||null, fecha_emision:form.fecha_emision||null, estado:form.estado,
      })
      if (error) { alert(error.message); return }
      setModal(false)
      setForm({numero_oc:'',proveedor:'',cuit_proveedor:'',categoria_id:'',descripcion:'',moneda:'ARS',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_emision:'',estado:'pendiente_aprobacion'})
      await load()
    } finally { setSaving(false) }
  }

  const CHIP={pendiente_aprobacion:'c-pend',aprobada:'c-apr',activa:'c-ok',completada:'c-ok',cancelada:'c-no'}
  if (loading) return <div className="state-msg">Cargando OCs...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  return (
    <>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Órdenes de Compra — Facturables</span><button className="btn" onClick={()=>setModal(true)}>+ Nueva OC</button></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>#OC</th><th>Proveedor</th><th>Descripción</th><th>Total USD c/IVA</th><th>Facturado</th><th>Alocado</th><th>Sin alocar</th><th>Emitida</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {ocs.length===0&&<tr><td colSpan={10} className="state-msg">Sin OC</td></tr>}
              {ocs.map(o=>(
                <tr key={o.id}>
                  <td className="mono cb">{o.numero_oc}</td>
                  <td style={{fontWeight:600}}>{o.proveedor}</td>
                  <td style={{color:'var(--muted)',fontSize:11}}>{o.descripcion}</td>
                  <td className="mono"><strong>{fmtUSD(o.total_alocar_usd)}</strong></td>
                  <td>
                    <div style={{display:'flex',flexDirection:'column',gap:3}}>
                      <span className={`mono ${(o.pct_facturado||0)>=100?'cg':'cw'}`} style={{fontSize:11}}>{fmtUSD(o.facturado_usd)} ({o.pct_facturado||0}%)</span>
                      <div className="prog-wrap" style={{width:80}}><div className="prog" style={{width:`${o.pct_facturado||0}%`,background:(o.pct_facturado||0)>=100?'#059669':'#235C96'}} /></div>
                    </div>
                  </td>
                  <td className="mono cg">{fmtUSD(o.alocado_usd)}</td>
                  <td className={`mono ${(o.total_alocar_usd-o.alocado_usd)>0.01?'cw':'cg'}`}>
                    {(o.total_alocar_usd-o.alocado_usd)>0.01?fmtUSD(o.total_alocar_usd-o.alocado_usd):<span style={{color:'#059669'}}>✓</span>}
                  </td>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(o.fecha_emision)}</td>
                  <td><span className={`chip ${CHIP[o.estado]||'c-no'}`}>{safeReplace(o.estado)}</span></td>
                  <td><button className="btn" style={{padding:'4px 10px',fontSize:10}} onClick={()=>setModalAlocar(o)}>Alocar →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>Total c/IVA: <strong>{fmtUSD(ocs.reduce((s,o)=>s+(o.total_alocar_usd||0),0))}</strong></span>
          <span style={{color:'var(--muted)'}}>Pendiente facturar: <strong className="cw">{fmtUSD(ocs.reduce((s,o)=>s+(o.saldo_usd||0),0))}</strong></span>
        </div>
      </div>
      {modalAlocar&&<ModalAlocar oc={modalAlocar} proyecto={proyecto} onClose={()=>{setModalAlocar(null);load()}} />}
      {modal&&<ModalNuevaOC categorias={categorias} form={form} setForm={setForm} saving={saving} onClose={()=>setModal(false)} onSubmit={handleSave} />}
    </>
  )
}

// ─── SUB TAB FACTURAS COMPRA ──────────────────────────────────────────────────
function SubTabFacturasCompra({ proyecto }) {
  const [fcompra, setFcompra]   = useState([])
  const [ocs, setOcs]           = useState([])
  const [ocSaldos, setOcSaldos] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [formC, setFormC] = useState({numero_factura:'',oc_id:'',proveedor:'',cuit_proveedor:'',moneda:'ARS',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_factura:'',fecha_vto_pago:''})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [fc,o,s] = await Promise.all([api.getFacturasCompra(proyecto.id), api.getOCsBasic(proyecto.id), api.getOCSaldos(proyecto.id)])
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
        monto_sin_iva:Number(formC.monto_sin_iva), iva_pct:Number(formC.iva_pct),
        fx:Number(formC.fx)||null, cuit_proveedor:formC.cuit_proveedor||null
      })
      if (error) { alert(error.message); return }
      setModal(false)
      setFormC({numero_factura:'',oc_id:'',proveedor:'',cuit_proveedor:'',moneda:'ARS',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_factura:'',fecha_vto_pago:''})
      await load()
    } finally { setSaving(false) }
  }

  const ocSel = formC.oc_id?ocSaldos[formC.oc_id]:null
  const CHIPFC={pagada:'c-ok',pendiente_pago:'c-apr',vencida:'c-pend'}
  if (loading) return <div className="state-msg">Cargando facturas...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  return (
    <>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Facturas de Compra — Facturables</span><button className="btn" onClick={()=>setModal(true)}>+ Registrar</button></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>#Factura</th><th>Proveedor</th><th>OC</th><th>USD s/IVA</th><th>USD c/IVA</th><th>Fecha</th><th>Vto. Pago</th><th>Estado</th></tr></thead>
            <tbody>
              {fcompra.length===0&&<tr><td colSpan={8} className="state-msg">Sin facturas</td></tr>}
              {fcompra.map(f=>(
                <tr key={f.id}>
                  <td className="mono">{f.numero_factura}</td>
                  <td style={{fontWeight:500}}>{f.proveedor}</td>
                  <td className="mono cb">{f.cpt_oc?.numero_oc}</td>
                  <td className="mono">{fmtUSD(f.monto_usd_sin_iva)}</td>
                  <td className="mono">{fmtUSD(f.monto_usd_con_iva)}</td>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(f.fecha_factura)}</td>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(f.fecha_vto_pago)}</td>
                  <td><span className={`chip ${CHIPFC[f.estado]||'c-no'}`}>{safeReplace(f.estado)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal&&(
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Registrar Factura de Compra</h3>
            <form onSubmit={handleSave}>
              <div className="two-col"><div className="form-row"><label>Número *</label><input required value={formC.numero_factura} onChange={e=>setFormC(f=>({...f,numero_factura:e.target.value}))} /></div><div className="form-row"><label>OC vinculada *</label><select required value={formC.oc_id} onChange={e=>setFormC(f=>({...f,oc_id:e.target.value}))}><option value="">Seleccionar...</option>{ocs.map(o=><option key={o.id} value={o.id}>{o.numero_oc} – {o.proveedor}</option>)}</select></div></div>
              {ocSel&&<div className="alert alert-info" style={{marginBottom:12}}>Saldo disponible: <strong>{fmtUSD(ocSel.saldo_usd)} USD</strong></div>}
              <div className="form-row"><label>Proveedor *</label><input required value={formC.proveedor} onChange={e=>setFormC(f=>({...f,proveedor:e.target.value}))} /></div>
              <div className="form-row"><label>CUIT</label><input value={formC.cuit_proveedor||''} onChange={e=>setFormC(f=>({...f,cuit_proveedor:e.target.value}))} placeholder="ej. 30-70733736-9" /></div>
              <div className="two-col"><div className="form-row"><label>Moneda</label><select value={formC.moneda} onChange={e=>setFormC(f=>({...f,moneda:e.target.value}))}><option value="ARS">ARS</option><option value="USD">USD</option></select></div><div className="form-row"><label>FX {formC.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={formC.fx} onChange={e=>setFormC(f=>({...f,fx:e.target.value}))} disabled={formC.moneda==='USD'} required={formC.moneda==='ARS'} placeholder="ej. 1428" /></div></div>
              <div className="two-col"><div className="form-row"><label>Monto s/IVA *</label><input required type="number" step="0.01" value={formC.monto_sin_iva} onChange={e=>setFormC(f=>({...f,monto_sin_iva:e.target.value}))} /></div><div className="form-row"><label>IVA %</label><select value={formC.iva_pct} onChange={e=>setFormC(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div></div>
              <div className="two-col"><div className="form-row"><label>Fecha *</label><input required type="date" value={formC.fecha_factura} onChange={e=>setFormC(f=>({...f,fecha_factura:e.target.value}))} /></div><div className="form-row"><label>Vto. pago</label><input type="date" value={formC.fecha_vto_pago} onChange={e=>setFormC(f=>({...f,fecha_vto_pago:e.target.value}))} /></div></div>
              <div className="modal-footer"><button type="button" className="btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Registrar'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── TAB COSTOS (Facturables) ─────────────────────────────────────────────────
function TabCostos({ proyecto }) {
  const [subTab, setSubTab] = useState('oc')
  return (
    <>
      <div className="sub-tabs">
        <button className={subTab==='oc'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab('oc')}>Órdenes de Compra</button>
        <button className={subTab==='facturas'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab('facturas')}>Facturas de Compra</button>
      </div>
      {subTab==='oc'       && <SubTabOC            proyecto={proyecto} />}
      {subTab==='facturas' && <SubTabFacturasCompra proyecto={proyecto} />}
    </>
  )
}

// ─── TAB INGRESOS (Facturables) ───────────────────────────────────────────────
function SubTabFacturasVenta({ proyecto }) {
  const [fventa, setFventa]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [modal, setModal]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [formV, setFormV] = useState({numero_factura:'',concepto:'',monto_usd:'',cuit_cliente:'',fecha_emision:'',fecha_vto_cobro:'',notas:''})

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
        proyecto_id:proyecto.id, numero_factura:formV.numero_factura||null,
        concepto:formV.concepto, monto_usd:Number(formV.monto_usd),
        cuit_cliente:formV.cuit_cliente||null,
        fecha_emision:formV.fecha_emision||null, fecha_vto_cobro:formV.fecha_vto_cobro||null,
        notas:formV.notas||null, estado:formV.fecha_emision?'emitida':'no_emitida', monto_cobrado:0,
      })
      if (error) { alert(error.message); return }
      setModal(false); setFormV({numero_factura:'',concepto:'',monto_usd:'',cuit_cliente:'',fecha_emision:'',fecha_vto_cobro:'',notas:''}); await load()
    } finally { setSaving(false) }
  }

  const CHIPFV={cobrada:'c-ok',cobro_parcial:'c-pend',emitida:'c-apr',no_emitida:'c-no'}
  const totalFacVta  = fventa.reduce((s,f)=>s+(f.monto_usd||0),0)
  const totalCobrado = fventa.reduce((s,f)=>s+(f.monto_cobrado||0),0)

  if (loading) return <div className="state-msg">Cargando...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  return (
    <>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Facturas al Cliente</span><button className="btn" onClick={()=>setModal(true)}>+ Nueva</button></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>#Factura</th><th>Concepto</th><th>Monto USD</th><th>Emitida</th><th>Vto. Cobro</th><th>Cobrado</th><th>Pendiente</th><th>Estado</th></tr></thead>
            <tbody>
              {fventa.length===0&&<tr><td colSpan={8} className="state-msg">Sin facturas al cliente</td></tr>}
              {fventa.map(f=>(
                <tr key={f.id}>
                  <td className="mono">{f.numero_factura||'—'}</td>
                  <td style={{fontWeight:500}}>{f.concepto}</td>
                  <td className="mono cb">{fmtUSD(f.monto_usd)}</td>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(f.fecha_emision)}</td>
                  <td>{f.fecha_vto_cobro?(()=>{const r=getReminderStatus(f.fecha_vto_cobro);return <span className={`reminder-badge ${r.cls}`}>{r.label}</span>})():<span style={{color:'var(--muted)',fontSize:11}}>—</span>}</td>
                  <td className={`mono ${(f.monto_cobrado||0)>0?'cg':''}`}>{fmtUSD(f.monto_cobrado)}</td>
                  <td className={`mono ${(f.monto_usd-(f.monto_cobrado||0))>0?'cw':''}`}>{fmtUSD(f.monto_usd-(f.monto_cobrado||0))}</td>
                  <td><span className={`chip ${CHIPFV[f.estado]||'c-no'}`}>{safeReplace(f.estado)}</span></td>
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
      {modal&&(
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Nueva Factura al Cliente</h3>
            <form onSubmit={handleSave}>
              <div className="form-row"><label>Número</label><input value={formV.numero_factura} onChange={e=>setFormV(f=>({...f,numero_factura:e.target.value}))} placeholder="Vacío si no emitida aún" /></div>
              <div className="form-row"><label>Concepto *</label><input required value={formV.concepto} onChange={e=>setFormV(f=>({...f,concepto:e.target.value}))} placeholder="ej. Anticipo 30% obra" /></div>
              <div className="form-row"><label>CUIT Cliente</label><input value={formV.cuit_cliente} onChange={e=>setFormV(f=>({...f,cuit_cliente:e.target.value}))} /></div>
              <div className="form-row"><label>Monto USD *</label><input required type="number" step="0.01" value={formV.monto_usd} onChange={e=>setFormV(f=>({...f,monto_usd:e.target.value}))} /></div>
              <div className="two-col"><div className="form-row"><label>Fecha emisión</label><input type="date" value={formV.fecha_emision} onChange={e=>setFormV(f=>({...f,fecha_emision:e.target.value}))} /></div><div className="form-row"><label>Vto. cobro</label><input type="date" value={formV.fecha_vto_cobro} onChange={e=>setFormV(f=>({...f,fecha_vto_cobro:e.target.value}))} /></div></div>
              <div className="form-row"><label>Notas</label><textarea value={formV.notas} onChange={e=>setFormV(f=>({...f,notas:e.target.value}))} /></div>
              <div className="modal-footer"><button type="button" className="btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Guardar'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function TabIngresos({ proyecto }) {
  const [subTab, setSubTab] = useState('facturas')
  return (
    <>
      <div className="sub-tabs">
        <button className={subTab==='facturas'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab('facturas')}>Facturas al Cliente</button>
        <button className={subTab==='margen'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab('margen')}>Margen & Costos</button>
      </div>
      {subTab==='facturas'&&<SubTabFacturasVenta proyecto={proyecto} />}
      {subTab==='margen'&&(()=>{
        return <MargenSimple proyecto={proyecto} />
      })()}
    </>
  )
}

function MargenSimple({ proyecto }) {
  const [fventa, setFventa]   = useState([])
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try { const [fv,its]=await Promise.all([api.getFacturasVenta(proyecto.id),api.getItems(proyecto.id)]); setFventa(fv); setItems(its) }
    catch{} finally { setLoading(false) }
  }, [proyecto.id])
  useEffect(()=>{ load() },[load])
  if (loading) return <div className="state-msg">Cargando...</div>
  const totalCotizado = fventa.reduce((s,f)=>s+(f.monto_usd||0),0)
  const totalReal     = items.reduce((s,i)=>s+CATS.reduce((sc,cat)=>sc+(i.costos_real?.[cat]||0),0),0)
  const cm            = totalCotizado>0?((totalCotizado-totalReal)/totalCotizado*100).toFixed(1):0
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      <div className="card" style={{marginBottom:0}}>
        <div className="card-hdr"><span className="card-title">Resumen de Márgenes</span></div>
        <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:12,fontSize:13}}>
          <div style={{display:'flex',justifyContent:'space-between',paddingBottom:10,borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--muted)'}}>Ingreso cotizado</span><strong className="cb">{fmtUSD(totalCotizado)}</strong></div>
          <div style={{display:'flex',justifyContent:'space-between'}}><span style={{color:'var(--muted)'}}>Costo real / forecast</span><strong className="cg">{fmtUSD(totalReal)}</strong></div>
          <div style={{background:'#F0FDF4',border:'1px solid #BBF7D0',borderRadius:6,padding:'8px 10px',display:'flex',justifyContent:'space-between'}}><span style={{fontWeight:700}}>CM</span><strong className="cg" style={{fontSize:16}}>{cm}%</strong></div>
        </div>
      </div>
      <div className="card" style={{marginBottom:0}}>
        <div className="card-hdr"><span className="card-title">Costo por ítem</span></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Ítem</th><th>Precio</th><th>Costo Real</th><th>CM</th></tr></thead>
            <tbody>
              {items.map(i=>{const cr=CATS.reduce((s,cat)=>s+(i.costos_real?.[cat]||0),0);const cm=i.precio_cliente>0?((i.precio_cliente-cr)/i.precio_cliente*100).toFixed(1):null;return(
                <tr key={i.id}><td style={{fontWeight:500,fontSize:11}}>{i.descripcion}</td><td className="mono cb">{fmtUSD(i.precio_cliente)}</td><td className={`mono ${cr>0?'cg':''}`}>{cr>0?fmtUSD(cr):'—'}</td><td style={{fontSize:11,fontWeight:700,color:cm!=null?(Number(cm)>=30?'#059669':Number(cm)>=15?'#D97706':'#DC2626'):'var(--muted)'}}>{cm!=null?cm+'%':'—'}</td></tr>
              )})}
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
  const caja = totalCobrado-totalPagado

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

// ─── MODAL EDITAR OC NF ───────────────────────────────────────────────────────
function ModalEditarOCNF({ oc, zonas, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    numero_oc: oc.numero_oc||'', proveedor: oc.proveedor||'', cuit_proveedor: oc.cuit_proveedor||'',
    zona_id: oc.zona_id||'', descripcion: oc.descripcion||'', moneda: oc.moneda||'ARS',
    monto_sin_iva: oc.monto_sin_iva||'', iva_pct: oc.iva_pct??'21', fx: oc.fx||'',
    fecha_emision: oc.fecha_emision||'', estado: oc.estado||'activa',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:560}}>
        <h3>Editar OC — {oc.numero_oc}</h3>
        <form onSubmit={handleSubmit}>
          <div className="two-col"><div className="form-row"><label>Número OC *</label><input required value={form.numero_oc} onChange={e=>setForm(f=>({...f,numero_oc:e.target.value}))} /></div><div className="form-row"><label>Proveedor *</label><input required value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} /></div></div>
          <div className="form-row"><label>CUIT</label><input value={form.cuit_proveedor} onChange={e=>setForm(f=>({...f,cuit_proveedor:e.target.value}))} /></div>
          <div className="two-col"><div className="form-row"><label>Zona</label><select value={form.zona_id} onChange={e=>setForm(f=>({...f,zona_id:e.target.value}))}><option value="">Sin zona</option>{zonas.map(z=><option key={z.id} value={z.id}>{z.nombre}</option>)}</select></div><div className="form-row"><label>Estado</label><select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}><option value="pendiente_aprobacion">Pend. aprobación</option><option value="aprobada">Aprobada</option><option value="activa">Activa</option><option value="completada">Completada</option></select></div></div>
          <div className="form-row"><label>Descripción</label><input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} /></div>
          <div className="two-col"><div className="form-row"><label>Moneda</label><select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))}><option value="ARS">ARS</option><option value="USD">USD</option></select></div><div className="form-row"><label>FX {form.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx} onChange={e=>setForm(f=>({...f,fx:e.target.value}))} disabled={form.moneda==='USD'} required={form.moneda==='ARS'} placeholder="ej. 1425" /></div></div>
          <div className="two-col"><div className="form-row"><label>Monto s/IVA ({form.moneda}) *</label><input required type="number" step="0.01" value={form.monto_sin_iva} onChange={e=>setForm(f=>({...f,monto_sin_iva:e.target.value}))} /></div><div className="form-row"><label>IVA %</label><select value={form.iva_pct} onChange={e=>setForm(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div></div>
          <div className="form-row"><label>Fecha emisión</label><input type="date" value={form.fecha_emision} onChange={e=>setForm(f=>({...f,fecha_emision:e.target.value}))} /></div>
          <div className="modal-footer" style={{justifyContent:'space-between'}}>
            <button type="button" onClick={onDelete} style={{background:'#FEF2F2',border:'1px solid #FECACA',color:'#DC2626',padding:'6px 14px',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer'}}>🗑 Eliminar OC</button>
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

// ─── NO FACTURABLES ───────────────────────────────────────────────────────────
function SubTabPrepBarco({ proyecto }) {
  const [ocs, setOcs]           = useState([])
  const [zonas, setZonas]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [filterZona, setFilterZona] = useState('')
  const [modalEditar, setModalEditar] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { const [o,z]=await Promise.all([api.getOCsNF(proyecto.id),api.getZonas(proyecto.id)]); setOcs(o); setZonas(z) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])
  if (loading) return <div className="state-msg">Cargando preparación barco...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const filtradas = filterZona?ocs.filter(o=>o.zona_id===filterZona):ocs
  const totalSinIVA = ocs.reduce((s,o)=>s+(o.monto_usd_sin_iva||0),0)
  const totalConIVA = ocs.reduce((s,o)=>s+(o.monto_usd_con_iva||0),0)
  const sinZona = ocs.filter(o=>!o.zona_id)
  const porZona = {}
  for (const o of ocs) {
    const k=o.zona_id||'__sin_zona__'
    if (!porZona[k]) porZona[k]={nombre:o.cpt_zonas_trabajo?.nombre||'Sin zona',total:0}
    porZona[k].total+=o.monto_usd_con_iva||0
  }
  const maxZona=Math.max(...Object.values(porZona).map(z=>z.total),1)

  return (
    <>
      <div className="kpi-row" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <div className="kpi"><div className="kpi-lbl">Total OC s/IVA</div><div className="kpi-val cb">{fmtUSD(totalSinIVA)}</div><div className="kpi-sub">USD equiv. · {ocs.length} OC</div></div>
        <div className="kpi"><div className="kpi-lbl">Total OC c/IVA</div><div className="kpi-val cw">{fmtUSD(totalConIVA)}</div><div className="kpi-sub">USD equiv.</div></div>
        <div className="kpi"><div className="kpi-lbl">Zonas activas</div><div className="kpi-val cg">{zonas.length}</div><div className="kpi-sub">{zonas.map(z=>z.nombre).join(' · ')||'Sin zonas'}</div></div>
        <div className="kpi"><div className="kpi-lbl">Sin zona asignada</div><div className="kpi-val" style={{color:sinZona.length>0?'var(--r)':'var(--g)'}}>{sinZona.length}</div><div className="kpi-sub">{sinZona.length>0?'Pendientes':'Todas clasificadas ✓'}</div></div>
      </div>
      {sinZona.length>0&&<div className="alert alert-warn">⚠ {sinZona.length} OC sin zona — {fmtUSD(sinZona.reduce((s,o)=>s+(o.monto_usd_con_iva||0),0))} USD c/IVA sin clasificar</div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Costo por zona (USD c/IVA)</span></div>
          <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
            {Object.entries(porZona).map(([k,z])=>(
              <div key={k}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}>
                  <span style={{fontWeight:600,color:k==='__sin_zona__'?'var(--r)':'var(--navy)'}}>{z.nombre}</span>
                  <span className="mono cg">{fmtUSD(z.total)}</span>
                </div>
                <div className="prog-wrap"><div className="prog" style={{width:`${z.total/maxZona*100}%`,background:k==='__sin_zona__'?'#DC2626':'#235C96'}} /></div>
              </div>
            ))}
            {Object.keys(porZona).length===0&&<div className="state-msg" style={{padding:12}}>Sin OC cargadas</div>}
          </div>
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Zonas de trabajo</span><button className="btn" onClick={async()=>{
            const nombre=prompt('Nombre de la nueva zona:')
            if (!nombre?.trim()) return
            const {error}=await supabase.from('cpt_zonas_trabajo').insert({proyecto_id:proyecto.id,nombre:nombre.trim()})
            if (error) { alert(error.message); return }
            await load()
          }}>+ Zona</button></div>
          <div style={{padding:'12px 16px'}}>
            {zonas.length===0?<div className="state-msg" style={{padding:12}}>Sin zonas</div>:zonas.map(z=>(
              <div key={z.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:'1px solid var(--border)',fontSize:12}}>
                <span style={{fontWeight:600}}>{z.nombre}</span>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <span style={{color:'var(--muted)',fontSize:11}}>{ocs.filter(o=>o.zona_id===z.id).length} OC</span>
                  <button className="btn-ghost" style={{padding:'2px 8px',fontSize:10,color:'var(--r)'}} onClick={async()=>{
                    if (!confirm(`¿Eliminar zona "${z.nombre}"?`)) return
                    const {error}=await supabase.from('cpt_zonas_trabajo').delete().eq('id',z.id)
                    if (error) { alert(error.message); return }
                    await load()
                  }}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-hdr">
          <span className="card-title">OC de alistamiento</span>
          <select value={filterZona} onChange={e=>setFilterZona(e.target.value)} style={{fontSize:11,padding:'4px 8px',width:'auto'}}>
            <option value="">Todas las zonas</option>
            {zonas.map(z=><option key={z.id} value={z.id}>{z.nombre}</option>)}
          </select>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>#OC</th><th>Proveedor</th><th>Descripción</th><th>Zona</th><th>Mon.</th><th>s/IVA orig.</th><th>c/IVA orig.</th><th>FX</th><th>USD s/IVA</th><th>USD c/IVA</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {filtradas.length===0&&<tr><td colSpan={12} className="state-msg">Sin OC</td></tr>}
              {filtradas.map(o=>(
                <tr key={o.id}>
                  <td className="mono cb">{o.numero_oc}</td>
                  <td style={{fontWeight:600}}>{o.proveedor}</td>
                  <td style={{color:'var(--muted)',fontSize:11}}>{o.descripcion}</td>
                  <td>{o.cpt_zonas_trabajo?<span className="tag t-blue">{o.cpt_zonas_trabajo.nombre}</span>:<span className="tag t-red">Sin zona</span>}</td>
                  <td className="mono">{o.moneda}</td>
                  <td className="mono">{o.moneda==='ARS'?`$${Number(o.monto_sin_iva).toLocaleString('es-AR')}`:fmtUSD(o.monto_sin_iva)}</td>
                  <td className="mono">{o.moneda==='ARS'?`$${Number(o.monto_sin_iva*(1+(o.iva_pct||0)/100)).toLocaleString('es-AR')}`:fmtUSD(o.monto_sin_iva*(1+(o.iva_pct||0)/100))}</td>
                  <td className="mono" style={{color:'var(--muted)'}}>{o.fx?Number(o.fx).toLocaleString('es-AR'):'—'}</td>
                  <td className="mono">{fmtUSD(o.monto_usd_sin_iva)}</td>
                  <td className="mono cg">{fmtUSD(o.monto_usd_con_iva)}</td>
                  <td><span className={`chip ${o.estado==='activa'?'c-ok':'c-pend'}`}>{safeReplace(o.estado)}</span></td>
                  <td><button className="btn-ghost" style={{padding:'3px 8px',fontSize:10}} onClick={()=>setModalEditar(o)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>USD s/IVA: <strong>{fmtUSD(totalSinIVA)}</strong></span>
          <span style={{color:'var(--muted)'}}>USD c/IVA: <strong className="cg">{fmtUSD(totalConIVA)}</strong></span>
        </div>
      </div>
      {modalEditar&&(
        <ModalEditarOCNF
          oc={modalEditar} zonas={zonas}
          onClose={()=>setModalEditar(null)}
          onSave={async (data)=>{
            const {error}=await supabase.from('cpt_oc_nf').update({
              numero_oc:data.numero_oc, proveedor:data.proveedor,
              cuit_proveedor:data.cuit_proveedor||null, zona_id:data.zona_id||null,
              descripcion:data.descripcion, moneda:data.moneda,
              monto_sin_iva:Number(data.monto_sin_iva), iva_pct:Number(data.iva_pct),
              fx:Number(data.fx)||null, fecha_emision:data.fecha_emision||null, estado:data.estado,
            }).eq('id',modalEditar.id)
            if (error) { alert(error.message); return }
            setModalEditar(null); await load()
          }}
          onDelete={async()=>{
            if (!confirm(`¿Eliminar OC ${modalEditar.numero_oc}?`)) return
            const {error}=await supabase.from('cpt_oc_nf').delete().eq('id',modalEditar.id)
            if (error) { alert(error.message); return }
            setModalEditar(null); await load()
          }}
        />
      )}
    </>
  )
}

// ─── SUB TAB OC NO FACTURABLES ────────────────────────────────────────────────
function SubTabOCNoFact({ proyecto }) {
  const [subTab2, setSubTab2]   = useState('oc')
  const [ocs, setOcs]           = useState([])
  const [zonas, setZonas]       = useState([])
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(false)
  const [modalFact, setModalFact] = useState(false)
  const [saving, setSaving]     = useState(false)
  const emptyOC = {numero_oc:'',proveedor:'',cuit_proveedor:'',zona_id:'',descripcion:'',moneda:'ARS',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_emision:'',estado:'activa'}
  const [form, setForm]   = useState(emptyOC)
  const [formF, setFormF] = useState({numero_factura:'',oc_nf_id:'',proveedor:'',cuit_proveedor:'',moneda:'ARS',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_factura:'',fecha_vto_pago:''})

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [o,z,f] = await Promise.all([api.getOCsNF(proyecto.id), api.getZonas(proyecto.id), api.getFacturasNF(proyecto.id)])
      setOcs(o); setZonas(z); setFacturas(f)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleSaveOC = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_oc_nf').insert({
        proyecto_id:proyecto.id, numero_oc:form.numero_oc, proveedor:form.proveedor,
        cuit_proveedor:form.cuit_proveedor||null, zona_id:form.zona_id||null,
        descripcion:form.descripcion, moneda:form.moneda,
        monto_sin_iva:Number(form.monto_sin_iva), iva_pct:Number(form.iva_pct),
        fx:Number(form.fx)||null, fecha_emision:form.fecha_emision||null, estado:form.estado,
      })
      if (error) { alert(error.message); return }
      setModal(false); setForm(emptyOC); await load()
    } finally { setSaving(false) }
  }

  const handleSaveFact = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_facturas_nf').insert({
        proyecto_id:proyecto.id, numero_factura:formF.numero_factura,
        oc_nf_id:formF.oc_nf_id||null, proveedor:formF.proveedor,
        cuit_proveedor:formF.cuit_proveedor||null, moneda:formF.moneda,
        monto_sin_iva:Number(formF.monto_sin_iva), iva_pct:Number(formF.iva_pct),
        fx:Number(formF.fx)||null,
        fecha_factura:formF.fecha_factura||null, fecha_vto_pago:formF.fecha_vto_pago||null,
      })
      if (error) { alert(error.message); return }
      setModalFact(false)
      setFormF({numero_factura:'',oc_nf_id:'',proveedor:'',cuit_proveedor:'',moneda:'ARS',monto_sin_iva:'',iva_pct:'21',fx:'',fecha_factura:'',fecha_vto_pago:''})
      await load()
    } finally { setSaving(false) }
  }

  if (loading) return <div className="state-msg">Cargando...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const montoOrig = (o) => o.moneda==='ARS'?`$${Number(o.monto_sin_iva).toLocaleString('es-AR')}`:fmtUSD(o.monto_sin_iva)
  const montoOrigCIVA = (o) => {
    const val = o.monto_sin_iva*(1+(o.iva_pct||0)/100)
    return o.moneda==='ARS'?`$${Number(val).toLocaleString('es-AR')}`:fmtUSD(val)
  }

  return (
    <>
      <div className="sub-tabs">
        <button className={subTab2==='oc'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab2('oc')}>Órdenes de Compra</button>
        <button className={subTab2==='fact'?'btn-active btn':'btn-ghost'} onClick={()=>setSubTab2('fact')}>Facturas</button>
      </div>

      {subTab2==='oc'&&(
        <>
          <div className="card">
            <div className="card-hdr"><span className="card-title">OC — No Facturables</span><button className="btn" onClick={()=>setModal(true)}>+ Nueva OC</button></div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>#OC</th><th>Proveedor</th><th>Descripción</th><th>Zona</th><th>Mon.</th><th>s/IVA orig.</th><th>c/IVA orig.</th><th>FX</th><th>USD s/IVA</th><th>USD c/IVA</th><th>Estado</th></tr></thead>
                <tbody>
                  {ocs.length===0&&<tr><td colSpan={11} className="state-msg">Sin OC</td></tr>}
                  {ocs.map(o=>(
                    <tr key={o.id}>
                      <td className="mono cb">{o.numero_oc}</td>
                      <td style={{fontWeight:600}}>{o.proveedor}</td>
                      <td style={{color:'var(--muted)',fontSize:11}}>{o.descripcion}</td>
                      <td>{o.cpt_zonas_trabajo?<span className="tag t-blue">{o.cpt_zonas_trabajo.nombre}</span>:<span className="tag t-red">Sin zona</span>}</td>
                      <td className="mono">{o.moneda}</td>
                      <td className="mono">{montoOrig(o)}</td>
                      <td className="mono">{montoOrigCIVA(o)}</td>
                      <td className="mono" style={{color:'var(--muted)'}}>{o.fx?Number(o.fx).toLocaleString('es-AR'):'—'}</td>
                      <td className="mono">{fmtUSD(o.monto_usd_sin_iva)}</td>
                      <td className="mono cg">{fmtUSD(o.monto_usd_con_iva)}</td>
                      <td><span className={`chip ${o.estado==='activa'?'c-ok':'c-pend'}`}>{safeReplace(o.estado)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tbl-foot">
              <span style={{color:'var(--muted)'}}>USD s/IVA: <strong>{fmtUSD(ocs.reduce((s,o)=>s+(o.monto_usd_sin_iva||0),0))}</strong></span>
              <span style={{color:'var(--muted)'}}>USD c/IVA: <strong className="cg">{fmtUSD(ocs.reduce((s,o)=>s+(o.monto_usd_con_iva||0),0))}</strong></span>
            </div>
          </div>
          {modal&&(
            <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
              <div className="modal" style={{width:560}}>
                <h3>Nueva OC — No Facturable</h3>
                <form onSubmit={handleSaveOC}>
                  <div className="two-col"><div className="form-row"><label>Número OC *</label><input required value={form.numero_oc} onChange={e=>setForm(f=>({...f,numero_oc:e.target.value}))} /></div><div className="form-row"><label>Proveedor *</label><input required value={form.proveedor} onChange={e=>setForm(f=>({...f,proveedor:e.target.value}))} /></div></div>
                  <div className="form-row"><label>CUIT</label><input value={form.cuit_proveedor} onChange={e=>setForm(f=>({...f,cuit_proveedor:e.target.value}))} /></div>
                  <div className="two-col"><div className="form-row"><label>Zona</label><select value={form.zona_id} onChange={e=>setForm(f=>({...f,zona_id:e.target.value}))}><option value="">Sin zona</option>{zonas.map(z=><option key={z.id} value={z.id}>{z.nombre}</option>)}</select></div><div className="form-row"><label>Estado</label><select value={form.estado} onChange={e=>setForm(f=>({...f,estado:e.target.value}))}><option value="pendiente_aprobacion">Pend. aprobación</option><option value="aprobada">Aprobada</option><option value="activa">Activa</option><option value="completada">Completada</option></select></div></div>
                  <div className="form-row"><label>Descripción</label><input value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} /></div>
                  <div className="two-col"><div className="form-row"><label>Moneda</label><select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))}><option value="ARS">ARS</option><option value="USD">USD</option></select></div><div className="form-row"><label>FX {form.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx} onChange={e=>setForm(f=>({...f,fx:e.target.value}))} disabled={form.moneda==='USD'} required={form.moneda==='ARS'} placeholder="ej. 1425" /></div></div>
                  <div className="two-col"><div className="form-row"><label>Monto s/IVA ({form.moneda}) *</label><input required type="number" step="0.01" value={form.monto_sin_iva} onChange={e=>setForm(f=>({...f,monto_sin_iva:e.target.value}))} /></div><div className="form-row"><label>IVA %</label><select value={form.iva_pct} onChange={e=>setForm(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div></div>
                  <div className="form-row"><label>Fecha emisión</label><input type="date" value={form.fecha_emision} onChange={e=>setForm(f=>({...f,fecha_emision:e.target.value}))} /></div>
                  {form.moneda==='ARS'&&form.monto_sin_iva&&form.fx&&(
                    <div className="alert alert-info" style={{marginBottom:12}}>USD s/IVA: <strong>{fmtUSD(Number(form.monto_sin_iva)/Number(form.fx))}</strong> · USD c/IVA: <strong>{fmtUSD(Number(form.monto_sin_iva)*(1+Number(form.iva_pct)/100)/Number(form.fx))}</strong></div>
                  )}
                  <div className="modal-footer"><button type="button" className="btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Crear OC'}</button></div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {subTab2==='fact'&&(
        <>
          <div className="card">
            <div className="card-hdr"><span className="card-title">Facturas — No Facturables</span><button className="btn" onClick={()=>setModalFact(true)}>+ Registrar</button></div>
            <div className="tbl-wrap">
              <table>
                <thead><tr><th>#Factura</th><th>Proveedor</th><th>OC vinculada</th><th>Mon.</th><th>s/IVA orig.</th><th>c/IVA orig.</th><th>FX</th><th>USD s/IVA</th><th>USD c/IVA</th><th>Fecha</th><th>Vto. Pago</th></tr></thead>
                <tbody>
                  {facturas.length===0&&<tr><td colSpan={11} className="state-msg">Sin facturas</td></tr>}
                  {facturas.map(f=>{
                    const sinIvaUSD=f.moneda==='ARS'&&f.fx?f.monto_sin_iva/f.fx:f.monto_sin_iva
                    const conIvaUSD=f.moneda==='ARS'&&f.fx?(f.monto_sin_iva*(1+(f.iva_pct||0)/100))/f.fx:(f.monto_sin_iva*(1+(f.iva_pct||0)/100))
                    return (
                      <tr key={f.id}>
                        <td className="mono">{f.numero_factura}</td>
                        <td style={{fontWeight:500}}>{f.proveedor}</td>
                        <td className="mono cb">{f.cpt_oc_nf?.numero_oc||'—'}</td>
                        <td className="mono">{f.moneda}</td>
                        <td className="mono">{f.moneda==='ARS'?`$${Number(f.monto_sin_iva).toLocaleString('es-AR')}`:fmtUSD(f.monto_sin_iva)}</td>
                        <td className="mono">{f.moneda==='ARS'?`$${Number(f.monto_sin_iva*(1+(f.iva_pct||0)/100)).toLocaleString('es-AR')}`:fmtUSD(f.monto_sin_iva*(1+(f.iva_pct||0)/100))}</td>
                        <td className="mono" style={{color:'var(--muted)'}}>{f.fx?Number(f.fx).toLocaleString('es-AR'):'—'}</td>
                        <td className="mono">{fmtUSD(sinIvaUSD)}</td>
                        <td className="mono cg">{fmtUSD(conIvaUSD)}</td>
                        <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(f.fecha_factura)}</td>
                        <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(f.fecha_vto_pago)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {modalFact&&(
            <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModalFact(false)}>
              <div className="modal" style={{width:520}}>
                <h3>Registrar Factura — No Facturable</h3>
                <form onSubmit={handleSaveFact}>
                  <div className="two-col"><div className="form-row"><label>Número *</label><input required value={formF.numero_factura} onChange={e=>setFormF(f=>({...f,numero_factura:e.target.value}))} /></div><div className="form-row"><label>OC vinculada</label><select value={formF.oc_nf_id} onChange={e=>{const oc=ocs.find(o=>o.id===e.target.value);setFormF(f=>({...f,oc_nf_id:e.target.value,proveedor:oc?.proveedor||f.proveedor}))}}><option value="">Sin OC</option>{ocs.map(o=><option key={o.id} value={o.id}>{o.numero_oc} – {o.proveedor}</option>)}</select></div></div>
                  <div className="form-row"><label>Proveedor *</label><input required value={formF.proveedor} onChange={e=>setFormF(f=>({...f,proveedor:e.target.value}))} /></div>
                  <div className="form-row"><label>CUIT</label><input value={formF.cuit_proveedor} onChange={e=>setFormF(f=>({...f,cuit_proveedor:e.target.value}))} /></div>
                  <div className="two-col"><div className="form-row"><label>Moneda</label><select value={formF.moneda} onChange={e=>setFormF(f=>({...f,moneda:e.target.value}))}><option value="ARS">ARS</option><option value="USD">USD</option></select></div><div className="form-row"><label>FX {formF.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={formF.fx} onChange={e=>setFormF(f=>({...f,fx:e.target.value}))} disabled={formF.moneda==='USD'} required={formF.moneda==='ARS'} placeholder="ej. 1425" /></div></div>
                  <div className="two-col"><div className="form-row"><label>Monto s/IVA *</label><input required type="number" step="0.01" value={formF.monto_sin_iva} onChange={e=>setFormF(f=>({...f,monto_sin_iva:e.target.value}))} /></div><div className="form-row"><label>IVA %</label><select value={formF.iva_pct} onChange={e=>setFormF(f=>({...f,iva_pct:e.target.value}))}><option value="21">21%</option><option value="10.5">10.5%</option><option value="0">0%</option></select></div></div>
                  <div className="two-col"><div className="form-row"><label>Fecha *</label><input required type="date" value={formF.fecha_factura} onChange={e=>setFormF(f=>({...f,fecha_factura:e.target.value}))} /></div><div className="form-row"><label>Vto. pago</label><input type="date" value={formF.fecha_vto_pago} onChange={e=>setFormF(f=>({...f,fecha_vto_pago:e.target.value}))} /></div></div>
                  {formF.moneda==='ARS'&&formF.monto_sin_iva&&formF.fx&&(
                    <div className="alert alert-info" style={{marginBottom:12}}>USD s/IVA: <strong>{fmtUSD(Number(formF.monto_sin_iva)/Number(formF.fx))}</strong> · USD c/IVA: <strong>{fmtUSD(Number(formF.monto_sin_iva)*(1+Number(formF.iva_pct)/100)/Number(formF.fx))}</strong></div>
                  )}
                  <div className="modal-footer"><button type="button" className="btn-ghost" onClick={()=>setModalFact(false)}>Cancelar</button><button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Registrar'}</button></div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ─── TAB OPERACIÓN ────────────────────────────────────────────────────────────
function ModalOpRegistro({ titulo, cats, form, setForm, saving, onClose, onSubmit, esIngreso }) {
  return (
    <div className="overlay open" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{width:500}}>
        <h3>{titulo}</h3>
        <form onSubmit={onSubmit}>
          <div className="two-col">
            <div className="form-row"><label>Fecha *</label><input required type="date" value={form.fecha} onChange={e=>setForm(f=>({...f,fecha:e.target.value}))} /></div>
            <div className="form-row"><label>Categoría *</label><select required value={form.categoria_id} onChange={e=>setForm(f=>({...f,categoria_id:e.target.value}))}><option value="">Seleccionar...</option>{cats.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          </div>
          <div className="form-row"><label>Descripción *</label><input required value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} placeholder={esIngreso?'ej. Daily hire mayo — 31 días':'ej. Salarios tripulación mayo'} /></div>
          <div className="two-col">
            <div className="form-row"><label>Moneda</label><select value={form.moneda} onChange={e=>setForm(f=>({...f,moneda:e.target.value}))}><option value="USD">USD</option><option value="ARS">ARS</option></select></div>
            <div className="form-row"><label>FX {form.moneda==='USD'?'(no aplica)':'*'}</label><input type="number" value={form.fx} onChange={e=>setForm(f=>({...f,fx:e.target.value}))} disabled={form.moneda==='USD'} required={form.moneda==='ARS'} placeholder="ej. 1425" /></div>
          </div>
          <div className="form-row"><label>Monto ({form.moneda}) *</label><input required type="number" step="0.01" value={form.monto} onChange={e=>setForm(f=>({...f,monto:e.target.value}))} placeholder="0.00" /></div>
          {form.moneda==='ARS'&&form.monto&&form.fx&&<div className="alert alert-info" style={{marginBottom:12}}>USD equiv.: <strong>{fmtUSD(Number(form.monto)/Number(form.fx))}</strong></div>}
          {esIngreso&&(
            <div className="form-row"><label>Estado</label><select value={String(form.es_forecast)} onChange={e=>setForm(f=>({...f,es_forecast:e.target.value==='true'}))}><option value="false">● Confirmado</option><option value="true">◌ Forecast</option></select></div>
          )}
          <div className="form-row"><label>Notas</label><input value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} placeholder="Opcional" /></div>
          <div className="modal-footer"><button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button><button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Guardar'}</button></div>
        </form>
      </div>
    </div>
  )
}

function SubTabOpCostos({ proyecto }) {
  const [registros, setRegistros] = useState([])
  const [cats, setCats]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [modal, setModal]         = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [saving, setSaving]       = useState(false)
  const emptyForm = {fecha:'',categoria_id:'',descripcion:'',moneda:'USD',monto:'',fx:'',notas:''}
  const [form, setForm]           = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { const [r,c]=await Promise.all([api.getOpCostos(proyecto.id),api.getCategorias('operacion_costo')]); setRegistros(r); setCats(c) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_op_costos').insert({
        proyecto_id:proyecto.id, fecha:form.fecha, categoria_id:form.categoria_id,
        descripcion:form.descripcion, moneda:form.moneda, monto:Number(form.monto),
        fx:Number(form.fx)||null, notas:form.notas||null,
      })
      if (error) { alert(error.message); return }
      setModal(false); setForm(emptyForm); await load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('cpt_op_costos').delete().eq('id',id); await load()
  }

  if (loading) return <div className="state-msg">Cargando costos operativos...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const total = registros.reduce((s,r)=>s+(r.monto_usd||0),0)
  const porCat = {}
  for (const r of registros) {
    const k=r.categoria_id
    if (!porCat[k]) porCat[k]={nombre:r.cpt_categorias?.nombre||'—',color:r.cpt_categorias?.color||'gray',total:0}
    porCat[k].total+=r.monto_usd||0
  }
  const maxCat=Math.max(...Object.values(porCat).map(c=>c.total),1)

  return (
    <>
      {cats.length===0&&<div className="alert alert-warn">Sin categorías de costos operativos — agregá desde <strong>Categorías</strong></div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Por categoría</span></div>
          <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
            {Object.entries(porCat).sort((a,b)=>b[1].total-a[1].total).map(([k,c])=>(
              <div key={k}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:12}}><span className={`tag t-${c.color}`}>{c.nombre}</span><span className="mono" style={{color:'var(--r)'}}>{fmtUSD(c.total)}</span></div>
                <div className="prog-wrap"><div className="prog" style={{width:`${c.total/maxCat*100}%`,background:'#DC2626'}} /></div>
              </div>
            ))}
            {Object.keys(porCat).length===0&&<div className="state-msg" style={{padding:12}}>Sin registros</div>}
          </div>
          <div className="tbl-foot"><span style={{color:'var(--muted)'}}>Total: <strong className="cr">{fmtUSD(total)}</strong></span></div>
        </div>
        <div className="card" style={{marginBottom:0}}>
          <div className="card-hdr"><span className="card-title">Últimos registros</span><button className="btn" onClick={()=>setModal(true)}>+ Registrar</button></div>
          <div className="tbl-wrap" style={{maxHeight:220}}>
            <table>
              <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th style={{textAlign:'right'}}>USD</th></tr></thead>
              <tbody>
                {registros.slice(0,8).map(r=>(
                  <tr key={r.id}>
                    <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(r.fecha)}</td>
                    <td><span className={`tag t-${r.cpt_categorias?.color||'gray'}`}>{r.cpt_categorias?.nombre||'—'}</span></td>
                    <td style={{fontSize:11}}>{r.descripcion}</td>
                    <td className="mono cr" style={{textAlign:'right'}}>−{fmtUSD(r.monto_usd)}</td>
                  </tr>
                ))}
                {registros.length===0&&<tr><td colSpan={4} className="state-msg">Sin registros</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Todos los costos operativos</span><button className="btn" onClick={()=>setModal(true)}>+ Registrar</button></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Mon.</th><th>Monto orig.</th><th>FX</th><th style={{textAlign:'right'}}>USD equiv.</th><th>Notas</th><th></th></tr></thead>
            <tbody>
              {registros.length===0&&<tr><td colSpan={9} className="state-msg">Sin registros</td></tr>}
              {registros.map(r=>(
                <tr key={r.id}>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(r.fecha)}</td>
                  <td><span className={`tag t-${r.cpt_categorias?.color||'gray'}`}>{r.cpt_categorias?.nombre||'—'}</span></td>
                  <td style={{fontWeight:500}}>{r.descripcion}</td>
                  <td className="mono">{r.moneda}</td>
                  <td className="mono">{r.moneda==='ARS'?`$${Number(r.monto).toLocaleString('es-AR')}`:fmtUSD(r.monto)}</td>
                  <td className="mono" style={{color:'var(--muted)'}}>{r.fx?Number(r.fx).toLocaleString('es-AR'):'—'}</td>
                  <td className="mono cr" style={{textAlign:'right'}}>−{fmtUSD(r.monto_usd)}</td>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{r.notas||'—'}</td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn-ghost" style={{padding:'2px 8px',fontSize:10}} onClick={()=>setModalEditar(r)}>Editar</button>
                      <button className="btn-ghost" style={{padding:'2px 8px',fontSize:10,color:'var(--r)'}} onClick={()=>handleDelete(r.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>{registros.length} registros</span>
          <span style={{marginLeft:'auto',fontWeight:700,fontSize:13,color:'var(--r)'}}>Total: {fmtUSD(total)}</span>
        </div>
      </div>
      {modal&&<ModalOpRegistro titulo="Registrar costo operativo" cats={cats} form={form} setForm={setForm} saving={saving} onClose={()=>setModal(false)} onSubmit={handleSave} esIngreso={false} />}
      {modalEditar&&(
        <ModalOpRegistro
          titulo="Editar costo operativo"
          cats={cats}
          form={{
            fecha: modalEditar.fecha||'',
            categoria_id: modalEditar.categoria_id||'',
            descripcion: modalEditar.descripcion||'',
            moneda: modalEditar.moneda||'USD',
            monto: modalEditar.monto||'',
            fx: modalEditar.fx||'',
            notas: modalEditar.notas||'',
          }}
          setForm={(updater)=>{
            setModalEditar(prev => {
              const current = {fecha:prev.fecha||'',categoria_id:prev.categoria_id||'',descripcion:prev.descripcion||'',moneda:prev.moneda||'USD',monto:prev.monto||'',fx:prev.fx||'',notas:prev.notas||''}
              const next = typeof updater === 'function' ? updater(current) : updater
              return {...prev,...next}
            })
          }}
          saving={saving}
          onClose={()=>setModalEditar(null)}
          onSubmit={async(e)=>{
            e.preventDefault(); setSaving(true)
            try {
              const {error}=await supabase.from('cpt_op_costos').update({
                fecha:modalEditar.fecha, categoria_id:modalEditar.categoria_id,
                descripcion:modalEditar.descripcion, moneda:modalEditar.moneda,
                monto:Number(modalEditar.monto), fx:Number(modalEditar.fx)||null,
                notas:modalEditar.notas||null,
              }).eq('id',modalEditar.id)
              if (error) { alert(error.message); return }
              setModalEditar(null); await load()
            } finally { setSaving(false) }
          }}
          esIngreso={false}
        />
      )}
    </>
  )
}

function SubTabOpIngresos({ proyecto }) {
  const [registros, setRegistros] = useState([])
  const [cats, setCats]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [modal, setModal]         = useState(false)
  const [modalEditar, setModalEditar] = useState(null)
  const [saving, setSaving]       = useState(false)
  const emptyForm = {fecha:'',categoria_id:'',descripcion:'',moneda:'USD',monto:'',fx:'',notas:'',es_forecast:false}
  const [form, setForm]           = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { const [r,c]=await Promise.all([api.getOpIngresos(proyecto.id),api.getCategorias('operacion_ingreso')]); setRegistros(r); setCats(c) }
    catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { error } = await supabase.from('cpt_op_ingresos').insert({
        proyecto_id:proyecto.id, fecha:form.fecha, categoria_id:form.categoria_id,
        descripcion:form.descripcion, moneda:form.moneda, monto:Number(form.monto),
        fx:Number(form.fx)||null, notas:form.notas||null, es_forecast:form.es_forecast,
      })
      if (error) { alert(error.message); return }
      setModal(false); setForm(emptyForm); await load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar?')) return
    await supabase.from('cpt_op_ingresos').delete().eq('id',id); await load()
  }

  if (loading) return <div className="state-msg">Cargando ingresos operativos...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const totalReal     = registros.filter(r=>!r.es_forecast).reduce((s,r)=>s+(r.monto_usd||0),0)
  const totalForecast = registros.filter(r=>r.es_forecast).reduce((s,r)=>s+(r.monto_usd||0),0)

  return (
    <>
      {cats.length===0&&<div className="alert alert-warn">Sin categorías de ingresos operativos — agregá desde <strong>Categorías</strong></div>}
      <div className="kpi-row" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="kpi"><div className="kpi-lbl">Total confirmado</div><div className="kpi-val cg">{fmtUSD(totalReal)}</div><div className="kpi-sub">{registros.filter(r=>!r.es_forecast).length} registros reales</div></div>
        <div className="kpi"><div className="kpi-lbl">Forecast pendiente</div><div className="kpi-val cw">{fmtUSD(totalForecast)}</div><div className="kpi-sub">{registros.filter(r=>r.es_forecast).length} estimados</div></div>
        <div className="kpi"><div className="kpi-lbl">Total proyectado</div><div className="kpi-val cb">{fmtUSD(totalReal+totalForecast)}</div><div className="kpi-sub">Real + forecast</div></div>
      </div>
      <div className="card">
        <div className="card-hdr"><span className="card-title">Ingresos operativos</span><button className="btn" onClick={()=>setModal(true)}>+ Registrar</button></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Mon.</th><th>Monto orig.</th><th>FX</th><th style={{textAlign:'right'}}>USD equiv.</th><th>Estado</th><th>Notas</th><th></th></tr></thead>
            <tbody>
              {registros.length===0&&<tr><td colSpan={10} className="state-msg">Sin registros</td></tr>}
              {registros.map(r=>(
                <tr key={r.id} style={r.es_forecast?{opacity:.75}:{}}>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{fmtDate(r.fecha)}</td>
                  <td><span className={`tag t-${r.cpt_categorias?.color||'gray'}`}>{r.cpt_categorias?.nombre||'—'}</span></td>
                  <td style={{fontWeight:500}}>{r.descripcion}</td>
                  <td className="mono">{r.moneda}</td>
                  <td className="mono">{r.moneda==='ARS'?`$${Number(r.monto).toLocaleString('es-AR')}`:fmtUSD(r.monto)}</td>
                  <td className="mono" style={{color:'var(--muted)'}}>{r.fx?Number(r.fx).toLocaleString('es-AR'):'—'}</td>
                  <td className="mono cg" style={{textAlign:'right'}}>+{fmtUSD(r.monto_usd)}</td>
                  <td><span className={`chip ${r.es_forecast?'c-forecast':'c-ok'}`}>{r.es_forecast?'Forecast':'Confirmado'}</span></td>
                  <td style={{fontSize:11,color:'var(--muted)'}}>{r.notas||'—'}</td>
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      <button className="btn-ghost" style={{padding:'2px 8px',fontSize:10}} onClick={()=>setModalEditar(r)}>Editar</button>
                      <button className="btn-ghost" style={{padding:'2px 8px',fontSize:10,color:'var(--r)'}} onClick={()=>handleDelete(r.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-foot">
          <span style={{color:'var(--muted)'}}>Confirmado: <strong className="cg">{fmtUSD(totalReal)}</strong></span>
          <span style={{color:'var(--muted)'}}>Forecast: <strong className="cw">{fmtUSD(totalForecast)}</strong></span>
          <span style={{marginLeft:'auto',fontWeight:700}}>Total: {fmtUSD(totalReal+totalForecast)}</span>
        </div>
      </div>
      {modal&&<ModalOpRegistro titulo="Registrar ingreso operativo" cats={cats} form={form} setForm={setForm} saving={saving} onClose={()=>setModal(false)} onSubmit={handleSave} esIngreso={true} />}
      {modalEditar&&(
        <ModalOpRegistro
          titulo="Editar ingreso operativo"
          cats={cats}
          form={{
            fecha: modalEditar.fecha||'',
            categoria_id: modalEditar.categoria_id||'',
            descripcion: modalEditar.descripcion||'',
            moneda: modalEditar.moneda||'USD',
            monto: modalEditar.monto||'',
            fx: modalEditar.fx||'',
            notas: modalEditar.notas||'',
            es_forecast: modalEditar.es_forecast||false,
          }}
          setForm={(updater)=>{
            setModalEditar(prev => {
              const current = {fecha:prev.fecha||'',categoria_id:prev.categoria_id||'',descripcion:prev.descripcion||'',moneda:prev.moneda||'USD',monto:prev.monto||'',fx:prev.fx||'',notas:prev.notas||'',es_forecast:prev.es_forecast||false}
              const next = typeof updater === 'function' ? updater(current) : updater
              return {...prev,...next}
            })
          }}
          saving={saving}
          onClose={()=>setModalEditar(null)}
          onSubmit={async(e)=>{
            e.preventDefault(); setSaving(true)
            try {
              const {error}=await supabase.from('cpt_op_ingresos').update({
                fecha:modalEditar.fecha, categoria_id:modalEditar.categoria_id,
                descripcion:modalEditar.descripcion, moneda:modalEditar.moneda,
                monto:Number(modalEditar.monto), fx:Number(modalEditar.fx)||null,
                notas:modalEditar.notas||null, es_forecast:modalEditar.es_forecast,
              }).eq('id',modalEditar.id)
              if (error) { alert(error.message); return }
              setModalEditar(null); await load()
            } finally { setSaving(false) }
          }}
          esIngreso={true}
        />
      )}
    </>
  )
}

// ─── SUB TAB PRESUPUESTO OPERATIVO ────────────────────────────────────────────
function SubTabOpPresupuesto({ proyecto }) {
  const [presupuesto, setPresupuesto] = useState([])
  const [costos, setCostos]           = useState([])
  const [ingresos, setIngresos]       = useState([])
  const [catsCosto, setCatsCosto]     = useState([])
  const [catsIngreso, setCatsIngreso] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(null)
  const [editId, setEditId]           = useState(null)
  const [editVal, setEditVal]         = useState('')
  const [saving, setSaving]           = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [p,c,i,cc,ci] = await Promise.all([
        api.getOpPresupuesto(proyecto.id), api.getOpCostos(proyecto.id), api.getOpIngresos(proyecto.id),
        api.getCategorias('operacion_costo'), api.getCategorias('operacion_ingreso')
      ])
      setPresupuesto(p); setCostos(c); setIngresos(i); setCatsCosto(cc); setCatsIngreso(ci)
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [proyecto.id])

  useEffect(() => { load() }, [load])

  const handleUpsert = async (catId) => {
    const val = Number(editVal)
    if (!val||val<=0) return
    setSaving(true)
    try {
      const { error } = await supabase.from('cpt_op_presupuesto')
        .upsert({proyecto_id:proyecto.id,categoria_id:catId,monto_usd:val},{onConflict:'proyecto_id,categoria_id'})
      if (error) { alert(error.message); return }
      setEditId(null); setEditVal(''); await load()
    } finally { setSaving(false) }
  }

  const handleDeletePres = async (id) => {
    await supabase.from('cpt_op_presupuesto').delete().eq('id',id); await load()
  }

  if (loading) return <div className="state-msg">Cargando presupuesto operativo...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const costoRealPorCat = {}
  for (const c of costos) costoRealPorCat[c.categoria_id]=(costoRealPorCat[c.categoria_id]||0)+(c.monto_usd||0)
  const ingresoRealPorCat = {}
  for (const i of ingresos.filter(r=>!r.es_forecast)) ingresoRealPorCat[i.categoria_id]=(ingresoRealPorCat[i.categoria_id]||0)+(i.monto_usd||0)
  const presMap = {}
  for (const p of presupuesto) presMap[p.categoria_id]=p

  const totalPresC = catsCosto.reduce((s,c)=>s+(presMap[c.id]?.monto_usd||0),0)
  const totalRealC = costos.reduce((s,c)=>s+(c.monto_usd||0),0)
  const totalPresI = catsIngreso.reduce((s,c)=>s+(presMap[c.id]?.monto_usd||0),0)
  const totalRealI = ingresos.filter(r=>!r.es_forecast).reduce((s,r)=>s+(r.monto_usd||0),0)

  const renderPres = (cats, tipo) => (
    <div className="card">
      <div className="card-hdr"><span className="card-title">{tipo==='costo'?'Costos operativos':'Ingresos operativos'} — Presupuesto vs Real</span></div>
      {cats.length===0
        ? <div className="state-msg">Sin categorías — agregá desde <strong>Categorías</strong></div>
        : <>
            <div style={{display:'grid',gridTemplateColumns:'160px 1fr 110px 110px 90px 80px'}}>
              {['Categoría','Progreso','Presupuesto','Real','Desvío',''].map(h=>(
                <div key={h} style={{padding:'7px 12px',background:'#FAFBFC',borderBottom:'1px solid var(--border)',fontSize:10,fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:.4}}>{h}</div>
              ))}
            </div>
            {cats.map(cat=>{
              const pres=presMap[cat.id]?.monto_usd||0
              const real=tipo==='costo'?(costoRealPorCat[cat.id]||0):(ingresoRealPorCat[cat.id]||0)
              const pct=pres>0?Math.min(Math.round(real/pres*100),140):0
              const delta=real-pres
              const over=tipo==='costo'?delta>0:delta<0
              return (
                <div key={cat.id} style={{display:'grid',gridTemplateColumns:'160px 1fr 110px 110px 90px 80px',borderBottom:'1px solid var(--border)'}}>
                  <div style={{padding:'9px 12px'}}><span className={`tag t-${cat.color}`}>{cat.nombre}</span></div>
                  <div style={{padding:'9px 12px',display:'flex',alignItems:'center',gap:8}}>
                    {pres>0
                      ? <><div className="prog-wrap" style={{flex:1}}><div className="prog" style={{width:`${Math.min(pct,100)}%`,background:over?'#DC2626':tipo==='costo'?'#235C96':'#059669'}} /></div><span className="mono" style={{fontSize:10,color:over?'var(--r)':tipo==='costo'?'var(--blue)':'var(--g)',minWidth:32}}>{pct}%</span></>
                      : <span style={{fontSize:11,color:'var(--muted)',fontStyle:'italic'}}>Sin presupuesto</span>
                    }
                  </div>
                  <div style={{padding:'9px 12px'}}>
                    {editId===cat.id
                      ? <div style={{display:'flex',gap:4}}>
                          <input type="number" step="0.01" value={editVal} onChange={e=>setEditVal(e.target.value)} className="inline-edit" placeholder="USD" autoFocus onKeyDown={e=>{if(e.key==='Enter')handleUpsert(cat.id);if(e.key==='Escape'){setEditId(null);setEditVal('')}}} />
                          <button className="btn" style={{padding:'3px 7px',fontSize:10}} onClick={()=>handleUpsert(cat.id)} disabled={saving}>✓</button>
                        </div>
                      : <span className="mono" style={{cursor:'pointer',color:pres>0?'var(--text)':'var(--muted)'}} onClick={()=>{setEditId(cat.id);setEditVal(pres?String(pres):'')}}>
                          {pres>0?fmtUSD(pres):<span style={{fontSize:10,fontStyle:'italic'}}>Clic para fijar</span>}
                        </span>
                    }
                  </div>
                  <div style={{padding:'9px 12px'}}><span className="mono" style={{color:real>0?tipo==='costo'?'var(--r)':'var(--g)':'var(--muted)'}}>{real>0?fmtUSD(real):'—'}</span></div>
                  <div style={{padding:'9px 12px'}}><span className="mono" style={{fontWeight:700,color:over?'#DC2626':delta===0||pres===0?'var(--muted)':'#059669'}}>{pres>0&&real>0?(delta>0?'+':'')+fmtUSD(delta):'—'}</span></div>
                  <div style={{padding:'9px 12px'}}>{pres>0&&<button className="btn-ghost" style={{padding:'2px 8px',fontSize:10,color:'var(--r)'}} onClick={()=>handleDeletePres(presMap[cat.id].id)}>✕</button>}</div>
                </div>
              )
            })}
            <div className="tbl-foot">
              <span style={{color:'var(--muted)'}}>Presupuesto: <strong>{fmtUSD(tipo==='costo'?totalPresC:totalPresI)}</strong></span>
              <span style={{color:'var(--muted)'}}>Real: <strong style={{color:tipo==='costo'?'var(--r)':'var(--g)'}}>{fmtUSD(tipo==='costo'?totalRealC:totalRealI)}</strong></span>
              {(tipo==='costo'?totalPresC:totalPresI)>0&&(()=>{const d=(tipo==='costo'?totalRealC:totalRealI)-(tipo==='costo'?totalPresC:totalPresI);return <span style={{marginLeft:'auto',fontWeight:700,color:(tipo==='costo'?d>0:d<0)?'var(--r)':'var(--g)'}}>{(d>0?'+':'')+fmtUSD(d)}</span>})()}
            </div>
          </>
      }
    </div>
  )

  return (
    <>
      <div className="kpi-row" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="kpi"><div className="kpi-lbl">Ingreso operativo real</div><div className="kpi-val cg">{fmtUSD(totalRealI)}</div><div className="kpi-sub">Confirmados</div></div>
        <div className="kpi"><div className="kpi-lbl">Costo operativo real</div><div className="kpi-val cr">{fmtUSD(totalRealC)}</div><div className="kpi-sub">Todos los registros</div></div>
        <div className="kpi"><div className="kpi-lbl">Resultado operativo</div><div className="kpi-val" style={{color:totalRealI-totalRealC>=0?'#059669':'#DC2626'}}>{fmtUSD(totalRealI-totalRealC)}</div><div className="kpi-sub">Ingreso − Costo</div></div>
      </div>
      {renderPres(catsCosto,'costo')}
      {renderPres(catsIngreso,'ingreso')}
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
  const [form, setForm]       = useState({nombre:'',descripcion:'',color:'blue',tipo:'facturable'})

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
      setModal(false); setForm({nombre:'',descripcion:'',color:'blue',tipo:'facturable'}); await load()
    } finally { setSaving(false) }
  }

  const toggleActiva = async (cat) => {
    const { error } = await supabase.from('cpt_categorias').update({activa:!cat.activa}).eq('id',cat.id)
    if (error) { alert(error.message); return }
    await load()
  }

  if (loading) return <div className="state-msg">Cargando categorías...</div>
  if (error)   return <div className="alert alert-err">Error: {error}</div>

  const TIPO_LABEL = {facturable:'Facturables',operacion_costo:'Operación — Costos',operacion_ingreso:'Operación — Ingresos'}
  const grupos = ['facturable','operacion_costo','operacion_ingreso']

  return (
    <>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
        <div>
          {grupos.map(tipo=>{
            const grupo=cats.filter(c=>c.tipo===tipo)
            return (
              <div key={tipo} className="card">
                <div className="card-hdr"><span className="card-title">{TIPO_LABEL[tipo]}</span><button className="btn" onClick={()=>{setForm({nombre:'',descripcion:'',color:'blue',tipo});setModal(true)}}>+ Nueva</button></div>
                <div style={{padding:8}}>
                  <table>
                    <thead><tr><th>Nombre</th><th>Descripción</th><th>Activa</th></tr></thead>
                    <tbody>
                      {grupo.length===0&&<tr><td colSpan={3} className="state-msg" style={{padding:12}}>Sin categorías</td></tr>}
                      {grupo.map(c=>(
                        <tr key={c.id} style={{opacity:c.activa?1:.5}}>
                          <td><span className={`tag t-${c.color}`}>{c.nombre}</span></td>
                          <td style={{fontSize:11,color:'var(--muted)'}}>{c.descripcion||'—'}</td>
                          <td><button className="btn-ghost" style={{fontSize:10,padding:'3px 9px',color:c.activa?'var(--g)':'var(--muted)'}} onClick={()=>toggleActiva(c)}>{c.activa?'✓ Activa':'Inactiva'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
        <div className="card" style={{alignSelf:'start'}}>
          <div className="card-hdr"><span className="card-title">¿Por qué un catálogo controlado?</span></div>
          <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10,fontSize:12}}>
            <div className="alert alert-err">Sin catálogo, texto libre genera duplicados: "Bunkering" · "bunkering costo" · "BUNK" → 3 categorías.</div>
            <div className="alert alert-ok">Con catálogo: cada registro elige de un selector. Renombrar actualiza todo.</div>
            <div className="alert alert-info">Categorías de Operación → se usan en los sub-tabs de Costos e Ingresos operativos. Facturables → OC e ítems cotizados.</div>
          </div>
        </div>
      </div>

      {modal&&(
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h3>Nueva Categoría</h3>
            <form onSubmit={handleSave}>
              <div className="form-row"><label>Nombre *</label><input required value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="ej. Bunkering costo" /></div>
              <div className="form-row"><label>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm(f=>({...f,descripcion:e.target.value}))} /></div>
              <div className="two-col">
                <div className="form-row"><label>Tipo *</label><select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))}><option value="facturable">Facturables</option><option value="operacion_costo">Operación — Costos</option><option value="operacion_ingreso">Operación — Ingresos</option></select></div>
                <div className="form-row"><label>Color</label><select value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}><option value="blue">Azul</option><option value="orange">Naranja</option><option value="green">Verde</option><option value="purple">Violeta</option><option value="red">Rojo</option><option value="gray">Gris</option></select></div>
              </div>
              {form.nombre&&<div style={{marginBottom:12}}><span style={{fontSize:11,color:'var(--muted)',marginRight:8}}>Preview:</span><span className={`tag t-${form.color}`}>{form.nombre}</span></div>}
              <div className="modal-footer"><button type="button" className="btn-ghost" onClick={()=>setModal(false)}>Cancelar</button><button type="submit" className="btn" disabled={saving}>{saving?'Guardando...':'Crear'}</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

// ─── COST TRACKER APP ─────────────────────────────────────────────────────────
function CostTrackerApp({ session }) {
  const [mainTab, setMainTab]       = useState('overview')
  const [subTab, setSubTab]         = useState(null)
  const [proyectos, setProyectos]   = useState([])
  const [proyectoId, setProyectoId] = useState(() => localStorage.getItem('cpt_proyecto_id')||'')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [savingP, setSavingP]       = useState(false)
  const [errorP, setErrorP]         = useState('')
  const [formP, setFormP]           = useState({nombre:'',cliente:'',descripcion:'',fecha_inicio:'',fecha_fin_est:''})

  const SUB_TABS = {
    facturables:   [{id:'presupuesto',label:'Presupuesto vs Real'},{id:'costos',label:'OC y Facturas'},{id:'ingresos',label:'Ingresos'}],
    nofacturables: [{id:'preparacion',label:'Preparación Barco'},{id:'oc_nofact',label:'OC y Facturas'}],
    operacion:     [{id:'op_costos',label:'Costos operativos'},{id:'op_ingresos',label:'Ingresos operativos'},{id:'op_presupuesto',label:'Presupuesto'}],
  }

  const loadProyectos = useCallback(async () => {
    try {
      const data = await api.getProyectos()
      setProyectos(data)
      const saved = localStorage.getItem('cpt_proyecto_id')
      if (!saved&&data.length===1) { setProyectoId(data[0].id); localStorage.setItem('cpt_proyecto_id',data[0].id) }
    } catch(e) { console.error('Error cargando proyectos:',e.message) }
  }, [])

  useEffect(() => { loadProyectos() }, [loadProyectos])

  const proyecto = proyectos.find(p=>p.id===proyectoId)||null

  const selProyecto = (id) => {
    setProyectoId(id); localStorage.setItem('cpt_proyecto_id',id)
    setMainTab('overview'); setSubTab(null)
  }

  const selectMainTab = (id) => {
    setMainTab(id)
    const subs = SUB_TABS[id]
    setSubTab(subs?subs[0].id:null)
  }

  const handleNuevo = async (e) => {
    e.preventDefault(); setSavingP(true); setErrorP('')
    try {
      const { data, error } = await supabase.from('cpt_proyectos')
        .insert({...formP,estado:'activo',moneda_base:'USD',created_by:session.user.id})
        .select('id').single()
      if (error) { setErrorP('No se pudo crear: '+error.message); return }
      setModalNuevo(false); setFormP({nombre:'',cliente:'',descripcion:'',fecha_inicio:'',fecha_fin_est:''})
      await loadProyectos(); selProyecto(data.id)
    } catch(e) { setErrorP('Error de conexión: '+e.message) }
    finally { setSavingP(false) }
  }

  const MAIN_TABS = [
    {id:'overview',      label:'Overview'},
    {id:'facturables',   label:'Facturables'},
    {id:'nofacturables', label:'No Facturables'},
    {id:'operacion',     label:'Operación'},
    {id:'cashflow',      label:'Cashflow'},
    {id:'categorias',    label:'Categorías'},
  ]

  const currentSubs    = SUB_TABS[mainTab]||null
  const activeSubTab   = currentSubs?(subTab||currentSubs[0].id):null

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

        <nav className="tabs-main">
          {MAIN_TABS.map(t=>(
            <a key={t.id} className={`tab${mainTab===t.id?' active':''}`} onClick={()=>selectMainTab(t.id)} style={{cursor:'pointer'}}>{t.label}</a>
          ))}
        </nav>

        {currentSubs&&(
          <div className="tabs-sub">
            {currentSubs.map(s=>(
              <button key={s.id} className={`stab${activeSubTab===s.id?' active':''}`} onClick={()=>setSubTab(s.id)}>{s.label}</button>
            ))}
          </div>
        )}

        <div className="main">
          {!proyecto
            ? <div className="state-msg" style={{marginTop:60}}>
                <p style={{fontSize:15,fontWeight:700,color:'var(--navy)',marginBottom:8}}>Seleccioná un proyecto para comenzar</p>
                <p>o creá uno nuevo con el botón <strong>+ Proyecto</strong> arriba a la derecha</p>
              </div>
            : <>
                {mainTab==='overview'                                          && <TabOverview       proyecto={proyecto} />}
                {mainTab==='facturables' && activeSubTab==='presupuesto'       && <TabPresupuesto    proyecto={proyecto} />}
                {mainTab==='facturables' && activeSubTab==='costos'            && <TabCostos         proyecto={proyecto} />}
                {mainTab==='facturables' && activeSubTab==='ingresos'          && <TabIngresos       proyecto={proyecto} />}
                {mainTab==='nofacturables' && activeSubTab==='preparacion'     && <SubTabPrepBarco   proyecto={proyecto} />}
                {mainTab==='nofacturables' && activeSubTab==='oc_nofact'       && <SubTabOCNoFact    proyecto={proyecto} />}
                {mainTab==='operacion' && activeSubTab==='op_costos'           && <SubTabOpCostos    proyecto={proyecto} />}
                {mainTab==='operacion' && activeSubTab==='op_ingresos'         && <SubTabOpIngresos  proyecto={proyecto} />}
                {mainTab==='operacion' && activeSubTab==='op_presupuesto'      && <SubTabOpPresupuesto proyecto={proyecto} />}
                {mainTab==='cashflow'                                          && <TabCashflow       proyecto={proyecto} />}
                {mainTab==='categorias'                                        && <TabCategorias />}
              </>
          }
        </div>
      </div>

      {modalNuevo&&(
        <div className="overlay open" onClick={e=>e.target===e.currentTarget&&setModalNuevo(false)}>
          <div className="modal">
            <h3>Nuevo Proyecto</h3>
            <form onSubmit={handleNuevo}>
              {errorP&&<div className="alert alert-err">{errorP}</div>}
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
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); setLoading(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { setSession(session) })
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
