import { Router } from "express";
import { pool } from "../db/pool.js";
import { hashPassword, verificarPassword, firmarToken } from "../services/auth.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const authRouter = Router();

// POST /api/auth/login — público
authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email y password son obligatorios" });
    }

    const { rows } = await pool.query(
      `SELECT * FROM usuarios WHERE email = $1 AND activo = true`,
      [email.toLowerCase().trim()]
    );
    const usuario = rows[0];
    if (!usuario) {
      return res.status(401).json({ error: "Email o contraseña incorrectos" });
    }

    const passwordOk = await verificarPassword(password, usuario.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: "Email o contraseña incorrectos" });
    }

    const token = firmarToken(usuario);
    res.json({ token, usuario: serializeUsuario(usuario) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// GET /api/auth/me — requiere estar logueado
authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(req.usuario);
});

// GET /api/auth/usuarios — listado, solo ADMIN
authRouter.get("/usuarios", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, email, rol, activo, created_at FROM usuarios ORDER BY nombre`
    );
    res.json(rows.map(serializeUsuario));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al listar usuarios" });
  }
});

// POST /api/auth/usuarios — crear cuenta, solo ADMIN
authRouter.post("/usuarios", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) {
      return res.status(400).json({ error: "nombre, email y password son obligatorios" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    }

    const passwordHash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [nombre, email.toLowerCase().trim(), passwordHash, rol || "RRHH"]
    );

    res.status(201).json(serializeUsuario(rows[0]));
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe una cuenta con ese email" });
    }
    console.error(err);
    res.status(500).json({ error: "Error al crear el usuario" });
  }
});

// PUT /api/auth/usuarios/:id — activar/desactivar o cambiar rol, solo ADMIN
authRouter.put("/usuarios/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const { rol, activo } = req.body;

    const { rows } = await pool.query(
      `UPDATE usuarios SET
         rol = COALESCE($1, rol),
         activo = COALESCE($2, activo)
       WHERE id = $3 RETURNING *`,
      [rol || null, activo ?? null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(serializeUsuario(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar el usuario" });
  }
});

function serializeUsuario(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    email: row.email,
    rol: row.rol,
    activo: row.activo,
  };
}
