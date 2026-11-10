import 'dotenv/config'
import crypto from 'node:crypto'
import express, { type NextFunction, type Request, type Response } from 'express'
import sql from 'mssql'
import { resolve } from 'node:path'

const app = express()
app.use(express.json({ limit: '100kb' }))

type AuthUser = { IdPersonal: number; Usuario: string }
type AuthRequest = Request & { auth?: AuthUser }

let poolPromise: Promise<sql.ConnectionPool> | undefined
function getPool() {
  if (!process.env.DB_SERVER || !process.env.DB_USER || !process.env.DB_PASSWORD) {
    throw new Error('Configura DB_SERVER, DB_USER y DB_PASSWORD en el archivo .env.')
  }
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      server: process.env.DB_SERVER,
      port: Number(process.env.DB_PORT || 1433),
      database: process.env.DB_DATABASE || 'clinica_macp',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: {
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
      },
      pool: { min: 0, max: 10, idleTimeoutMillis: 30000 },
      connectionTimeout: 15000,
      requestTimeout: 30000,
    }).connect().catch((error: unknown) => {
      poolPromise = undefined
      throw error
    })
  }
  return poolPromise
}

function signToken(id: number, usuario: string) {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET debe tener al menos 32 caracteres.')
  const payload = Buffer.from(JSON.stringify({ id, usuario, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

function verifyToken(token: string): AuthUser | null {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = crypto.createHmac('sha256', secret).update(payload).digest()
  let actual: Buffer
  try {
    actual = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { id: number; usuario: string; exp: number }
    return data.id > 0 && data.usuario && data.exp > Date.now() ? { IdPersonal: data.id, Usuario: data.usuario } : null
  } catch {
    return null
  }
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '')
  const auth = token ? verifyToken(token) : null
  if (!auth) return res.status(401).json({ error: 'La sesión venció. Inicia sesión nuevamente.' })
  req.auth = auth
  next()
}

function normalizeRows<T>(rows: T[]) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row as Record<string, unknown>).map(([key, value]) => {
      if (!(value instanceof Date)) return [key, value]
      if (key.startsWith('Hora')) {
        return [key, `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}:${String(value.getUTCSeconds()).padStart(2, '0')}`]
      }
      if (['Fecha', 'FechaCita', 'FechaNacimiento', 'FechaAfiliacion'].includes(key)) {
        return [key, value.toISOString().slice(0, 10)]
      }
      return [key, value.toISOString()]
    }),
  ))
}

const dataQueries = {
  Especialidad: 'SELECT * FROM Maestros_MACP.Especialidad_MACP',
  Consultorio: 'SELECT * FROM Maestros_MACP.Consultorio_MACP',
  Paciente: 'SELECT * FROM Maestros_MACP.Paciente_MACP',
  Seguro: 'SELECT * FROM Maestros_MACP.Seguro_MACP',
  Alergia: 'SELECT * FROM Maestros_MACP.Alergia_MACP',
  Personal: `SELECT IdPersonal, DNI, Nombre, Apellido, Telefono, Cargo, Usuario,
    HoraEntradaProgramada, HoraSalidaProgramada, Estado, Creador, FechaCreacion, Modificador, FechaModificacion
    FROM Maestros_MACP.Personal_MACP`,
  Medico: 'SELECT * FROM Maestros_MACP.Medico_MACP',
  HorarioMedico: 'SELECT * FROM Maestros_MACP.HorarioMedico_MACP',
  Tratamiento: 'SELECT * FROM Maestros_MACP.Tratamiento_MACP',
  Examen: 'SELECT * FROM Maestros_MACP.Examen_MACP',
  Procedimiento: 'SELECT * FROM Maestros_MACP.Procedimiento_MACP',
  Insumo: 'SELECT * FROM Maestros_MACP.InsumoMedico_MACP',
  DetalleSeguro: 'SELECT * FROM Operaciones_MACP.DetalleSeguro_MACP',
  DetalleAlergia: 'SELECT * FROM Operaciones_MACP.DetalleAlergia_MACP',
  DetalleMedicoConsultorio: 'SELECT * FROM Operaciones_MACP.DetalleMedicoConsultorio_MACP',
  Cita: 'SELECT * FROM Operaciones_MACP.Cita_MACP',
  DetalleCitaProcedimiento: 'SELECT * FROM Operaciones_MACP.DetalleCitaProcedimiento_MACP',
  Consulta: 'SELECT * FROM Operaciones_MACP.Consulta_MACP',
  DetalleTratamiento: 'SELECT * FROM Operaciones_MACP.DetalleTratamiento_MACP',
  DetalleExamen: 'SELECT * FROM Operaciones_MACP.DetalleExamen_MACP',
  DetalleConsultaInsumo: 'SELECT * FROM Operaciones_MACP.DetalleConsultaInsumo_MACP',
  Asistencia: `SELECT a.*, Operaciones_MACP.fn_MinutosTardanza_MACP(p.HoraEntradaProgramada, a.HoraEntrada) AS MinutosTardanza,
    Operaciones_MACP.fn_MinutosExtra_MACP(p.HoraSalidaProgramada, a.HoraSalida) AS MinutosExtra
    FROM Operaciones_MACP.Asistencia_MACP a
    INNER JOIN Maestros_MACP.Personal_MACP p ON p.IdPersonal = a.IdPersonal`,
  AuditoriaCita: 'SELECT * FROM Auditoria_MACP.AuditoriaCita_MACP',
  ProximasCitas: 'SELECT * FROM Operaciones_MACP.vw_ProximasCitas_MACP',
} as const

