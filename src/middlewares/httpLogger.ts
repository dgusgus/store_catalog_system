import pinoHttp from "pino-http";
import { logger } from "../config/logger.js";

// Middleware que loggea cada request con método, url, status y tiempo de respuesta.
// El `reqId` auto-generado aparece en todos los logs del mismo request
// si usas req.log.info() dentro de controllers.
export const httpLogger = pinoHttp({
  logger,
  // No loggear el health check — llenaría los logs sin valor
  autoLogging: {
    ignore: (req) => req.url === "/health",
  },
  customLogLevel: (_req, res) => {
    if (res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});