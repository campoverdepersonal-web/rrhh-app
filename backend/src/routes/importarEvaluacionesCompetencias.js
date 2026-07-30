import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { pool } from "../db/pool.js";

export const importarEvaluacionesCompetenciasRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const MAPA_RESPUESTA = {
  malo: 1,
  regular: 2,
  bueno: 3,
  "muy bueno": 4,
  excelente: 4,
};

function buscar(raw, ...nombresPosibles) {
  for (const key of Object.keys(raw)) {
    const keyNorm = key.trim().toLowerCase();
    if (nombresPosibles.includes(keyNorm)) return String(raw[key]).trim();
  }
  return "";
}
function buscarCrudo(raw, ...nombresPosibles) {
  for (const key of Object.keys(raw)) {
    const keyNorm = key.trim().toLowerCase();
    if (nombresPosibles.includes(keyNorm)) return raw[key];
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

function normalizar(texto) {
  return texto
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // saca tildes
    .toLowerCase()
    .replace(/[()]/g, "") // saca paréntesis
    .replace(/\bsistemas\b/g, "sistema") // tolera singular/plural
    .replace(/\s+/g, " ")
    .trim();
}

// "Orientación al cliente nivel 2" -> { nombreBase: "Orientación al cliente", nivelEvaluado: 2 }
function extraerNombreYNivel(titulo) {
  const match = titulo.match(/^(.*?)\s+nivel\s+(\d)\s*$/i);
  if (match) {
    return { nombreBase: match[1].trim(), nivelEvaluado: Number(match[2]) };
  }
  return { nombreBase: titulo.trim(), nivelEvaluado: null };
}

// POST /api/employees/importar-evaluaciones-competencias
importarEvaluacionesCompetenciasRouter.post("/importar-evaluaciones-competencias", upload.single("archivo"), async (req, res) => {
  const client = await pool.connect();
  try {
    if (!req.file) return res.status(400).json({ error: "No se recibió ningún archivo" });

    let filas;
    try {
      const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });
    } catch {
      return res.status(400).json({ error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx) o CSV válido?" });
    }
    if (filas.length === 0) return res.status(400).json({ error: "El archivo no tiene filas de datos" });

    // Mapa de competencias del diccionario, normalizado para matchear sin
    // depender de mayúsculas/tildes exactas.
    const competenciasResult = await pool.query(`SELECT id, nombre FROM competencias`);
    const competenciaPorNombre = new Map(competenciasResult.rows.map((c) => [normalizar(c.nombre), c.id]));

    // Mapa legajo -> employee_id
    const empleadosResult = await pool.query(`SELECT id, legajo FROM employees`);
    const employeeIdPorLegajo = new Map(empleadosResult.rows.map((e) => [String(e.legajo).trim().toLowerCase(), e.id]));

    const errores = [];
    const grupos = new Map(); // clave "legajo|fecha|evaluador" -> { legajo, fecha, evaluador, filas: [] }

    filas.forEach((raw, i) => {
      const numeroFila = i + 2;
      const legajo = buscar(raw, "legajo");
      const fecha = parsearFecha(buscarCrudo(raw, "fecha de respuesta", "fecha"));
      const evaluador = buscar(raw, "evaluador");
      const tituloCompetencia = buscar(raw, "título de la competencia", "titulo de la competencia");
      const respuestaTexto = buscar(raw, "respuesta");
      const puntajeCrudo = buscarCrudo(raw, "puntaje");

      if (!legajo || !fecha || !evaluador || !tituloCompetencia || !respuestaTexto) {
        errores.push({ fila: numeroFila, motivo: "Falta Legajo, Fecha, Evaluador, Título de la competencia o Respuesta" });
        return;
      }

      const nivelAlcanzado = MAPA_RESPUESTA[normalizar(respuestaTexto)];
      if (!nivelAlcanzado) {
        errores.push({ fila: numeroFila, motivo: `Respuesta desconocida: "${respuestaTexto}" (usar Malo, Regular, Bueno o Muy Bueno/Excelente)` });
        return;
      }

      const { nombreBase, nivelEvaluado } = extraerNombreYNivel(tituloCompetencia);
      const competenciaId = competenciaPorNombre.get(normalizar(nombreBase));
      if (!competenciaId) {
        errores.push({ fila: numeroFila, motivo: `No se encontró la competencia "${nombreBase}" en el diccionario` });
        return;
      }

      const employeeId = employeeIdPorLegajo.get(legajo.toLowerCase());
      if (!employeeId) {
        errores.push({ fila: numeroFila, motivo: `No existe ningún empleado con legajo "${legajo}"` });
        return;
      }

      const clave = `${legajo}|${fecha}|${evaluador}`;
      if (!grupos.has(clave)) {
        grupos.set(clave, { employeeId, legajo, fecha, evaluador, competencias: [] });
      }
      grupos.get(clave).competencias.push({
        competenciaId,
        nivelAlcanzado,
        nivelEvaluado,
        respuesta: respuestaTexto,
        puntaje: puntajeCrudo !== "" ? Number(puntajeCrudo) : null,
      });
    });

    let evaluacionesCreadas = 0;
    let evaluacionesActualizadas = 0;

    await client.query("BEGIN");

    for (const grupo of grupos.values()) {
      const existente = await client.query(
        `SELECT id FROM evaluaciones_desempeno WHERE employee_id = $1 AND fecha = $2 AND evaluador = $3`,
        [grupo.employeeId, grupo.fecha, grupo.evaluador]
      );

      const puntajePromedio = grupo.competencias.some((c) => c.puntaje !== null)
        ? Number((
            grupo.competencias.filter((c) => c.puntaje !== null).reduce((a, c) => a + c.puntaje, 0)
            / grupo.competencias.filter((c) => c.puntaje !== null).length * 10
          ).toFixed(2))
        : null;

      let evaluacionId;
      if (existente.rows.length > 0) {
        evaluacionId = existente.rows[0].id;
        await client.query(
          `UPDATE evaluaciones_desempeno SET puntaje_total = COALESCE($1, puntaje_total) WHERE id = $2`,
          [puntajePromedio, evaluacionId]
        );
        await client.query(`DELETE FROM evaluacion_competencias WHERE evaluacion_id = $1`, [evaluacionId]);
        evaluacionesActualizadas++;
      } else {
        const nueva = await client.query(
          `INSERT INTO evaluaciones_desempeno (employee_id, fecha, evaluador, puntaje_total)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [grupo.employeeId, grupo.fecha, grupo.evaluador, puntajePromedio]
        );
        evaluacionId = nueva.rows[0].id;
        evaluacionesCreadas++;
      }

      for (const c of grupo.competencias) {
        await client.query(
          `INSERT INTO evaluacion_competencias (evaluacion_id, competencia_id, nivel_alcanzado, nivel_evaluado, respuesta, puntaje)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [evaluacionId, c.competenciaId, c.nivelAlcanzado, c.nivelEvaluado, c.respuesta, c.puntaje]
        );
      }
    }

    await client.query("COMMIT");

    res.json({
      evaluacionesCreadas,
      evaluacionesActualizadas,
      totalCompetenciasCargadas: filas.length - errores.length,
      errores,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Error al procesar la importación" });
  } finally {
    client.release();
  }
});
