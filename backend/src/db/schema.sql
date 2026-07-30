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

CREATE TABLE IF NOT EXISTS cursos_capacitaciones (                -- ACTIVO
  id                 SERIAL PRIMARY KEY,
  employee_id        INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  curso              VARCHAR(160) NOT NULL,
  modalidad          VARCHAR(60),
  fecha              DATE,
  estado             VARCHAR(30),
  capacitador        VARCHAR(160),
  observaciones      TEXT,
  created_at         TIMESTAMP NOT NULL DEFAULT now()
);

-- Migración segura para bases de datos creadas antes de agregar estas columnas.
ALTER TABLE cursos_capacitaciones ADD COLUMN IF NOT EXISTS capacitador VARCHAR(160);
ALTER TABLE cursos_capacitaciones ADD COLUMN IF NOT EXISTS observaciones TEXT;

CREATE TABLE IF NOT EXISTS competencias (                         -- ACTIVO (diccionario de competencias)
  id                     SERIAL PRIMARY KEY,
  nombre                 VARCHAR(160) UNIQUE NOT NULL,
  tipo                   VARCHAR(10) NOT NULL CHECK (tipo IN ('BLANDA', 'TECNICA')),
  clasificacion          VARCHAR(30) CHECK (clasificacion IN ('ORGANIZACIONAL', 'ESPECIFICA_DE_PUESTO')),
  justificacion_clasificacion TEXT,
  definicion             TEXT,
  importancia            TEXT,
  conductas_esperadas    JSONB,
  conductas_no_esperadas JSONB,
  nivel_1_desc           TEXT,
  nivel_2_desc           TEXT,
  nivel_3_desc           TEXT,
  nivel_4_desc           TEXT,
  ejemplos_aplicacion    JSONB,
  created_at             TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS puesto_competencias (                  -- ACTIVO (matriz de asignación por puesto)
  id                 SERIAL PRIMARY KEY,
  puesto             VARCHAR(160) NOT NULL,
  competencia_id     INTEGER NOT NULL REFERENCES competencias(id) ON DELETE CASCADE,
  tipo_requerimiento VARCHAR(15) NOT NULL CHECK (tipo_requerimiento IN ('OBLIGATORIA', 'DESEABLE')),
  nivel_requerido    INTEGER NOT NULL CHECK (nivel_requerido BETWEEN 1 AND 4),
  UNIQUE (puesto, competencia_id)
);

CREATE INDEX IF NOT EXISTS idx_puesto_competencias_puesto ON puesto_competencias(puesto);

CREATE TABLE IF NOT EXISTS evaluacion_competencias (              -- ACTIVO (puntaje por competencia dentro de una evaluación)
  id                 SERIAL PRIMARY KEY,
  evaluacion_id      INTEGER NOT NULL REFERENCES evaluaciones_desempeno(id) ON DELETE CASCADE,
  competencia_id     INTEGER NOT NULL REFERENCES competencias(id) ON DELETE CASCADE,
  nivel_alcanzado    INTEGER NOT NULL CHECK (nivel_alcanzado BETWEEN 1 AND 4),
  nivel_evaluado     INTEGER,                                     -- nivel de la afirmación testeada (si viene de import)
  respuesta          VARCHAR(30),                                 -- Malo/Regular/Bueno/Muy Bueno (si viene de import)
  puntaje            NUMERIC(4,2),                                -- puntaje original de la fuente (si viene de import)
  observaciones      TEXT,
  UNIQUE (evaluacion_id, competencia_id)
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

-- Migración: campos de trazabilidad para importación de evaluaciones por
-- competencia (seguro tanto en bases nuevas como existentes).
ALTER TABLE evaluacion_competencias ADD COLUMN IF NOT EXISTS nivel_evaluado INTEGER;
ALTER TABLE evaluacion_competencias ADD COLUMN IF NOT EXISTS respuesta VARCHAR(30);
ALTER TABLE evaluacion_competencias ADD COLUMN IF NOT EXISTS puntaje NUMERIC(4,2);
