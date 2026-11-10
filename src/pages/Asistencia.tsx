import { useEffect, useState } from 'react'
import { DIAS, diaSemana, fmtFecha, hhmm, hoy, horaServidor, spCalcularAsistencia, spMarcarAsistencia, useDB, type ResumenAsistencia } from '../db'
import type { PageProps } from '../types'
import { Alert, Badge, Btn, Card, CardTitle, Field, Input, Note, PageTitle, Select, Table, Td, useMsg } from '../ui'

export function MiAsistencia({ sess }: PageProps) {
  const d = useDB()
  const { msg, run } = useMsg()
  const [reloj, setReloj] = useState(horaServidor())
  useEffect(() => { const t = setInterval(() => setReloj(horaServidor()), 1000); return () => clearInterval(t) }, [])
  const p = d.Personal.find((x) => x.IdPersonal === sess.IdPersonal)!
  const hoyA = d.Asistencia.find((a) => a.IdPersonal === sess.IdPersonal && a.Fecha === hoy())
  const ultimas = d.Asistencia.filter((a) => a.IdPersonal === sess.IdPersonal).sort((a, b) => b.Fecha.localeCompare(a.Fecha)).slice(0, 10)
  const tard = hoyA?.MinutosTardanza ?? 0
  const marcar = (t: 'ENTRADA' | 'SALIDA') => run(() => spMarcarAsistencia(sess.IdPersonal, t), t === 'ENTRADA' ? 'Entrada registrada.' : 'Salida registrada.')
  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Mi asistencia</PageTitle>
      <Card className="mb-5">
        <Alert msg={msg} />
        <div className="flex items-start justify-between">
          <div>
            <div className="text-muted">Hoy · {fmtFecha(hoy())}</div>
            <div className="text-[34px] font-bold tabular-nums leading-tight">{reloj}</div>
            <div className="mt-1 text-[12.5px]">Mi horario: entrada {hhmm(p.HoraEntradaProgramada)} · salida {hhmm(p.HoraSalidaProgramada)}</div>
          </div>
          <div className="flex gap-3">
            <Btn disabled={!!hoyA} onClick={() => marcar('ENTRADA')}>Marcar entrada</Btn>
            <Btn variant="ghost" disabled={!hoyA || !!hoyA.HoraSalida} onClick={() => marcar('SALIDA')}>Marcar salida</Btn>
          </div>
        </div>
        {hoyA?.HoraEntrada && (
          <div className="mt-3 rounded-md bg-canvas px-3 py-2">
            Entrada registrada {hhmm(hoyA.HoraEntrada)}{hoyA.HoraSalida && <> · Salida {hhmm(hoyA.HoraSalida)}</>} · {tard > 0 ? <b>Tardanza {tard} min</b> : <b>Puntual</b>}
          </div>
        )}
      </Card>
      <Card>
        <CardTitle>Mis últimas marcaciones</CardTitle>
        <Table head={['Fecha', 'Entrada', 'Salida', 'Min. tardanza', 'Min. extra', 'Estado']} empty="Aún no hay marcaciones.">
          {ultimas.map((a) => (
            <tr key={a.IdAsistencia}>
              <Td>{DIAS[diaSemana(a.Fecha)].slice(0, 3)} {fmtFecha(a.Fecha)}</Td><Td>{hhmm(a.HoraEntrada)}</Td><Td>{hhmm(a.HoraSalida)}</Td>
              <Td>{a.MinutosTardanza}</Td><Td>{a.HoraSalida ? a.MinutosExtra : '—'}</Td>
              <Td><Badge>{a.Estado}</Badge></Td>
            </tr>
          ))}
        </Table>
        <Note>sp_MarcarAsistencia_MACP usa la hora del servidor: una entrada por día; la salida exige entrada previa</Note>
      </Card>
    </>
  )
}

export function AsistenciaPersonal({ sess }: PageProps) {
  const d = useDB()
  const { msg, setMsg } = useMsg()
  const now = new Date()
  const [anio, setAnio] = useState(String(now.getFullYear()))
  const [mes, setMes] = useState(String(now.getMonth() + 1))
  const [trab, setTrab] = useState('')
  const [rows, setRows] = useState<ResumenAsistencia[] | null>(null)
  const calcular = async () => {
    try { setRows(await spCalcularAsistencia(+anio, +mes, trab ? +trab : null)); setMsg(null) } catch (e) { setRows(null); setMsg({ tipo: 'error', texto: (e as Error).message }) }
  }
  useEffect(() => { void calcular() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Asistencia del personal</PageTitle>
      <Card>
        <div className="mb-4 grid grid-cols-[120px_180px_1fr_auto] items-end gap-3">
          <Field label="Año"><Input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} /></Field>
          <Field label="Mes"><Select value={mes} onChange={(e) => setMes(e.target.value)}>{meses.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</Select></Field>
          <Field label="Trabajador (opcional)">
            <Select value={trab} onChange={(e) => setTrab(e.target.value)}>
              <option value="">Todos</option>
              {d.Personal.filter((p) => p.Estado === 'Activo').map((p) => <option key={p.IdPersonal} value={p.IdPersonal}>{p.Nombre} {p.Apellido}</option>)}
            </Select>
          </Field>
          <Btn onClick={calcular}>Calcular</Btn>
        </div>
        <Alert msg={msg} />
        {rows && (
          <>
            <CardTitle>Resumen mensual por trabajador</CardTitle>
            <Table head={['Trabajador', 'Cargo', 'Días asistidos', 'Min. tardanza', 'Ausencias', 'Horas extras']}>
              {rows.map((r) => (
                <tr key={r.IdPersonal}><Td>{r.Trabajador}</Td><Td>{r.Cargo}</Td><Td>{r.DiasAsistidos}</Td><Td>{r.TardanzasMinutos}</Td><Td>{r.Ausencias}</Td><Td>{r.HorasExtras.toFixed(1)}</Td></tr>
              ))}
            </Table>
          </>
        )}
        <Note>sp_CalcularAsistencia_MACP: días laborables lunes a viernes; ausencia = día laborable sin entrada</Note>
      </Card>
    </>
  )
}
