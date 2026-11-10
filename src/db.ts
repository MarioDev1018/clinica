import { useSyncExternalStore } from 'react'

export type Estado = 'Activo' | 'Inactivo'
type Audit = { Creador?: string; FechaCreacion?: string; Modificador?: string | null; FechaModificacion?: string | null }
export type Especialidad = Audit & { IdEspecialidad: number; Nombre: string; Descripcion: string; Estado: Estado }
export type Consultorio = Audit & { IdConsultorio: number; Numero: string; Piso: number; Descripcion: string; Estado: Estado }
export type Paciente = Audit & { IdPaciente: number; DNI: string; Nombre: string; Apellido: string; FechaNacimiento: string; Telefono: string; Direccion: string; Correo: string; Estado: Estado }
export type Seguro = { IdSeguro: number; Nombre: string; TipoSeguro: string }
export type Alergia = Audit & { IdAlergia: number; Nombre: string; Descripcion: string; Estado: Estado }
export type Personal = Audit & { IdPersonal: number; DNI: string; Nombre: string; Apellido: string; Telefono: string; Cargo: string; Usuario: string; HoraEntradaProgramada: string; HoraSalidaProgramada: string; Estado: Estado }
export type Medico = Audit & { IdMedico: number; IdEspecialidad: number; DNI: string; Nombre: string; Apellido: string; Telefono: string; Correo: string; Estado: Estado }
export type HorarioMedico = { IdHorarioMedico: number; IdMedico: number; DiaSemana: number; HoraInicio: string; HoraFin: string }
export type Tratamiento = Audit & { IdTratamiento: number; Nombre: string; Descripcion: string; Estado: Estado }
export type Examen = Audit & { IdExamen: number; Nombre: string; Costo: number; Estado: Estado }
export type Procedimiento = Audit & { IdProcedimiento: number; Nombre: string; Descripcion: string; Costo: number; Estado: Estado }
export type Insumo = Audit & { IdInsumo: number; Nombre: string; UnidadMedida: string; StockMinimo: number; StockActual: number; Estado: Estado }
export type DetalleSeguro = { IdPaciente: number; IdSeguro: number; NumeroPoliza: string; FechaAfiliacion: string }
export type Gravedad = 'Leve' | 'Moderada' | 'Grave'
export type DetalleAlergia = { IdPaciente: number; IdAlergia: number; Gravedad: Gravedad; Observaciones: string }
export type Turno = 'Manana' | 'Tarde'
export type DetalleMedicoConsultorio = { IdConsultorio: number; IdMedico: number; DiaSemana: number; Turno: Turno }
export type EstadoCita = 'Programada' | 'Atendida' | 'Cancelada'
export type Cita = Audit & { IdCita: number; IdConsultorio: number; IdPaciente: number; IdMedico: number; IdPersonal: number; FechaCita: string; HoraCita: string; DuracionMinutos: number; Motivo: string; Estado: EstadoCita }
export type DetalleCitaProcedimiento = { IdProcedimiento: number; IdCita: number; ObservacionEnfermeria: string; FechaHoraRealizacion: string | null; CostoAplicado: number }
export type Consulta = Audit & { IdConsulta: number; IdCita: number; FechaConsulta: string; Diagnostico: string; Observaciones: string }
export type DetalleTratamiento = { IdConsulta: number; IdTratamiento: number; Indicaciones: string; DuracionDias: number; Observaciones: string }
export type DetalleExamen = { IdConsulta: number; IdExamen: number; Indicaciones: string; CostoAplicado: number }
export type DetalleConsultaInsumo = { IdInsumo: number; IdConsulta: number; CantidadUtilizada: number; Observaciones: string }
export type EstadoAsistencia = 'Pendiente' | 'Puntual' | 'Tardanza' | 'Hora extra'
export type Asistencia = { IdAsistencia: number; IdPersonal: number; Fecha: string; HoraEntrada: string | null; HoraSalida: string | null; Estado: EstadoAsistencia; MinutosTardanza: number; MinutosExtra: number }
export type AuditoriaCita = { IdAuditoria: number; IdCita: number; Accion: 'INSERT' | 'UPDATE' | 'DELETE'; EstadoAnterior: string | null; EstadoNuevo: string | null; FechaEvento: string; UsuarioSQL: string }
export type ProximaCita = { IdCita: number; FechaCita: string; HoraCita: string; Estado: EstadoCita; Motivo: string; DNIPaciente: string; Paciente: string; Medico: string; Consultorio: string }