const reports = {
  inner: {
    cols: ['Cita', 'Fecha', 'Hora', 'Paciente', 'Médico', 'Especialidad', 'Estado', 'Diagnóstico', 'Tratamiento'],
    note: 'Relaciona las citas con sus participantes y, cuando existe, el diagnóstico y tratamiento.',
    query: `SELECT c.IdCita, c.FechaCita, c.HoraCita, p.Nombre AS Paciente, m.Nombre AS Medico, e.Nombre AS Especialidad,
      c.Estado, co.Diagnostico, t.Nombre AS Tratamiento
      FROM Operaciones_MACP.Cita_MACP c
      INNER JOIN Maestros_MACP.Paciente_MACP p ON p.IdPaciente = c.IdPaciente
      INNER JOIN Maestros_MACP.Medico_MACP m ON m.IdMedico = c.IdMedico
      INNER JOIN Maestros_MACP.Especialidad_MACP e ON e.IdEspecialidad = m.IdEspecialidad
      LEFT JOIN Operaciones_MACP.Consulta_MACP co ON co.IdCita = c.IdCita
      LEFT JOIN Operaciones_MACP.DetalleTratamiento_MACP dt ON dt.IdConsulta = co.IdConsulta
      LEFT JOIN Maestros_MACP.Tratamiento_MACP t ON t.IdTratamiento = dt.IdTratamiento
      ORDER BY c.FechaCita, c.HoraCita`,
  },
  left: {
    cols: ['IdPaciente', 'Nombre', 'IdCita', 'Fecha'],
    note: 'NULL (—) en IdCita significa que el paciente no tiene ninguna cita.',
    query: `SELECT p.IdPaciente, p.Nombre, c.IdCita, c.FechaCita
      FROM Maestros_MACP.Paciente_MACP p
      LEFT JOIN Operaciones_MACP.Cita_MACP c ON c.IdPaciente = p.IdPaciente
      ORDER BY p.IdPaciente, c.FechaCita`,
  },
  right: {
    cols: ['IdMedico', 'Nombre', 'IdCita', 'Estado'],
    note: 'NULL (—) en IdCita significa que el médico no ha recibido citas.',
    query: `SELECT m.IdMedico, m.Nombre, c.IdCita, c.Estado
      FROM Operaciones_MACP.Cita_MACP c
      RIGHT JOIN Maestros_MACP.Medico_MACP m ON m.IdMedico = c.IdMedico
      ORDER BY m.IdMedico, c.IdCita`,
  },
  full: {
    cols: ['Médico (horario)', 'Día', 'Inicio', 'Médico (cita)', 'IdCita', 'Fecha', 'Hora'],
    note: 'Contrasta horarios con citas cuya fecha, día de semana y hora coinciden.',
    query: `SELECT h.IdMedico, CASE h.DiaSemana WHEN 1 THEN 'Lunes' WHEN 2 THEN 'Martes' WHEN 3 THEN 'Miercoles'
      WHEN 4 THEN 'Jueves' WHEN 5 THEN 'Viernes' WHEN 6 THEN 'Sabado' WHEN 7 THEN 'Domingo' END AS Dia,
      h.HoraInicio, c.IdMedico AS MedicoCita, c.IdCita, c.FechaCita, c.HoraCita
      FROM Maestros_MACP.HorarioMedico_MACP h
      FULL OUTER JOIN Operaciones_MACP.Cita_MACP c
        ON h.IdMedico = c.IdMedico
        AND h.DiaSemana = DATEDIFF(DAY, '19000101', c.FechaCita) % 7 + 1
        AND h.HoraInicio = c.HoraCita
      ORDER BY COALESCE(h.IdMedico, c.IdMedico), c.FechaCita`,
  },
  cross: {
    cols: ['Especialidad', 'Día'],
    note: 'Combinaciones de especialidades con los días laborables.',
    query: `SELECT e.Nombre, d.Dia
      FROM Maestros_MACP.Especialidad_MACP e
      CROSS JOIN (VALUES ('Lunes'), ('Martes'), ('Miercoles'), ('Jueves'), ('Viernes')) d(Dia)
      ORDER BY e.Nombre, d.Dia`,
  },
  top: {
    cols: ['Tipo', 'Nombre', 'Valor', 'Referencia'],
    note: 'Muestra los médicos con más citas y los insumos con menos stock.',
    query: `SELECT Tipo, Nombre, Valor, Referencia FROM (
      SELECT TOP (5) 'Medico (TOP 5)' AS Tipo, m.Nombre,
        CONCAT(COUNT(c.IdCita), ' citas') AS Valor, '' AS Referencia,
        COUNT(c.IdCita) AS Orden
      FROM Maestros_MACP.Medico_MACP m
      LEFT JOIN Operaciones_MACP.Cita_MACP c ON c.IdMedico = m.IdMedico
      GROUP BY m.IdMedico, m.Nombre
      ORDER BY COUNT(c.IdCita) DESC, m.IdMedico
    ) medicos
    UNION ALL
    SELECT 'Insumo (TOP 5)', Nombre, CONCAT(StockActual, ' en stock'), CONCAT('minimo ', StockMinimo), StockActual
    FROM (SELECT TOP (5) Nombre, StockActual, StockMinimo FROM Maestros_MACP.InsumoMedico_MACP ORDER BY StockActual, IdInsumo) insumos`,
  },
  distinct: {
    cols: ['Tipo', 'Valor'],
    note: 'Cada especialidad usada y cada cargo aparecen una sola vez.',
    query: `SELECT 'Especialidad' AS Tipo, DISTINCT_VALUE.Nombre AS Valor FROM (
      SELECT DISTINCT e.Nombre FROM Maestros_MACP.Medico_MACP m
      INNER JOIN Maestros_MACP.Especialidad_MACP e ON e.IdEspecialidad = m.IdEspecialidad
    ) DISTINCT_VALUE
    UNION ALL
    SELECT 'Cargo', Cargo FROM (SELECT DISTINCT Cargo FROM Maestros_MACP.Personal_MACP) cargos`,
  },
  pivot: {
    cols: ['Año', 'Mes', 'Programadas', 'Atendidas', 'Canceladas'],
    note: 'Agrupa las citas por año y mes, separadas por estado.',
    query: `SELECT YEAR(FechaCita) AS Anio, MONTH(FechaCita) AS Mes,
      SUM(CASE WHEN Estado = 'Programada' THEN 1 ELSE 0 END) AS Programadas,
      SUM(CASE WHEN Estado = 'Atendida' THEN 1 ELSE 0 END) AS Atendidas,
      SUM(CASE WHEN Estado = 'Cancelada' THEN 1 ELSE 0 END) AS Canceladas
      FROM Operaciones_MACP.Cita_MACP GROUP BY YEAR(FechaCita), MONTH(FechaCita)
      ORDER BY Anio, Mes`,
  },
  sub: {
    cols: ['Consulta', 'Nombre', 'Valor', 'Promedio'],
    note: 'Compara el stock y el número de citas contra sus promedios.',
    query: `SELECT 'Insumo bajo promedio' AS Consulta, Nombre, CAST(StockActual AS VARCHAR(50)) AS Valor,
      CAST((SELECT AVG(CAST(StockActual AS DECIMAL(18,2))) FROM Maestros_MACP.InsumoMedico_MACP) AS VARCHAR(50)) AS Promedio
      FROM Maestros_MACP.InsumoMedico_MACP
      WHERE StockActual < (SELECT AVG(CAST(StockActual AS DECIMAL(18,2))) FROM Maestros_MACP.InsumoMedico_MACP)
      UNION ALL
      SELECT 'Medico >= promedio de citas', m.Nombre, CAST(COUNT(c.IdCita) AS VARCHAR(50)),
      CAST((SELECT AVG(CAST(Cantidad AS DECIMAL(18,2))) FROM
        (SELECT COUNT(*) AS Cantidad FROM Maestros_MACP.Medico_MACP mx
         LEFT JOIN Operaciones_MACP.Cita_MACP cx ON cx.IdMedico = mx.IdMedico GROUP BY mx.IdMedico) promedio) AS VARCHAR(50))
      FROM Maestros_MACP.Medico_MACP m LEFT JOIN Operaciones_MACP.Cita_MACP c ON c.IdMedico = m.IdMedico
      GROUP BY m.IdMedico, m.Nombre
      HAVING COUNT(c.IdCita) >= (SELECT AVG(CAST(Cantidad AS DECIMAL(18,2))) FROM
        (SELECT COUNT(*) AS Cantidad FROM Maestros_MACP.Medico_MACP mx
         LEFT JOIN Operaciones_MACP.Cita_MACP cx ON cx.IdMedico = mx.IdMedico GROUP BY mx.IdMedico) promedio)`,
  },
  exists: {
    cols: ['Condición', 'IdPaciente', 'Nombre'],
    note: 'Separa pacientes con al menos una cita de aquellos sin consultas.',
    query: `SELECT 'EXISTS - con al menos una cita' AS Condicion, p.IdPaciente, CONCAT(p.Nombre, ' ', p.Apellido) AS Nombre
      FROM Maestros_MACP.Paciente_MACP p
      WHERE EXISTS (SELECT 1 FROM Operaciones_MACP.Cita_MACP c WHERE c.IdPaciente = p.IdPaciente)
      UNION ALL
      SELECT 'NOT EXISTS - sin ninguna consulta', p.IdPaciente, CONCAT(p.Nombre, ' ', p.Apellido)
      FROM Maestros_MACP.Paciente_MACP p
      WHERE NOT EXISTS (SELECT 1 FROM Operaciones_MACP.Cita_MACP c
        INNER JOIN Operaciones_MACP.Consulta_MACP co ON co.IdCita = c.IdCita WHERE c.IdPaciente = p.IdPaciente)
      ORDER BY IdPaciente`,
  },
} as const

