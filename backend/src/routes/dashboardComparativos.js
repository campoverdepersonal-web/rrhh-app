import { Router } from "express";
import { pool } from "../db/pool.js";
import { calcularPeriodoPrueba } from "../services/periodoPrueba.js";

export const comparativosRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/dashboard/puestos — ranking general de puestos
// ---------------------------------------------------------------------------
comparativosRouter.get("/puestos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        e.puesto,
        count(DISTINCT e.id)::int AS cantidad_empleados,
        avg(ed.puntaje_total)::numeric(4,2) AS promedio,
        count(ed.id)::int AS evaluaciones,
        (SELECT count(*)::int FROM sanciones s
           JOIN employees e2 ON e2.id = s.employee_id
           WHERE e2.puesto = e.puesto AND s.tipo = 'APERCIBIMIENTO') AS apercibimientos
      FROM employees e
      LEFT JOIN evaluaciones_desempeno ed ON ed.employee_id = e.id AND ed.puntaje_total IS NOT NULL
      WHERE e.estado = 'ACTIVO'
      GROUP BY e.puesto
      ORDER BY promedio DESC NULLS LAST
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular el comparativo de puestos" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/puestos/:puesto — detalle de un puesto: ranking interno,
// necesidades de capacitación y apercibimientos.
// ---------------------------------------------------------------------------
comparativosRouter.get("/puestos/:puesto", async (req, res) => {
  try {
    const { puesto } = req.params;

    const ranking = await pool.query(`
      SELECT e.id, e.nombre, e.apellido, e.lugar_trabajo,
             avg(ed.puntaje_total)::numeric(4,2) AS promedio,
             count(ed.id)::int AS evaluaciones
      FROM employees e
      LEFT JOIN evaluaciones_desempeno ed ON ed.employee_id = e.id AND ed.puntaje_total IS NOT NULL
      WHERE e.puesto = $1 AND e.estado = 'ACTIVO'
      GROUP BY e.id, e.nombre, e.apellido, e.lugar_trabajo
      ORDER BY promedio DESC NULLS LAST
    `, [puesto]);

    const promedioPuesto = await pool.query(`
      SELECT avg(ed.puntaje_total)::numeric(4,2) AS promedio, count(ed.id)::int AS evaluaciones
      FROM evaluaciones_desempeno ed
      JOIN employees e ON e.id = ed.employee_id
      WHERE e.puesto = $1 AND ed.puntaje_total IS NOT NULL
    `, [puesto]);

    const apercibimientos = await pool.query(`
      SELECT count(*)::int AS total
      FROM sanciones s JOIN employees e ON e.id = s.employee_id
      WHERE e.puesto = $1 AND s.tipo = 'APERCIBIMIENTO'
    `, [puesto]);

    const necesidadesCapacitacion = await pool.query(`
      SELECT c.curso, count(*)::int AS pendientes
      FROM cursos_capacitaciones c JOIN employees e ON e.id = c.employee_id
      WHERE e.puesto = $1 AND c.estado IN ('PENDIENTE', 'EN_CURSO', 'NO_COMPLETADO')
      GROUP BY c.curso ORDER BY pendientes DESC LIMIT 5
    `, [puesto]);

    res.json({
      puesto,
      promedio: promedioPuesto.rows[0].promedio,
      evaluaciones: promedioPuesto.rows[0].evaluaciones,
      apercibimientos: apercibimientos.rows[0].total,
      ranking: ranking.rows,
      necesidadesCapacitacion: necesidadesCapacitacion.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular el detalle del puesto" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/lugares — ranking general de lugares de trabajo
// ---------------------------------------------------------------------------
comparativosRouter.get("/lugares", async (req, res) => {
  try {
    const empleadosResult = await pool.query(`SELECT * FROM employees WHERE estado = 'ACTIVO'`);
    const porLugar = {};
    for (const e of empleadosResult.rows) {
      porLugar[e.lugar_trabajo] ??= { lugarTrabajo: e.lugar_trabajo, cantidadEmpleados: 0, enPeriodoPrueba: 0 };
      porLugar[e.lugar_trabajo].cantidadEmpleados += 1;
      if (calcularPeriodoPrueba(e.fecha_ingreso).estado === "EN_PRUEBA") {
        porLugar[e.lugar_trabajo].enPeriodoPrueba += 1;
      }
    }

    const promedios = await pool.query(`
      SELECT e.lugar_trabajo,
             avg(ed.puntaje_total)::numeric(4,2) AS promedio,
             count(ed.id)::int AS evaluaciones,
             count(DISTINCT ed.employee_id)::int AS empleados_evaluados
      FROM employees e
      LEFT JOIN evaluaciones_desempeno ed ON ed.employee_id = e.id AND ed.puntaje_total IS NOT NULL
      WHERE e.estado = 'ACTIVO'
      GROUP BY e.lugar_trabajo
    `);

    const sanciones = await pool.query(`
      SELECT e.lugar_trabajo, count(*)::int AS sanciones
      FROM sanciones s JOIN employees e ON e.id = s.employee_id
      GROUP BY e.lugar_trabajo
    `);

    const cursos = await pool.query(`
      SELECT e.lugar_trabajo, count(*) FILTER (WHERE c.estado = 'COMPLETADO')::int AS cursos_completados
      FROM cursos_capacitaciones c JOIN employees e ON e.id = c.employee_id
      GROUP BY e.lugar_trabajo
    `);

    const resultado = Object.values(porLugar).map((l) => {
      const prom = promedios.rows.find((p) => p.lugar_trabajo === l.lugarTrabajo);
      const sanc = sanciones.rows.find((s) => s.lugar_trabajo === l.lugarTrabajo);
      const curs = cursos.rows.find((c) => c.lugar_trabajo === l.lugarTrabajo);
      return {
        ...l,
        promedio: prom?.promedio ?? null,
        evaluaciones: prom?.evaluaciones ?? 0,
        empleadosEvaluados: prom?.empleados_evaluados ?? 0,
        sanciones: sanc?.sanciones ?? 0,
        cursosCompletados: curs?.cursos_completados ?? 0,
      };
    }).sort((a, b) => (b.promedio ?? -1) - (a.promedio ?? -1));

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular el comparativo de lugares de trabajo" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/lugares/:lugar — detalle de un lugar de trabajo
// ---------------------------------------------------------------------------
comparativosRouter.get("/lugares/:lugar", async (req, res) => {
  try {
    const { lugar } = req.params;

    const empleados = await pool.query(`SELECT * FROM employees WHERE lugar_trabajo = $1 AND estado = 'ACTIVO'`, [lugar]);
    const enPeriodoPrueba = empleados.rows.filter((e) => calcularPeriodoPrueba(e.fecha_ingreso).estado === "EN_PRUEBA").length;

    const promedioGeneral = await pool.query(`
      SELECT avg(ed.puntaje_total)::numeric(4,2) AS promedio, count(DISTINCT ed.employee_id)::int AS empleados_evaluados
      FROM evaluaciones_desempeno ed JOIN employees e ON e.id = ed.employee_id
      WHERE e.lugar_trabajo = $1 AND ed.puntaje_total IS NOT NULL
    `, [lugar]);

    const promedioPorPuesto = await pool.query(`
      SELECT e.puesto, avg(ed.puntaje_total)::numeric(4,2) AS promedio, count(ed.id)::int AS evaluaciones
      FROM employees e
      LEFT JOIN evaluaciones_desempeno ed ON ed.employee_id = e.id AND ed.puntaje_total IS NOT NULL
      WHERE e.lugar_trabajo = $1 AND e.estado = 'ACTIVO'
      GROUP BY e.puesto ORDER BY promedio DESC NULLS LAST
    `, [lugar]);

    const cursos = await pool.query(`
      SELECT count(*) FILTER (WHERE c.estado = 'COMPLETADO')::int AS completados, count(*)::int AS total
      FROM cursos_capacitaciones c JOIN employees e ON e.id = c.employee_id
      WHERE e.lugar_trabajo = $1
    `, [lugar]);

    const sanciones = await pool.query(`
      SELECT count(*)::int AS total
      FROM sanciones s JOIN employees e ON e.id = s.employee_id
      WHERE e.lugar_trabajo = $1
    `, [lugar]);

    res.json({
      lugarTrabajo: lugar,
      cantidadEmpleados: empleados.rows.length,
      empleadosEnPeriodoPrueba: enPeriodoPrueba,
      promedioGeneral: promedioGeneral.rows[0].promedio,
      empleadosEvaluados: promedioGeneral.rows[0].empleados_evaluados,
      promedioPorPuesto: promedioPorPuesto.rows,
      cursos: cursos.rows[0],
      sanciones: sanciones.rows[0].total,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular el detalle del lugar de trabajo" });
  }
});
