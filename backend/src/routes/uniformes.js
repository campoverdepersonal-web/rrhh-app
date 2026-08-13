import { Router } from "express";
import { pool } from "../db/pool.js";

export const uniformesRouter = Router({ mergeParams: true });

// Catálogo fijo de prendas -> colores/detalle disponibles, y marcas.
// Se expone via /api/uniformes/catalogo para que el frontend no lo duplique.
export const CATALOGO_PRENDAS = {
  "Remera": ["Blanca", "Azul"],
  "Buzo Algodón": ["Azul"],
  "Buzo Polar": ["Blanco", "Azul"],
  "Pantalón Náutico": ["Blanco", "Azul"],
  "Pantalón Cargo": ["Blanco", "Camel"],
  "Faja Lumbar": [],
  "Borcegos": ["Blancos", "Negros"],
  "Botas de Goma": ["Blancas"],
  "Guantes": ["Congelados", "Térmicos", "Obra"],
  "Delantal PVC": ["Corto", "Largo"],
  "Delantal": ["Azul"],
  "Cuello Polar": ["Azul", "Blanco"],
  "Capucha Polar": ["Blanca"],
  "Gorra": ["Azul"],
  "Chomba": ["Azul", "Blanca"],
  "Camisa": ["Azul", "Beige"],
  "Sweater": ["Azul"],
  "Chaleco Trucker": ["Azul", "Blanco"],
  "Campera Trucker": ["Azul", "Blanco"],
  "Pantalón Trucker": ["Azul"],
  "Medias": [],
  "Manga PVC": ["Blancas"],
  "Cofia": ["Azul"],
};

export const CATALOGO_MARCAS = ["OMBU", "BX", "DPS", "Beato", "Mingo", "Calfor Pampeana", "Promo Textil", "Mauro Sergio"];

// Umbral de alerta (días desde la entrega). Por ahora igual para todas las
// prendas — a futuro se puede definir por tipo_prenda.
export const DIAS_APTO = 180;
export const DIAS_POSIBILIDAD_CAMBIO = 220;

export const catalogoRouter = Router();
catalogoRouter.get("/catalogo", (req, res) => {
  res.json({ prendas: CATALOGO_PRENDAS, marcas: CATALOGO_MARCAS, diasApto: DIAS_APTO, diasPosibilidadCambio: DIAS_POSIBILIDAD_CAMBIO });
});

// ---------------------------------------------------------------------------
// GET /api/employees/:employeeId/talles-uniforme
// ---------------------------------------------------------------------------
uniformesRouter.get("/talles-uniforme", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { rows } = await pool.query(`SELECT * FROM talles_uniforme WHERE employee_id = $1`, [employeeId]);
    res.json(rows[0] ? serializeTalles(rows[0]) : null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener los talles" });
  }
});

// PUT /api/employees/:employeeId/talles-uniforme — crea o actualiza (upsert)
uniformesRouter.put("/talles-uniforme", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { remera, buzo, pantalonNautico, pantalonCargo, calzado, faja } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO talles_uniforme (employee_id, remera, buzo, pantalon_nautico, pantalon_cargo, calzado, faja)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (employee_id) DO UPDATE SET
         remera = EXCLUDED.remera, buzo = EXCLUDED.buzo,
         pantalon_nautico = EXCLUDED.pantalon_nautico, pantalon_cargo = EXCLUDED.pantalon_cargo,
         calzado = EXCLUDED.calzado, faja = EXCLUDED.faja, updated_at = now()
       RETURNING *`,
      [employeeId, limpiar(remera), limpiar(buzo), limpiar(pantalonNautico), limpiar(pantalonCargo), limpiar(calzado), limpiar(faja)]
    );
    res.json(serializeTalles(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al guardar los talles" });
  }
});

function limpiar(v) {
  const t = (v || "").toString().trim();
  return t || null;
}

function serializeTalles(row) {
  return {
    remera: row.remera,
    buzo: row.buzo,
    pantalonNautico: row.pantalon_nautico,
    pantalonCargo: row.pantalon_cargo,
    calzado: row.calzado,
    faja: row.faja,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// GET /api/employees/:employeeId/entregas-uniforme
// ---------------------------------------------------------------------------
uniformesRouter.get("/entregas-uniforme", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM entregas_uniforme WHERE employee_id = $1 ORDER BY fecha_entrega DESC, id DESC`,
      [employeeId]
    );
    res.json(rows.map(serializeEntrega));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener el historial de entregas" });
  }
});

// POST /api/employees/:employeeId/entregas-uniforme
uniformesRouter.post("/entregas-uniforme", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { fechaEntrega, tipoPrenda, colorDetalle, marca, talle, cantidad, estado } = req.body;

    const motivo = validarEntrega({ fechaEntrega, tipoPrenda, colorDetalle, estado });
    if (motivo) return res.status(400).json({ error: motivo });

    const { rows } = await pool.query(
      `INSERT INTO entregas_uniforme (employee_id, fecha_entrega, tipo_prenda, color_detalle, marca, talle, cantidad, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [employeeId, fechaEntrega, tipoPrenda, colorDetalle || null, marca || null, talle || null, cantidad || 1, estado]
    );
    res.status(201).json(serializeEntrega(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al registrar la entrega" });
  }
});

// PUT /api/employees/:employeeId/entregas-uniforme/:id
uniformesRouter.put("/entregas-uniforme/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fechaEntrega, tipoPrenda, colorDetalle, marca, talle, cantidad, estado } = req.body;

    const motivo = validarEntrega({ fechaEntrega, tipoPrenda, colorDetalle, estado });
    if (motivo) return res.status(400).json({ error: motivo });

    const { rows } = await pool.query(
      `UPDATE entregas_uniforme SET
         fecha_entrega = $1, tipo_prenda = $2, color_detalle = $3, marca = $4,
         talle = $5, cantidad = $6, estado = $7
       WHERE id = $8 RETURNING *`,
      [fechaEntrega, tipoPrenda, colorDetalle || null, marca || null, talle || null, cantidad || 1, estado, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Entrega no encontrada" });
    res.json(serializeEntrega(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al editar la entrega" });
  }
});

// DELETE /api/employees/:employeeId/entregas-uniforme/:id
uniformesRouter.delete("/entregas-uniforme/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(`DELETE FROM entregas_uniforme WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Entrega no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar la entrega" });
  }
});

function validarEntrega({ fechaEntrega, tipoPrenda, colorDetalle, estado }) {
  if (!fechaEntrega) return "Falta la fecha de entrega";
  if (!tipoPrenda || !CATALOGO_PRENDAS[tipoPrenda]) return "Tipo de prenda inválido";
  const opciones = CATALOGO_PRENDAS[tipoPrenda];
  if (opciones.length === 0) {
    if (colorDetalle) return `${tipoPrenda} no tiene opciones de color/detalle`;
  } else if (colorDetalle && !opciones.includes(colorDetalle)) {
    return `"${colorDetalle}" no es una opción válida para ${tipoPrenda}`;
  }
  if (!["NUEVA", "USADA"].includes(estado)) return "Estado inválido (debe ser NUEVA o USADA)";
  return null;
}

function serializeEntrega(row) {
  return {
    id: row.id,
    fechaEntrega: row.fecha_entrega,
    tipoPrenda: row.tipo_prenda,
    colorDetalle: row.color_detalle,
    marca: row.marca,
    talle: row.talle,
    cantidad: row.cantidad,
    estado: row.estado,
  };
}
