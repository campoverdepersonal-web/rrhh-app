import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const schema = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query(schema);
  console.log("✅ Esquema aplicado correctamente.");
  await pool.end();
}

main().catch((err) => {
  console.error("❌ Error aplicando el esquema:", err);
  process.exit(1);
});
