import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/layout/Layout'
import Overview from './pages/Overview/Overview'
import Presupuesto from './pages/Presupuesto/Presupuesto'
import OC from './pages/OC/OC'
import Facturas from './pages/Facturas/Facturas'
import Ingresos from './pages/Ingresos/Ingresos'
import Cashflow from './pages/Cashflow/Cashflow'
import Categorias from './pages/Categorias/Categorias'

const ERP_HOME_URL = 'https://integra.terra-mare.com.ar'
const MODULO_ID    = 'cost-tracker'

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --navy:   #0B1629;
  --navy2:  #132040;
  --gold:   #B8942A;
  --gold2:  #D4AA3A;
  --blue:   #235C96;
  --bg:     #0d1117;
  --bg2:    #161b22;
  --bg3:    #21262d;
  --border: #30363d;
  --text:   #e6edf3;
  --muted:  #8b949e;
  --g:      #10b981;
  --danger: #ef4444;
  --warn:   #f59e0b;
  --accent: #3b82f6;
  --sans:   'Montserrat', sans-serif;
  --mono:   'DM Mono', monospace;
}
body { font-family: var(--sans); background: var(--bg); color: var(--text); min-height: 100vh; }

/* LOADING */
.loading-screen { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--navy); }
.loading-text { font-family: var(--mono); font-size: 10px; color: rgba(255,255,255,0.3); letter-spacing: 3px; text-transform: uppercase; }

