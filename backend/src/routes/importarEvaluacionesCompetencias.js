import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { pool } from "../db/pool.js";
import { parsearFecha, detectarFormatoFechas } from "../services/importarExcel.js";

export const importarEvaluacionesCompetenciasRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

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

    // Algunos sistemas exportan las fechas como MM/DD/AAAA: se detecta
    // mirando todo el archivo y se interpreta en consecuencia.
    const formatoFechas = detectarFormatoFechas(filas.map((r) => buscarCrudo(r, "fecha de respuesta", "fecha")));

    filas.forEach((raw, i) => {
      const numeroFila = i + 2;
      const legajo = buscar(raw, "legajo");
      const fecha = parsearFecha(buscarCrudo(raw, "fecha de respuesta", "fecha"), formatoFechas);
      const evaluador = buscar(raw, "evaluador");
      const tituloCompetencia = buscar(raw, "título de la competencia", "titulo de la competencia");
      const respuestaTexto = buscar(raw, "respuesta");
      const puntajeCrudo = buscarCrudo(raw, "puntaje");

      const faltantes = [
        !legajo && "Legajo",
        String(buscarCrudo(raw, "fecha de respuesta", "fecha") ?? "").trim() === "" && "Fecha de respuesta",
        !evaluador && "Evaluador",
        !tituloCompetencia && "Título de la competencia",
        !respuestaTexto && "Respuesta",
      ].filter(Boolean);
      if (faltantes.length > 0) {
        errores.push({ fila: numeroFila, legajo, motivo: `Falta completar: ${faltantes.join(", ")}` });
        return;
      }
      if (!fecha) {
        errores.push({
          fila: numeroFila, legajo,
          motivo: `La fecha "${String(buscarCrudo(raw, "fecha de respuesta", "fecha")).trim()}" no es válida o no existe (usar DD/MM/AAAA)`,
        });
        return;
      }
      if (evaluador.length > 120) {
        errores.push({ fila: numeroFila, legajo, motivo: "El nombre del evaluador es demasiado largo (máximo 120 caracteres)" });
        return;
      }

      const nivelAlcanzado = MAPA_RESPUESTA[normalizar(respuestaTexto)];
      if (!nivelAlcanzado) {
        errores.push({ fila: numeroFila, legajo, motivo: `Respuesta desconocida: "${respuestaTexto}" (usar Malo, Regular, Bueno o Muy Bueno/Excelente)` });
        return;
      }

      const { nombreBase, nivelEvaluado } = extraerNombreYNivel(tituloCompetencia);
      const competenciaId = competenciaPorNombre.get(normalizar(nombreBase));
      if (!competenciaId) {
        errores.push({ fila: numeroFila, legajo, motivo: `No se encontró la competencia "${nombreBase}" en el diccionario` });
        return;
      }

      const employeeId = employeeIdPorLegajo.get(legajo.toLowerCase());
      if (!employeeId) {
        errores.push({ fila: numeroFila, legajo, motivo: `No existe ningún empleado con legajo "${legajo}"` });
        return;
      }

      const clave = `${legajo}|${fecha}|${evaluador}`;
      if (!grupos.has(clave)) {
        grupos.set(clave, { employeeId, legajo, fecha, evaluador, competencias: [] });
      }
      const grupo = grupos.get(clave);

      // Una misma competencia solo puede aparecer una vez por evaluación
      // (mismo legajo + fecha + evaluador). Antes esto hacía fallar TODA la
      // importación con un error genérico; ahora se informa la fila y se
      // toma la primera aparición.
      const repetida = grupo.competencias.find((c) => c.competenciaId === competenciaId);
      if (repetida) {
        errores.push({
          fila: numeroFila, legajo,
          motivo: `La competencia "${nombreBase}" ya aparece en la fila ${repetida.fila} para el mismo legajo, fecha y evaluador. ` +
            `Se tomó solo la de la fila ${repetida.fila}.`,
        });
        return;
      }

      // El "Puntaje" del archivo es solo informativo (no se usa en ningún
      // cálculo). Si no es un número válido para guardar, se ignora.
      const puntajeNum = puntajeCrudo === "" ? null : Number(String(puntajeCrudo).replace(",", "."));
      const puntaje = Number.isFinite(puntajeNum) && Math.abs(puntajeNum) < 100 ? puntajeNum : null;

      grupo.competencias.push({
        fila: numeroFila,
        competenciaId,
        nivelAlcanzado,
        nivelEvaluado,
        respuesta: respuestaTexto.slice(0, 30),
        puntaje,
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

      // Se calcula sobre el nivel interno (1-4), no sobre el "Puntaje" crudo
      // del archivo — ese valor externo varía según la herramienta de origen
      // y a veces ni "Muy bueno" llega a representar un 10/10 real.
      const puntajePromedio = grupo.competencias.length > 0
        ? Number((
            grupo.competencias.reduce((a, c) => a + c.nivelAlcanzado, 0)
            / grupo.competencias.length / 4 * 10
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
      totalCompetenciasCargadas: [...grupos.values()].reduce((n, g) => n + g.competencias.length, 0),
      errores,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({
      error: `Error al procesar la importación. No se cargó nada. Detalle técnico: ${err.message}`,
    });
  } finally {
    client.release();
  }
});
