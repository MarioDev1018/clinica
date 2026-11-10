-- Ejecutar una vez en clinica_macp despues del script Clinica_MACP_Unidad_II.sql.
ALTER PROCEDURE Operaciones_MACP.sp_RegistrarCita_MACP
    @IdPaciente INT, @IdMedico INT, @IdConsultorio INT, @IdPersonal INT,
    @FechaCita DATE, @HoraCita TIME(0), @Motivo VARCHAR(250),
    @IdProcedimiento INT = NULL, @DuracionMinutos INT = 30, @IdCita INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @DiaSemana INT = (DATEDIFF(DAY, '19000101', @FechaCita) % 7 + 1);
    DECLARE @Turno VARCHAR(15) = CASE WHEN @HoraCita < '13:00' THEN 'Manana' ELSE 'Tarde' END;
    BEGIN TRY
        BEGIN TRANSACTION;
        IF @DuracionMinutos NOT BETWEEN 15 AND 180
            THROW 50019, 'La duracion debe estar entre 15 y 180 minutos.', 1;
        IF NOT EXISTS (SELECT 1 FROM Maestros_MACP.Paciente_MACP WHERE IdPaciente = @IdPaciente AND Estado = 'Activo')
            THROW 50002, 'Paciente inexistente o inactivo.', 1;
        IF NOT EXISTS (SELECT 1 FROM Maestros_MACP.Medico_MACP WHERE IdMedico = @IdMedico AND Estado = 'Activo')
            THROW 50003, 'Medico inexistente o inactivo.', 1;
        IF NOT EXISTS (SELECT 1 FROM Maestros_MACP.Consultorio_MACP WHERE IdConsultorio = @IdConsultorio AND Estado = 'Activo')
            THROW 50004, 'Consultorio inexistente o inactivo.', 1;
        IF NOT EXISTS (SELECT 1 FROM Maestros_MACP.Personal_MACP WHERE IdPersonal = @IdPersonal AND Estado = 'Activo')
            THROW 50005, 'Personal inexistente o inactivo.', 1;
        IF NOT EXISTS (
            SELECT 1 FROM Maestros_MACP.HorarioMedico_MACP
            WHERE IdMedico = @IdMedico AND DiaSemana = @DiaSemana AND HoraInicio <= @HoraCita
              AND DATEADD(MINUTE, @DuracionMinutos, CAST(@HoraCita AS DATETIME2)) <= CAST(HoraFin AS DATETIME2)
        ) THROW 50006, 'La cita esta fuera del horario medico.', 1;
        IF NOT EXISTS (
            SELECT 1 FROM Operaciones_MACP.DetalleMedicoConsultorio_MACP
            WHERE IdConsultorio = @IdConsultorio AND IdMedico = @IdMedico
              AND DiaSemana = @DiaSemana AND Turno = @Turno
        ) THROW 50007, 'El medico no tiene asignado ese consultorio en el turno.', 1;
        IF EXISTS (
            SELECT 1 FROM Operaciones_MACP.Cita_MACP WITH (UPDLOCK, HOLDLOCK)
            WHERE FechaCita = @FechaCita AND Estado <> 'Cancelada'
              AND (IdMedico = @IdMedico OR IdConsultorio = @IdConsultorio)
              AND CAST(HoraCita AS DATETIME2) < DATEADD(MINUTE, @DuracionMinutos, CAST(@HoraCita AS DATETIME2))
              AND CAST(@HoraCita AS DATETIME2) < DATEADD(MINUTE, DuracionMinutos, CAST(HoraCita AS DATETIME2))
        ) THROW 50008, 'Horario ocupado por el medico o consultorio.', 1;

        INSERT INTO Operaciones_MACP.Cita_MACP
            (IdConsultorio, IdPaciente, IdMedico, IdPersonal, FechaCita, HoraCita, DuracionMinutos, Motivo)
        VALUES
            (@IdConsultorio, @IdPaciente, @IdMedico, @IdPersonal, @FechaCita, @HoraCita, @DuracionMinutos, @Motivo);
        SET @IdCita = CONVERT(INT, SCOPE_IDENTITY());
        IF @IdProcedimiento IS NOT NULL
        BEGIN
            INSERT INTO Operaciones_MACP.DetalleCitaProcedimiento_MACP
                (IdProcedimiento, IdCita, ObservacionEnfermeria, CostoAplicado)
            SELECT IdProcedimiento, @IdCita, 'Pendiente de realizar', Costo
            FROM Maestros_MACP.Procedimiento_MACP
            WHERE IdProcedimiento = @IdProcedimiento AND Estado = 'Activo';
            IF @@ROWCOUNT = 0 THROW 50009, 'Procedimiento inexistente o inactivo.', 1;
        END;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
