import { Router } from "express";
import { pool } from "../db/pool.js";

export const competenciasRouter = Router();

// GET /api/competencias — listado liviano del diccionario completo
competenciasRouter.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, tipo, clasificacion FROM competencias ORDER BY tipo, nombre`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar competencias" });
  }
});

// GET /api/competencias/puestos — lista de puestos que tienen matriz cargada
competenciasRouter.get("/puestos", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT puesto FROM puesto_competencias ORDER BY puesto`
    );
    res.json(rows.map((r) => r.puesto));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar puestos" });
  }
});

// GET /api/competencias/puestos/:puesto — competencias requeridas para un puesto
competenciasRouter.get("/puestos/:puesto", async (req, res) => {
  try {
    const { puesto } = req.params;
    const { rows } = await pool.query(
      `SELECT c.id, c.nombre, c.tipo, c.clasificacion, pc.tipo_requerimiento AS "tipoRequerimiento", pc.nivel_requerido AS "nivelRequerido"
       FROM puesto_competencias pc JOIN competencias c ON c.id = pc.competencia_id
       WHERE pc.puesto = $1
       ORDER BY pc.tipo_requerimiento, pc.nivel_requerido DESC, c.nombre`,
      [puesto]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener las competencias del puesto" });
  }
});

// GET /api/competencias/:id — detalle completo de una competencia (incluye
// en qué puestos se requiere y con qué nivel)
competenciasRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`SELECT * FROM competencias WHERE id = $1`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Competencia no encontrada" });

    const puestos = await pool.query(
      `SELECT puesto, tipo_requerimiento AS "tipoRequerimiento", nivel_requerido AS "nivelRequerido"
       FROM puesto_competencias WHERE competencia_id = $1
       ORDER BY tipo_requerimiento, nivel_requerido DESC, puesto`,
      [id]
    );

    const c = rows[0];
    res.json({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      clasificacion: c.clasificacion,
      justificacionClasificacion: c.justificacion_clasificacion,
      definicion: c.definicion,
      importancia: c.importancia,
      conductasEsperadas: c.conductas_esperadas,
      conductasNoEsperadas: c.conductas_no_esperadas,
      niveles: {
        1: c.nivel_1_desc,
        2: c.nivel_2_desc,
        3: c.nivel_3_desc,
        4: c.nivel_4_desc,
      },
      ejemplosAplicacion: c.ejemplos_aplicacion,
      puestos: puestos.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener la competencia" });
  }
});
