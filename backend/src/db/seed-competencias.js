import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const data = JSON.parse(readFileSync(path.join(__dirname, "competencias-data.json"), "utf-8"));

  console.log(`Cargando ${data.competencias.length} competencias...`);
  const idPorNombre = new Map();

  for (const c of data.competencias) {
    const { rows } = await pool.query(
      `INSERT INTO competencias (
         nombre, tipo, clasificacion, justificacion_clasificacion, definicion, importancia,
         conductas_esperadas, conductas_no_esperadas,
         nivel_1_desc, nivel_2_desc, nivel_3_desc, nivel_4_desc, ejemplos_aplicacion
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (nombre) DO UPDATE SET
         tipo = EXCLUDED.tipo,
         clasificacion = EXCLUDED.clasificacion,
         justificacion_clasificacion = EXCLUDED.justificacion_clasificacion,
         definicion = EXCLUDED.definicion,
         importancia = EXCLUDED.importancia,
         conductas_esperadas = EXCLUDED.conductas_esperadas,
         conductas_no_esperadas = EXCLUDED.conductas_no_esperadas,
         nivel_1_desc = EXCLUDED.nivel_1_desc,
         nivel_2_desc = EXCLUDED.nivel_2_desc,
         nivel_3_desc = EXCLUDED.nivel_3_desc,
         nivel_4_desc = EXCLUDED.nivel_4_desc,
         ejemplos_aplicacion = EXCLUDED.ejemplos_aplicacion
       RETURNING id, nombre`,
      [
        c.nombre, c.tipo, c.clasificacion || null, c.justificacionClasificacion || null,
        c.definicion || null, c.importancia || null,
        JSON.stringify(c.conductas_esperadas || []), JSON.stringify(c.conductas_no_esperadas || []),
        c.niveles?.["1"] || null, c.niveles?.["2"] || null, c.niveles?.["3"] || null, c.niveles?.["4"] || null,
        JSON.stringify(c.ejemplos || []),
      ]
    );
    idPorNombre.set(rows[0].nombre, rows[0].id);
  }

  console.log(`Cargando ${data.puestoCompetencias.length} asignaciones puesto-competencia...`);
  let cargadas = 0;
  for (const pc of data.puestoCompetencias) {
    const competenciaId = idPorNombre.get(pc.competencia);
    if (!competenciaId) {
      console.warn(`⚠️  Competencia no encontrada, se omite: ${pc.competencia}`);
      continue;
    }
    await pool.query(
      `INSERT INTO puesto_competencias (puesto, competencia_id, tipo_requerimiento, nivel_requerido)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (puesto, competencia_id) DO UPDATE SET
         tipo_requerimiento = EXCLUDED.tipo_requerimiento,
         nivel_requerido = EXCLUDED.nivel_requerido`,
      [pc.puesto, competenciaId, pc.tipoRequerimiento, pc.nivelRequerido]
    );
    cargadas++;
  }

  console.log(`✅ ${idPorNombre.size} competencias y ${cargadas} asignaciones cargadas correctamente.`);
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Error al cargar el diccionario de competencias:", err);
  process.exit(1);
});