app.get('/api/health', async (_req, res, next) => {
  try {
    await (await getPool()).request().query('SELECT 1 AS ok')
    res.json({ ok: true, database: process.env.DB_DATABASE || 'clinica_macp' })
  } catch (error) {
    next(error)
  }
})

app.post('/api/login', async (req, res, next) => {
  try {
    const { usuario, contrasena } = req.body as { usuario?: string; contrasena?: string }
    if (!usuario?.trim() || !contrasena) return res.status(400).json({ error: 'Ingrese usuario y contraseña.' })
    const result = await (await getPool()).request()
      .input('Usuario', sql.VarChar(50), usuario.trim())
      .input('Contrasena', sql.VarChar(255), contrasena)
      .query(`UPDATE Maestros_MACP.Personal_MACP
        SET Contrasena = CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @Contrasena), 2)
        OUTPUT INSERTED.IdPersonal, INSERTED.Cargo, INSERTED.Usuario, INSERTED.Nombre, INSERTED.Apellido
        WHERE Usuario = @Usuario AND Estado = 'Activo'
          AND (
            Contrasena = CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @Contrasena), 2)
            OR Contrasena = @Contrasena
          )`)
    const personal = result.recordset[0]
    if (!personal) return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' })
    res.json({
      IdPersonal: personal.IdPersonal,
      Cargo: personal.Cargo,
      Usuario: personal.Usuario,
      Nombre: `${personal.Nombre} ${personal.Apellido}`,
      Token: signToken(personal.IdPersonal, personal.Usuario),
    })
  } catch (error) {
    next(error)
  }
})

