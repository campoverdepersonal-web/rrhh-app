import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const seed = readFileSync(path.join(__dirname, "seed.sql"), "utf-8");
  await pool.query(seed);
  console.log("✅ Datos de ejemplo cargados.");
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Error cargando datos de ejemplo:", err);
  process.exit(1);
});
