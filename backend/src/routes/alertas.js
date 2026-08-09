import { Router } from "express";
import { pool } from "../db/pool.js";
import { calcularPeriodoPrueba } from "../services/periodoPrueba.js";

export const alertasRouter = Router();

// ---------------------------------------------------------------------------
// Umbrales configurables (por ahora fijos e iguales para todos; se pueden
// ajustar acá mismo, o más adelante convertir en configuración por puesto).
// ---------------------------------------------------------------------------
const DIAS_SIN_EVALUACION_EFECTIVO = 120;  // "no fue evaluado" — personal efectivo
const DIAS_SIN_EVALUACION_PRUEBA = 60;     // "no fue evaluado" — todavía en período de prueba
const DIAS_SANCIONES_RECIENTES = 90;   // ventana para contar sanciones "acumuladas"
const UMBRAL_SANCIONES_ACUMULADAS = 2;
const CAIDA_DESEMPENO_PUNTOS = 2;      // baja de puntaje entre las 2 últimas evaluaciones
const DIAS_CURSO_SIN_COMPLETAR = 20;   // curso pendiente/en curso hace más de X días
const UMBRAL_SOBRESALIENTE = 9;        // puntaje de la última evaluación
const UMBRAL_PROMOCION_PROMEDIO = 8.5;
const DIAS_ANTIGUEDAD_PROMOCION = 365;

