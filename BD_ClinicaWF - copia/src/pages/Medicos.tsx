import { useState } from 'react'
import { DIAS, agregarHorario, asignarConsultorio, guardarFila, hhmm, quitarAsignacion, quitarHorario, useDB, type Turno } from '../db'
import type { PageProps } from '../types'
import { Alert, Btn, Card, CardTitle, EstadoBadge, Field, Input, Modal, PageTitle, Select, Table, Td, cx, useMsg } from '../ui'

const vacio = { DNI: '', Nombre: '', Apellido: '', IdEspecialidad: '', Telefono: '', Correo: '', Estado: 'Activo' }

export default function Medicos({ sess }: PageProps) {
  const d = useDB()
  const { msg, run, setMsg } = useMsg()
  const [sel, setSel] = useState<number | null>(d.Medico[0]?.IdMedico ?? null)
  const [modal, setModal] = useState<null | { id?: number; f: typeof vacio }>(null)
  const [h, setH] = useState({ dia: '1', ini: '08:00', fin: '12:00' })
  const [a, setA] = useState({ cons: '', dia: '1', turno: 'Manana' })

  const guardar = async () => {
    if (!modal) return
    const { f, id } = modal
    await run(async () => {
      if (!f.Nombre.trim() || !f.Apellido.trim()) throw new Error('Nombre y apellido son obligatorios.')
      if (!f.IdEspecialidad) throw new Error('Seleccione una especialidad.')
      const nuevo = await guardarFila('Medico', { ...(id ? { IdMedico: id } : {}), ...f, IdEspecialidad: +f.IdEspecialidad }, sess.Usuario)
      setSel(nuevo); setModal(null)
    }, 'Médico guardado.')
  }
  const m = d.Medico.find((x) => x.IdMedico === sel)
  const horarios = d.HorarioMedico.filter((x) => x.IdMedico === sel).sort((p, q) => p.DiaSemana - q.DiaSemana || p.HoraInicio.localeCompare(q.HoraInicio))
  const asigs = d.DetalleMedicoConsultorio.filter((x) => x.IdMedico === sel).sort((p, q) => p.DiaSemana - q.DiaSemana)
  const nombreMod = (k: keyof typeof vacio, v: string) => setModal((p) => p && { ...p, f: { ...p.f, [k]: v } })

  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Médicos y horarios</PageTitle>
      <Alert msg={msg} />
      <Card className="mb-5">
        <CardTitle action={<Btn onClick={() => { setMsg(null); setModal({ f: vacio }) }}>+ Nuevo médico</Btn>}>Médicos</CardTitle>
        <div className="max-h-72 overflow-y-auto">
          <Table head={['DNI', 'Nombre', 'Especialidad', 'Teléfono', 'Estado', '']}>
            {d.Medico.map((x) => (
              <tr key={x.IdMedico} onClick={() => setSel(x.IdMedico)} className={cx('cursor-pointer hover:bg-canvas', sel === x.IdMedico && 'bg-blue-50')}>
                <Td>{x.DNI}</Td><Td>{x.Nombre} {x.Apellido}</Td><Td>{d.Especialidad.find((e) => e.IdEspecialidad === x.IdEspecialidad)?.Nombre}</Td><Td>{x.Telefono}</Td><Td><EstadoBadge e={x.Estado} /></Td>
                <Td>
                  <button className="text-brand underline" onClick={(e) => { e.stopPropagation(); setMsg(null); setModal({ id: x.IdMedico, f: { DNI: x.DNI, Nombre: x.Nombre, Apellido: x.Apellido, IdEspecialidad: String(x.IdEspecialidad), Telefono: x.Telefono ?? '', Correo: x.Correo ?? '', Estado: x.Estado } }) }}>Editar</button>
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      {m && (
        <div className="grid grid-cols-2 gap-5">
          <Card>
            <CardTitle action={<Btn variant="ghost" onClick={() => run(() => agregarHorario(m.IdMedico, +h.dia, h.ini, h.fin), 'Horario agregado.')}>+ Agregar</Btn>}>Horario del médico · {m.Nombre} {m.Apellido}</CardTitle>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Select value={h.dia} onChange={(e) => setH({ ...h, dia: e.target.value })} aria-label="Día">{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{DIAS[n]}</option>)}</Select>
              <Input type="time" value={h.ini} onChange={(e) => setH({ ...h, ini: e.target.value })} aria-label="Inicio" />
              <Input type="time" value={h.fin} onChange={(e) => setH({ ...h, fin: e.target.value })} aria-label="Fin" />
            </div>
            <Table head={['Día', 'Inicio', 'Fin', '']} empty="Sin horario.">
              {horarios.map((x) => (
                <tr key={x.IdHorarioMedico}><Td>{DIAS[x.DiaSemana]}</Td><Td>{hhmm(x.HoraInicio)}</Td><Td>{hhmm(x.HoraFin)}</Td><Td><button className="text-red-700" onClick={() => run(() => quitarHorario(x.IdHorarioMedico), 'Horario eliminado.')}>Quitar</button></Td></tr>
              ))}
            </Table>
          </Card>
          <Card>
            <CardTitle action={<Btn variant="ghost" onClick={() => run(async () => { if (!a.cons) throw new Error('Seleccione un consultorio.'); await asignarConsultorio(+a.cons, m.IdMedico, +a.dia, a.turno as Turno) }, 'Consultorio asignado.')}>+ Asignar</Btn>}>Consultorio por día y turno</CardTitle>
            <div className="mb-3 grid grid-cols-3 gap-2">
              <Select value={a.cons} onChange={(e) => setA({ ...a, cons: e.target.value })} aria-label="Consultorio"><option value="">Consultorio…</option>{d.Consultorio.filter((c) => c.Estado === 'Activo').map((c) => <option key={c.IdConsultorio} value={c.IdConsultorio}>{c.Numero}</option>)}</Select>
              <Select value={a.dia} onChange={(e) => setA({ ...a, dia: e.target.value })} aria-label="Día">{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{DIAS[n]}</option>)}</Select>
              <Select value={a.turno} onChange={(e) => setA({ ...a, turno: e.target.value })} aria-label="Turno"><option value="Manana">Mañana</option><option value="Tarde">Tarde</option></Select>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <Table head={['Consultorio', 'Día', 'Turno', '']} empty="Sin asignaciones.">
                {asigs.map((x) => (
                  <tr key={`${x.IdConsultorio}${x.DiaSemana}${x.Turno}`}>
                    <Td>{d.Consultorio.find((c) => c.IdConsultorio === x.IdConsultorio)?.Numero}</Td><Td>{DIAS[x.DiaSemana]}</Td><Td>{x.Turno === 'Manana' ? 'Mañana' : 'Tarde'}</Td>
                    <Td><button className="text-red-700" onClick={() => run(() => quitarAsignacion(x), 'Asignación eliminada.')}>Quitar</button></Td>
                  </tr>
                ))}
              </Table>
            </div>
          </Card>
        </div>
      )}

      {modal && (
        <Modal title={modal.id ? 'Editar médico' : 'Nuevo médico'} onClose={() => setModal(null)}>
          <Alert msg={msg} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="DNI"><Input value={modal.f.DNI} maxLength={8} onChange={(e) => nombreMod('DNI', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Especialidad">
              <Select value={modal.f.IdEspecialidad} onChange={(e) => nombreMod('IdEspecialidad', e.target.value)}>
                <option value="">Seleccione…</option>
                {d.Especialidad.filter((e) => e.Estado === 'Activo').map((e) => <option key={e.IdEspecialidad} value={e.IdEspecialidad}>{e.Nombre}</option>)}
              </Select>
            </Field>
            <Field label="Nombre"><Input value={modal.f.Nombre} onChange={(e) => nombreMod('Nombre', e.target.value)} /></Field>
            <Field label="Apellido"><Input value={modal.f.Apellido} onChange={(e) => nombreMod('Apellido', e.target.value)} /></Field>
            <Field label="Teléfono"><Input value={modal.f.Telefono} onChange={(e) => nombreMod('Telefono', e.target.value)} /></Field>
            <Field label="Correo"><Input type="email" value={modal.f.Correo} onChange={(e) => nombreMod('Correo', e.target.value)} /></Field>
            <Field label="Estado"><Select value={modal.f.Estado} onChange={(e) => nombreMod('Estado', e.target.value)}><option>Activo</option><option>Inactivo</option></Select></Field>
          </div>
          <div className="mt-5 flex justify-end gap-3"><Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn><Btn onClick={guardar}>Guardar</Btn></div>
        </Modal>
      )}
    </>
  )
}