export interface DB {
  Especialidad: Especialidad[]
  Consultorio: Consultorio[]
  Paciente: Paciente[]
  Seguro: Seguro[]
  Alergia: Alergia[]
  Personal: Personal[]
  Medico: Medico[]
  HorarioMedico: HorarioMedico[]
  Tratamiento: Tratamiento[]
  Examen: Examen[]
  Procedimiento: Procedimiento[]
  Insumo: Insumo[]
  DetalleSeguro: DetalleSeguro[]
  DetalleAlergia: DetalleAlergia[]
  DetalleMedicoConsultorio: DetalleMedicoConsultorio[]
  Cita: Cita[]
  DetalleCitaProcedimiento: DetalleCitaProcedimiento[]
  Consulta: Consulta[]
  DetalleTratamiento: DetalleTratamiento[]
  DetalleExamen: DetalleExamen[]
  DetalleConsultaInsumo: DetalleConsultaInsumo[]
  Asistencia: Asistencia[]
  AuditoriaCita: AuditoriaCita[]
  ProximasCitas: ProximaCita[]
}

export type Tabla = 'Especialidad' | 'Consultorio' | 'Seguro' | 'Alergia' | 'Personal' | 'Medico' | 'Tratamiento' | 'Examen' | 'Procedimiento' | 'Insumo'
export type ResumenAsistencia = { IdPersonal: number; Trabajador: string; Cargo: string; DiasAsistidos: number; TardanzasMinutos: number; Ausencias: number; HorasExtras: number }
export type Reporte = { cols: string[]; rows: (string | number | null)[][]; nota: string }

const EMPTY_DB: DB = {
  Especialidad: [], Consultorio: [], Paciente: [], Seguro: [], Alergia: [], Personal: [], Medico: [], HorarioMedico: [],
  Tratamiento: [], Examen: [], Procedimiento: [], Insumo: [], DetalleSeguro: [], DetalleAlergia: [], DetalleMedicoConsultorio: [],
  Cita: [], DetalleCitaProcedimiento: [], Consulta: [], DetalleTratamiento: [], DetalleExamen: [], DetalleConsultaInsumo: [],
  Asistencia: [], AuditoriaCita: [], ProximasCitas: [],
}

let db = EMPTY_DB
let token: string | null = null
let version = 0
const subscribers = new Set<() => void>()

function commit(next: DB) {
  db = next
  version++
  subscribers.forEach((subscriber) => subscriber())
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  if (init?.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(path, { ...init, headers })
  const body = await response.text()
  let payload: ({ error?: string } & T) | undefined
  if (body) {
    try {
      payload = JSON.parse(body) as { error?: string } & T
    } catch {
      if (response.ok) throw new Error(`La API devolvió una respuesta inválida (HTTP ${response.status}).`)
    }
  }
  if (!response.ok) {
    throw new Error(payload?.error || `No se pudo completar la solicitud (HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`)
  }
  if (!payload) throw new Error(`La API devolvió una respuesta vacía (HTTP ${response.status}).`)
  return payload
}

function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) })
}

export function setAuthToken(value: string | null) {
  token = value
}

export function useDB(): DB {
  useSyncExternalStore(
    (subscriber) => { subscribers.add(subscriber); return () => subscribers.delete(subscriber) },
    () => version,
  )
  return db
}

export async function loadDB() {
  const next = await request<DB>('/api/db')
  commit(next)
  return next
}

export async function validarLogin(Usuario: string, Contrasena: string, tieneContrasena: boolean) {
  if (!Usuario.trim() || !tieneContrasena) throw new Error('Ingrese usuario y contraseña.')
  return post<{ IdPersonal: number; Cargo: string; Usuario: string; Nombre: string; Token: string }>('/api/login', {
    usuario: Usuario,
    contrasena: Contrasena,
  })
}

