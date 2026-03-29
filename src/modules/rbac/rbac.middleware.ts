import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { TokenPayload } from "../auth/auth.service.js";
import "./rbac.types.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev_secret_change_in_production";

// ── verifyToken ────────────────────────────────────────────────────────────
// Valida el JWT del header Authorization: Bearer <token>
// Si es válido inyecta req.user. Si no, responde 401.

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token no proporcionado" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
    req.user = { sub: payload.sub, email: payload.email, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// ── requireRole ────────────────────────────────────────────────────────────
// Factory que devuelve un middleware.
// Uso: requireRole("ADMIN") o requireRole("ADMIN", "MODERATOR")
// Siempre debe ir después de verifyToken.

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "No tienes permisos para esta acción" });
      return;
    }

    next();
  };
}