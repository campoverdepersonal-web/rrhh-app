import { Router } from "express";
import { pool } from "../db/pool.js";

export const historialRouter = Router();

const LIMITE = 1000;

// GET /api/historial/comentarios
historialRouter.get("/comentarios", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.fecha, c.lider, c.tipo, c.comentario, c.lugar_trabajo AS "lugarTrabajo",
             e.legajo, e.nombre, e.apellido
      FROM comentarios_lider c JOIN employees e ON e.id = c.employee_id
      ORDER BY c.fecha DESC, c.id DESC LIMIT $1
    `, [LIMITE]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el historial de comentarios" });
  }
});

// GET /api/historial/evaluaciones
historialRouter.get("/evaluaciones", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ev.id, ev.fecha, ev.evaluador, ev.puntaje_total AS "puntajeTotal", ev.resultado, ev.observaciones,
             e.legajo, e.nombre, e.apellido
      FROM evaluaciones_desempeno ev JOIN employees e ON e.id = ev.employee_id
      ORDER BY ev.fecha DESC, ev.id DESC LIMIT $1
    `, [LIMITE]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el historial de evaluaciones" });
  }
});

// GET /api/historial/evaluaciones-competencias
historialRouter.get("/evaluaciones-competencias", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ec.id, ev.fecha, ev.evaluador, c.nombre AS competencia,
             ec.nivel_alcanzado AS "nivelAlcanzado", ec.respuesta,
             e.legajo, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido
      FROM evaluacion_competencias ec
      JOIN evaluaciones_desempeno ev ON ev.id = ec.evaluacion_id
      JOIN competencias c ON c.id = ec.competencia_id
      JOIN employees e ON e.id = ev.employee_id
      ORDER BY ev.fecha DESC, ec.id DESC LIMIT $1
    `, [LIMITE]);
    res.json(rows.map((r) => ({ ...r, nombre: r.empleado_nombre, apellido: r.empleado_apellido })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el historial de evaluaciones por competencia" });
  }
});

// GET /api/historial/sanciones
historialRouter.get("/sanciones", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.id, s.fecha, s.tipo, s.motivo, s.responsable,
             e.legajo, e.nombre, e.apellido
      FROM sanciones s JOIN employees e ON e.id = s.employee_id
      ORDER BY s.fecha DESC, s.id DESC LIMIT $1
    `, [LIMITE]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el historial de sanciones" });
  }
});

// GET /api/historial/cursos
historialRouter.get("/cursos", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id, c.curso, c.modalidad, c.fecha, c.estado, c.capacitador,
             e.legajo, e.nombre, e.apellido
      FROM cursos_capacitaciones c JOIN employees e ON e.id = c.employee_id
      ORDER BY c.fecha DESC NULLS LAST, c.created_at DESC LIMIT $1
    `, [LIMITE]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el historial de cursos" });
  }
});

// GET /api/historial/entregas-uniforme
historialRouter.get("/entregas-uniforme", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT eu.id, eu.fecha_entrega AS "fechaEntrega", eu.tipo_prenda AS "tipoPrenda",
             eu.color_detalle AS "colorDetalle", eu.marca, eu.talle, eu.cantidad, eu.estado,
             e.legajo, e.nombre, e.apellido
      FROM entregas_uniforme eu JOIN employees e ON e.id = eu.employee_id
      ORDER BY eu.fecha_entrega DESC, eu.id DESC LIMIT $1
    `, [LIMITE]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el historial de entregas de uniforme" });
  }
});
