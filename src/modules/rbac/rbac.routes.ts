import { Router } from "express";
import type { Request, Response } from "express";
import { verifyToken } from "./rbac.middleware.js";
import { requireRole } from "./rbac.middleware.js";
import { changeUserRole, getAllUsers } from "./rbac.service.js";

const router = Router();

// GET /admin/users → lista todos los usuarios (solo ADMIN)
router.get("/users", verifyToken, requireRole("ADMIN"), async (_req: Request, res: Response) => {
  const users = await getAllUsers();
  res.json(users);
});

// PATCH /admin/users/:id/role → cambia el rol (solo ADMIN)
router.patch("/users/:id/role", verifyToken, requireRole("ADMIN"), async (req: Request, res: Response) => {
  const userId = parseInt(String(req.params.id));
  const { role } = req.body as { role: "USER" | "ADMIN" };

  if (!["USER", "ADMIN"].includes(role)) {
    res.status(400).json({ error: "Rol inválido. Usa USER o ADMIN" });
    return;
  }

  try {
    const updated = await changeUserRole(userId, role);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al cambiar rol";
    res.status(404).json({ error: message });
  }
});

export default router;