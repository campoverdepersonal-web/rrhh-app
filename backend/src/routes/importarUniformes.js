import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { pool } from "../db/pool.js";
import { CATALOGO_PRENDAS } from "./uniformes.js";

export const importarUniformesRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function leerFilas(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const hoja = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(hoja, { defval: "" });
}

function buscar(raw, ...nombres) {
  for (const key of Object.keys(raw)) {
    if (nombres.includes(key.trim().toLowerCase())) return String(raw[key]).trim();
  }
  return "";
}
function buscarCrudo(raw, ...nombres) {
  for (const key of Object.keys(raw)) {
    if (nombres.includes(key.trim().toLowerCase())) return raw[key];
  }
  return "";
}

function parsearFecha(valor) {
  if (!valor && valor !== 0) return null;
  if (valor instanceof Date && !isNaN(valor)) return valor.toISOString().slice(0, 10);
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10);
  const match = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

async function mapaLegajoAId() {
  const { rows } = await pool.query(`SELECT id, legajo FROM employees`);
  return new Map(rows.map((r) => [String(r.legajo).trim().toLowerCase(), r.id]));
}

// ---------------------------------------------------------------------------
// POST /api/employees/importar-talles-uniforme
// Columnas: Legajo, Remera, Buzo, Pantalón náutico, Pantalón cargo, Calzado, Faja
// ---------------------------------------------------------------------------
importarUniformesRouter.post("/importar-talles-uniforme", upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });

    let filas;
    try {
      filas = leerFilas(req.file.buffer);
    } catch {
      return res.status(400).json({ error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx) o CSV válido?" });
    }
    if (filas.length === 0) return res.status(400).json({ error: "El archivo no tiene filas de datos" });

    const legajoAId = await mapaLegajoAId();
    const resultado = { actualizados: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const legajo = buscar(filas[i], "legajo").toLowerCase();
      const employeeId = legajoAId.get(legajo);

      if (!legajo) { resultado.errores.push({ fila: numeroFila, motivo: "Falta el Legajo" }); continue; }
      if (!employeeId) { resultado.errores.push({ fila: numeroFila, legajo, motivo: `No existe ningún empleado con legajo "${legajo}"` }); continue; }

      const limpiar = (v) => v.trim() || null;
      const remera = limpiar(buscar(filas[i], "remera"));
      const buzo = limpiar(buscar(filas[i], "buzo"));
      const pantalonNautico = limpiar(buscar(filas[i], "pantalón náutico", "pantalon nautico"));
      const pantalonCargo = limpiar(buscar(filas[i], "pantalón cargo", "pantalon cargo"));
      const calzado = limpiar(buscar(filas[i], "calzado"));
      const faja = limpiar(buscar(filas[i], "faja"));

      await pool.query(
        `INSERT INTO talles_uniforme (employee_id, remera, buzo, pantalon_nautico, pantalon_cargo, calzado, faja)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (employee_id) DO UPDATE SET
           remera = EXCLUDED.remera, buzo = EXCLUDED.buzo,
           pantalon_nautico = EXCLUDED.pantalon_nautico, pantalon_cargo = EXCLUDED.pantalon_cargo,
           calzado = EXCLUDED.calzado, faja = EXCLUDED.faja, updated_at = now()`,
        [employeeId, remera, buzo, pantalonNautico, pantalonCargo, calzado, faja]
      );
      resultado.actualizados++;
    }

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al procesar la importación de talles" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/importar-entregas-uniforme
// Columnas: Legajo, Fecha de entrega, Tipo de prenda, Color/Detalle, Marca, Talle, Cantidad, Estado
// ---------------------------------------------------------------------------
importarUniformesRouter.post("/importar-entregas-uniforme", upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });

    let filas;
    try {
      filas = leerFilas(req.file.buffer);
    } catch {
      return res.status(400).json({ error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx) o CSV válido?" });
    }
    if (filas.length === 0) return res.status(400).json({ error: "El archivo no tiene filas de datos" });

    const legajoAId = await mapaLegajoAId();
    const resultado = { insertados: 0, omitidosPorDuplicado: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const raw = filas[i];
      const legajo = buscar(raw, "legajo").toLowerCase();
      const employeeId = legajoAId.get(legajo);
      const fechaEntrega = parsearFecha(buscarCrudo(raw, "fecha de entrega", "fecha"));
      const tipoPrenda = buscar(raw, "tipo de prenda", "prenda");
      const colorDetalle = buscar(raw, "color/detalle", "color / detalle", "color", "detalle") || null;
      const marca = buscar(raw, "marca") || null;
      const talle = buscar(raw, "talle") || null;
      const cantidadCruda = buscar(raw, "cantidad");
      const estadoTexto = buscar(raw, "estado").toUpperCase();

      if (!legajo) { resultado.errores.push({ fila: numeroFila, motivo: "Falta el Legajo" }); continue; }
      if (!employeeId) { resultado.errores.push({ fila: numeroFila, legajo, motivo: `No existe ningún empleado con legajo "${legajo}"` }); continue; }
      if (!fechaEntrega) { resultado.errores.push({ fila: numeroFila, legajo, motivo: "Fecha de entrega vacía o con formato inválido (usar DD/MM/AAAA)" }); continue; }
      if (!tipoPrenda || !CATALOGO_PRENDAS[tipoPrenda]) {
        resultado.errores.push({ fila: numeroFila, legajo, motivo: `Tipo de prenda inválido: "${tipoPrenda}"` });
        continue;
      }
      const opciones = CATALOGO_PRENDAS[tipoPrenda];
      if (opciones.length === 0 && colorDetalle) {
        resultado.errores.push({ fila: numeroFila, legajo, motivo: `${tipoPrenda} no tiene opciones de color/detalle` });
        continue;
      }
      if (opciones.length > 0 && colorDetalle && !opciones.includes(colorDetalle)) {
        resultado.errores.push({ fila: numeroFila, legajo, motivo: `"${colorDetalle}" no es una opción válida para ${tipoPrenda}` });
        continue;
      }
      const estadoMapa = { NUEVA: "NUEVA", NUEVO: "NUEVA", USADA: "USADA", USADO: "USADA" };
      const estado = estadoMapa[estadoTexto];
      if (!estado) {
        resultado.errores.push({ fila: numeroFila, legajo, motivo: `Estado inválido: "${estadoTexto}" (usar Nueva o Usada)` });
        continue;
      }
      const cantidad = cantidadCruda ? parseInt(cantidadCruda, 10) : 1;

      // Evita cargar dos veces la misma entrega si el archivo se vuelve a
      // importar (mismo empleado, fecha, prenda, color, marca, talle,
      // cantidad y estado ya registrados).
      const existente = await pool.query(
        `SELECT id FROM entregas_uniforme
         WHERE employee_id = $1 AND fecha_entrega = $2 AND tipo_prenda = $3
           AND color_detalle IS NOT DISTINCT FROM $4
           AND marca IS NOT DISTINCT FROM $5
           AND talle IS NOT DISTINCT FROM $6
           AND cantidad = $7 AND estado = $8`,
        [employeeId, fechaEntrega, tipoPrenda, colorDetalle, marca, talle, cantidad || 1, estado]
      );
      if (existente.rows.length > 0) {
        resultado.omitidosPorDuplicado++;
        continue;
      }

      await pool.query(
        `INSERT INTO entregas_uniforme (employee_id, fecha_entrega, tipo_prenda, color_detalle, marca, talle, cantidad, estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [employeeId, fechaEntrega, tipoPrenda, colorDetalle, marca, talle, cantidad || 1, estado]
      );
      resultado.insertados++;
    }

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al procesar la importación de entregas" });
  }
});
