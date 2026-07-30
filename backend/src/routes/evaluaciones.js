import { Router } from "express";
import { pool } from "../db/pool.js";

export const evaluacionesRouter = Router({ mergeParams: true });

// GET /api/employees/:employeeId/evaluaciones
evaluacionesRouter.get("/", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM evaluaciones_desempeno WHERE employee_id = $1 ORDER BY fecha DESC, id DESC`,
      [employeeId]
    );

    const evaluaciones = await Promise.all(rows.map(async (row) => {
      const competencias = await pool.query(
        `SELECT ec.competencia_id AS "competenciaId", c.nombre, c.tipo,
                ec.nivel_alcanzado AS "nivelAlcanzado", ec.observaciones
         FROM evaluacion_competencias ec JOIN competencias c ON c.id = ec.competencia_id
         WHERE ec.evaluacion_id = $1 ORDER BY c.nombre`,
        [row.id]
      );
      return serialize(row, competencias.rows);
    }));

    res.json(evaluaciones);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener las evaluaciones" });
  }
});

// POST /api/employees/:employeeId/evaluaciones
evaluacionesRouter.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { employeeId } = req.params;
    const { fecha, evaluador, puntajeTotal, objetivos, observaciones, resultado, competenciasEvaluadas } = req.body;

    if (!fecha || !evaluador) {
      return res.status(400).json({ error: "fecha y evaluador son obligatorios" });
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO evaluaciones_desempeno (employee_id, fecha, evaluador, puntaje_total, objetivos, observaciones, resultado)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        employeeId, fecha, evaluador, puntajeTotal ?? null,
        objetivos ? JSON.stringify(objetivos) : null, observaciones || null, resultado || null,
      ]
    );
    const evaluacion = rows[0];

    const competenciasGuardadas = await guardarCompetencias(client, evaluacion.id, competenciasEvaluadas);

    await client.query("COMMIT");
    res.status(201).json(serialize(evaluacion, competenciasGuardadas));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Error al registrar la evaluación" });
  } finally {
    client.release();
  }
});

// PUT /api/employees/:employeeId/evaluaciones/:id
evaluacionesRouter.put("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { fecha, evaluador, puntajeTotal, observaciones, resultado, competenciasEvaluadas } = req.body;

    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE evaluaciones_desempeno SET
         fecha = COALESCE($1, fecha),
         evaluador = COALESCE($2, evaluador),
         puntaje_total = $3,
         observaciones = $4,
         resultado = $5
       WHERE id = $6 RETURNING *`,
      [fecha || null, evaluador || null, puntajeTotal ?? null, observaciones || null, resultado || null, id]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Evaluación no encontrada" });
    }

    let competenciasGuardadas;
    if (competenciasEvaluadas !== undefined) {
      await client.query(`DELETE FROM evaluacion_competencias WHERE evaluacion_id = $1`, [id]);
      competenciasGuardadas = await guardarCompetencias(client, id, competenciasEvaluadas);
    } else {
      const existentes = await client.query(
        `SELECT ec.competencia_id AS "competenciaId", c.nombre, c.tipo,
                ec.nivel_alcanzado AS "nivelAlcanzado", ec.observaciones
         FROM evaluacion_competencias ec JOIN competencias c ON c.id = ec.competencia_id
         WHERE ec.evaluacion_id = $1 ORDER BY c.nombre`,
        [id]
      );
      competenciasGuardadas = existentes.rows;
    }

    await client.query("COMMIT");
    res.json(serialize(rows[0], competenciasGuardadas));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Error al editar la evaluación" });
  } finally {
    client.release();
  }
});

// DELETE /api/employees/:employeeId/evaluaciones/:id
evaluacionesRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`DELETE FROM evaluaciones_desempeno WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Evaluación no encontrada" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar la evaluación" });
  }
});

async function guardarCompetencias(client, evaluacionId, competenciasEvaluadas) {
  if (!Array.isArray(competenciasEvaluadas) || competenciasEvaluadas.length === 0) return [];

  const guardadas = [];
  for (const c of competenciasEvaluadas) {
    if (!c.competenciaId || !c.nivelAlcanzado) continue;
    const { rows } = await client.query(
      `INSERT INTO evaluacion_competencias (evaluacion_id, competencia_id, nivel_alcanzado, observaciones)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (evaluacion_id, competencia_id) DO UPDATE SET
         nivel_alcanzado = EXCLUDED.nivel_alcanzado, observaciones = EXCLUDED.observaciones
       RETURNING competencia_id AS "competenciaId", nivel_alcanzado AS "nivelAlcanzado", observaciones`,
      [evaluacionId, c.competenciaId, c.nivelAlcanzado, c.observaciones || null]
    );
    const detalle = await client.query(`SELECT nombre, tipo FROM competencias WHERE id = $1`, [c.competenciaId]);
    guardadas.push({ ...rows[0], nombre: detalle.rows[0]?.nombre, tipo: detalle.rows[0]?.tipo });
  }
  return guardadas;
}

function serialize(row, competenciasEvaluadas = []) {
  return {
    id: row.id,
    fecha: row.fecha,
    evaluador: row.evaluador,
    puntajeTotal: row.puntaje_total,
    objetivos: row.objetivos,
    observaciones: row.observaciones,
    resultado: row.resultado,
    competenciasEvaluadas,
  };
}
