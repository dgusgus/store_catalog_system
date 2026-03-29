import type { Request, Response, NextFunction } from "express";
import { AppError } from "../config/errors.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.code && { code: err.code }),
    });
    return;
  }

  // Bug inesperado — loggea con stack trace completo
  logger.error({ err }, err.message);  // ← pino serializa el error correctamente

  res.status(500).json({
    error: "Error interno del servidor",
    ...(env.NODE_ENV === "development" && { detail: err.message }),
  });
}
