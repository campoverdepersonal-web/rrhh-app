import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "rrhh",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
});

pool.on("error", (err) => {
  console.error("Error inesperado en el pool de PostgreSQL:", err);
});
