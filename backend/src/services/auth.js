import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "cambiar-este-secreto-en-produccion";
const JWT_EXPIRES_IN = "12h";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verificarPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function firmarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function verificarToken(token) {
  return jwt.verify(token, JWT_SECRET);
}