/** 1=Lunes ... 7=Domingo */
export const diaSemana = (fecha: string) => {
  const [year, month, day] = fecha.split('-').map(Number)
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1
}
const pad = (value: number) => String(value).padStart(2, '0')
export const hoy = () => {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
export const horaServidor = () => {
  const date = new Date()
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
export const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const fmtFecha = (fecha: string) => {
  const [year, month, day] = fecha.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}
export const hhmm = (time: string | null) => time ? time.slice(0, 5) : '—'

export interface RegistrarCitaArgs {
  IdPaciente: number
  IdMedico: number
  IdConsultorio: number
  IdPersonal: number
  FechaCita: string
  HoraCita: string
  Motivo: string
  IdProcedimiento?: number | null
}
export interface RegistrarConsultaArgs {
  IdCita: number
  Diagnostico: string
  Observaciones: string
  IdInsumo: number
  Cantidad: number
}

async function mutate<T>(path: string, body?: unknown, method = 'POST') {
  const result = await request<T>(path, body === undefined ? { method } : { method, body: JSON.stringify(body) })
  await loadDB()
  return result
}

export async function spRegistrarCita(args: RegistrarCitaArgs) {
  const result = await mutate<{ id: number }>('/api/citas', args)
  return result.id
}

export async function spRegistrarConsulta(
  consulta: RegistrarConsultaArgs,
  tratamientos: { IdTratamiento: number; Indicaciones: string; DuracionDias: number }[],
  examenes: { IdExamen: number; Indicaciones: string }[],
) {
  const result = await mutate<{ id: number }>('/api/consultas', { consulta, tratamientos, examenes })
  return result.id
}

export async function spCancelarCita(IdCita: number, _Modificador = 'Sistema') {
  await mutate(`/api/citas/${IdCita}/cancelar`)
}

export async function spMarcarAsistencia(IdPersonal: number, Tipo: 'ENTRADA' | 'SALIDA') {
  await mutate('/api/asistencia/marcar', { IdPersonal, Tipo })
}

export async function spCalcularAsistencia(Anio: number, Mes: number, IdPersonal?: number | null) {
  const params = new URLSearchParams({ anio: String(Anio), mes: String(Mes) })
  if (IdPersonal) params.set('idPersonal', String(IdPersonal))
  return request<ResumenAsistencia[]>(`/api/asistencia/resumen?${params}`)
}

export function vwProximasCitas(data: DB = db) {
  return data.ProximasCitas
}

export async function guardarFila(tabla: Tabla, fila: Record<string, unknown>, modificador = 'Sistema') {
  const result = await mutate<{ id: number }>(`/api/catalogos/${tabla}`, { fila, modificador })
  return result.id
}

export async function guardarPaciente(
  paciente: Omit<Paciente, 'IdPaciente' | keyof Audit> & { IdPaciente?: number },
  seguro: { IdSeguro: number; NumeroPoliza: string; FechaAfiliacion: string } | null,
  alergias: DetalleAlergia[],
  modificador: string,
) {
  const result = await mutate<{ id: number }>('/api/pacientes', { paciente, seguro, alergias, modificador })
  return result.id
}

export async function agregarHorario(IdMedico: number, DiaSemana: number, HoraInicio: string, HoraFin: string) {
  await mutate('/api/horarios', { IdMedico, DiaSemana, HoraInicio, HoraFin })
}

export async function quitarHorario(IdHorarioMedico: number) {
  await mutate(`/api/horarios/${IdHorarioMedico}`, undefined, 'DELETE')
}

export async function asignarConsultorio(IdConsultorio: number, IdMedico: number, DiaSemana: number, Turno: Turno) {
  await mutate('/api/asignaciones', { IdConsultorio, IdMedico, DiaSemana, Turno })
}

export async function quitarAsignacion(asignacion: DetalleMedicoConsultorio) {
  await mutate('/api/asignaciones', asignacion, 'DELETE')
}

export function cargarReporte(key: string) {
  return request<Reporte>(`/api/reportes/${encodeURIComponent(key)}`)
}
