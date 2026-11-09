export type Session = { IdPersonal: number; Cargo: string; Usuario: string; Nombre: string; Token: string }
export type Page = 'panel' | 'citas' | 'cita-nueva' | 'consultas' | 'pacientes' | 'medicos' | 'catalogos' | 'asistencia' | 'asistenciaPersonal' | 'reportes'
export type Go = (p: Page, params?: { IdCita?: number }) => void
export interface PageProps { sess: Session; go: Go; params?: { IdCita?: number } }
