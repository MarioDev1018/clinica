import { useState } from 'react'
import { DIAS, diaSemana, fmtFecha, hhmm, hoy, spCancelarCita, spRegistrarCita, useDB, vwProximasCitas } from '../db'
import type { PageProps } from '../types'
import { Alert, Btn, Card, CardTitle, EstadoBadge, Field, Input, Note, PageTitle, Select, Table, Td, useMsg } from '../ui'

export default function Citas({ sess, go }: PageProps) {
  const d = useDB()
  const [filtro, setFiltro] = useState('')
  const { msg, run } = useMsg()
  const citas = vwProximasCitas(d).filter((c) => !filtro || c.Estado === filtro)
  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Citas</PageTitle>
      <Card>
        <CardTitle action={<Btn onClick={() => go('cita-nueva')}>+ Nueva cita</Btn>}>Todas las citas</CardTitle>
        <Alert msg={msg} />
        <div className="mb-3 w-48">
          <Select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            <option>Programada</option><option>Atendida</option><option>Cancelada</option>
          </Select>
        </div>
        <Table head={['Fecha', 'Hora', 'DNI', 'Paciente', 'Médico', 'Consultorio', 'Motivo', 'Estado', 'Acciones']}>
          {citas.map((c) => (
            <tr key={c.IdCita}>
              <Td>{fmtFecha(c.FechaCita)}</Td><Td>{hhmm(c.HoraCita)}</Td><Td>{c.DNIPaciente}</Td><Td>{c.Paciente}</Td><Td>{c.Medico}</Td><Td>{c.Consultorio}</Td><Td>{c.Motivo}</Td>
              <Td><EstadoBadge e={c.Estado} /></Td>
              <Td>
                {c.Estado === 'Programada' && (
                  <span className="flex gap-2">
                    <button className="text-brand underline" onClick={() => go('consultas', { IdCita: c.IdCita })}>Atender</button>
                    <button className="text-red-700 underline" onClick={() => confirm('¿Cancelar la cita?') && run(() => spCancelarCita(c.IdCita, sess.Usuario), `Cita ${c.IdCita} cancelada.`)}>Cancelar</button>
                  </span>
                )}
              </Td>
            </tr>
          ))}
        </Table>
        <Note>sp_CancelarCita_MACP: solo cancela citas Programadas; el trigger tr_AuditoriaCita_MACP registra el cambio.</Note>
      </Card>
    </>
  )
}

export function CitaNueva({ sess, go }: PageProps) {
  const d = useDB()
  const { msg, run } = useMsg()
  const [f, setF] = useState({ paciente: '', medico: '', consultorio: '', fecha: hoy(), hora: '09:00', motivo: '', proc: '' })
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }))
  // al elegir médico/fecha, sugiere el consultorio asignado para ese día y turno
  const sugerir = (medico: string, fecha: string, hora: string) => {
    if (!medico || !fecha) return ''
    const turno = hora < '13:00' ? 'Manana' : 'Tarde'
    const a = d.DetalleMedicoConsultorio.find((x) => x.IdMedico === +medico && x.DiaSemana === diaSemana(fecha) && x.Turno === turno)
    return a ? String(a.IdConsultorio) : ''
  }
  const cambiar = (k: 'medico' | 'fecha' | 'hora', v: string) => {
    const n = { ...f, [k]: v }
    setF({ ...n, consultorio: sugerir(n.medico, n.fecha, n.hora) || n.consultorio })
  }
  const guardar = async () => {
    let id = 0
    const ok = await run(async () => {
      if (!f.paciente || !f.medico || !f.consultorio) throw new Error('Seleccione paciente, médico y consultorio.')
      id = await spRegistrarCita({ IdPaciente: +f.paciente, IdMedico: +f.medico, IdConsultorio: +f.consultorio, IdPersonal: sess.IdPersonal, FechaCita: f.fecha, HoraCita: f.hora, Motivo: f.motivo, IdProcedimiento: f.proc ? +f.proc : null })
    }, 'Cita registrada.')
    if (ok) setTimeout(() => go('citas'), 700)
    return id
  }
  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Registrar cita</PageTitle>
      <Card>
        <CardTitle>Datos de la cita</CardTitle>
        <Alert msg={msg} />
        <div className="grid grid-cols-3 gap-4">
          <Field label="Paciente">
            <Select value={f.paciente} onChange={(e) => set('paciente', e.target.value)}>
              <option value="">Seleccione…</option>
              {d.Paciente.filter((p) => p.Estado === 'Activo').map((p) => <option key={p.IdPaciente} value={p.IdPaciente}>{p.DNI} · {p.Nombre} {p.Apellido}</option>)}
            </Select>
          </Field>
          <Field label="Médico">
            <Select value={f.medico} onChange={(e) => cambiar('medico', e.target.value)}>
              <option value="">Seleccione…</option>
              {d.Medico.filter((m) => m.Estado === 'Activo').map((m) => <option key={m.IdMedico} value={m.IdMedico}>{m.Nombre} {m.Apellido} · {d.Especialidad.find((e) => e.IdEspecialidad === m.IdEspecialidad)?.Nombre}</option>)}
            </Select>
          </Field>
          <Field label="Consultorio">
            <Select value={f.consultorio} onChange={(e) => set('consultorio', e.target.value)}>
              <option value="">Seleccione…</option>
              {d.Consultorio.filter((c) => c.Estado === 'Activo').map((c) => <option key={c.IdConsultorio} value={c.IdConsultorio}>{c.Numero}</option>)}
            </Select>
          </Field>
          <Field label="Fecha"><Input type="date" value={f.fecha} onChange={(e) => cambiar('fecha', e.target.value)} /></Field>
          <Field label="Hora"><Input type="time" value={f.hora} onChange={(e) => cambiar('hora', e.target.value)} /></Field>
          <Field label="Motivo" className="col-span-3"><Input value={f.motivo} maxLength={250} onChange={(e) => set('motivo', e.target.value)} /></Field>
          <Field label="Procedimiento (opcional)" className="col-span-2">
            <Select value={f.proc} onChange={(e) => set('proc', e.target.value)}>
              <option value="">Ninguno</option>
              {d.Procedimiento.filter((p) => p.Estado === 'Activo').map((p) => <option key={p.IdProcedimiento} value={p.IdProcedimiento}>{p.Nombre} · S/ {p.Costo.toFixed(2)}</option>)}
            </Select>
          </Field>
          <Field label="Registrado por"><Input value={sess.Nombre} disabled /></Field>
        </div>
        {f.fecha && <p className="mt-3 text-[11.5px] text-muted">Día de la semana: {DIAS[diaSemana(f.fecha)]}</p>}
        <div className="mt-4 rounded-md border border-line bg-canvas p-3">
          <div className="mb-1 font-semibold">Validaciones al guardar</div>
          <p className="text-[12px] text-muted">Paciente, médico, consultorio y personal activos · duración fija de 30 minutos · cita dentro del HorarioMedico · consultorio asignado al médico y turno · sin cruce de horarios</p>
        </div>
        <Note>sp_RegistrarCita_MACP registra citas de 30 minutos y, opcionalmente, el procedimiento en una transacción. Devuelve IdCita (OUTPUT).</Note>
        <div className="mt-4 flex justify-end gap-3">
          <Btn variant="ghost" onClick={() => go('citas')}>Cancelar</Btn>
          <Btn onClick={guardar}>Guardar cita</Btn>
        </div>
      </Card>
    </>
  )
}
