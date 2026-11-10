import { useDB, vwProximasCitas, fmtFecha, hhmm } from '../db'
import type { PageProps } from '../types'
import { Btn, Card, CardTitle, EstadoBadge, Note, PageTitle, Stat, Table, Td } from '../ui'

export default function Panel({ sess, go }: PageProps) {
  const d = useDB()
  const citas = vwProximasCitas(d)
  const prog = d.Cita.filter((c) => c.Estado === 'Programada').length
  const aten = d.Cita.filter((c) => c.Estado === 'Atendida').length
  const bajo = d.Insumo.filter((i) => i.Estado === 'Activo' && i.StockActual < i.StockMinimo).length
  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Panel principal</PageTitle>
      <div className="mb-4 grid grid-cols-3 gap-4">
        <Stat label="Citas programadas" value={prog} />
        <Stat label="Citas atendidas" value={aten} />
        <Stat label="Insumos bajo stock mínimo" value={bajo} />
      </div>
      <Card>
        <CardTitle action={<Btn onClick={() => go('cita-nueva')}>+ Nueva cita</Btn>}>Próximas citas</CardTitle>
        <Table head={['Fecha', 'Hora', 'DNI', 'Paciente', 'Médico', 'Consultorio', 'Estado']}>
          {citas.map((c) => (
            <tr key={c.IdCita}>
              <Td>{fmtFecha(c.FechaCita)}</Td><Td>{hhmm(c.HoraCita)}</Td><Td>{c.DNIPaciente}</Td><Td>{c.Paciente}</Td><Td>{c.Medico}</Td><Td>{c.Consultorio}</Td>
              <Td><EstadoBadge e={c.Estado} /></Td>
            </tr>
          ))}
        </Table>
        <Note>Datos de la vista vw_ProximasCitas_MACP</Note>
      </Card>
    </>
  )
}
