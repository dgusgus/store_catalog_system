import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { httpLogger } from "./middlewares/httpLogger.js";          // ← importa el config validado

import { generateOpenAPIDocument } from "./config/openapi.js";
import swaggerUi from "swagger-ui-express";

import authRoutes from "./modules/auth/auth.routes.js";
import rbacRoutes from "./modules/rbac/rbac.routes.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app  = express();
const PORT = process.env.PORT ?? 3000;

// ── Swagger UI (solo en desarrollo) ───────────────────────
if (env.NODE_ENV !== "production") {
  const openApiDoc = generateOpenAPIDocument();
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDoc));
  app.get("/docs.json", (_req, res) => res.json(openApiDoc));  // útil para Postman/Insomnia
  logger.info("📚  Swagger UI disponible en http://localhost:3000/docs");
}

// ── Seguridad ──────────────────────────────────────────────────────────────
app.use(helmet());  // Headers HTTP de seguridad (XSS, MIME sniff, etc.)
app.use(cors({
  origin: env.CORS_ORIGIN,                        // ← antes: process.env.CORS_ORIGIN ?? "*"
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
}));

// ── Parsing ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(httpLogger);

// ── Rate limit global ──────────────────────────────────────────────────────
// auth tiene su propio limiter más estricto definido en auth.routes.ts
app.use("/api", apiLimiter);

// ── Rutas ──────────────────────────────────────────────────────────────────
app.use("/auth",  authRoutes);
app.use("/admin", rbacRoutes);

/* app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
}); */

// ── Error handler global ───────────────────────────────────────────────────
// DEBE ir al final, después de todas las rutas
app.use(errorHandler);

// ── Inicio ─────────────────────────────────────────────────────────────────
app.listen(env.PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${env.PORT}`);  // ← antes: console.log
});

export default app;