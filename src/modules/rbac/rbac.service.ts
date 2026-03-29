import { prisma } from "../../../lib/prisma.js";
import { NotFoundError } from "../.././config/errors.js";
// ── Cambiar rol de un usuario ──────────────────────────────────────────────
// Solo debería llamarse desde un endpoint protegido con requireRole("ADMIN")

export async function changeUserRole(userId: number, newRole: "USER" | "ADMIN") {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("Usuario no encontrado", "USER_NOT_FOUND");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: { id: true, email: true, name: true, role: true },
  });

  return updated;
}

// ── Obtener todos los usuarios (solo admin) ────────────────────────────────
export async function getAllUsers() {
  return prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}