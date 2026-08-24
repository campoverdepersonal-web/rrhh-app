import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { pool } from "../db/pool.js";
import { calcularPeriodoPrueba } from "../services/periodoPrueba.js";
import { calcularAntiguedad } from "../services/antiguedad.js";
import { requireRole } from "../middleware/auth.js";

export const employeesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ---------------------------------------------------------------------------
// POST /api/employees/importar — carga masiva de empleados desde Excel/CSV.
// Crea empleados nuevos o actualiza los existentes (por legajo). Nunca borra
// nada — solo agrega/actualiza. Devuelve un resumen con errores por fila.
// ---------------------------------------------------------------------------
employeesRouter.post("/importar", upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió ningún archivo" });
    }

    let filas;
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
    } catch (err) {
      return res.status(400).json({ error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx) o CSV válido?" });
    }

    if (filas.length === 0) {
      return res.status(400).json({ error: "El archivo no tiene filas de datos" });
    }

    const resultado = { insertados: 0, actualizados: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2; // fila 1 = encabezados
      const fila = normalizarFila(filas[i]);
      const motivoError = validarFila(fila);

      if (motivoError) {
        resultado.errores.push({ fila: numeroFila, legajo: fila.legajo || "(sin legajo)", motivo: motivoError });
        continue;
      }

      try {
        const upsert = await pool.query(
          `INSERT INTO employees (legajo, nombre, apellido, cuil, fecha_ingreso, puesto, sector, lugar_trabajo, estado)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (legajo) DO UPDATE SET
             nombre = EXCLUDED.nombre,
             apellido = EXCLUDED.apellido,
             cuil = EXCLUDED.cuil,
             fecha_ingreso = EXCLUDED.fecha_ingreso,
             puesto = EXCLUDED.puesto,
             sector = EXCLUDED.sector,
             lugar_trabajo = EXCLUDED.lugar_trabajo,
             estado = EXCLUDED.estado,
             updated_at = now()
           RETURNING (xmax = 0) AS insertado`,
          [fila.legajo, fila.nombre, fila.apellido, fila.cuil, fila.fechaIngreso, fila.puesto, fila.sector, fila.lugarTrabajo, fila.estado]
        );

        if (upsert.rows[0].insertado) resultado.insertados++;
        else resultado.actualizados++;
      } catch (err) {
        if (err.code === "23505") {
          resultado.errores.push({ fila: numeroFila, legajo: fila.legajo, motivo: `El CUIL ${fila.cuil} ya pertenece a otro legajo` });
        } else {
          resultado.errores.push({ fila: numeroFila, legajo: fila.legajo, motivo: "Error al guardar: " + err.message });
        }
      }
    }

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al procesar la importación" });
  }
});

function normalizarFila(raw) {
  const buscar = (...nombresPosibles) => {
    for (const key of Object.keys(raw)) {
      const keyNorm = key.trim().toLowerCase();
      if (nombresPosibles.includes(keyNorm)) return String(raw[key]).trim();
    }
    return "";
  };
  const buscarCrudo = (...nombresPosibles) => {
    for (const key of Object.keys(raw)) {
      const keyNorm = key.trim().toLowerCase();
      if (nombresPosibles.includes(keyNorm)) return raw[key];
    }
    return "";
  };

  return {
    legajo: buscar("legajo"),
    nombre: buscar("nombre"),
    apellido: buscar("apellido"),
    cuil: buscar("cuil"),
    fechaIngreso: parsearFecha(buscarCrudo("fecha de ingreso", "fecha ingreso")),
    puesto: buscar("puesto"),
    sector: buscar("sector"),
    lugarTrabajo: buscar("lugar de trabajo"),
    estado: (buscar("estado") || "ACTIVO").toUpperCase(),
  };
}