app.use('/api', requireAuth)

app.get('/api/db', async (_req, res, next) => {
  try {
    const pool = await getPool()
    const entries = await Promise.all(Object.entries(dataQueries).map(async ([name, query]) => {
      const result = await pool.request().query(query)
      return [name, normalizeRows(result.recordset)] as const
    }))
    res.json(Object.fromEntries(entries))
  } catch (error) {
    next(error)
  }
})

const catalogues = {
  Especialidad: { schema: 'Maestros_MACP', table: 'Especialidad_MACP', pk: 'IdEspecialidad', cols: ['Nombre', 'Descripcion', 'Estado'] },
  Consultorio: { schema: 'Maestros_MACP', table: 'Consultorio_MACP', pk: 'IdConsultorio', cols: ['Numero', 'Piso', 'Descripcion', 'Estado'] },
  Paciente: { schema: 'Maestros_MACP', table: 'Paciente_MACP', pk: 'IdPaciente', cols: ['DNI', 'Nombre', 'Apellido', 'FechaNacimiento', 'Telefono', 'Direccion', 'Correo', 'Estado'] },
  Seguro: { schema: 'Maestros_MACP', table: 'Seguro_MACP', pk: 'IdSeguro', cols: ['Nombre', 'TipoSeguro'] },
  Alergia: { schema: 'Maestros_MACP', table: 'Alergia_MACP', pk: 'IdAlergia', cols: ['Nombre', 'Descripcion', 'Estado'] },
  Personal: { schema: 'Maestros_MACP', table: 'Personal_MACP', pk: 'IdPersonal', cols: ['DNI', 'Nombre', 'Apellido', 'Telefono', 'Cargo', 'Usuario', 'Contrasena', 'HoraEntradaProgramada', 'HoraSalidaProgramada', 'Estado'] },
  Medico: { schema: 'Maestros_MACP', table: 'Medico_MACP', pk: 'IdMedico', cols: ['IdEspecialidad', 'DNI', 'Nombre', 'Apellido', 'Telefono', 'Correo', 'Estado'] },
  Tratamiento: { schema: 'Maestros_MACP', table: 'Tratamiento_MACP', pk: 'IdTratamiento', cols: ['Nombre', 'Descripcion', 'Estado'] },
  Examen: { schema: 'Maestros_MACP', table: 'Examen_MACP', pk: 'IdExamen', cols: ['Nombre', 'Costo', 'Estado'] },
  Procedimiento: { schema: 'Maestros_MACP', table: 'Procedimiento_MACP', pk: 'IdProcedimiento', cols: ['Nombre', 'Descripcion', 'Costo', 'Estado'] },
  Insumo: { schema: 'Maestros_MACP', table: 'InsumoMedico_MACP', pk: 'IdInsumo', cols: ['Nombre', 'UnidadMedida', 'StockMinimo', 'StockActual', 'Estado'] },
} as const

