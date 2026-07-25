import { Router } from "express";
import { pool } from "../db/pool.js";

export const comentariosRouter = Router({ mergeParams: true });

const TIPOS_VALIDOS = ["POSITIVO", "NEGATIVO", "CORRECTIVO", "OBSERVACION", "FELICITACION"];

// GET /api/employees/:employeeId/comentarios
comentariosRouter.get("/", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM comentarios_lider WHERE employee_id = $1 ORDER BY fecha DESC, id DESC`,
      [employeeId]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener los comentarios" });
  }
});

// POST /api/employees/:employeeId/comentarios
comentariosRouter.post("/", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { fecha, lider, tipo, comentario, lugarTrabajo } = req.body;

    if (!fecha || !lider || !tipo || !comentario) {
      return res.status(400).json({ error: "fecha, lider, tipo y comentario son obligatorios" });
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido" });
    }

    const { rows } = await pool.query(
      `INSERT INTO comentarios_lider (employee_id, fecha, lider, tipo, comentario, lugar_trabajo)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [employeeId, fecha, lider, tipo, comentario, lugarTrabajo || null]
    );

    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar el comentario" });
  }
});

// PUT /api/employees/:employeeId/comentarios/:id
comentariosRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, lider, tipo, comentario, lugarTrabajo } = req.body;

    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido" });
    }

    const { rows } = await pool.query(
      `UPDATE comentarios_lider SET
         fecha = COALESCE($1, fecha),
         lider = COALESCE($2, lider),
         tipo = COALESCE($3, tipo),
         comentario = COALESCE($4, comentario),
         lugar_trabajo = $5
       WHERE id = $6 RETURNING *`,
      [fecha || null, lider || null, tipo || null, comentario || null, lugarTrabajo || null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Comentario no encontrado" });
    }

    res.json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al editar el comentario" });
  }
});

// DELETE /api/employees/:employeeId/comentarios/:id
comentariosRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`DELETE FROM comentarios_lider WHERE id = $1 RETURNING id`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: "Comentario no encontrado" });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar el comentario" });
  }
});

function serialize(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    lider: row.lider,
    tipo: row.tipo,
    comentario: row.comentario,
    lugarTrabajo: row.lugar_trabajo,
  };
}