alertasRouter.get("/", async (req, res) => {
  try {
    const empleados = await pool.query(`SELECT * FROM employees WHERE estado = 'ACTIVO'`);

    const sinEvaluacionReciente = [];
    const sancionesAcumuladas = [];
    const bajaDesempeno = [];
    const cursosIncompletos = [];
    const resultadosSobresalientes = [];
    const candidatosPromocion = [];

    for (const emp of empleados.rows) {
      const nombreCompleto = `${emp.nombre} ${emp.apellido}`;

      // --- Evaluaciones (últimas 2, para tendencia) ---
      const evals = await pool.query(
        `SELECT fecha, puntaje_total FROM evaluaciones_desempeno
         WHERE employee_id = $1 AND puntaje_total IS NOT NULL
         ORDER BY fecha DESC LIMIT 2`,
        [emp.id]
      );

      const ultimaEval = evals.rows[0];
      const diasSinEval = ultimaEval
        ? Math.floor((Date.now() - new Date(ultimaEval.fecha)) / 86400000)
        : null;

      const periodoPrueba = calcularPeriodoPrueba(emp.fecha_ingreso);
      const enPeriodoPrueba = periodoPrueba.estado === "EN_PRUEBA";
      const umbralSinEvaluacion = enPeriodoPrueba ? DIAS_SIN_EVALUACION_PRUEBA : DIAS_SIN_EVALUACION_EFECTIVO;

      if (!ultimaEval || diasSinEval > umbralSinEvaluacion) {
        sinEvaluacionReciente.push({
          id: emp.id, nombre: nombreCompleto, puesto: emp.puesto,
          detalle: !ultimaEval
            ? `Nunca fue evaluado${enPeriodoPrueba ? " (en período de prueba)" : ""}`
            : `Última evaluación hace ${diasSinEval} días${enPeriodoPrueba ? " (en período de prueba)" : ""}`,
          _enPeriodoPrueba: enPeriodoPrueba,
          _nuncaEvaluado: !ultimaEval,
          _diasSinEval: diasSinEval ?? Infinity,
        });
      }

      if (evals.rows.length === 2) {
        const caida = Number(evals.rows[1].puntaje_total) - Number(evals.rows[0].puntaje_total);
        if (caida >= CAIDA_DESEMPENO_PUNTOS) {
          bajaDesempeno.push({
            id: emp.id, nombre: nombreCompleto, puesto: emp.puesto,
            detalle: `Bajó de ${evals.rows[1].puntaje_total} a ${evals.rows[0].puntaje_total} puntos`,
          });
        }
      }

      if (ultimaEval && Number(ultimaEval.puntaje_total) >= UMBRAL_SOBRESALIENTE) {
        resultadosSobresalientes.push({
          id: emp.id, nombre: nombreCompleto, puesto: emp.puesto,
          detalle: `Última evaluación: ${ultimaEval.puntaje_total} puntos`,
        });
      }

      // --- Sanciones recientes ---
      const sanciones = await pool.query(
        `SELECT count(*)::int AS total FROM sanciones
         WHERE employee_id = $1 AND fecha >= CURRENT_DATE - ($2 || ' days')::interval`,
        [emp.id, DIAS_SANCIONES_RECIENTES]
      );
      if (sanciones.rows[0].total >= UMBRAL_SANCIONES_ACUMULADAS) {
        sancionesAcumuladas.push({
          id: emp.id, nombre: nombreCompleto, puesto: emp.puesto,
          detalle: `${sanciones.rows[0].total} sanciones en los últimos ${DIAS_SANCIONES_RECIENTES} días`,
          _enPeriodoPrueba: enPeriodoPrueba,
          _totalSanciones: sanciones.rows[0].total,
        });
      }

      // --- Cursos sin completar ---
      const cursosSinCompletar = await pool.query(
        `SELECT curso, estado, fecha, created_at FROM cursos_capacitaciones
         WHERE employee_id = $1 AND estado IN ('PENDIENTE', 'EN_CURSO', 'NO_COMPLETADO')`,
        [emp.id]
      );
      const cursosVencidos = cursosSinCompletar.rows.filter((c) => {
        if (c.estado === "NO_COMPLETADO") return true;
        const diasDesdeCreado = Math.floor((Date.now() - new Date(c.created_at)) / 86400000);
        return diasDesdeCreado >= DIAS_CURSO_SIN_COMPLETAR;
      });
      if (cursosVencidos.length > 0) {
        cursosIncompletos.push({
          id: emp.id, nombre: nombreCompleto, puesto: emp.puesto,
          detalle: cursosVencidos.map((c) => c.curso).join(", "),
        });
      }

      // --- Candidato a promoción (heurística simple, ajustable) ---
      const todasEvals = await pool.query(
        `SELECT avg(puntaje_total)::numeric(4,2) AS promedio, count(*)::int AS cantidad
         FROM evaluaciones_desempeno WHERE employee_id = $1 AND puntaje_total IS NOT NULL`,
        [emp.id]
      );
      const todasSanciones = await pool.query(`SELECT count(*)::int AS total FROM sanciones WHERE employee_id = $1`, [emp.id]);
      const antiguedadDias = Math.floor((Date.now() - new Date(emp.fecha_ingreso)) / 86400000);
      const promedio = todasEvals.rows[0].promedio;

      if (
        promedio !== null && Number(promedio) >= UMBRAL_PROMOCION_PROMEDIO &&
        todasSanciones.rows[0].total === 0 &&
        antiguedadDias >= DIAS_ANTIGUEDAD_PROMOCION
      ) {
        candidatosPromocion.push({
          id: emp.id, nombre: nombreCompleto, puesto: emp.puesto,
          detalle: `Promedio ${promedio} · sin sanciones · ${Math.floor(antiguedadDias / 365)} año(s) de antigüedad`,
        });
      }
    }

    // Orden pedido: primero quienes están en período de prueba (nunca evaluado
    // antes que "hace X días"), después los efectivos con el mismo criterio.
    sinEvaluacionReciente.sort((a, b) => {
      if (a._enPeriodoPrueba !== b._enPeriodoPrueba) return a._enPeriodoPrueba ? -1 : 1;
      if (a._nuncaEvaluado !== b._nuncaEvaluado) return a._nuncaEvaluado ? -1 : 1;
      return b._diasSinEval - a._diasSinEval;
    });

    // Orden pedido: primero quienes están en período de prueba, después por
    // cantidad de sanciones (de mayor a menor).
    sancionesAcumuladas.sort((a, b) => {
      if (a._enPeriodoPrueba !== b._enPeriodoPrueba) return a._enPeriodoPrueba ? -1 : 1;
      return b._totalSanciones - a._totalSanciones;
    });

    const limpiar = (arr) => arr.map(({ _enPeriodoPrueba, _nuncaEvaluado, _diasSinEval, _totalSanciones, ...resto }) => resto);

    res.json({
      configuracion: {
        diasSinEvaluacionEfectivo: DIAS_SIN_EVALUACION_EFECTIVO,
        diasSinEvaluacionPrueba: DIAS_SIN_EVALUACION_PRUEBA,
        diasSancionesRecientes: DIAS_SANCIONES_RECIENTES,
        umbralSancionesAcumuladas: UMBRAL_SANCIONES_ACUMULADAS,
        caidaDesempenoPuntos: CAIDA_DESEMPENO_PUNTOS,
        diasCursoSinCompletar: DIAS_CURSO_SIN_COMPLETAR,
        umbralSobresaliente: UMBRAL_SOBRESALIENTE,
        umbralPromocionPromedio: UMBRAL_PROMOCION_PROMEDIO,
        diasAntiguedadPromocion: DIAS_ANTIGUEDAD_PROMOCION,
      },
      sinEvaluacionReciente: limpiar(sinEvaluacionReciente),
      sancionesAcumuladas: limpiar(sancionesAcumuladas),
      bajaDesempeno,
      cursosIncompletos,
      resultadosSobresalientes,
      candidatosPromocion,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular las alertas" });
  }
});
