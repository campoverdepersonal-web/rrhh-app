import "dotenv/config";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { pool } from "./pool.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const opciones = JSON.parse(readFileSync(join(__dirname, "potencial-opciones-data.json"), "utf-8"));
  const celdas = JSON.parse(readFileSync(join(__dirname, "nine-box-celdas-data.json"), "utf-8"));

  console.log(`Cargando ${opciones.length} opciones de puntaje de Potencial...`);
  for (const o of opciones) {
    await pool.query(
      `INSERT INTO potencial_config_opciones (dimension, pregunta_numero, pregunta_texto, opcion_texto, puntaje)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (pregunta_numero, opcion_texto) DO UPDATE SET
         dimension = EXCLUDED.dimension, pregunta_texto = EXCLUDED.pregunta_texto, puntaje = EXCLUDED.puntaje`,
      [o.dimension, o.preguntaNumero, o.preguntaTexto, o.opcionTexto, o.puntaje]
    );
  }

  console.log(`Cargando ${celdas.length} celdas del Nine Box...`);
  for (const c of celdas) {
    await pool.query(
      `INSERT INTO nine_box_celdas_config (desempeno_nivel, potencial_nivel, nombre_celda, foco_desarrollo, accion_sugerida)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (desempeno_nivel, potencial_nivel) DO UPDATE SET
         nombre_celda = EXCLUDED.nombre_celda, foco_desarrollo = EXCLUDED.foco_desarrollo, accion_sugerida = EXCLUDED.accion_sugerida`,
      [c.desempenoNivel, c.potencialNivel, c.nombreCelda, c.focoDesarrollo, c.accionSugerida]
    );
  }

  console.log("✅ Configuración de Nine Box cargada correctamente.");
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Error cargando Nine Box:", err);
  process.exit(1);
});
