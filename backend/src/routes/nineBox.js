import { Router } from "express";
import { pool } from "../db/pool.js";
import { requireRole } from "../middleware/auth.js";
import { nivelDesempeno, nivelPotencial } from "../services/nineBox.js";

export const nineBoxRouter = Router();

async function obtenerCeldasConfig() {
  const { rows } = await pool.query(`SELECT * FROM nine_box_celdas_config`);
  const mapa = new Map();
  for (const r of rows) mapa.set(`${r.desempeno_nivel}|${r.potencial_nivel}`, r);
  return mapa;
}

// ---------------------------------------------------------------------------
// GET /api/nine-box — la grilla completa: para cada persona con Desempeño y
// Potencial cargados, calcula su celda y agrupa por celda.
// ---------------------------------------------------------------------------
nineBoxRouter.get("/", async (req, res) => {
  try {
    const desempenoResult = await pool.query(`SELECT * FROM nine_box_desempeno`);
    const desempenoPorEmpleado = new Map(desempenoResult.rows.map((r) => [r.employee_id, r]));

    // Última evaluación de potencial por empleado.
    const potencialResult = await pool.query(`
      SELECT DISTINCT ON (employee_id) *
      FROM potencial_evaluaciones
      ORDER BY employee_id, fecha DESC
    `);
    const potencialPorEmpleado = new Map(potencialResult.rows.map((r) => [r.employee_id, r]));

    const idsConAmbos = [...desempenoPorEmpleado.keys()].filter((id) => potencialPorEmpleado.has(id));

    let empleadosPorId = new Map();
    if (idsConAmbos.length > 0) {
      const empleadosResult = await pool.query(
        `SELECT id, legajo, nombre, apellido, puesto FROM employees WHERE id = ANY($1::int[])`,
        [idsConAmbos]
      );
      empleadosPorId = new Map(empleadosResult.rows.map((e) => [e.id, e]));
    }
    const celdasConfig = await obtenerCeldasConfig();

    const personas = idsConAmbos.map((id) => {
      const emp = empleadosPorId.get(id);
      const desempeno = desempenoPorEmpleado.get(id);
      const potencial = potencialPorEmpleado.get(id);
      const desempenoNivel = nivelDesempeno(desempeno.puntaje_competencias);
      const potencialNivel = nivelPotencial(potencial.potencial_final);
      const celda = celdasConfig.get(`${desempenoNivel}|${potencialNivel}`);
      return {
        id: emp.id,
        nombre: `${emp.nombre} ${emp.apellido}`,
        legajo: emp.legajo,
        puesto: emp.puesto,
        puntajeCompetencias: Number(desempeno.puntaje_competencias),
        potencialFinal: Number(potencial.potencial_final),
        desempenoNivel,
        potencialNivel,
        nombreCelda: celda?.nombre_celda || null,
      };
    });

    // Agrupar en las 9 celdas (siempre las 9, aunque estén vacías).
    const NIVELES = ["Bajo", "Medio", "Alto"];
    const celdas = [];
    for (const potencialNivel of NIVELES) {
      for (const desempenoNivel of NIVELES) {
        const config = celdasConfig.get(`${desempenoNivel}|${potencialNivel}`);
        celdas.push({
          desempenoNivel,
          potencialNivel,
          nombreCelda: config?.nombre_celda || `${desempenoNivel}/${potencialNivel}`,
          focoDesarrollo: config?.foco_desarrollo || null,
          accionSugerida: config?.accion_sugerida || null,
          personas: personas.filter((p) => p.desempenoNivel === desempenoNivel && p.potencialNivel === potencialNivel),
        });
      }
    }

    res.json({ celdas, totalPersonas: personas.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al calcular el Nine Box" });
  }
});

// ---------------------------------------------------------------------------
// Configuración: puntaje por opción (editable)
// ---------------------------------------------------------------------------
nineBoxRouter.get("/config/opciones", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM potencial_config_opciones ORDER BY pregunta_numero, puntaje`
    );
    res.json(rows.map((r) => ({
      id: r.id, dimension: r.dimension, preguntaNumero: r.pregunta_numero,
      preguntaTexto: r.pregunta_texto, opcionTexto: r.opcion_texto, puntaje: r.puntaje,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener la configuración de puntajes" });
  }
});

nineBoxRouter.put("/config/opciones/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { opcionTexto, puntaje } = req.body;
    if (!puntaje || puntaje < 1 || puntaje > 4) {
      return res.status(400).json({ error: "El puntaje debe ser un número entre 1 y 4" });
    }
    const { rows } = await pool.query(
      `UPDATE potencial_config_opciones SET opcion_texto = COALESCE($1, opcion_texto), puntaje = $2 WHERE id = $3 RETURNING *`,
      [opcionTexto, puntaje, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Opción no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el puntaje" });
  }
});

// ---------------------------------------------------------------------------
// Configuración: las 9 celdas (editable)
// ---------------------------------------------------------------------------
nineBoxRouter.get("/config/celdas", async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM nine_box_celdas_config ORDER BY potencial_nivel DESC, desempeno_nivel DESC`);
    res.json(rows.map((r) => ({
      id: r.id, desempenoNivel: r.desempeno_nivel, potencialNivel: r.potencial_nivel,
      nombreCelda: r.nombre_celda, focoDesarrollo: r.foco_desarrollo, accionSugerida: r.accion_sugerida,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener la configuración de celdas" });
  }
});

nineBoxRouter.put("/config/celdas/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { nombreCelda, focoDesarrollo, accionSugerida } = req.body;
    const { rows } = await pool.query(
      `UPDATE nine_box_celdas_config SET
         nombre_celda = COALESCE($1, nombre_celda),
         foco_desarrollo = $2, accion_sugerida = $3
       WHERE id = $4 RETURNING *`,
      [nombreCelda, focoDesarrollo, accionSugerida, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Celda no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar la celda" });
  }
});

// ---------------------------------------------------------------------------
// Por empleado: posición vigente + detalle + historial de Potencial.
// Montado bajo /api/employees/:employeeId (ver server.js).
// ---------------------------------------------------------------------------
export const nineBoxEmpleadoRouter = Router({ mergeParams: true });

nineBoxEmpleadoRouter.get("/nine-box", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const desempenoResult = await pool.query(`SELECT * FROM nine_box_desempeno WHERE employee_id = $1`, [employeeId]);
    const potencialResult = await pool.query(
      `SELECT * FROM potencial_evaluaciones WHERE employee_id = $1 ORDER BY fecha DESC LIMIT 1`,
      [employeeId]
    );

    if (desempenoResult.rows.length === 0 || potencialResult.rows.length === 0) {
      return res.json({ disponible: false });
    }

    const desempeno = desempenoResult.rows[0];
    const potencial = potencialResult.rows[0];
    const respuestasResult = await pool.query(
      `SELECT * FROM potencial_respuestas WHERE evaluacion_id = $1 ORDER BY pregunta_numero`,
      [potencial.id]
    );

    const desempenoNivel = nivelDesempeno(desempeno.puntaje_competencias);
    const potencialNivel = nivelPotencial(potencial.potencial_final);
    const celdasConfig = await obtenerCeldasConfig();
    const celda = celdasConfig.get(`${desempenoNivel}|${potencialNivel}`);

    res.json({
      disponible: true,
      puntajeCompetencias: Number(desempeno.puntaje_competencias),
      desempenoNivel,
      potencial: {
        fecha: potencial.fecha,
        evaluador: potencial.evaluador,
        aprendizajePromedio: potencial.aprendizaje_promedio,
        aspiracionPromedio: potencial.aspiracion_promedio,
        compromisoPromedio: potencial.compromiso_promedio,
        liderazgoPromedio: potencial.liderazgo_promedio,
        potencialFinal: potencial.potencial_final,
      },
      potencialNivel,
      nombreCelda: celda?.nombre_celda || null,
      focoDesarrollo: celda?.foco_desarrollo || null,
      accionSugerida: celda?.accion_sugerida || null,
      respuestas: respuestasResult.rows.map((r) => ({
        preguntaNumero: r.pregunta_numero, dimension: r.dimension,
        opcionTexto: r.opcion_texto, puntaje: r.puntaje, comentario: r.comentario,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el Nine Box del empleado" });
  }
});

nineBoxEmpleadoRouter.get("/potencial-historial", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM potencial_evaluaciones WHERE employee_id = $1 ORDER BY fecha DESC`,
      [employeeId]
    );
    res.json(rows.map((r) => ({
      id: r.id, fecha: r.fecha, evaluador: r.evaluador,
      aprendizajePromedio: r.aprendizaje_promedio, aspiracionPromedio: r.aspiracion_promedio,
      compromisoPromedio: r.compromiso_promedio, liderazgoPromedio: r.liderazgo_promedio,
      potencialFinal: r.potencial_final, potencialNivel: nivelPotencial(r.potencial_final),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el historial de potencial" });
  }
});