type Catalogue = keyof typeof catalogues
type Executor = sql.ConnectionPool | sql.Transaction

function bindValue(request: sql.Request, key: string, value: unknown) {
  if (key === 'Contrasena') request.input(key, sql.VarChar(255), value)
  else if (typeof value === 'number') request.input(key, sql.Decimal(18, 2), value)
  else request.input(key, sql.NVarChar(4000), value ?? null)
}

async function saveCatalogueRow(executor: Executor, table: Catalogue, row: Record<string, unknown>, modifier: string) {
  const spec = catalogues[table]
  const id = Number(row[spec.pk]) || 0
  if ('DNI' in row && !/^\d{8}$/.test(String(row.DNI))) throw new Error('El DNI debe tener 8 dígitos.')
  if (table === 'Paciente' && (!String(row.Nombre || '').trim() || !String(row.Apellido || '').trim() || !row.FechaNacimiento)) {
    throw new Error('Nombre, apellido y fecha de nacimiento son obligatorios.')
  }
  const columns = spec.cols.filter((column) => row[column] !== undefined && !(column === 'Contrasena' && row[column] === ''))
  if (!id && table === 'Personal' && !columns.includes('Contrasena')) {
    throw new Error('La contraseña es obligatoria para el nuevo personal.')
  }
  if (id && !columns.length) throw new Error('No hay campos para actualizar.')
  const request = executor.request()
  for (const column of columns) bindValue(request, column, row[column])
  const fullTable = `[${spec.schema}].[${spec.table}]`
  const passwordValue = (column: string) => column === 'Contrasena'
    ? `CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', @${column}), 2)`
    : `@${column}`

  if (id) {
    request.input('id', sql.Int, id).input('modifier', sql.NVarChar(50), modifier)
    const sets = columns.map((column) => `[${column}] = ${passwordValue(column)}`)
    if (table !== 'Seguro') sets.push('Modificador = @modifier', 'FechaModificacion = SYSDATETIME()')
    const result = await request.query(`UPDATE ${fullTable} SET ${sets.join(', ')} OUTPUT INSERTED.[${spec.pk}] AS id WHERE [${spec.pk}] = @id`)
    if (!result.recordset[0]) throw new Error('No se encontró el registro que se quiere actualizar.')
    return result.recordset[0].id as number
  }

  const fields: string[] = [...columns]
  const values = columns.map(passwordValue)
  if (table !== 'Seguro') {
    fields.push('Creador')
    values.push('@modifier')
    request.input('modifier', sql.NVarChar(50), modifier)
  }
  const result = await request.query(`INSERT INTO ${fullTable} (${fields.map((field) => `[${field}]`).join(', ')})
    OUTPUT INSERTED.[${spec.pk}] AS id VALUES (${values.join(', ')})`)
  return result.recordset[0].id as number
}

app.post('/api/catalogos/:tabla', async (req, res, next) => {
  try {
    const table = req.params.tabla as Catalogue
    if (!(table in catalogues)) return res.status(404).json({ error: 'Catálogo desconocido.' })
    const { fila } = req.body as { fila?: Record<string, unknown> }
    if (!fila || typeof fila !== 'object') return res.status(400).json({ error: 'Faltan los datos del registro.' })
    const id = await saveCatalogueRow(await getPool(), table, fila, (req as AuthRequest).auth!.Usuario)
    res.json({ id })
  } catch (error) {
    next(error)
  }
})

