import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireRole } from "../middleware/auth.js";

export const puestosRouter = Router();

// Todas las tablas donde se guarda el NOMBRE de un puesto como texto. Si en
// el futuro se agrega otra tabla con una columna "puesto", sumarla acá para
// que el renombrado la incluya.
const TABLAS_CON_PUESTO = [
  { tabla: "employees", clave: "empleados", descripcion: "Legajos" },
  { tabla: "historial_puestos", clave: "historial", descripcion: "Historial de puestos" },
  { tabla: "puesto_competencias", clave: "matriz", descripcion: "Matriz de competencias" },
  { tabla: "criterios_evaluacion_puesto", clave: "criterios", descripcion: "Criterios de evaluación" },
];

// La comparación ignora mayúsculas y espacios sobrantes, para que
// "Conciliaciones bancarias " y "Conciliaciones Bancarias" cuenten como el
// mismo puesto.
const MISMO_PUESTO = `lower(btrim(puesto)) = lower(btrim($1))`;

// ---------------------------------------------------------------------------
// GET /api/puestos — todos los puestos que aparecen en algún lado de la app,
// con cuántos registros usa cada uno.
// ---------------------------------------------------------------------------
puestosRouter.get("/", requireRole("ADMIN", "RRHH"), async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH todos AS (
        SELECT btrim(puesto) AS puesto, 'activos' AS origen FROM employees WHERE estado != 'BAJA'
        UNION ALL SELECT btrim(puesto), 'bajas' FROM employees WHERE estado = 'BAJA'
        UNION ALL SELECT btrim(puesto), 'historial' FROM historial_puestos
        UNION ALL SELECT btrim(puesto), 'matriz' FROM puesto_competencias
        UNION ALL SELECT btrim(puesto), 'criterios' FROM criterios_evaluacion_puesto
      )
      SELECT
        min(puesto) AS nombre,
        count(*) FILTER (WHERE origen = 'activos')::int AS "empleadosActivos",
        count(*) FILTER (WHERE origen = 'bajas')::int AS "empleadosBaja",
        count(*) FILTER (WHERE origen = 'historial')::int AS historial,
        count(*) FILTER (WHERE origen = 'matriz')::int AS "competenciasMatriz",
        count(*) FILTER (WHERE origen = 'criterios')::int AS criterios,
        count(DISTINCT puesto)::int AS variantes
      FROM todos
      WHERE puesto IS NOT NULL AND puesto != ''
      GROUP BY lower(puesto)
      ORDER BY lower(min(puesto))
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar los puestos" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/puestos/renombrar — cambia la denominación de un puesto en TODA
// la app (legajos, historial, matriz de competencias, criterios). Se hace en
// una sola transacción: o se cambia todo, o no se cambia nada.
// Body: { actual: "Conciliaciones Bancarias", nuevo: "Administrativo de Cobros y Pagos" }
// ---------------------------------------------------------------------------
puestosRouter.post("/renombrar", requireRole("ADMIN", "RRHH"), async (req, res) => {
  const actual = String(req.body?.actual || "").trim();
  const nuevo = String(req.body?.nuevo || "").replace(/\s+/g, " ").trim();

  if (!actual) return res.status(400).json({ error: "Falta el puesto a renombrar" });
  if (!nuevo) return res.status(400).json({ error: "Falta el nombre nuevo del puesto" });
  if (nuevo.length > 120) return res.status(400).json({ error: "El nombre nuevo es demasiado largo (máximo 120 caracteres)" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Si el nombre nuevo ya existe como OTRO puesto con su propia matriz de
    // competencias, no se pueden mezclar las dos matrices automáticamente.
    const esMismoPuesto = actual.toLowerCase() === nuevo.toLowerCase();
    if (!esMismoPuesto) {
      const matrizActual = await client.query(`SELECT count(*)::int AS n FROM puesto_competencias WHERE ${MISMO_PUESTO}`, [actual]);
      const matrizNueva = await client.query(`SELECT count(*)::int AS n FROM puesto_competencias WHERE ${MISMO_PUESTO}`, [nuevo]);
      if (matrizActual.rows[0].n > 0 && matrizNueva.rows[0].n > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          error: `Ya existe un puesto "${nuevo}" con su propia matriz de competencias. ` +
            `No se puede renombrar "${actual}" con ese nombre porque se mezclarían las dos matrices.`,
        });
      }
    }

    const cambios = {};
    for (const { tabla, clave } of TABLAS_CON_PUESTO) {
      const extra = tabla === "employees" ? ", updated_at = now()" : "";
      const r = await client.query(`UPDATE ${tabla} SET puesto = $2${extra} WHERE ${MISMO_PUESTO}`, [actual, nuevo]);
      cambios[clave] = r.rowCount;
    }

    const total = Object.values(cambios).reduce((a, b) => a + b, 0);
    if (total === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: `No se encontró el puesto "${actual}" en ningún registro` });
    }

    await client.query("COMMIT");
    res.json({ actual, nuevo, cambios });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Error al renombrar el puesto. No se modificó nada." });
  } finally {
    client.release();
  }
});
