import rateLimit from "express-rate-limit";

// ── Auth limiter ───────────────────────────────────────────────────────────
// Para /auth/register y /auth/login.
// Máximo 10 intentos cada 15 minutos por IP.
// Protege contra fuerza bruta y spam de registros.

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,  // Envía RateLimit-* headers al cliente
  legacyHeaders: false,
  message: { error: "Demasiados intentos, espera 15 minutos" },
});

// ── API limiter general ────────────────────────────────────────────────────
// Para el resto de rutas protegidas.
// Máximo 100 requests cada 15 minutos por IP.

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Límite de requests alcanzado, espera 15 minutos" },
});