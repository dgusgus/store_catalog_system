import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);  // ← una sola vez, en el archivo de schemas base

export const registerSchema = z.object({
  email:    z.email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  name:     z.string().min(1).optional(),
}).openapi("RegisterInput");  // ← nombre en Swagger UI

export const loginSchema = z.object({
  email:    z.email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
}).openapi("LoginInput");

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "El refresh token es requerido"),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1, "El refresh token es requerido"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput    = z.infer<typeof loginSchema>;
export type RefreshInput  = z.infer<typeof refreshSchema>;
export type LogoutInput   = z.infer<typeof logoutSchema>;