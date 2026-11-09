import { useState } from 'react'
import { guardarFila, useDB, type DB, type Tabla } from '../db'
import type { PageProps } from '../types'
import { Alert, Btn, Card, CardTitle, EstadoBadge, Field, Input, Modal, Note, PageTitle, Select, Table, Td, cx, soles, type Msg } from '../ui'

type F = { k: string; label: string; type?: 'text' | 'number' | 'time' | 'password' | 'select'; opts?: string[]; req?: boolean; hide?: boolean }
type Cat = { key: string; label: string; tabla: Tabla; pk: string; hasEstado: boolean; cols: { k: string; label: string; fmt?: (v: any) => string }[]; fields: F[] }
const T = (k: string, label: string, req = true): F => ({ k, label, req })
const CATS: Cat[] = [
  { key: 'esp', label: 'Especialidades', tabla: 'Especialidad', pk: 'IdEspecialidad', hasEstado: true, cols: [{ k: 'Nombre', label: 'Nombre' }, { k: 'Descripcion', label: 'Descripción' }], fields: [T('Nombre', 'Nombre'), T('Descripcion', 'Descripción', false)] },
  { key: 'con', label: 'Consultorios', tabla: 'Consultorio', pk: 'IdConsultorio', hasEstado: true, cols: [{ k: 'Numero', label: 'Número' }, { k: 'Piso', label: 'Piso' }, { k: 'Descripcion', label: 'Descripción' }], fields: [T('Numero', 'Número'), { k: 'Piso', label: 'Piso', type: 'number', req: true }, T('Descripcion', 'Descripción', false)] },
  { key: 'seg', label: 'Seguros', tabla: 'Seguro', pk: 'IdSeguro', hasEstado: false, cols: [{ k: 'Nombre', label: 'Nombre' }, { k: 'TipoSeguro', label: 'Tipo' }], fields: [T('Nombre', 'Nombre'), { k: 'TipoSeguro', label: 'Tipo de seguro', type: 'select', opts: ['Publico', 'Privado'], req: true }] },
  { key: 'ale', label: 'Alergias', tabla: 'Alergia', pk: 'IdAlergia', hasEstado: true, cols: [{ k: 'Nombre', label: 'Nombre' }, { k: 'Descripcion', label: 'Descripción' }], fields: [T('Nombre', 'Nombre'), T('Descripcion', 'Descripción', false)] },
  { key: 'tra', label: 'Tratamientos', tabla: 'Tratamiento', pk: 'IdTratamiento', hasEstado: true, cols: [{ k: 'Nombre', label: 'Nombre' }, { k: 'Descripcion', label: 'Descripción' }], fields: [T('Nombre', 'Nombre'), T('Descripcion', 'Descripción', false)] },
  { key: 'exa', label: 'Exámenes', tabla: 'Examen', pk: 'IdExamen', hasEstado: true, cols: [{ k: 'Nombre', label: 'Nombre' }, { k: 'Costo', label: 'Costo', fmt: soles }], fields: [T('Nombre', 'Nombre'), { k: 'Costo', label: 'Costo (S/)', type: 'number', req: true }] },
  { key: 'pro', label: 'Procedimientos', tabla: 'Procedimiento', pk: 'IdProcedimiento', hasEstado: true, cols: [{ k: 'Nombre', label: 'Nombre' }, { k: 'Descripcion', label: 'Descripción' }, { k: 'Costo', label: 'Costo', fmt: soles }], fields: [T('Nombre', 'Nombre'), T('Descripcion', 'Descripción', false), { k: 'Costo', label: 'Costo (S/)', type: 'number', req: true }] },
  { key: 'ins', label: 'Insumos médicos', tabla: 'Insumo', pk: 'IdInsumo', hasEstado: true, cols: [{ k: 'Nombre', label: 'Nombre' }, { k: 'UnidadMedida', label: 'Unidad' }, { k: 'StockMinimo', label: 'Stock mín.' }, { k: 'StockActual', label: 'Stock actual' }], fields: [T('Nombre', 'Nombre'), T('UnidadMedida', 'Unidad de medida'), { k: 'StockMinimo', label: 'Stock mínimo', type: 'number', req: true }, { k: 'StockActual', label: 'Stock actual', type: 'number', req: true }] },
  { key: 'per', label: 'Personal', tabla: 'Personal', pk: 'IdPersonal', hasEstado: true, cols: [{ k: 'DNI', label: 'DNI' }, { k: 'Nombre', label: 'Nombre' }, { k: 'Apellido', label: 'Apellido' }, { k: 'Cargo', label: 'Cargo' }, { k: 'Usuario', label: 'Usuario' }], fields: [T('DNI', 'DNI'), T('Nombre', 'Nombre'), T('Apellido', 'Apellido'), T('Telefono', 'Teléfono', false), { k: 'Cargo', label: 'Cargo', type: 'select', opts: ['Recepcionista', 'Enfermero', 'Administrativo'], req: true }, T('Usuario', 'Usuario'), { k: 'Contrasena', label: 'Contraseña', type: 'password' }, { k: 'HoraEntradaProgramada', label: 'Entrada programada', type: 'time', req: true }, { k: 'HoraSalidaProgramada', label: 'Salida programada', type: 'time', req: true }] },
]

