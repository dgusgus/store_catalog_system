import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  // Servidor
  NODE_ENV:  z.enum(["development", "production", "test"]).default("development"),
  PORT:      z.coerce.number().default(3000),

  // Base de datos
  DATABASE_URL: z.url("DATABASE_URL debe ser una URL válida"),

  // JWT
  JWT_SECRET:     z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  ACCESS_EXPIRES: z.string().default("15m"),

  // CORS
  CORS_ORIGIN: z.string().default("*"),
});

// parse() lanza un error detallado si falta algo — la app NO arranca
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌  Variables de entorno inválidas:\n");
  const errors = parsed.error.flatten().fieldErrors;
  for (const [key, messages] of Object.entries(errors)) {
    console.error(`   ${key}: ${messages?.join(", ")}`);
  }
  process.exit(1); // falla explícita, no silenciosa
}

export const env = parsed.data;