function parsearFecha(valor) {
  if (!valor && valor !== 0) return null;
  if (valor instanceof Date && !isNaN(valor)) {
    return valor.toISOString().slice(0, 10);
  }
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const match = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/employees/importar-actualizar-puesto — actualiza SOLO el campo
// puesto de empleados existentes (por Legajo). No toca ningún otro dato.
// ---------------------------------------------------------------------------
employeesRouter.post("/importar-actualizar-puesto", upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });

    let filas;
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
    } catch {
      return res.status(400).json({ error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx) o CSV válido?" });
    }
    if (filas.length === 0) return res.status(400).json({ error: "El archivo no tiene filas de datos" });

    const buscarCol = (raw, ...nombres) => {
      for (const key of Object.keys(raw)) {
        if (nombres.includes(key.trim().toLowerCase())) return String(raw[key]).trim();
      }
      return "";
    };

    const resultado = { actualizados: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const legajo = buscarCol(filas[i], "legajo");
      const puesto = buscarCol(filas[i], "puesto");

      if (!legajo) { resultado.errores.push({ fila: numeroFila, motivo: "Falta el Legajo" }); continue; }
      if (!puesto) { resultado.errores.push({ fila: numeroFila, legajo, motivo: "Falta el Puesto" }); continue; }

      const { rowCount } = await pool.query(
        `UPDATE employees SET puesto = $1, updated_at = now() WHERE legajo = $2`,
        [puesto, legajo]
      );

      if (rowCount === 0) {
        resultado.errores.push({ fila: numeroFila, legajo, motivo: `No existe ningún empleado con legajo "${legajo}"` });
      } else {
        resultado.actualizados++;
      }
    }

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar los puestos" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/importar-actualizar-legajo — renumera el Legajo de
// empleados existentes, buscándolos por CUIL (no por Legajo, ya que
// justamente eso es lo que cambia). Valida que el legajo nuevo no esté
// repetido antes de aplicar el cambio.
// ---------------------------------------------------------------------------
employeesRouter.post("/importar-actualizar-legajo", upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });

    let filas;
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
    } catch {
      return res.status(400).json({ error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx) o CSV válido?" });
    }
    if (filas.length === 0) return res.status(400).json({ error: "El archivo no tiene filas de datos" });

    const buscarCol = (raw, ...nombres) => {
      for (const key of Object.keys(raw)) {
        if (nombres.includes(key.trim().toLowerCase())) return String(raw[key]).trim();
      }
      return "";
    };

    const resultado = { actualizados: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const cuil = buscarCol(filas[i], "cuil");
      const legajoNuevo = buscarCol(filas[i], "legajo nuevo", "nuevo legajo", "legajo");

      if (!cuil) { resultado.errores.push({ fila: numeroFila, motivo: "Falta el CUIL" }); continue; }
      if (!legajoNuevo) { resultado.errores.push({ fila: numeroFila, motivo: "Falta el Legajo nuevo" }); continue; }

      const empleado = await pool.query(`SELECT id FROM employees WHERE cuil = $1`, [cuil]);
      if (empleado.rows.length === 0) {
        resultado.errores.push({ fila: numeroFila, motivo: `No existe ningún empleado con CUIL "${cuil}"` });
        continue;
      }
      const employeeId = empleado.rows[0].id;

      const enUso = await pool.query(`SELECT id FROM employees WHERE legajo = $1 AND id != $2`, [legajoNuevo, employeeId]);
      if (enUso.rows.length > 0) {
        resultado.errores.push({ fila: numeroFila, motivo: `El legajo "${legajoNuevo}" ya está en uso por otro empleado` });
        continue;
      }

      await pool.query(`UPDATE employees SET legajo = $1, updated_at = now() WHERE id = $2`, [legajoNuevo, employeeId]);
      resultado.actualizados++;
    }

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar los legajos" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/importar-bajas — registra la baja de varios empleados
// a la vez (por Legajo), para carga de datos históricos y análisis de
// rotación. No borra nada — el historial de cada persona se conserva.
// ---------------------------------------------------------------------------
employeesRouter.post("/importar-bajas", upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });

    let filas;
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
    } catch {
      return res.status(400).json({ error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx) o CSV válido?" });
    }
    if (filas.length === 0) return res.status(400).json({ error: "El archivo no tiene filas de datos" });

    const buscarCol = (raw, ...nombres) => {
      for (const key of Object.keys(raw)) {
        if (nombres.includes(key.trim().toLowerCase())) return String(raw[key]).trim();
      }
      return "";
    };
    const buscarColCruda = (raw, ...nombres) => {
      for (const key of Object.keys(raw)) {
        if (nombres.includes(key.trim().toLowerCase())) return raw[key];
      }
      return "";
    };

    const resultado = { insertados: 0, actualizados: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const legajo = buscarCol(filas[i], "legajo");
      const nombre = buscarCol(filas[i], "nombre");
      const apellido = buscarCol(filas[i], "apellido");
      const cuil = buscarCol(filas[i], "cuil");
      const puesto = buscarCol(filas[i], "puesto");
      const sector = buscarCol(filas[i], "sector");
      const lugarTrabajo = buscarCol(filas[i], "lugar de trabajo");
      const fechaAlta = parsearFecha(buscarColCruda(filas[i], "fecha de alta", "fecha de ingreso"));
      const fechaBaja = parsearFecha(buscarColCruda(filas[i], "fecha de baja"));
      const motivo = buscarCol(filas[i], "motivo") || null;

      if (!legajo) { resultado.errores.push({ fila: numeroFila, motivo: "Falta el Legajo" }); continue; }
      if (!fechaBaja) { resultado.errores.push({ fila: numeroFila, legajo, motivo: "Fecha de baja vacía o con formato inválido (usar DD/MM/AAAA)" }); continue; }

      const existente = await pool.query(`SELECT id FROM employees WHERE legajo = $1`, [legajo]);

      if (existente.rows.length > 0) {
        // Ya existe: actualiza los datos provistos (los que vengan vacíos no
        // pisan lo que ya había) y lo marca como baja.
        await pool.query(
          `UPDATE employees SET
             nombre = COALESCE(NULLIF($1, ''), nombre),
             apellido = COALESCE(NULLIF($2, ''), apellido),
             cuil = COALESCE(NULLIF($3, ''), cuil),
             puesto = COALESCE(NULLIF($4, ''), puesto),
             sector = COALESCE(NULLIF($5, ''), sector),
             lugar_trabajo = COALESCE(NULLIF($6, ''), lugar_trabajo),
             fecha_ingreso = COALESCE($7, fecha_ingreso),
             estado = 'BAJA', fecha_baja = $8, motivo_baja = $9, updated_at = now()
           WHERE legajo = $10`,
          [nombre, apellido, cuil, puesto, sector, lugarTrabajo, fechaAlta, fechaBaja, motivo, legajo]
        );
        resultado.actualizados++;
        continue;
      }

      // No existe: se crea directamente como baja (carga histórica). Acá sí
      // hacen falta todos los datos básicos, porque es un alta nueva.
      if (!nombre || !apellido || !cuil || !puesto || !sector || !lugarTrabajo || !fechaAlta) {
        resultado.errores.push({
          fila: numeroFila, legajo,
          motivo: "El legajo no existe en el sistema y faltan datos para crearlo (Nombre, Apellido, CUIL, Puesto, Sector, Lugar de trabajo y Fecha de alta son obligatorios en ese caso)",
        });
        continue;
      }

      try {
        await pool.query(
          `INSERT INTO employees (legajo, nombre, apellido, cuil, fecha_ingreso, puesto, sector, lugar_trabajo, estado, fecha_baja, motivo_baja)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'BAJA',$9,$10)`,
          [legajo, nombre, apellido, cuil, fechaAlta, puesto, sector, lugarTrabajo, fechaBaja, motivo]
        );
        resultado.insertados++;
      } catch (err) {
        if (err.code === "23505") {
          resultado.errores.push({ fila: numeroFila, legajo, motivo: `El CUIL "${cuil}" ya pertenece a otro legajo` });
        } else {
          throw err;
        }
      }
    }

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al importar las bajas" });
  }
});