export default function Catalogos({ sess }: PageProps) {
  const d = useDB()
  const [key, setKey] = useState('pro')
  const cat = CATS.find((c) => c.key === key)!
  const [modal, setModal] = useState<null | { id?: number; v: Record<string, any> }>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const filas = (d as any)[cat.tabla] as Record<string, any>[]

  const abrir = (fila?: Record<string, any>) => {
    setMsg(null)
    const v: Record<string, any> = {}
    cat.fields.forEach((f) => { v[f.k] = fila && f.type !== 'password' ? String(fila[f.k] ?? '') : f.type === 'time' ? (f.k.includes('Entrada') ? '08:00' : '16:00') : f.type === 'select' ? f.opts![0] : '' })
    if (cat.hasEstado) v.Estado = fila?.Estado ?? 'Activo'
    if (cat.tabla === 'Insumo' && !fila) { v.StockMinimo = '10'; v.StockActual = '0' }
    setModal({ id: fila?.[cat.pk], v })
  }
  const guardar = async () => {
    if (!modal) return
    try {
      const out: Record<string, any> = { ...modal.v }
      cat.fields.forEach((f) => {
        if (f.req && f.type !== 'password' && String(out[f.k]).trim() === '') throw new Error(`${f.label} es obligatorio.`)
        if (f.type === 'number') out[f.k] = Number(out[f.k])
      })
      if (modal.id) out[cat.pk] = modal.id
      await guardarFila(cat.tabla, out, sess.Usuario)
      setModal(null)
    } catch (e) { setMsg({ tipo: 'error', texto: (e as Error).message }) }
  }
  const cambiarEstado = async (r: Record<string, any>) => {
    try { await guardarFila(cat.tabla, { ...r, Estado: r.Estado === 'Activo' ? 'Inactivo' : 'Activo' }, sess.Usuario) } catch (e) { alert((e as Error).message) }
  }

  return (
    <>
      <PageTitle user={`Usuario: ${sess.Nombre} · Rol: ${sess.Cargo}`}>Catálogos</PageTitle>
      <Card className="mb-5">
        <CardTitle>Tablas de apoyo</CardTitle>
        <div className="flex flex-wrap gap-2">
          {CATS.map((c) => (
            <button key={c.key} onClick={() => setKey(c.key)} className={cx('rounded-md border px-3 py-1.5 text-[12.5px]', key === c.key ? 'border-brand bg-brand text-white' : 'border-line bg-white hover:bg-canvas')}>{c.label}</button>
          ))}
        </div>
      </Card>
      <Card>
        <CardTitle action={<Btn onClick={() => abrir()}>+ Nuevo</Btn>}>{cat.label}</CardTitle>
        <Table head={[...cat.cols.map((c) => c.label), ...(cat.hasEstado ? ['Estado'] : []), 'Acciones']}>
          {filas.map((r) => (
            <tr key={r[cat.pk]}>
              {cat.cols.map((c) => <Td key={c.k}>{c.fmt ? c.fmt(r[c.k]) : r[c.k]}</Td>)}
              {cat.hasEstado && <Td><EstadoBadge e={r.Estado} /></Td>}
              <Td>
                <span className="flex gap-3">
                  <button className="text-brand underline" onClick={() => abrir(r)}>Editar</button>
                  {cat.hasEstado && <button className="text-ink/70 underline" onClick={() => cambiarEstado(r)}>{r.Estado === 'Activo' ? 'Desactivar' : 'Activar'}</button>}
                </span>
              </Td>
            </tr>
          ))}
        </Table>
        <Note>Cada catálogo tiene su tabla con la misma forma. Estado Activo/Inactivo en lugar de borrar. Creador y fechas se llenan solos.</Note>
      </Card>

      {modal && (
        <Modal title={`${modal.id ? 'Editar' : 'Nuevo'} · ${cat.label}`} onClose={() => setModal(null)}>
          <Alert msg={msg} />
          <div className="grid grid-cols-2 gap-3">
            {cat.fields.map((f) => (
              <Field key={f.k} label={f.label + (f.type === 'password' && modal.id ? ' (vacío = no cambiar)' : '')}>
                {f.type === 'select' ? (
                  <Select value={modal.v[f.k]} onChange={(e) => setModal({ ...modal, v: { ...modal.v, [f.k]: e.target.value } })}>{f.opts!.map((o) => <option key={o}>{o}</option>)}</Select>
                ) : (
                  <Input type={f.type ?? 'text'} min={f.type === 'number' ? 0 : undefined} step={f.k === 'Costo' ? '0.01' : undefined} value={modal.v[f.k]} onChange={(e) => setModal({ ...modal, v: { ...modal.v, [f.k]: e.target.value } })} />
                )}
              </Field>
            ))}
            {cat.hasEstado && <Field label="Estado"><Select value={modal.v.Estado} onChange={(e) => setModal({ ...modal, v: { ...modal.v, Estado: e.target.value } })}><option>Activo</option><option>Inactivo</option></Select></Field>}
          </div>
          <div className="mt-5 flex justify-end gap-3"><Btn variant="ghost" onClick={() => setModal(null)}>Cancelar</Btn><Btn onClick={guardar}>Guardar</Btn></div>
        </Modal>
      )}
    </>
  )
}
export type { DB }
