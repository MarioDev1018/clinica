import { useEffect, useState, type FormEvent } from 'react'
import { loadDB, setAuthToken, useDB, validarLogin } from './db'
import type { Page, Session, PageProps } from './types'
import { Alert, Btn, Card, Field, Input, cx, type Msg } from './ui'
import Panel from './pages/Panel'
import Citas, { CitaNueva } from './pages/Citas'
import Consultas from './pages/Consultas'
import Pacientes from './pages/Pacientes'
import Medicos from './pages/Medicos'
import Catalogos from './pages/Catalogos'
import { MiAsistencia, AsistenciaPersonal } from './pages/Asistencia'
import Reportes from './pages/Reportes'

const NAV: [Page, string][] = [
  ['panel', 'Panel'], ['citas', 'Citas'], ['consultas', 'Consultas'], ['pacientes', 'Pacientes'], ['medicos', 'Médicos y horarios'],
  ['catalogos', 'Catálogos'], ['asistencia', 'Mi asistencia'], ['asistenciaPersonal', 'Asistencia del personal'], ['reportes', 'Reportes'],
]
const NOMBRE_CLINICA = 'MACP'
const SKEY = 'clinica_macp_session'

function Login({ onLogin }: { onLogin: (s: Session) => Promise<void> }) {
  const [usuario, setUsuario] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState<Msg>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const session = await validarLogin(usuario, pass, pass !== '')
      await onLogin({ ...session })
    } catch (err) { setMsg({ tipo: 'error', texto: (err as Error).message }) }
  }
  return (
    <div className="login-screen">
      <div className="login-cover" aria-hidden="true">
        <img className="login-cover-image" src="/login-cover.jpg" alt="" onError={(event) => { event.currentTarget.hidden = true }} />
      </div>
      <main className="login-content">
        <section className="login-card" aria-labelledby="login-title">
          <header className="login-heading">
            <div>
              <h1 id="login-title" className="text-[20px] font-semibold">Clínica {NOMBRE_CLINICA}</h1>
              <p className="mt-1 text-[13px] text-muted">Iniciar sesión</p>
            </div>
            <div className="login-logo">
              <img src="/clinic-logo.svg" alt={`Logo de Clínica ${NOMBRE_CLINICA}`} onError={(event) => { event.currentTarget.hidden = true }} />
            </div>
          </header>
          <form onSubmit={submit} className="mx-auto mt-3 max-w-[260px] space-y-4">
            <Alert msg={msg} />
            <Field label="Usuario">
              <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus autoComplete="username" />
            </Field>
            <Field label="Contraseña">
              <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
            </Field>
            <Btn type="submit" className="w-full py-2.5">Ingresar</Btn>
          </form>
          <div className="mx-auto mt-4 w-full max-w-[260px] rounded border border-dashed border-amber-400 bg-note px-3 py-2 text-[11.5px]">
            La autenticación se valida contra el personal Activo de SQL Server.
          </div>
        </section>
      </main>
    </div>
  )
}

export default function App() {
  useDB()
  const [sess, setSess] = useState<Session | null>(() => { try { return JSON.parse(sessionStorage.getItem(SKEY) || 'null') } catch { return null } })
  const [loading, setLoading] = useState(Boolean(sess))
  const [dbError, setDbError] = useState('')
  const [nav, setNav] = useState<{ page: Page; params?: PageProps['params'] }>({ page: 'panel' })
  useEffect(() => {
    if (!sess) return
    if (!sess.Token) {
      sessionStorage.removeItem(SKEY)
      setSess(null)
      setLoading(false)
      return
    }
    setAuthToken(sess.Token)
    void loadDB().then(() => setLoading(false)).catch((error: unknown) => {
      setDbError(error instanceof Error ? error.message : 'No se pudo cargar la base de datos.')
      setLoading(false)
    })
  }, [])
  const login = async (session: Session) => {
    setAuthToken(session.Token)
    try {
      await loadDB()
      sessionStorage.setItem(SKEY, JSON.stringify(session))
      setSess(session)
      setDbError('')
    } catch (error) {
      setAuthToken(null)
      throw error
    }
  }
  const logout = () => {
    sessionStorage.removeItem(SKEY)
    setAuthToken(null)
    setSess(null)
    setNav({ page: 'panel' })
  }
  if (!sess) return <Login onLogin={login} />
  if (loading) return <div className="p-8 text-muted">Conectando con la base de datos clínica…</div>
  if (dbError) return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg p-7">
        <Alert msg={{ tipo: 'error', texto: dbError }} />
        <p className="mb-4 text-[13px]">No se pudo cargar la información de la clínica.</p>
        <div className="flex gap-3">
          <Btn onClick={() => { setLoading(true); void loadDB().then(() => setDbError('')).catch((error: unknown) => setDbError(error instanceof Error ? error.message : 'Error de conexión.')).finally(() => setLoading(false)) }}>Reintentar</Btn>
          <Btn variant="ghost" onClick={logout}>Cerrar sesión</Btn>
        </div>
      </Card>
    </div>
  )
  const go: PageProps['go'] = (page, params) => setNav({ page, params })
  const props: PageProps = { sess, go, params: nav.params }
  const active = nav.page === 'cita-nueva' ? 'citas' : nav.page
  const view = {
    panel: <Panel {...props} />, citas: <Citas {...props} />, 'cita-nueva': <CitaNueva {...props} />, consultas: <Consultas {...props} />,
    pacientes: <Pacientes {...props} />, medicos: <Medicos {...props} />, catalogos: <Catalogos {...props} />, asistencia: <MiAsistencia {...props} />,
    asistenciaPersonal: <AsistenciaPersonal {...props} />, reportes: <Reportes {...props} />,
  }[nav.page]
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[210px] shrink-0 flex-col bg-side p-3">
        <div className="px-3 py-2 text-[15px] font-bold">Clínica {NOMBRE_CLINICA}</div>
        <nav className="mt-3 flex flex-1 flex-col gap-1">
          {NAV.map(([p, label]) => (
            <button key={p} onClick={() => go(p)} className={cx('rounded-md border px-3 py-2 text-left text-[12.5px] leading-tight', active === p ? 'border-line bg-white font-semibold' : 'border-transparent text-ink/80 hover:bg-white/60')}>
              {label}
            </button>
          ))}
        </nav>
        <button onClick={logout} className="px-3 py-2 text-left text-[12.5px] text-ink/80 hover:text-ink">Cerrar sesión</button>
      </aside>
      <main className="min-w-0 flex-1 p-6">{view}</main>
    </div>
  )
}