/* LOGIN */
.login-page { min-height: 100vh; display: flex; background: var(--navy); position: relative; overflow: hidden; }
.login-bg-lines { position: absolute; inset: 0; z-index: 0; background-image: linear-gradient(rgba(184,148,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(184,148,42,0.04) 1px, transparent 1px); background-size: 60px 60px; }
.login-bg-overlay { position: absolute; inset: 0; z-index: 1; background: linear-gradient(135deg, rgba(11,22,41,0.92) 0%, rgba(11,22,41,0.75) 60%, rgba(11,22,41,0.92) 100%); }
.login-split { position: relative; z-index: 2; display: flex; width: 100%; }
.login-left { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 80px 60px; border-right: 1px solid rgba(184,148,42,0.15); }
.login-left-eyebrow { font-family: var(--mono); font-size: 10px; letter-spacing: 3px; color: var(--gold); text-transform: uppercase; margin-bottom: 20px; }
.login-left-title { font-size: 48px; font-weight: 900; color: #fff; line-height: 0.95; letter-spacing: -2px; margin-bottom: 0; }
.login-left-title span { color: var(--gold); display: block; }
.login-left-line { width: 48px; height: 3px; background: var(--gold); margin: 20px 0; }
.login-left-sub { font-size: 13px; color: rgba(255,255,255,0.45); line-height: 1.7; max-width: 320px; font-style: italic; }
.login-right { width: 440px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 60px 48px; }
.login-card { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(184,148,42,0.2); border-radius: 16px; padding: 40px 36px; backdrop-filter: blur(20px); }
.login-card-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 4px; }
.login-card-sub { font-family: var(--mono); font-size: 10px; color: rgba(255,255,255,0.35); letter-spacing: 1px; margin-bottom: 28px; text-transform: uppercase; }
.login-fg { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.login-fg label { font-size: 9px; color: rgba(255,255,255,0.4); letter-spacing: 1px; text-transform: uppercase; font-weight: 600; }
.login-fg input { border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 11px 14px; font-size: 13px; font-family: var(--sans); color: #fff; background: rgba(255,255,255,0.06); outline: none; transition: border-color .15s; width: 100%; }
.login-fg input::placeholder { color: rgba(255,255,255,0.2); }
.login-fg input:focus { border-color: var(--gold); }
.login-btn { width: 100%; padding: 12px; margin-top: 8px; background: var(--gold); color: var(--navy); border: none; border-radius: 8px; font-family: var(--sans); font-size: 13px; font-weight: 700; cursor: pointer; transition: background .15s; letter-spacing: .5px; }
.login-btn:hover { background: var(--gold2); }
.login-btn:disabled { opacity: .5; cursor: not-allowed; }
.login-error { background: rgba(239,68,68,0.12); color: #FCA5A5; border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-bottom: 14px; }
.login-footer { text-align: center; font-family: var(--mono); font-size: 9px; color: rgba(255,255,255,0.2); margin-top: 20px; letter-spacing: 1px; }
.login-back { text-align: center; margin-top: 12px; font-size: 11px; color: rgba(255,255,255,0.3); cursor: pointer; font-family: var(--mono); }
.login-back:hover { color: var(--gold); }

/* SIN ACCESO */
.sin-acceso-screen { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--navy); gap: 16px; padding: 24px; text-align: center; }
.sin-acceso-msg { font-size: 14px; color: #FCA5A5; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.25); border-radius: 10px; padding: 16px 24px; max-width: 380px; }
.sin-acceso-btn { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); font-family: var(--sans); font-size: 12px; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
.sin-acceso-btn:hover { color: #fff; border-color: rgba(255,255,255,0.4); }

/* RESPONSIVE MOBILE */
@media (max-width: 640px) {
  .login-split { flex-direction: column; }
  .login-left { display: none; }
  .login-right { width: 100%; padding: 40px 24px; }
}
`

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage() {
  const [email, setEmail]     = useState('')
  const [pass, setPass]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
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
          <div className="login-left-title">
            PARANA<span>LOGÍSTICA</span>
          </div>
          <div className="login-left-line" />
          <div className="login-left-sub">
            Control de costos, órdenes de compra y márgenes de proyecto en tiempo real.
          </div>
        </div>
        <div className="login-right">
          <div className="login-card">
            <div className="login-card-title">Acceso al módulo</div>
            <div className="login-card-sub">Solo personal autorizado</div>
            {error && <div className="login-error">{error}</div>}
            <div className="login-fg">
              <label>Email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKey}
                placeholder="usuario@paranalogistica.com.ar"
                autoFocus
              />
            </div>
            <div className="login-fg">
              <label>Contraseña</label>
              <input
                type="password" value={pass}
                onChange={e => setPass(e.target.value)}
                onKeyDown={handleKey}
                placeholder="••••••••"
              />
            </div>
            <button className="login-btn" onClick={handleLogin} disabled={loading || !email || !pass}>
              {loading ? 'Ingresando...' : 'Ingresar →'}
            </button>
            <div className="login-footer">Parana Logística · Acceso restringido</div>
            <div className="login-back" onClick={() => window.location.href = ERP_HOME_URL}>
              ← Volver al Portal
            </div>
          </div>
        </div>
      </div>
    </div>
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
      const { data } = await supabase
        .from('user_roles')
        .select('modulos')
        .eq('user_id', userId)
        .maybeSingle()
      const modulos = data?.modulos || []
      setAutorizado(modulos.length === 0 || modulos.includes(MODULO_ID))
    } catch {
      setAutorizado(false)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="loading-screen">
          <div className="loading-text">Cargando...</div>
        </div>
      </>
    )
  }

  if (!session) {
    return (
      <>
        <style>{CSS}</style>
        <LoginPage />
      </>
    )
  }

  if (!autorizado) {
    return (
      <>
        <style>{CSS}</style>
        <div className="sin-acceso-screen">
          <div className="sin-acceso-msg">
            Tu usuario no tiene acceso a este módulo.<br />
            Contactá al administrador del sistema.
          </div>
          <button className="sin-acceso-btn" onClick={() => supabase.auth.signOut()}>
            Cerrar sesión
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <style>{CSS}</style>
      <Routes>
        <Route element={<Layout session={session} />}>
          <Route index                element={<Navigate to="/overview" replace />} />
          <Route path="overview"      element={<Overview />} />
          <Route path="presupuesto"   element={<Presupuesto />} />
          <Route path="oc"            element={<OC />} />
          <Route path="facturas"      element={<Facturas />} />
          <Route path="ingresos"      element={<Ingresos />} />
          <Route path="cashflow"      element={<Cashflow />} />
          <Route path="categorias"    element={<Categorias />} />
          <Route path="*"             element={<Navigate to="/overview" replace />} />
        </Route>
      </Routes>
    </>
  )
}