app.post('/api/pacientes', async (req, res, next) => {
  const transaction = new sql.Transaction(await getPool())
  let transactionStarted = false
  try {
    const { paciente, seguro, alergias } = req.body as {
      paciente?: Record<string, unknown>
      seguro?: { IdSeguro: number; NumeroPoliza: string; FechaAfiliacion: string } | null
      alergias?: { IdAlergia: number; Gravedad: string; Observaciones: string }[]
    }
    if (!paciente || !Array.isArray(alergias)) return res.status(400).json({ error: 'Datos del paciente incompletos.' })
    await transaction.begin()
    transactionStarted = true
    if (!paciente.Nombre || !paciente.Apellido || !paciente.FechaNacimiento) {
      throw new Error('Nombre, apellido y fecha de nacimiento son obligatorios.')
    }
    if (seguro && (!seguro.NumeroPoliza?.trim() || !seguro.FechaAfiliacion)) {
      throw new Error('Indique número de póliza y fecha de afiliación.')
    }
    const idPaciente = await saveCatalogueRow(transaction, 'Paciente', paciente, (req as AuthRequest).auth!.Usuario)
    const removeSeguro = transaction.request().input('id', sql.Int, idPaciente)
    await removeSeguro.query('DELETE FROM Operaciones_MACP.DetalleSeguro_MACP WHERE IdPaciente = @id')
    if (seguro) {
      const duplicate = await transaction.request()
        .input('idPaciente', sql.Int, idPaciente)
        .input('idSeguro', sql.Int, seguro.IdSeguro)
        .input('poliza', sql.NVarChar(50), seguro.NumeroPoliza)
        .query(`SELECT TOP (1) 1 AS Existe FROM Operaciones_MACP.DetalleSeguro_MACP WITH (UPDLOCK, HOLDLOCK)
          WHERE IdSeguro = @idSeguro AND NumeroPoliza = @poliza AND IdPaciente <> @idPaciente`)
      if (duplicate.recordset.length) throw new Error('El número de póliza ya existe en esa aseguradora.')
      await transaction.request()
        .input('idPaciente', sql.Int, idPaciente)
        .input('idSeguro', sql.Int, seguro.IdSeguro)
        .input('poliza', sql.NVarChar(50), seguro.NumeroPoliza)
        .input('fecha', sql.Date, seguro.FechaAfiliacion)
        .query(`INSERT INTO Operaciones_MACP.DetalleSeguro_MACP (IdPaciente, IdSeguro, NumeroPoliza, FechaAfiliacion)
          VALUES (@idPaciente, @idSeguro, @poliza, @fecha)`)
    }
    await transaction.request().input('id', sql.Int, idPaciente)
      .query('DELETE FROM Operaciones_MACP.DetalleAlergia_MACP WHERE IdPaciente = @id')
    for (const alergia of alergias) {
      await transaction.request()
        .input('idPaciente', sql.Int, idPaciente)
        .input('idAlergia', sql.Int, alergia.IdAlergia)
        .input('gravedad', sql.VarChar(20), alergia.Gravedad)
        .input('observaciones', sql.NVarChar(250), alergia.Observaciones)
        .query(`INSERT INTO Operaciones_MACP.DetalleAlergia_MACP (IdPaciente, IdAlergia, Gravedad, Observaciones)
          VALUES (@idPaciente, @idAlergia, @gravedad, @observaciones)`)
    }
    await transaction.commit()
    res.json({ id: idPaciente })
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback()
      } catch (rollbackError) {
        console.error('No se pudo revertir la transacción del paciente:', rollbackError)
      }
    }
    next(error)
  }
})

