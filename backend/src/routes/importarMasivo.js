import { Router } from "express";
import multer from "multer";
import { pool } from "../db/pool.js";
import {
  leerFilasExcel, buscarColumna, buscarColumnaCruda, parsearFecha, mapearValor,
} from "../services/importarExcel.js";

export const importarMasivoRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const TIPOS_COMENTARIO = {
  "positivo": "POSITIVO",
  "negativo": "NEGATIVO",
  "correctivo": "CORRECTIVO",
  "observacion": "OBSERVACION",
  "felicitacion": "FELICITACION",
};

const TIPOS_SANCION = {
  "apercibimiento": "APERCIBIMIENTO",
  "llamado de atencion": "LLAMADO_ATENCION",
  "suspension": "SUSPENSION",
};

const ESTADOS_CURSO = {
  "pendiente": "PENDIENTE",
  "en curso": "EN_CURSO",
  "completado": "COMPLETADO",
  "no completado": "NO_COMPLETADO",
};

async function mapaLegajos() {
  const { rows } = await pool.query(`SELECT id, legajo FROM employees`);
  return new Map(rows.map((r) => [r.legajo.trim().toLowerCase(), r.id]));
}

function procesarArchivo(req) {
  if (!req.file) throw { status: 400, error: "No se recibió ningún archivo" };
  try {
    return leerFilasExcel(req.file.buffer);
  } catch {
    throw { status: 400, error: "No se pudo leer el archivo. ¿Es un Excel (.xlsx) o CSV válido?" };
  }
}

