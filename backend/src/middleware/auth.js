import { verificarToken } from "../services/auth.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    req.usuario = verificarToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Sesión inválida o expirada" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tenés permisos para esta acción" });
    }
    next();
  };
}
