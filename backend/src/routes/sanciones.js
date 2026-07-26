import { Router } from "express";
import { pool } from "../db/pool.js";

export const sancionesRouter = Router({ mergeParams: true });

const TIPOS_VALIDOS = ["APERCIBIMIENTO", "LLAMADO_ATENCION", "SUSPENSION"];

// GET /api/employees/:employeeId/sanciones
sancionesRouter.get("/", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM sanciones WHERE employee_id = $1 ORDER BY fecha DESC, id DESC`,
      [employeeId]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener las sanciones" });
  }
});

// POST /api/employees/:employeeId/sanciones
sancionesRouter.post("/", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { fecha, motivo, tipo, responsable } = req.body;

    if (!fecha || !motivo || !tipo || !responsable) {
      return res.status(400).json({ error: "fecha, motivo, tipo y responsable son obligatorios" });
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido" });
    }

    const { rows } = await pool.query(
      `INSERT INTO sanciones (employee_id, fecha, motivo, tipo, responsable)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [employeeId, fecha, motivo, tipo, responsable]
    );

    res.status(201).json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar la sanción" });
  }
});

// PUT /api/employees/:employeeId/sanciones/:id
sancionesRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, motivo, tipo, responsable } = req.body;

    if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: "tipo inválido" });
    }

    const { rows } = await pool.query(
      `UPDATE sanciones SET
         fecha = COALESCE($1, fecha),
         motivo = COALESCE($2, motivo),
         tipo = COALESCE($3, tipo),
         responsable = COALESCE($4, responsable)
       WHERE id = $5 RETURNING *`,
      [fecha || null, motivo || null, tipo || null, responsable || null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Sanción no encontrada" });
    }

    res.json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al editar la sanción" });
  }
});

// DELETE /api/employees/:employeeId/sanciones/:id
sancionesRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`DELETE FROM sanciones WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: "Sanción no encontrada" });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar la sanción" });
  }
});

function serialize(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    motivo: row.motivo,
    tipo: row.tipo,
    responsable: row.responsable,
  };
}
