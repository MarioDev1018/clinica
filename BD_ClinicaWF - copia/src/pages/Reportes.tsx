import { useEffect, useState } from 'react'
import { cargarReporte, type Reporte } from '../db'
import type { PageProps } from '../types'
import { Alert, Card, CardTitle, PageTitle, Table, Td, cx } from '../ui'

const REPORTES = [
  { key: 'inner', label: 'INNER JOIN · Citas, consultas y médicos' },
  { key: 'left', label: 'LEFT JOIN · Pacientes sin cita' },
  { key: 'right', label: 'RIGHT JOIN · Médicos sin citas' },
  { key: 'full', label: 'FULL OUTER · Horarios vs citas' },
  { key: 'cross', label: 'CROSS JOIN · Especialidades × días' },
  { key: 'top', label: 'TOP · Médicos con más citas / insumos con menos stock' },
  { key: 'distinct', label: 'DISTINCT · Especialidades y cargos' },
  { key: 'pivot', label: 'PIVOT · Citas por mes y estado' },
  { key: 'sub', label: 'Subconsultas · Stock y citas bajo el promedio' },
  { key: 'exists', label: 'EXISTS / NOT EXISTS · Pacientes con citas / sin consulta' },
]

export default function Reportes({ sess }: PageProps) {
  const [key, setKey] = useState(REPORTES[0].key)
  const [res, setRes] = useState<Reporte | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const rep = REPORTES.find((report) => report.key === key)!

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void cargarReporte(key).then((report) => {
      if (active) setRes(report)
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'No se pudo ejecutar el reporte.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [key])

  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Reportes</PageTitle>
      <div className="grid grid-cols-[300px_1fr] gap-5">
        <Card>
          <CardTitle>Consultas del trabajo</CardTitle>
          <div className="flex flex-col gap-1.5">
            {REPORTES.map((report) => (
              <button key={report.key} onClick={() => setKey(report.key)} className={cx('rounded-md border px-3 py-2 text-left text-[12.5px] leading-snug', key === report.key ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:bg-canvas')}>{report.label}</button>
            ))}
          </div>
        </Card>
        <Card className="min-w-0">
          <CardTitle>Resultado · {rep.label} {res && <span className="font-normal text-muted">({res.rows.length} filas)</span>}</CardTitle>
          <Alert msg={error ? { tipo: 'error', texto: error } : null} />
          {loading && <p className="py-6 text-center text-muted">Ejecutando consulta en SQL Server…</p>}
          {!loading && res && (
            <>
              <div className="max-h-[520px] overflow-auto">
                <Table head={res.cols}>
                  {res.rows.map((row, i) => <tr key={i}>{row.map((value, j) => <Td key={j}>{value === null ? '—' : value}</Td>)}</tr>)}
                </Table>
              </div>
              <div className="mt-3 rounded-md bg-canvas px-3 py-2 text-[12px]"><b>Interpretación:</b> {res.nota}</div>
            </>
          )}
        </Card>
      </div>
    </>
  )
}
