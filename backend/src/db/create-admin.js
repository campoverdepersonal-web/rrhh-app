import { pool } from "./pool.js";
import { hashPassword } from "../services/auth.js";

async function main() {
  const [nombre, email, password, rol] = process.argv.slice(2);

  if (!nombre || !email || !password) {
    console.error("Uso: npm run db:create-admin -- \"Nombre Apellido\" email@empresa.com contraseña [ADMIN|RRHH|LIDER]");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("❌ La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const rolFinal = rol || "ADMIN";

  try {
    await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4)`,
      [nombre, email.toLowerCase().trim(), passwordHash, rolFinal]
    );
    console.log(`✅ Usuario creado: ${email} (rol: ${rolFinal})`);
  } catch (err) {
    if (err.code === "23505") {
      console.error(`❌ Ya existe una cuenta con el email ${email}.`);
    } else {
      console.error("❌ Error al crear el usuario:", err.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