function validarFila(fila) {
  if (!fila.legajo) return "Falta el Legajo";
  if (!fila.nombre) return "Falta el Nombre";
  if (!fila.apellido) return "Falta el Apellido";
  if (!fila.cuil) return "Falta el CUIL";
  if (!fila.fechaIngreso) return "Fecha de ingreso vacía o con formato inválido (usar DD/MM/AAAA)";
  if (!fila.puesto) return "Falta el Puesto";
  if (!fila.sector) return "Falta el Sector";
  if (!fila.lugarTrabajo) return "Falta el Lugar de trabajo";
  if (!["ACTIVO", "INACTIVO"].includes(fila.estado)) return `Estado inválido: "${fila.estado}" (debe ser ACTIVO o INACTIVO)`;
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/employees  — listado con estado de período de prueba (para tablas
// y filtros del dashboard general).
// ---------------------------------------------------------------------------
employeesRouter.get("/", async (req, res) => {
  try {
    const { puesto, sector, lugarTrabajo, estado } = req.query;

    const condiciones = [];
    const valores = [];
    if (puesto) { valores.push(puesto); condiciones.push(`puesto = $${valores.length}`); }
    if (sector) { valores.push(sector); condiciones.push(`sector = $${valores.length}`); }
    if (lugarTrabajo) { valores.push(lugarTrabajo); condiciones.push(`lugar_trabajo = $${valores.length}`); }
    if (estado) {
      valores.push(estado);
      condiciones.push(`estado = $${valores.length}`);
    } else {
      // Por defecto, los dados de baja no aparecen en la nómina activa.
      condiciones.push(`estado != 'BAJA'`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const { rows } = await pool.query(
      `SELECT * FROM employees ${where} ORDER BY apellido, nombre`,
      valores
    );

    const ultimasEvaluaciones = await pool.query(
      `SELECT DISTINCT ON (employee_id) employee_id, resultado, fecha
       FROM periodo_prueba_evaluaciones
       ORDER BY employee_id, fecha DESC`
    );
    const evalPorEmpleado = Object.fromEntries(
      ultimasEvaluaciones.rows.map((e) => [e.employee_id, e])
    );

    const empleados = rows.map((emp) => {
      const fechaReferencia = emp.estado === "BAJA" && emp.fecha_baja ? new Date(emp.fecha_baja) : new Date();
      const periodoPrueba = calcularPeriodoPrueba(emp.fecha_ingreso, evalPorEmpleado[emp.id] || null, fechaReferencia);
      return {
        ...serializeEmployee(emp),
        antiguedad: calcularAntiguedad(emp.fecha_ingreso, fechaReferencia).texto,
        periodoPrueba,
      };
    });

    res.json(empleados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar empleados" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/employees/:id — legajo dinámico completo
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GET /api/employees/bajas — listado de empleados dados de baja (para
// análisis de rotación, uniformes entregados durante su paso por la empresa, etc.)
// Va ANTES de GET /:id para que "bajas" no se interprete como un id.
// ---------------------------------------------------------------------------
employeesRouter.get("/bajas", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM employees WHERE estado = 'BAJA' ORDER BY fecha_baja DESC NULLS LAST`
    );
    res.json(rows.map((r) => ({
      ...serializeEmployee(r),
      antiguedad: calcularAntiguedad(r.fecha_ingreso, r.fecha_baja ? new Date(r.fecha_baja) : new Date()).texto,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar las bajas" });
  }
});

employeesRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const empleadoResult = await pool.query("SELECT * FROM employees WHERE id = $1", [id]);
    if (empleadoResult.rows.length === 0) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    const empleado = empleadoResult.rows[0];

    const historialPuestos = await pool.query(
      `SELECT * FROM historial_puestos WHERE employee_id = $1 ORDER BY fecha_inicio DESC`,
      [id]
    );

    const evaluacionesPeriodoPrueba = await pool.query(
      `SELECT * FROM periodo_prueba_evaluaciones WHERE employee_id = $1 ORDER BY fecha DESC`,
      [id]
    );

    const ultimaEvaluacion = evaluacionesPeriodoPrueba.rows[0] || null;
    const fechaReferencia = empleado.estado === "BAJA" && empleado.fecha_baja ? new Date(empleado.fecha_baja) : new Date();
    const periodoPrueba = calcularPeriodoPrueba(empleado.fecha_ingreso, ultimaEvaluacion, fechaReferencia);

    res.json({
      ...serializeEmployee(empleado),
      antiguedad: calcularAntiguedad(empleado.fecha_ingreso, fechaReferencia).texto,
      periodoPrueba,
      historialPuestos: historialPuestos.rows.map(serializeHistorialPuesto),
      historialDecisionesPeriodoPrueba: evaluacionesPeriodoPrueba.rows.map(serializeEvaluacionPeriodoPrueba),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el legajo del empleado" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/:id/historial-puestos — registra un cambio de puesto:
// cierra el registro anterior "abierto" (fecha_fin) y actualiza los datos
// actuales del empleado (puesto/sector/lugar de trabajo) para que el legajo
// siempre refleje su situación vigente.
// ---------------------------------------------------------------------------
employeesRouter.post("/:id/historial-puestos", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { puesto, sector, lugarTrabajo, fechaInicio, motivo } = req.body;

    if (!puesto || !sector || !lugarTrabajo || !fechaInicio) {
      return res.status(400).json({ error: "puesto, sector, lugarTrabajo y fechaInicio son obligatorios" });
    }

    await client.query("BEGIN");

    // Cierra el registro vigente (si existe), un día antes de que empiece el nuevo.
    await client.query(
      `UPDATE historial_puestos SET fecha_fin = $1::date - INTERVAL '1 day'
       WHERE employee_id = $2 AND fecha_fin IS NULL`,
      [fechaInicio, id]
    );

    const { rows } = await client.query(
      `INSERT INTO historial_puestos (employee_id, puesto, sector, lugar_trabajo, fecha_inicio, motivo)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, puesto, sector, lugarTrabajo, fechaInicio, motivo || null]
    );

    await client.query(
      `UPDATE employees SET puesto = $1, sector = $2, lugar_trabajo = $3, updated_at = now() WHERE id = $4`,
      [puesto, sector, lugarTrabajo, id]
    );

    await client.query("COMMIT");
    res.status(201).json(serializeHistorialPuesto(rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Error al registrar el cambio de puesto" });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/employees/:id/historial-puestos/:historialId — corrige un
// registro cargado por error. No modifica los datos actuales del empleado
// (si necesitás corregir el puesto vigente, cargá un nuevo cambio de puesto).
// ---------------------------------------------------------------------------
employeesRouter.delete("/:id/historial-puestos/:historialId", async (req, res) => {
  try {
    const { historialId } = req.params;
    const { rows } = await pool.query(
      `DELETE FROM historial_puestos WHERE id = $1 RETURNING id`,
      [historialId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el registro" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees — alta manual de empleado
// ---------------------------------------------------------------------------
employeesRouter.post("/", async (req, res) => {
  try {
    const { legajo, nombre, apellido, cuil, fechaIngreso, puesto, sector, lugarTrabajo } = req.body;

    if (!legajo || !nombre || !apellido || !cuil || !fechaIngreso || !puesto || !sector || !lugarTrabajo) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const { rows } = await pool.query(
      `INSERT INTO employees (legajo, nombre, apellido, cuil, fecha_ingreso, puesto, sector, lugar_trabajo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [legajo, nombre, apellido, cuil, fechaIngreso, puesto, sector, lugarTrabajo]
    );

    res.status(201).json(serializeEmployee(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe un empleado con ese legajo o CUIL" });
    }
    console.error(err);
    res.status(500).json({ error: "Error al crear el empleado" });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/employees/:id — edición de datos personales/laborales
// ---------------------------------------------------------------------------
employeesRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { legajo, nombre, apellido, cuil, puesto, sector, lugarTrabajo, estado } = req.body;

    if (legajo) {
      const enUso = await pool.query(`SELECT id FROM employees WHERE legajo = $1 AND id != $2`, [legajo, id]);
      if (enUso.rows.length > 0) {
        return res.status(409).json({ error: `El legajo "${legajo}" ya está en uso por otro empleado` });
      }
    }

    const { rows } = await pool.query(
      `UPDATE employees SET
         legajo = COALESCE($1, legajo),
         nombre = COALESCE($2, nombre),
         apellido = COALESCE($3, apellido),
         cuil = COALESCE($4, cuil),
         puesto = COALESCE($5, puesto),
         sector = COALESCE($6, sector),
         lugar_trabajo = COALESCE($7, lugar_trabajo),
         estado = COALESCE($8, estado),
         updated_at = now()
       WHERE id = $9
       RETURNING *`,
      [legajo, nombre, apellido, cuil, puesto, sector, lugarTrabajo, estado, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    res.json(serializeEmployee(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe otro empleado con ese legajo o CUIL" });
    }
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el empleado" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/:id/baja — registra la baja de un empleado. A partir de
// acá deja de aparecer en la nómina activa (Legajos), pero todo su historial
// (evaluaciones, sanciones, cursos, entregas de uniforme, etc.) se conserva.
// ---------------------------------------------------------------------------
employeesRouter.post("/:id/baja", async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, motivo } = req.body;

    if (!fecha) {
      return res.status(400).json({ error: "La fecha de baja es obligatoria" });
    }

    const { rows } = await pool.query(
      `UPDATE employees SET estado = 'BAJA', fecha_baja = $1, motivo_baja = $2, updated_at = now()
       WHERE id = $3 RETURNING *`,
      [fecha, motivo || null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    res.json(serializeEmployee(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar la baja" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/:id/reactivar — corrige una baja cargada por error,
// vuelve al empleado a estado Activo y limpia fecha/motivo de baja.
// ---------------------------------------------------------------------------
employeesRouter.post("/:id/reactivar", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE employees SET estado = 'ACTIVO', fecha_baja = NULL, motivo_baja = NULL, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }
    res.json(serializeEmployee(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al reactivar el empleado" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/employees/:id — elimina un empleado y todo su historial
// (comentarios, evaluaciones, sanciones, cursos, etc. por cascada). Solo ADMIN.
// ---------------------------------------------------------------------------
employeesRouter.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`DELETE FROM employees WHERE id = $1 RETURNING id`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el empleado" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/:id/periodo-prueba — registrar la decisión de fin de
// período de prueba (confirmado / extensión / baja).
// ---------------------------------------------------------------------------
employeesRouter.post("/:id/periodo-prueba", async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, resultado, responsable, observaciones, documentoAdjunto } = req.body;

    if (!fecha || !resultado || !responsable) {
      return res.status(400).json({ error: "fecha, resultado y responsable son obligatorios" });
    }
    if (!["CONFIRMADO", "EXTENSION", "BAJA"].includes(resultado)) {
      return res.status(400).json({ error: "resultado inválido" });
    }

    const { rows } = await pool.query(
      `INSERT INTO periodo_prueba_evaluaciones (employee_id, fecha, resultado, responsable, observaciones, documento_adjunto)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, fecha, resultado, responsable, observaciones || null, documentoAdjunto || null]
    );

    if (resultado === "BAJA") {
      await pool.query(`UPDATE employees SET estado = 'INACTIVO', updated_at = now() WHERE id = $1`, [id]);
    }

    res.status(201).json(serializeEvaluacionPeriodoPrueba(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar la decisión de período de prueba" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/employees/alertas/periodo-prueba — próximos a vencer (<=15 días),
// usado por el dashboard general de RRHH.
// ---------------------------------------------------------------------------
employeesRouter.get("/alertas/periodo-prueba", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM employees WHERE estado = 'ACTIVO' ORDER BY fecha_ingreso`
    );
    const proximos = rows
      .map((emp) => ({ ...serializeEmployee(emp), periodoPrueba: calcularPeriodoPrueba(emp.fecha_ingreso) }))
      .filter((emp) => emp.periodoPrueba.alerta);

    res.json(proximos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular alertas de período de prueba" });
  }
});

// ---------------------------------------------------------------------------
// Serializers: mapean snake_case (DB) -> camelCase (API/frontend)
// ---------------------------------------------------------------------------
function serializeEmployee(row) {
  return {
    id: row.id,
    legajo: row.legajo,
    nombre: row.nombre,
    apellido: row.apellido,
    cuil: row.cuil,
    fechaIngreso: row.fecha_ingreso,
    puesto: row.puesto,
    sector: row.sector,
    lugarTrabajo: row.lugar_trabajo,
    estado: row.estado,
    fechaBaja: row.fecha_baja,
    motivoBaja: row.motivo_baja,
  };
}

function serializeHistorialPuesto(row) {
  return {
    id: row.id,
    puesto: row.puesto,
    sector: row.sector,
    lugarTrabajo: row.lugar_trabajo,
    fechaInicio: row.fecha_inicio,
    fechaFin: row.fecha_fin,
    motivo: row.motivo,
  };
}

function serializeEvaluacionPeriodoPrueba(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    resultado: row.resultado,
    responsable: row.responsable,
    observaciones: row.observaciones,
    documentoAdjunto: row.documento_adjunto,
  };
}
