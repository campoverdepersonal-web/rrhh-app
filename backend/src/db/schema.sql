-- ============================================================================
-- Esquema RRHH - Legajo dinámico de empleados
-- ============================================================================
-- Este archivo crea el modelo de datos completo previsto en la especificación.
-- Las tablas marcadas "ACTIVO" ya están conectadas a la API/UI de este MVP.
-- Las marcadas "SCAFFOLD" están creadas para no romper el modelo cuando se
-- construyan los próximos módulos (comentarios, evaluaciones, sanciones, etc.),
-- pero todavía no tienen endpoints ni pantallas.
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios (                            -- ACTIVO (autenticación)
  id                 SERIAL PRIMARY KEY,
  nombre             VARCHAR(160) NOT NULL,
  email              VARCHAR(160) UNIQUE NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  rol                VARCHAR(30) NOT NULL DEFAULT 'RRHH'
                     CHECK (rol IN ('ADMIN', 'RRHH', 'LIDER')),
  activo             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employees (                          -- ACTIVO
  id                SERIAL PRIMARY KEY,
  legajo             VARCHAR(20) UNIQUE NOT NULL,
  nombre             VARCHAR(120) NOT NULL,
  apellido           VARCHAR(120) NOT NULL,
  cuil               VARCHAR(20) UNIQUE NOT NULL,
  fecha_ingreso      DATE NOT NULL,
  puesto             VARCHAR(120) NOT NULL,
  sector             VARCHAR(120) NOT NULL,
  lugar_trabajo      VARCHAR(120) NOT NULL,
  estado             VARCHAR(20) NOT NULL DEFAULT 'ACTIVO'        -- ACTIVO | INACTIVO
                     CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at         TIMESTAMP NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historial_puestos (                   -- ACTIVO (lectura); alta manual pendiente de UI
  id                 SERIAL PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  puesto             VARCHAR(120) NOT NULL,
  sector             VARCHAR(120),
  lugar_trabajo      VARCHAR(120),
  fecha_inicio       DATE NOT NULL,
  fecha_fin          DATE,
  motivo             VARCHAR(255),
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS periodo_prueba_evaluaciones (          -- ACTIVO
  id                 SERIAL PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  fecha              DATE NOT NULL,
  resultado          VARCHAR(20) NOT NULL
                     CHECK (resultado IN ('CONFIRMADO', 'EXTENSION', 'BAJA')),
  responsable        VARCHAR(120) NOT NULL,
  observaciones      TEXT,
  documento_adjunto  VARCHAR(255),
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Seguimiento general (común a todos los puestos) — SCAFFOLD
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS comentarios_lider (                    -- SCAFFOLD
  id                 SERIAL PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  fecha              DATE NOT NULL,
  lider              VARCHAR(120) NOT NULL,
  tipo               VARCHAR(20) NOT NULL
                     CHECK (tipo IN ('POSITIVO', 'NEGATIVO', 'CORRECTIVO', 'OBSERVACION', 'FELICITACION')),
  comentario         TEXT NOT NULL,
  lugar_trabajo      VARCHAR(120),
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluaciones_desempeno (               -- SCAFFOLD
  id                 SERIAL PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  fecha              DATE NOT NULL,
  evaluador          VARCHAR(120) NOT NULL,
  puntaje_total      NUMERIC(5,2),
  competencias       JSONB,
  objetivos          JSONB,
  observaciones      TEXT,
  resultado          VARCHAR(60),
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sanciones (                            -- SCAFFOLD
  id                 SERIAL PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  fecha              DATE NOT NULL,
  motivo             TEXT NOT NULL,
  tipo               VARCHAR(30) NOT NULL
                     CHECK (tipo IN ('APERCIBIMIENTO', 'LLAMADO_ATENCION', 'SUSPENSION')),
  responsable        VARCHAR(120) NOT NULL,
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluaciones_teoricas (                -- SCAFFOLD
  id                 SERIAL PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  nombre             VARCHAR(160) NOT NULL,
  fecha              DATE NOT NULL,
  puntaje            NUMERIC(5,2),
  resultado          VARCHAR(60),
  tematica           VARCHAR(120),
  archivo_adjunto    VARCHAR(255),
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cursos_capacitaciones (                -- SCAFFOLD
  id                 SERIAL PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  curso              VARCHAR(160) NOT NULL,
  modalidad          VARCHAR(60),
  fecha              DATE,
  estado             VARCHAR(30),
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS criterios_evaluacion_puesto (          -- SCAFFOLD (panel admin de criterios configurables)
  id                 SERIAL PRIMARY KEY,
  puesto             VARCHAR(120) NOT NULL,
  nombre_criterio    VARCHAR(160) NOT NULL,
  descripcion        TEXT,
  peso               NUMERIC(5,2),
  activo             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS historial_cambios (                    -- SCAFFOLD (auditoría, punto 9 de la spec)
  id                 SERIAL PRIMARY KEY,
  tabla              VARCHAR(60) NOT NULL,
  registro_id        INTEGER NOT NULL,
  usuario            VARCHAR(120) NOT NULL,
  fecha_hora         TIMESTAMP NOT NULL DEFAULT now(),
  campo_modificado   VARCHAR(120),
  valor_anterior     TEXT,
  valor_nuevo        TEXT
);

CREATE INDEX IF NOT EXISTS idx_employees_puesto ON employees(puesto);
CREATE INDEX IF NOT EXISTS idx_employees_lugar ON employees(lugar_trabajo);
CREATE INDEX IF NOT EXISTS idx_employees_estado ON employees(estado);
CREATE INDEX IF NOT EXISTS idx_historial_puestos_employee ON historial_puestos(employee_id);
CREATE INDEX IF NOT EXISTS idx_periodo_prueba_employee ON periodo_prueba_evaluaciones(employee_id);
