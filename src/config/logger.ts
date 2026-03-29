import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",

  // En desarrollo: salida legible con colores
  // En producción: JSON puro (lo procesa Datadog, Loki, CloudWatch, etc.)
  transport: env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true, ignore: "pid,hostname" } }
    : undefined,
});