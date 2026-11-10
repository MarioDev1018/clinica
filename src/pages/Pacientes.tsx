import { useState } from 'react'
import { guardarPaciente, hoy, useDB, type DetalleAlergia, type Gravedad } from '../db'
import type { PageProps } from '../types'
import { Alert, Btn, Card, CardTitle, EstadoBadge, Field, Input, PageTitle, Select, Table, Td, cx, useMsg } from '../ui'

const vacio = { DNI: '', Nombre: '', Apellido: '', FechaNacimiento: '', Telefono: '', Correo: '', Direccion: '', Estado: 'Activo' as 'Activo' | 'Inactivo' }

export default function Pacientes({ sess }: PageProps) {
  const d = useDB()
  const { msg, run, setMsg } = useMsg()
  const [sel, setSel] = useState<number | null>(null) // null = ninguno; 0 = nuevo
  const [f, setF] = useState(vacio)
  const [seg, setSeg] = useState({ IdSeguro: '', NumeroPoliza: '', FechaAfiliacion: '' })
  const [als, setAls] = useState<DetalleAlergia[]>([])
  const [na, setNa] = useState({ IdAlergia: '', Gravedad: 'Leve' as Gravedad, Observaciones: '' })
  const [q, setQ] = useState('')

  const abrir = (id: number) => {
    setMsg(null); setSel(id)
    if (id === 0) { setF(vacio); setSeg({ IdSeguro: '', NumeroPoliza: '', FechaAfiliacion: '' }); setAls([]); return }
    const p = d.Paciente.find((x) => x.IdPaciente === id)!
    setF({ DNI: p.DNI, Nombre: p.Nombre, Apellido: p.Apellido, FechaNacimiento: p.FechaNacimiento, Telefono: p.Telefono ?? '', Correo: p.Correo ?? '', Direccion: p.Direccion ?? '', Estado: p.Estado })
    const s = d.DetalleSeguro.find((x) => x.IdPaciente === id)
    setSeg(s ? { IdSeguro: String(s.IdSeguro), NumeroPoliza: s.NumeroPoliza, FechaAfiliacion: s.FechaAfiliacion } : { IdSeguro: '', NumeroPoliza: '', FechaAfiliacion: '' })
    setAls(d.DetalleAlergia.filter((x) => x.IdPaciente === id))
  }
  const set = (k: keyof typeof vacio, v: string) => setF({ ...f, [k]: v })
  const guardar = async () => {
    await run(async () => {
      const idp = await guardarPaciente({ ...(sel ? { IdPaciente: sel } : {}), ...f }, seg.IdSeguro ? { IdSeguro: +seg.IdSeguro, NumeroPoliza: seg.NumeroPoliza, FechaAfiliacion: seg.FechaAfiliacion || hoy() } : null, als, sess.Usuario)
      setSel(idp)
    }, 'Paciente guardado.')
  }
  const addAl = () => {
    if (!na.IdAlergia) return
    if (als.some((a) => a.IdAlergia === +na.IdAlergia)) return setMsg({ tipo: 'error', texto: 'El paciente ya tiene registrada esa alergia.' })
    setAls([...als, { IdPaciente: sel ?? 0, IdAlergia: +na.IdAlergia, Gravedad: na.Gravedad, Observaciones: na.Observaciones }])
    setNa({ IdAlergia: '', Gravedad: 'Leve', Observaciones: '' })
  }
  const lista = d.Paciente.filter((p) => !q || `${p.DNI} ${p.Nombre} ${p.Apellido}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Pacientes</PageTitle>
      <Card className="mb-5">
        <CardTitle action={<Btn onClick={() => abrir(0)}>+ Nuevo paciente</Btn>}>Lista de pacientes</CardTitle>
        <div className="mb-3 w-64"><Input placeholder="Buscar por DNI o nombre" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="max-h-72 overflow-y-auto">
          <Table head={['DNI', 'Nombre', 'Apellido', 'Teléfono', 'Estado']}>
            {lista.map((p) => (
              <tr key={p.IdPaciente} onClick={() => abrir(p.IdPaciente)} className={cx('cursor-pointer hover:bg-canvas', sel === p.IdPaciente && 'bg-blue-50')}>
                <Td>{p.DNI}</Td><Td>{p.Nombre}</Td><Td>{p.Apellido}</Td><Td>{p.Telefono}</Td><Td><EstadoBadge e={p.Estado} /></Td>
              </tr>
            ))}
          </Table>
        </div>
      </Card>

      {sel !== null ? (
        <Card>
          <CardTitle>{sel === 0 ? 'Ficha del paciente (nuevo)' : 'Ficha del paciente'}</CardTitle>
          <Alert msg={msg} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="DNI"><Input value={f.DNI} maxLength={8} inputMode="numeric" onChange={(e) => set('DNI', e.target.value.replace(/\D/g, ''))} /></Field>
            <Field label="Fecha de nacimiento"><Input type="date" value={f.FechaNacimiento} onChange={(e) => set('FechaNacimiento', e.target.value)} /></Field>
            <Field label="Nombre"><Input value={f.Nombre} onChange={(e) => set('Nombre', e.target.value)} /></Field>
            <Field label="Apellido"><Input value={f.Apellido} onChange={(e) => set('Apellido', e.target.value)} /></Field>
            <Field label="Teléfono"><Input value={f.Telefono} maxLength={15} onChange={(e) => set('Telefono', e.target.value)} /></Field>
            <Field label="Correo"><Input type="email" value={f.Correo} onChange={(e) => set('Correo', e.target.value)} /></Field>
            <Field label="Dirección"><Input value={f.Direccion} onChange={(e) => set('Direccion', e.target.value)} /></Field>
            <Field label="Estado"><Select value={f.Estado} onChange={(e) => set('Estado', e.target.value)}><option>Activo</option><option>Inactivo</option></Select></Field>
          </div>

          <h4 className="mb-2 mt-6 font-semibold">Seguro</h4>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Seguro">
              <Select value={seg.IdSeguro} onChange={(e) => setSeg({ ...seg, IdSeguro: e.target.value })}>
                <option value="">Sin seguro</option>
                {d.Seguro.map((s) => <option key={s.IdSeguro} value={s.IdSeguro}>{s.Nombre} ({s.TipoSeguro})</option>)}
              </Select>
            </Field>
            <Field label="N° póliza"><Input value={seg.NumeroPoliza} disabled={!seg.IdSeguro} onChange={(e) => setSeg({ ...seg, NumeroPoliza: e.target.value })} /></Field>
            <Field label="Afiliación"><Input type="date" value={seg.FechaAfiliacion} disabled={!seg.IdSeguro} onChange={(e) => setSeg({ ...seg, FechaAfiliacion: e.target.value })} /></Field>
          </div>

          <h4 className="mb-2 mt-6 font-semibold">Alergias</h4>
          <div className="mb-3 grid grid-cols-[1fr_140px_1fr_auto] items-end gap-3">
            <Field label="Alergia">
              <Select value={na.IdAlergia} onChange={(e) => setNa({ ...na, IdAlergia: e.target.value })}>
                <option value="">Seleccione…</option>
                {d.Alergia.filter((a) => a.Estado === 'Activo').map((a) => <option key={a.IdAlergia} value={a.IdAlergia}>{a.Nombre}</option>)}
              </Select>
            </Field>
            <Field label="Gravedad"><Select value={na.Gravedad} onChange={(e) => setNa({ ...na, Gravedad: e.target.value as Gravedad })}><option>Leve</option><option>Moderada</option><option>Grave</option></Select></Field>
            <Field label="Observaciones"><Input value={na.Observaciones} maxLength={250} onChange={(e) => setNa({ ...na, Observaciones: e.target.value })} /></Field>
            <Btn variant="ghost" onClick={addAl}>+ Agregar</Btn>
          </div>
          <Table head={['Alergia', 'Gravedad', 'Observaciones', '']} empty="Sin alergias registradas.">
            {als.map((a) => (
              <tr key={a.IdAlergia}>
                <Td>{d.Alergia.find((x) => x.IdAlergia === a.IdAlergia)?.Nombre}</Td><Td>{a.Gravedad}</Td><Td>{a.Observaciones}</Td>
                <Td><button className="text-red-700" onClick={() => setAls(als.filter((x) => x !== a))}>Quitar</button></Td>
              </tr>
            ))}
          </Table>
          <div className="mt-5 flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => setSel(null)}>Cerrar</Btn>
            <Btn onClick={guardar}>Guardar</Btn>
          </div>
        </Card>
      ) : (
        <p className="text-muted">Seleccione un paciente de la lista o cree uno nuevo para ver su ficha.</p>
      )}
    </>
  )
}
