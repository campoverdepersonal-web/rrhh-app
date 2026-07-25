import { Router } from "express";
import { pool } from "../db/pool.js";

export const cursosRouter = Router({ mergeParams: true });

const ESTADOS_VALIDOS = ["PENDIENTE", "EN_CURSO", "COMPLETADO", "NO_COMPLETADO"];

// GET /api/employees/:employeeId/cursos
cursosRouter.get("/", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM cursos_capacitaciones WHERE employee_id = $1 ORDER BY fecha DESC NULLS LAST, id DESC`,
      [employeeId]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener los cursos" });
  }
});

// POST /api/employees/:employeeId/cursos
cursosRouter.post("/", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { curso, modalidad, fecha, estado } = req.body;

    if (!curso || !estado) {
      return res.status(400).json({ error: "curso y estado son obligatorios" });
    }
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: "estado inválido" });
    }

    const { rows } = await pool.query(
      `INSERT INTO cursos_capacitaciones (employee_id, curso, modalidad, fecha, estado)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [employeeId, curso, modalidad || null, fecha || null, estado]
    );

    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar el curso" });
  }
});

// PUT /api/employees/:employeeId/cursos/:id — para actualizar el estado (ej: marcar como completado)
cursosRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, fecha } = req.body;

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: "estado inválido" });
    }

    const { rows } = await pool.query(
      `UPDATE cursos_capacitaciones SET
         estado = COALESCE($1, estado),
         fecha = COALESCE($2, fecha)
       WHERE id = $3 RETURNING *`,
      [estado || null, fecha || null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }

    res.json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el curso" });
  }
});

function serialize(row) {
  return {
    id: row.id,
    curso: row.curso,
    modalidad: row.modalidad,
    fecha: row.fecha,
    estado: row.estado,
  };
}
