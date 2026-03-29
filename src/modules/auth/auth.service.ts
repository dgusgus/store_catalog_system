import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../../lib/prisma.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";
import { ConflictError, UnauthorizedError } from "../../config/errors.js";

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface TokenPayload {
  sub: number;
  email: string;
  role: string;
}

// ── Config ─────────────────────────────────────────────────────────────────
const JWT_SECRET     = env.JWT_SECRET;
const ACCESS_EXPIRES = env.ACCESS_EXPIRES;
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 días en ms

// ── Helpers ────────────────────────────────────────────────────────────────
function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES,
  } as jwt.SignOptions);
}

async function createRefreshToken(userId: number): Promise<string> {
  // Token opaco — string aleatorio de 64 bytes, almacenado en DB.
  // No es un JWT: si se filtra, sin la DB no sirve para nada.
  const token = crypto.randomBytes(64).toString("hex");

  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRES_MS),
    },
  });

  return token;
}

// ── Servicios ──────────────────────────────────────────────────────────────
export async function registerUser(input: RegisterInput) {
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new ConflictError("El email ya está registrado", "EMAIL_TAKEN");

  const hashedPassword = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, password: hashedPassword },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  const accessToken  = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = await createRefreshToken(user.id);

  return { user, accessToken, refreshToken };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // Mismo mensaje para no revelar si el email existe
  if (!user)  throw new UnauthorizedError("Credenciales inválidas");

  const valid = await bcrypt.compare(input.password, user.password);
  if (!valid) throw new UnauthorizedError("Credenciales inválidas");

  const { password: _pw, ...safeUser } = user;

  const accessToken  = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = await createRefreshToken(user.id);

  return { user: safeUser, accessToken, refreshToken };
}

export async function refreshAccessToken(refreshToken: string) {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored)                       throw new UnauthorizedError("Refresh token inválido", "INVALID_REFRESH_TOKEN");
  if (stored.expiresAt < new Date()) throw new UnauthorizedError("Refresh token expirado", "EXPIRED_REFRESH_TOKEN");

  // Rotación: borramos el token usado y emitimos uno nuevo.
  // Si alguien roba el refresh token y lo usa, el token original queda
  // inválido y el dueño legítimo notará el error en su próximo refresh.
  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const { user } = stored;
  const newAccessToken  = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const newRefreshToken = await createRefreshToken(user.id);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(refreshToken: string) {
  // Solo elimina el token del dispositivo actual.
  // deleteMany para que no lance error si el token ya no existe (idempotente).
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}