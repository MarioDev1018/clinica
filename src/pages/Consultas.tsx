import { useState } from 'react'
import { fmtFecha, hhmm, spRegistrarConsulta, useDB } from '../db'
import type { PageProps } from '../types'
import { Alert, Btn, Card, CardTitle, Field, Input, Note, PageTitle, Select, Table, Td, soles, useMsg } from '../ui'

export default function Consultas({ sess, params }: PageProps) {
  const d = useDB()
  const { msg, run } = useMsg()
  const [cita, setCita] = useState(params?.IdCita ? String(params.IdCita) : '')
  const [diag, setDiag] = useState('')
  const [obs, setObs] = useState('')
  const [insumo, setInsumo] = useState('')
  const [cant, setCant] = useState('1')
  const [trats, setTrats] = useState<{ IdTratamiento: number; Indicaciones: string; DuracionDias: number }[]>([])
  const [exams, setExams] = useState<{ IdExamen: number; Indicaciones: string }[]>([])
  const [nt, setNt] = useState({ id: '', ind: '', dias: '7' })
  const [ne, setNe] = useState({ id: '', ind: '' })

  const programadas = d.Cita.filter((c) => c.Estado === 'Programada')
  const sel = d.Cita.find((c) => c.IdCita === +cita)
  const pac = sel && d.Paciente.find((p) => p.IdPaciente === sel.IdPaciente)
  const med = sel && d.Medico.find((m) => m.IdMedico === sel.IdMedico)
  const insSel = d.Insumo.find((i) => i.IdInsumo === +insumo)

  const addT = () => {
    if (!nt.id) return
    if (trats.some((t) => t.IdTratamiento === +nt.id)) return run(() => { throw new Error('El tratamiento ya fue indicado en esta consulta.') }, '')
    if (!(+nt.dias > 0)) return run(() => { throw new Error('La duracion del tratamiento debe ser mayor que cero.') }, '')
    setTrats([...trats, { IdTratamiento: +nt.id, Indicaciones: nt.ind, DuracionDias: +nt.dias }]); setNt({ id: '', ind: '', dias: '7' })
  }
  const addE = () => {
    if (!ne.id) return
    if (exams.some((e) => e.IdExamen === +ne.id)) return run(() => { throw new Error('El examen ya fue ordenado en esta consulta.') }, '')
    setExams([...exams, { IdExamen: +ne.id, Indicaciones: ne.ind }]); setNe({ id: '', ind: '' })
  }
  const guardar = async () => {
    const ok = await run(async () => {
      if (!cita) throw new Error('Seleccione una cita programada.')
      if (!insumo) throw new Error('Seleccione el insumo usado.')
      await spRegistrarConsulta({ IdCita: +cita, Diagnostico: diag, Observaciones: obs, IdInsumo: +insumo, Cantidad: +cant }, trats, exams)
    }, 'Consulta registrada; stock descontado y cita marcada como Atendida.')
    if (ok) { setCita(''); setDiag(''); setObs(''); setInsumo(''); setCant('1'); setTrats([]); setExams([]) }
  }

  const hist = d.Consulta.map((c) => {
    const ci = d.Cita.find((x) => x.IdCita === c.IdCita)!
    const p = d.Paciente.find((x) => x.IdPaciente === ci.IdPaciente)!
    const m = d.Medico.find((x) => x.IdMedico === ci.IdMedico)!
    return { ...c, fecha: ci.FechaCita, hora: ci.HoraCita, paciente: `${p.Nombre} ${p.Apellido}`, medico: `${m.Nombre} ${m.Apellido}`, nT: d.DetalleTratamiento.filter((t) => t.IdConsulta === c.IdConsulta).length, nE: d.DetalleExamen.filter((t) => t.IdConsulta === c.IdConsulta).length }
  }).sort((a, b) => b.IdConsulta - a.IdConsulta)

  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Registrar consulta</PageTitle>
      <Card>
        <Alert msg={msg} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cita programada">
            <Select value={cita} onChange={(e) => setCita(e.target.value)}>
              <option value="">Seleccione…</option>
              {programadas.map((c) => <option key={c.IdCita} value={c.IdCita}>#{c.IdCita} · {fmtFecha(c.FechaCita)} {hhmm(c.HoraCita)} · {d.Paciente.find((p) => p.IdPaciente === c.IdPaciente)?.Nombre}</option>)}
            </Select>
          </Field>
          <Field label="Paciente / Médico"><Input disabled value={sel ? `${pac?.Nombre} ${pac?.Apellido} / ${med?.Nombre} ${med?.Apellido}` : ''} /></Field>
          <Field label="Diagnóstico"><Input value={diag} maxLength={500} onChange={(e) => setDiag(e.target.value)} /></Field>
          <Field label="Observaciones"><Input value={obs} maxLength={500} onChange={(e) => setObs(e.target.value)} /></Field>
          <Field label={`Insumo usado${insSel ? ` (stock: ${insSel.StockActual})` : ''}`}>
            <Select value={insumo} onChange={(e) => setInsumo(e.target.value)}>
              <option value="">Seleccione…</option>
              {d.Insumo.filter((i) => i.Estado === 'Activo').map((i) => <option key={i.IdInsumo} value={i.IdInsumo}>{i.Nombre} ({i.StockActual} {i.UnidadMedida})</option>)}
            </Select>
          </Field>
          <Field label="Cantidad"><Input type="number" min={1} value={cant} onChange={(e) => setCant(e.target.value)} /></Field>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-5">
          <div className="rounded-md border border-line p-4">
            <CardTitle action={<Btn variant="ghost" onClick={addT}>+ Agregar</Btn>}>Tratamientos</CardTitle>
            <div className="mb-3 grid grid-cols-[1fr_1fr_70px] gap-2">
              <Select value={nt.id} onChange={(e) => setNt({ ...nt, id: e.target.value })} aria-label="Tratamiento">
                <option value="">Tratamiento…</option>
                {d.Tratamiento.filter((t) => t.Estado === 'Activo').map((t) => <option key={t.IdTratamiento} value={t.IdTratamiento}>{t.Nombre}</option>)}
              </Select>
              <Input placeholder="Indicaciones" value={nt.ind} onChange={(e) => setNt({ ...nt, ind: e.target.value })} />
              <Input type="number" min={1} value={nt.dias} onChange={(e) => setNt({ ...nt, dias: e.target.value })} aria-label="Días" />
            </div>
            <Table head={['Tratamiento', 'Indicaciones', 'Días', '']} empty="Sin tratamientos.">
              {trats.map((t) => (
                <tr key={t.IdTratamiento}>
                  <Td>{d.Tratamiento.find((x) => x.IdTratamiento === t.IdTratamiento)?.Nombre}</Td><Td>{t.Indicaciones}</Td><Td>{t.DuracionDias}</Td>
                  <Td><button className="text-red-700" onClick={() => setTrats(trats.filter((x) => x !== t))}>Quitar</button></Td>
                </tr>
              ))}
            </Table>
          </div>
          <div className="rounded-md border border-line p-4">
            <CardTitle action={<Btn variant="ghost" onClick={addE}>+ Agregar</Btn>}>Exámenes</CardTitle>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Select value={ne.id} onChange={(e) => setNe({ ...ne, id: e.target.value })} aria-label="Examen">
                <option value="">Examen…</option>
                {d.Examen.filter((t) => t.Estado === 'Activo').map((t) => <option key={t.IdExamen} value={t.IdExamen}>{t.Nombre} · {soles(t.Costo)}</option>)}
              </Select>
              <Input placeholder="Indicaciones" value={ne.ind} onChange={(e) => setNe({ ...ne, ind: e.target.value })} />
            </div>
            <Table head={['Examen', 'Indicaciones', 'Costo', '']} empty="Sin exámenes.">
              {exams.map((t) => {
                const ex = d.Examen.find((x) => x.IdExamen === t.IdExamen)!
                return (
                  <tr key={t.IdExamen}>
                    <Td>{ex.Nombre}</Td><Td>{t.Indicaciones}</Td><Td>{soles(ex.Costo)}</Td>
                    <Td><button className="text-red-700" onClick={() => setExams(exams.filter((x) => x !== t))}>Quitar</button></Td>
                  </tr>
                )
              })}
            </Table>
          </div>
        </div>
        <Note>sp_RegistrarConsulta_MACP: consulta + descuento de stock + cita pasa a Atendida, todo en una transacción</Note>
        <div className="mt-4 flex justify-end"><Btn onClick={guardar}>Guardar consulta</Btn></div>
      </Card>

      <Card className="mt-5">
        <CardTitle>Consultas registradas</CardTitle>
        <Table head={['N°', 'Fecha cita', 'Paciente', 'Médico', 'Diagnóstico', 'Trat.', 'Exám.']}>
          {hist.map((h) => (
            <tr key={h.IdConsulta}><Td>{h.IdConsulta}</Td><Td>{fmtFecha(h.fecha)} {hhmm(h.hora)}</Td><Td>{h.paciente}</Td><Td>{h.medico}</Td><Td>{h.Diagnostico}</Td><Td>{h.nT}</Td><Td>{h.nE}</Td></tr>
          ))}
        </Table>
      </Card>
    </>
  )
}
