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

function serialize(row) {
  return {
    id: row.id,
    fecha: row.fecha,
    motivo: row.motivo,
    tipo: row.tipo,
    responsable: row.responsable,
  };
}
