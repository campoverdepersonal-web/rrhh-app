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
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener las evaluaciones" });
  }
});

// POST /api/employees/:employeeId/evaluaciones
evaluacionesRouter.post("/", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { fecha, evaluador, puntajeTotal, competencias, objetivos, observaciones, resultado } = req.body;

    if (!fecha || !evaluador) {
      return res.status(400).json({ error: "fecha y evaluador son obligatorios" });
    }

    const { rows } = await pool.query(
      `INSERT INTO evaluaciones_desempeno (employee_id, fecha, evaluador, puntaje_total, competencias, objetivos, observaciones, resultado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        employeeId,
        fecha,
        evaluador,
        puntajeTotal ?? null,
        competencias ? JSON.stringify(competencias) : null,
        objetivos ? JSON.stringify(objetivos) : null,
        observaciones || null,
        resultado || null,
      ]
    );

    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar la evaluación" });
  }
});

function serialize(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    evaluador: row.evaluador,
    puntajeTotal: row.puntaje_total,
    competencias: row.competencias,
    objetivos: row.objetivos,
    observaciones: row.observaciones,
    resultado: row.resultado,
  };
}