// ---------------------------------------------------------------------------
// POST /api/employees/importar-comentarios
// Columnas: Legajo, Fecha, Líder, Tipo, Comentario, Lugar de trabajo (opcional)
// ---------------------------------------------------------------------------
importarMasivoRouter.post("/importar-comentarios", upload.single("archivo"), async (req, res) => {
  try {
    const filas = procesarArchivo(req);
    const legajos = await mapaLegajos();
    const resultado = { insertados: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const raw = filas[i];
      const legajo = buscarColumna(raw, "legajo").toLowerCase();
      const employeeId = legajos.get(legajo);
      const fecha = parsearFecha(buscarColumnaCruda(raw, "fecha"));
      const lider = buscarColumna(raw, "lider", "líder");
      const tipo = mapearValor(buscarColumna(raw, "tipo"), TIPOS_COMENTARIO);
      const comentario = buscarColumna(raw, "comentario");
      const lugarTrabajo = buscarColumna(raw, "lugar de trabajo") || null;

      const motivo = !employeeId ? `No existe ningún empleado con legajo "${buscarColumna(raw, "legajo")}"`
        : !fecha ? "Fecha inválida o vacía (usar DD/MM/AAAA)"
        : !lider ? "Falta el Líder"
        : !tipo ? `Tipo inválido: "${buscarColumna(raw, "tipo")}" (Positivo, Negativo, Correctivo, Observación o Felicitación)`
        : !comentario ? "Falta el Comentario"
        : null;

      if (motivo) { resultado.errores.push({ fila: numeroFila, motivo }); continue; }

      await pool.query(
        `INSERT INTO comentarios_lider (employee_id, fecha, lider, tipo, comentario, lugar_trabajo) VALUES ($1,$2,$3,$4,$5,$6)`,
        [employeeId, fecha, lider, tipo, comentario, lugarTrabajo]
      );
      resultado.insertados++;
    }
    res.json(resultado);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error(err);
    res.status(500).json({ error: "Error al procesar la importación" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/importar-evaluaciones
// Columnas: Legajo, Fecha, Evaluador, Puntaje total, Resultado, Observaciones
// ---------------------------------------------------------------------------
importarMasivoRouter.post("/importar-evaluaciones", upload.single("archivo"), async (req, res) => {
  try {
    const filas = procesarArchivo(req);
    const legajos = await mapaLegajos();
    const resultado = { insertados: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const raw = filas[i];
      const legajo = buscarColumna(raw, "legajo").toLowerCase();
      const employeeId = legajos.get(legajo);
      const fecha = parsearFecha(buscarColumnaCruda(raw, "fecha"));
      const evaluador = buscarColumna(raw, "evaluador");
      const puntajeTexto = buscarColumna(raw, "puntaje total", "puntaje");
      const puntajeTotal = puntajeTexto ? Number(String(puntajeTexto).replace(",", ".")) : null;
      const resultadoTexto = buscarColumna(raw, "resultado") || null;
      const observaciones = buscarColumna(raw, "observaciones") || null;

      const motivo = !employeeId ? `No existe ningún empleado con legajo "${buscarColumna(raw, "legajo")}"`
        : !fecha ? "Fecha inválida o vacía (usar DD/MM/AAAA)"
        : !evaluador ? "Falta el Evaluador"
        : (puntajeTexto && Number.isNaN(puntajeTotal)) ? `Puntaje inválido: "${puntajeTexto}"`
        : null;

      if (motivo) { resultado.errores.push({ fila: numeroFila, motivo }); continue; }

      await pool.query(
        `INSERT INTO evaluaciones_desempeno (employee_id, fecha, evaluador, puntaje_total, resultado, observaciones) VALUES ($1,$2,$3,$4,$5,$6)`,
        [employeeId, fecha, evaluador, puntajeTotal, resultadoTexto, observaciones]
      );
      resultado.insertados++;
    }
    res.json(resultado);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error(err);
    res.status(500).json({ error: "Error al procesar la importación" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/importar-sanciones
// Columnas: Legajo, Fecha, Motivo, Tipo, Responsable
// ---------------------------------------------------------------------------
importarMasivoRouter.post("/importar-sanciones", upload.single("archivo"), async (req, res) => {
  try {
    const filas = procesarArchivo(req);
    const legajos = await mapaLegajos();
    const resultado = { insertados: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const raw = filas[i];
      const legajo = buscarColumna(raw, "legajo").toLowerCase();
      const employeeId = legajos.get(legajo);
      const fecha = parsearFecha(buscarColumnaCruda(raw, "fecha"));
      const motivoTexto = buscarColumna(raw, "motivo");
      const tipo = mapearValor(buscarColumna(raw, "tipo"), TIPOS_SANCION);
      const responsable = buscarColumna(raw, "responsable");

      const motivo = !employeeId ? `No existe ningún empleado con legajo "${buscarColumna(raw, "legajo")}"`
        : !fecha ? "Fecha inválida o vacía (usar DD/MM/AAAA)"
        : !motivoTexto ? "Falta el Motivo"
        : !tipo ? `Tipo inválido: "${buscarColumna(raw, "tipo")}" (Apercibimiento, Llamado de Atención o Suspensión)`
        : !responsable ? "Falta el Responsable"
        : null;

      if (motivo) { resultado.errores.push({ fila: numeroFila, motivo }); continue; }

      await pool.query(
        `INSERT INTO sanciones (employee_id, fecha, motivo, tipo, responsable) VALUES ($1,$2,$3,$4,$5)`,
        [employeeId, fecha, motivoTexto, tipo, responsable]
      );
      resultado.insertados++;
    }
    res.json(resultado);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error(err);
    res.status(500).json({ error: "Error al procesar la importación" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/employees/importar-cursos
// Columnas: Legajo, Curso, Modalidad, Fecha, Estado
// ---------------------------------------------------------------------------
importarMasivoRouter.post("/importar-cursos", upload.single("archivo"), async (req, res) => {
  try {
    const filas = procesarArchivo(req);
    const legajos = await mapaLegajos();
    const resultado = { insertados: 0, errores: [] };

    for (let i = 0; i < filas.length; i++) {
      const numeroFila = i + 2;
      const raw = filas[i];
      const legajo = buscarColumna(raw, "legajo").toLowerCase();
      const employeeId = legajos.get(legajo);
      const curso = buscarColumna(raw, "curso");
      const modalidad = buscarColumna(raw, "modalidad") || null;
      const fecha = parsearFecha(buscarColumnaCruda(raw, "fecha")) || null;
      const estadoTexto = buscarColumna(raw, "estado");
      const estado = mapearValor(estadoTexto, ESTADOS_CURSO);

      const motivo = !employeeId ? `No existe ningún empleado con legajo "${buscarColumna(raw, "legajo")}"`
        : !curso ? "Falta el Curso"
        : !estado ? `Estado inválido: "${estadoTexto}" (Pendiente, En curso, Completado o No completado)`
        : null;

      if (motivo) { resultado.errores.push({ fila: numeroFila, motivo }); continue; }

      await pool.query(
        `INSERT INTO cursos_capacitaciones (employee_id, curso, modalidad, fecha, estado) VALUES ($1,$2,$3,$4,$5)`,
        [employeeId, curso, modalidad, fecha, estado]
      );
      resultado.insertados++;
    }
    res.json(resultado);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.error });
    console.error(err);
    res.status(500).json({ error: "Error al procesar la importación" });
  }
});
