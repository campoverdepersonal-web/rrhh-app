import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { pool } from "../db/pool.js";

export const importarNineBoxRouter = Router();

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

function normalizarTexto(t) {
  return (t || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // saca tildes
    .toLowerCase()
    .replace(/[().,;:"']/g, "") // saca puntuación y paréntesis
    .replace(/\s+/g, " ")
    .trim();
}

// Humand a veces recorta o cambia levemente el texto de una opción respecto
// a la tabla de referencia (falta una palabra, un paréntesis aclaratorio,
// una tilde). En vez de exigir coincidencia exacta, se elige — entre las
// opciones configuradas para esa pregunta — la de mayor superposición de
// palabras, aceptándola si supera un umbral razonable.
function mejorCoincidencia(textoDado, opcionesDeLaPregunta) {
  const palabrasDadas = new Set(normalizarTexto(textoDado).split(" ").filter(Boolean));
  let mejor = null;
  let mejorPuntaje = 0;
  for (const [opcionNormalizada, info] of opcionesDeLaPregunta.entries()) {
    const palabrasOpcion = new Set(opcionNormalizada.split(" ").filter(Boolean));
    const interseccion = [...palabrasDadas].filter((p) => palabrasOpcion.has(p)).length;
    const minLen = Math.min(palabrasDadas.size, palabrasOpcion.size) || 1;
    const puntaje = interseccion / minLen;
    if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = info; }
  }
  return mejorPuntaje >= 0.7 ? mejor : null;
}

// ---------------------------------------------------------------------------
// POST /api/employees/importar-puntaje-competencias-nine-box
// Columnas: Legajo, Puntaje de competencias (0-100). Nombre/Puesto opcionales
// (se ignoran, son solo referencia en el archivo de origen).
// ---------------------------------------------------------------------------
importarNineBoxRouter.post("/importar-puntaje-competencias-nine-box", upload.single("archivo"), async (req, res) => {
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
      const raw = filas[i];
      const legajo = buscar(raw, "legajo").toLowerCase();
      const puntajeCrudo = buscarCrudo(raw, "puntaje de competencias (0 a 100)", "puntaje de competencias", "puntaje");

      if (!legajo) { resultado.errores.push({ fila: numeroFila, motivo: "Falta el Legajo" }); continue; }
      const employeeId = legajoAId.get(legajo);
      if (!employeeId) { resultado.errores.push({ fila: numeroFila, legajo, motivo: `No existe ningún empleado con legajo "${legajo}"` }); continue; }

      const puntaje = Number(puntajeCrudo);
      if (puntajeCrudo === "" || isNaN(puntaje) || puntaje < 0 || puntaje > 100) {
        resultado.errores.push({ fila: numeroFila, legajo, motivo: `Puntaje de competencias inválido: "${puntajeCrudo}" (debe ser un número entre 0 y 100)` });
        continue;
      }

      await pool.query(
        `INSERT INTO nine_box_desempeno (employee_id, puntaje_competencias, actualizado_en)
         VALUES ($1,$2,now())
         ON CONFLICT (employee_id) DO UPDATE SET puntaje_competencias = EXCLUDED.puntaje_competencias, actualizado_en = now()`,
        [employeeId, puntaje]
      );
      resultado.actualizados++;
    }

    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al importar el puntaje de competencias" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/importar-potencial
// Formato: el reporte crudo de Humand (Evaluación de Potencial), con la
// columna "Evaluado" renombrada a "Legajo". Cada fila = una evaluación
// completa de una persona (12 preguntas). Se identifica cada pregunta por el
// número al principio del encabezado ("1. ¿Con qué nivel..." / "1. Comentario"),
// así que no importa el orden exacto de las columnas.
// ---------------------------------------------------------------------------
importarNineBoxRouter.post("/importar-potencial", upload.single("archivo"), async (req, res) => {
  const client = await pool.connect();
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
    const opcionesResult = await client.query(`SELECT * FROM potencial_config_opciones`);
    const opcionesPorPregunta = new Map(); // pregunta_numero -> Map(opcion_normalizada -> {puntaje, dimension})
    for (const o of opcionesResult.rows) {
      if (!opcionesPorPregunta.has(o.pregunta_numero)) opcionesPorPregunta.set(o.pregunta_numero, new Map());
      opcionesPorPregunta.get(o.pregunta_numero).set(normalizarTexto(o.opcion_texto), { puntaje: o.puntaje, dimension: o.dimension });
    }

    const resultado = { evaluacionesCreadas: 0, omitidas: [], errores: [] };

    await client.query("BEGIN");

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const raw = filas[i];

      const legajo = buscar(raw, "legajo", "evaluado").toLowerCase();
      const fecha = parsearFecha(buscarCrudo(raw, "fecha de respuesta", "fecha"));
      const evaluador = buscar(raw, "evaluador") || null;
      const estado = buscar(raw, "estado de evaluación", "estado de evaluacion");

      if (estado && normalizarTexto(estado) !== "finalizada") {
        resultado.omitidas.push({ fila: numeroFila, legajo, motivo: `Evaluación con estado "${estado}", no "Finalizada" — se omite` });
        continue;
      }
      if (!legajo) { resultado.errores.push({ fila: numeroFila, motivo: "Falta el Legajo" }); continue; }
      const employeeId = legajoAId.get(legajo);
      if (!employeeId) { resultado.errores.push({ fila: numeroFila, legajo, motivo: `No existe ningún empleado con legajo "${legajo}"` }); continue; }
      if (!fecha) { resultado.errores.push({ fila: numeroFila, legajo, motivo: "Fecha de respuesta vacía o con formato inválido" }); continue; }

      // Identificar, por cada columna, a qué pregunta corresponde según el
      // número al principio del encabezado ("N. ..." / "N. Comentario").
      const respuestaPorPregunta = new Map(); // num -> texto de la opción elegida
      const comentarioPorPregunta = new Map(); // num -> comentario
      for (const key of Object.keys(raw)) {
        const match = key.trim().match(/^(\d{1,2})\.\s*(.*)$/);
        if (!match) continue;
        const num = Number(match[1]);
        if (num < 1 || num > 12) continue;
        const esComentario = normalizarTexto(match[2]) === "comentario";
        const valor = String(raw[key] ?? "").trim();
        if (esComentario) {
          if (valor) comentarioPorPregunta.set(num, valor);
        } else if (valor) {
          respuestaPorPregunta.set(num, valor);
        }
      }

      const faltantes = [];
      const respuestasResueltas = []; // { preguntaNumero, dimension, opcionTexto, puntaje, comentario }
      for (let num = 1; num <= 12; num++) {
        const opcionTexto = respuestaPorPregunta.get(num);
        if (!opcionTexto) { faltantes.push(`pregunta ${num} sin responder`); continue; }
        const opcionesDeEstaPregunta = opcionesPorPregunta.get(num);
        const info = opcionesDeEstaPregunta ? mejorCoincidencia(opcionTexto, opcionesDeEstaPregunta) : null;
        if (!info) { faltantes.push(`pregunta ${num}: opción "${opcionTexto}" no coincide con ninguna configurada`); continue; }
        respuestasResueltas.push({ preguntaNumero: num, dimension: info.dimension, opcionTexto, puntaje: info.puntaje, comentario: comentarioPorPregunta.get(num) || null });
      }

      if (faltantes.length > 0) {
        resultado.errores.push({ fila: numeroFila, legajo, motivo: `Evaluación incompleta: ${faltantes.join("; ")}` });
        continue;
      }

      const promedioDim = (nums) => Number((nums.reduce((a, r) => a + r.puntaje, 0) / nums.length).toFixed(2));
      const porDimension = (nombre) => respuestasResueltas.filter((r) => r.dimension === nombre);
      const aprendizaje = promedioDim(porDimension("Aprendizaje"));
      const aspiracion = promedioDim(porDimension("Aspiración"));
      const compromiso = promedioDim(porDimension("Compromiso"));
      const liderazgo = promedioDim(porDimension("Liderazgo / manejo de equipo"));
      const potencialFinal = Number(((aprendizaje + aspiracion + compromiso + liderazgo) / 4).toFixed(2));

      const nuevaEval = await client.query(
        `INSERT INTO potencial_evaluaciones
           (employee_id, fecha, evaluador, aprendizaje_promedio, aspiracion_promedio, compromiso_promedio, liderazgo_promedio, potencial_final)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [employeeId, fecha, evaluador, aprendizaje, aspiracion, compromiso, liderazgo, potencialFinal]
      );
      const evaluacionId = nuevaEval.rows[0].id;

      for (const r of respuestasResueltas) {
        await client.query(
          `INSERT INTO potencial_respuestas (evaluacion_id, pregunta_numero, dimension, opcion_texto, puntaje, comentario)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [evaluacionId, r.preguntaNumero, r.dimension, r.opcionTexto, r.puntaje, r.comentario]
        );
      }
      resultado.evaluacionesCreadas++;
    }

    await client.query("COMMIT");
    res.json(resultado);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Error al importar la evaluación de Potencial" });
  } finally {
    client.release();
  }
});
