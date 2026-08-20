import { Router } from "express";
import { pool } from "../db/pool.js";
import { calcularPeriodoPrueba } from "../services/periodoPrueba.js";

export const dashboardRouter = Router();

// GET /api/dashboard/rrhh — KPIs generales para la vista ejecutiva de RRHH.
dashboardRouter.get("/rrhh", async (req, res) => {
  try {
    const empleadosResult = await pool.query(`SELECT * FROM employees`);
    const empleados = empleadosResult.rows;
    const activos = empleados.filter((e) => e.estado === "ACTIVO");
    const inactivos = empleados.filter((e) => e.estado === "INACTIVO");

    const evaluacionesUltimasPP = await pool.query(
      `SELECT DISTINCT ON (employee_id) employee_id, resultado FROM periodo_prueba_evaluaciones ORDER BY employee_id, fecha DESC`
    );
    const evalPPPorEmpleado = Object.fromEntries(
      evaluacionesUltimasPP.rows.map((e) => [e.employee_id, e])
    );

    const conPeriodoPrueba = activos.map((e) => ({
      ...e,
      periodoPrueba: calcularPeriodoPrueba(e.fecha_ingreso, evalPPPorEmpleado[e.id] || null),
    }));

    const enPeriodoPrueba = conPeriodoPrueba.filter((e) => e.periodoPrueba.estado === "EN_PRUEBA");
    const proximosAVencer = enPeriodoPrueba
      .filter((e) => e.periodoPrueba.alerta)
      .map((e) => ({
        id: e.id,
        nombre: `${e.nombre} ${e.apellido}`,
        legajo: e.legajo,
        diasRestantes: e.periodoPrueba.diasRestantes,
      }));

    // --- Evaluaciones de desempeño ---
    const evalStats = await pool.query(`
      SELECT count(*)::int AS total, avg(puntaje_total)::numeric(4,2) AS promedio
      FROM evaluaciones_desempeno WHERE puntaje_total IS NOT NULL
    `);

    const destacados = await pool.query(`
      SELECT e.id, e.nombre, e.apellido, e.puesto,
             avg(ed.puntaje_total)::numeric(4,2) AS promedio,
             count(DISTINCT cl.id) FILTER (WHERE cl.tipo IN ('POSITIVO', 'FELICITACION'))::int AS "comentariosPositivos"
      FROM employees e
      LEFT JOIN evaluaciones_desempeno ed ON ed.employee_id = e.id AND ed.puntaje_total IS NOT NULL
      LEFT JOIN comentarios_lider cl ON cl.employee_id = e.id
      WHERE e.estado = 'ACTIVO'
      GROUP BY e.id, e.nombre, e.apellido, e.puesto
        HAVING avg(ed.puntaje_total) IS NOT NULL
          OR count(DISTINCT cl.id) FILTER (WHERE cl.tipo IN ('POSITIVO', 'FELICITACION')) >= 3
      ORDER BY promedio DESC NULLS LAST, "comentariosPositivos" DESC
      LIMIT 5
    `);

    const enRiesgo = await pool.query(`
      WITH datos AS (
        SELECT e.id, e.nombre, e.apellido, e.puesto,
               avg(ed.puntaje_total)::numeric(4,2) AS promedio,
               (SELECT count(*) FROM sanciones s WHERE s.employee_id = e.id)::int AS sanciones,
               (SELECT count(*) FROM sanciones s WHERE s.employee_id = e.id
                  AND s.fecha >= CURRENT_DATE - INTERVAL '3 months')::int AS sanciones_recientes,
               count(DISTINCT cl.id) FILTER (WHERE cl.tipo IN ('NEGATIVO', 'CORRECTIVO'))::int AS comentarios_negativos
        FROM employees e
        LEFT JOIN evaluaciones_desempeno ed ON ed.employee_id = e.id AND ed.puntaje_total IS NOT NULL
        LEFT JOIN comentarios_lider cl ON cl.employee_id = e.id
        WHERE e.estado = 'ACTIVO'
        GROUP BY e.id, e.nombre, e.apellido, e.puesto
      )
      SELECT id, nombre, apellido, puesto, promedio, sanciones,
             sanciones_recientes AS "sancionesRecientes",
             comentarios_negativos AS "comentariosNegativos"
      FROM datos
      WHERE promedio < 6 OR sanciones_recientes >= 1 OR comentarios_negativos >= 2
      ORDER BY (sanciones_recientes + comentarios_negativos) DESC, promedio ASC NULLS LAST
      LIMIT 5
    `);

    const puestosMenorDesempeno = await pool.query(`
      SELECT puesto, avg(ed.puntaje_total)::numeric(4,2) AS promedio, count(*)::int AS evaluaciones
      FROM evaluaciones_desempeno ed JOIN employees e ON e.id = ed.employee_id
      WHERE ed.puntaje_total IS NOT NULL
      GROUP BY puesto ORDER BY promedio ASC LIMIT 6
    `);

    const sectoresMejorDesempeno = await pool.query(`
      SELECT sector, avg(ed.puntaje_total)::numeric(4,2) AS promedio, count(*)::int AS evaluaciones
      FROM evaluaciones_desempeno ed JOIN employees e ON e.id = ed.employee_id
      WHERE ed.puntaje_total IS NOT NULL
      GROUP BY sector ORDER BY promedio DESC LIMIT 6
    `);

    const distribucion = await pool.query(`
      SELECT
        CASE
          WHEN puntaje_total < 4 THEN '0-4'
          WHEN puntaje_total < 6 THEN '4-6'
          WHEN puntaje_total < 8 THEN '6-8'
          ELSE '8-10'
        END AS rango,
        count(*)::int AS cantidad
      FROM evaluaciones_desempeno WHERE puntaje_total IS NOT NULL
      GROUP BY rango
    `);
    const ordenRangos = ["0-4", "4-6", "6-8", "8-10"];
    const distribucionOrdenada = ordenRangos.map((r) => ({
      rango: r,
      cantidad: distribucion.rows.find((row) => row.rango === r)?.cantidad || 0,
    }));

    const evolucionMensual = await pool.query(`
      SELECT to_char(date_trunc('month', fecha), 'YYYY-MM') AS mes,
             avg(puntaje_total)::numeric(4,2) AS promedio,
             count(*)::int AS cantidad
      FROM evaluaciones_desempeno
      WHERE puntaje_total IS NOT NULL AND fecha >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY mes ORDER BY mes
    `);

    const cursosStats = await pool.query(`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE estado = 'COMPLETADO')::int AS completados
      FROM cursos_capacitaciones
    `);

    const sancionesStats = await pool.query(`SELECT count(*)::int AS total FROM sanciones`);

    // --- Rotación % (año actual) ---
    // Fórmula estándar: bajas del período / dotación promedio del período.
    // Dotación promedio = (dotación al inicio del año + dotación actual) / 2.
    const dotacionInicioAnio = await pool.query(`
      SELECT count(*)::int AS total FROM employees
      WHERE fecha_ingreso <= date_trunc('year', CURRENT_DATE)
        AND (fecha_baja IS NULL OR fecha_baja > date_trunc('year', CURRENT_DATE))
    `);
    const dotacionActual = await pool.query(`SELECT count(*)::int AS total FROM employees WHERE estado != 'BAJA'`);
    const bajasEnAnio = await pool.query(`
      SELECT count(*)::int AS total FROM employees
      WHERE estado = 'BAJA' AND fecha_baja >= date_trunc('year', CURRENT_DATE) AND fecha_baja <= CURRENT_DATE
    `);
    const dInicio = dotacionInicioAnio.rows[0].total;
    const dActual = dotacionActual.rows[0].total;
    const dPromedio = (dInicio + dActual) / 2;
    const rotacion = {
      anio: new Date().getFullYear(),
      bajasEnAnio: bajasEnAnio.rows[0].total,
      dotacionInicioAnio: dInicio,
      dotacionActual: dActual,
      porcentaje: dPromedio > 0 ? Number(((bajasEnAnio.rows[0].total / dPromedio) * 100).toFixed(1)) : 0,
    };

    // --- Bajas por sector y motivo ---
    // El motivo es texto libre (lo carga RRHH al dar de baja); se clasifica
    // por palabras clave en 3 categorías. Los casos de "no superó el período
    // de prueba" solo aparecen acá si se cargaron manualmente como Baja.
    const bajasPorSectorYMotivoResult = await pool.query(`
      SELECT lugar_trabajo AS "lugarTrabajo", sector,
        count(*) FILTER (WHERE motivo_baja ILIKE '%renuncia%')::int AS renuncia,
        count(*) FILTER (WHERE motivo_baja ILIKE '%per%odo de prueba%')::int AS "finPeriodoPrueba",
        count(*) FILTER (
          WHERE motivo_baja IS NULL
             OR (motivo_baja NOT ILIKE '%renuncia%' AND motivo_baja NOT ILIKE '%per%odo de prueba%')
        )::int AS otros,
        count(*)::int AS total
      FROM employees
      WHERE estado = 'BAJA'
      GROUP BY lugar_trabajo, sector
      ORDER BY total DESC
    `);

    res.json({
      empleadosActivos: activos.length,
      empleadosInactivos: inactivos.length,
      empleadosEnPeriodoPrueba: enPeriodoPrueba.length,
      proximosAVencer,
      rotacion,
      bajasPorSectorYMotivo: bajasPorSectorYMotivoResult.rows,
      evaluaciones: {
        realizadas: evalStats.rows[0].total,
        promedioGeneral: evalStats.rows[0].promedio,
      },
      capacitaciones: cursosStats.rows[0],
      sanciones: sancionesStats.rows[0].total,
      colaboradoresDestacados: destacados.rows,
      colaboradoresEnRiesgo: enRiesgo.rows,
      puestosMenorDesempeno: puestosMenorDesempeno.rows,
      sectoresMejorDesempeno: sectoresMejorDesempeno.rows,
      distribucionCalificaciones: distribucionOrdenada,
      evolucionMensual: evolucionMensual.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular el dashboard general" });
  }
});