app.post('/api/horarios', async (req, res, next) => {
  try {
    const { IdMedico, DiaSemana, HoraInicio, HoraFin } = req.body as Record<string, number | string>
    await (await getPool()).request()
      .input('IdMedico', sql.Int, Number(IdMedico))
      .input('DiaSemana', sql.TinyInt, Number(DiaSemana))
      .input('HoraInicio', sql.VarChar(8), HoraInicio)
      .input('HoraFin', sql.VarChar(8), HoraFin)
      .query(`INSERT INTO Maestros_MACP.HorarioMedico_MACP (IdMedico, DiaSemana, HoraInicio, HoraFin)
        VALUES (@IdMedico, @DiaSemana, @HoraInicio, @HoraFin)`)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/horarios/:id', async (req, res, next) => {
  try {
    await (await getPool()).request().input('id', sql.Int, Number(req.params.id))
      .query('DELETE FROM Maestros_MACP.HorarioMedico_MACP WHERE IdHorarioMedico = @id')
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.post('/api/asignaciones', async (req, res, next) => {
  try {
    const { IdConsultorio, IdMedico, DiaSemana, Turno } = req.body as Record<string, number | string>
    await (await getPool()).request()
      .input('IdConsultorio', sql.Int, Number(IdConsultorio))
      .input('IdMedico', sql.Int, Number(IdMedico))
      .input('DiaSemana', sql.TinyInt, Number(DiaSemana))
      .input('Turno', sql.VarChar(15), Turno)
      .query(`INSERT INTO Operaciones_MACP.DetalleMedicoConsultorio_MACP (IdConsultorio, IdMedico, DiaSemana, Turno)
        VALUES (@IdConsultorio, @IdMedico, @DiaSemana, @Turno)`)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/asignaciones', async (req, res, next) => {
  try {
    const { IdConsultorio, IdMedico, DiaSemana, Turno } = req.body as Record<string, number | string>
    await (await getPool()).request()
      .input('IdConsultorio', sql.Int, Number(IdConsultorio))
      .input('IdMedico', sql.Int, Number(IdMedico))
      .input('DiaSemana', sql.TinyInt, Number(DiaSemana))
      .input('Turno', sql.VarChar(15), Turno)
      .query(`DELETE FROM Operaciones_MACP.DetalleMedicoConsultorio_MACP
        WHERE IdConsultorio = @IdConsultorio AND IdMedico = @IdMedico AND DiaSemana = @DiaSemana AND Turno = @Turno`)
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.post('/api/citas', async (req, res, next) => {
  try {
    const args = req.body as {
      IdPaciente: number; IdMedico: number; IdConsultorio: number; IdPersonal: number
      FechaCita: string; HoraCita: string; Motivo: string; IdProcedimiento?: number | null
    }
    const request = (await getPool()).request()
      .input('IdPaciente', sql.Int, args.IdPaciente)
      .input('IdMedico', sql.Int, args.IdMedico)
      .input('IdConsultorio', sql.Int, args.IdConsultorio)
      .input('IdPersonal', sql.Int, args.IdPersonal)
      .input('FechaCita', sql.Date, args.FechaCita)
      .input('HoraCita', sql.Time, args.HoraCita)
      .input('Motivo', sql.VarChar(250), args.Motivo)
      .input('IdProcedimiento', sql.Int, args.IdProcedimiento ?? null)
      .output('IdCita', sql.Int)
    const result = await request.execute('Operaciones_MACP.sp_RegistrarCita_MACP')
    res.json({ id: result.output.IdCita })
  } catch (error) {
    next(error)
  }
})

app.post('/api/citas/:id/cancelar', async (req, res, next) => {
  try {
    const result = await (await getPool()).request()
      .input('id', sql.Int, Number(req.params.id))
      .input('modificador', sql.NVarChar(50), (req as AuthRequest).auth!.Usuario)
      .query(`UPDATE Operaciones_MACP.Cita_MACP
        SET Estado = 'Cancelada', Modificador = @modificador, FechaModificacion = SYSDATETIME()
        WHERE IdCita = @id AND Estado = 'Programada'`)
    if (result.rowsAffected[0] === 0) throw new Error('La cita no existe o ya no está programada.')
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.post('/api/consultas', async (req, res, next) => {
  const transaction = new sql.Transaction(await getPool())
  let transactionStarted = false
  try {
    const { consulta, tratamientos, examenes } = req.body as {
      consulta: { IdCita: number; Diagnostico: string; Observaciones: string; IdInsumo: number; Cantidad: number }
      tratamientos: { IdTratamiento: number; Indicaciones: string; DuracionDias: number }[]
      examenes: { IdExamen: number; Indicaciones: string }[]
    }
    if (!consulta.Diagnostico?.trim()) throw new Error('El diagnóstico es obligatorio.')
    await transaction.begin()
    transactionStarted = true
    const request = transaction.request()
      .input('IdCita', sql.Int, consulta.IdCita)
      .input('Diagnostico', sql.VarChar(500), consulta.Diagnostico)
      .input('Observaciones', sql.VarChar(500), consulta.Observaciones)
      .input('IdInsumo', sql.Int, consulta.IdInsumo)
      .input('Cantidad', sql.Int, consulta.Cantidad)
      .output('IdConsulta', sql.Int)
    const result = await request.execute('Operaciones_MACP.sp_RegistrarConsulta_MACP')
    const idConsulta = Number(result.output.IdConsulta)
    for (const tratamiento of tratamientos) {
      const detail = await transaction.request()
        .input('IdConsulta', sql.Int, idConsulta)
        .input('IdTratamiento', sql.Int, tratamiento.IdTratamiento)
        .input('Indicaciones', sql.NVarChar(500), tratamiento.Indicaciones)
        .input('DuracionDias', sql.Int, tratamiento.DuracionDias)
        .query(`INSERT INTO Operaciones_MACP.DetalleTratamiento_MACP (IdConsulta, IdTratamiento, Indicaciones, DuracionDias)
          SELECT @IdConsulta, t.IdTratamiento, @Indicaciones, @DuracionDias
          FROM Maestros_MACP.Tratamiento_MACP t WHERE t.IdTratamiento = @IdTratamiento AND t.Estado = 'Activo'`)
      if (detail.rowsAffected[0] === 0) throw new Error('Tratamiento inexistente o inactivo.')
    }
    for (const examen of examenes) {
      const detail = await transaction.request()
        .input('IdConsulta', sql.Int, idConsulta)
        .input('IdExamen', sql.Int, examen.IdExamen)
        .input('Indicaciones', sql.NVarChar(500), examen.Indicaciones)
        .query(`INSERT INTO Operaciones_MACP.DetalleExamen_MACP (IdConsulta, IdExamen, Indicaciones, CostoAplicado)
          SELECT @IdConsulta, e.IdExamen, @Indicaciones, e.Costo
          FROM Maestros_MACP.Examen_MACP e WHERE e.IdExamen = @IdExamen AND e.Estado = 'Activo'`)
      if (detail.rowsAffected[0] === 0) throw new Error('Examen inexistente o inactivo.')
    }
    await transaction.commit()
    res.json({ id: idConsulta })
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback()
      } catch (rollbackError) {
        console.error('No se pudo revertir la transacción de la consulta:', rollbackError)
      }
    }
    next(error)
  }
})

app.post('/api/asistencia/marcar', async (req, res, next) => {
  try {
    const { IdPersonal, Tipo } = req.body as { IdPersonal: number; Tipo: 'ENTRADA' | 'SALIDA' }
    await (await getPool()).request()
      .input('IdPersonal', sql.Int, IdPersonal)
      .input('Tipo', sql.VarChar(10), Tipo)
      .execute('Operaciones_MACP.sp_MarcarAsistencia_MACP')
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

app.get('/api/asistencia/resumen', async (req, res, next) => {
  try {
    const year = Number(req.query.anio)
    const month = Number(req.query.mes)
    const idPersonal = req.query.idPersonal ? Number(req.query.idPersonal) : null
    const result = await (await getPool()).request()
      .input('Anio', sql.Int, year)
      .input('Mes', sql.Int, month)
      .input('IdPersonal', sql.Int, idPersonal)
      .execute('Operaciones_MACP.sp_CalcularAsistencia_MACP')
    res.json(normalizeRows(result.recordset))
  } catch (error) {
    next(error)
  }
})

app.get('/api/reportes/:key', async (req, res, next) => {
  try {
    const report = reports[req.params.key as keyof typeof reports]
    if (!report) return res.status(404).json({ error: 'Reporte desconocido.' })
    const result = await (await getPool()).request().query(report.query)
    res.json({ cols: report.cols, rows: normalizeRows(result.recordset).map((row) => Object.values(row)), nota: report.note })
  } catch (error) {
    next(error)
  }
})

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Ruta de API desconocida.' })
})

if (process.env.NODE_ENV === 'production') {
  const distPath = resolve(process.cwd(), 'dist')
  app.use(express.static(distPath))
  app.get('/{*path}', (_req, res, next) => {
    res.sendFile(resolve(distPath, 'index.html'), (error) => {
      if (error) next(error)
    })
  })
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error)
  const message = error instanceof Error ? error.message : 'Error inesperado en el servidor.'
  res.status(500).json({ error: message })
})

const port = Number(
  process.env.NODE_ENV === 'production'
    ? process.env.PORT || process.env.API_PORT || 3001
    : process.env.API_PORT || 3001,
)
app.listen(port, () => {
  console.log(`API de Clínica MACP escuchando en el puerto ${port}.`)
  try {
    void getPool().then(() => console.log(`Conectado a ${process.env.DB_DATABASE || 'clinica_macp'}.`)).catch((error: unknown) => {
      console.error('No se pudo conectar con SQL Server:', error)
    })
  } catch (error) {
    console.error('No se pudo conectar con SQL Server:', error)
  }
})
