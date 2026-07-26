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
    const { curso, modalidad, fecha, estado, capacitador, observaciones } = req.body;

    if (!curso || !estado) {
      return res.status(400).json({ error: "curso y estado son obligatorios" });
    }
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: "estado inválido" });
    }

    const { rows } = await pool.query(
      `INSERT INTO cursos_capacitaciones (employee_id, curso, modalidad, fecha, estado, capacitador, observaciones)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [employeeId, curso, modalidad || null, fecha || null, estado, capacitador || null, observaciones || null]
    );

    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar el curso" });
  }
});

// PUT /api/employees/:employeeId/cursos/:id — edición completa o rápida (ej: solo cambiar estado)
cursosRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { curso, modalidad, fecha, estado, capacitador, observaciones } = req.body;

    if (estado && !ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: "estado inválido" });
    }

    const { rows } = await pool.query(
      `UPDATE cursos_capacitaciones SET
         curso = COALESCE($1, curso),
         modalidad = COALESCE($2, modalidad),
         fecha = COALESCE($3, fecha),
         estado = COALESCE($4, estado),
         capacitador = COALESCE($5, capacitador),
         observaciones = COALESCE($6, observaciones)
       WHERE id = $7 RETURNING *`,
      [curso || null, modalidad || null, fecha || null, estado || null, capacitador || null, observaciones || null, id]
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

// DELETE /api/employees/:employeeId/cursos/:id
cursosRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`DELETE FROM cursos_capacitaciones WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Curso no encontrado" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el curso" });
  }
});

function serialize(row) {
  return {
    id: row.id,
    curso: row.curso,
    modalidad: row.modalidad,
    fecha: row.fecha,
    estado: row.estado,
    capacitador: row.capacitador,
    observaciones: row.observaciones,
  };
}
