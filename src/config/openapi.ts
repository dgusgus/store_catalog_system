import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { registerSchema, loginSchema } from "../modules/auth/auth.schema.js";

export const registry = new OpenAPIRegistry();

// ── Schemas reutilizables ──────────────────────────────────
const UserSchema = registry.register(
  "User",
  z.object({
    id:        z.number(),
    email:     z.email(),
    name:      z.string().optional(),
    role:      z.enum(["USER", "ADMIN"]),
    createdAt: z.string().datetime(),
  }).openapi("User"),
);

const ErrorSchema = registry.register(
  "Error",
  z.object({
    error: z.string(),
    code:  z.string().optional(),
  }).openapi("Error"),
);

// ── Auth ───────────────────────────────────────────────────
registry.registerPath({
  method:  "post",
  path:    "/auth/register",
  tags:    ["Auth"],
  summary: "Registrar nuevo usuario",
  request: { body: { content: { "application/json": { schema: registerSchema } } } },
  responses: {
    201: {
      description: "Usuario creado",
      content: { "application/json": { schema: z.object({
        user:         UserSchema,
        accessToken:  z.string(),
        refreshToken: z.string(),
      })}},
    },
    409: { description: "Email ya registrado",  content: { "application/json": { schema: ErrorSchema } } },
    400: { description: "Datos inválidos",       content: { "application/json": { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method:  "post",
  path:    "/auth/login",
  tags:    ["Auth"],
  summary: "Iniciar sesión",
  request: { body: { content: { "application/json": { schema: loginSchema } } } },
  responses: {
    200: {
      description: "Login exitoso",
      content: { "application/json": { schema: z.object({
        user:         UserSchema,
        accessToken:  z.string(),
        refreshToken: z.string(),
      })}},
    },
    401: { description: "Credenciales inválidas", content: { "application/json": { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method:  "post",
  path:    "/auth/refresh",
  tags:    ["Auth"],
  summary: "Renovar access token",
  request: { body: { content: { "application/json": { schema: z.object({ refreshToken: z.string() }) } } } },
  responses: {
    200: { description: "Tokens renovados", content: { "application/json": { schema: z.object({
      accessToken:  z.string(),
      refreshToken: z.string(),
    })}}},
    401: { description: "Token inválido o expirado", content: { "application/json": { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method:  "post",
  path:    "/auth/logout",
  tags:    ["Auth"],
  summary: "Cerrar sesión",
  request: { body: { content: { "application/json": { schema: z.object({ refreshToken: z.string() }) } } } },
  responses: {
    200: { description: "Sesión cerrada" },
  },
});

// ── Admin / RBAC ───────────────────────────────────────────
registry.registerPath({
  method:  "get",
  path:    "/admin/users",
  tags:    ["Admin"],
  summary: "Listar todos los usuarios",
  security: [{ bearerAuth: [] }],
  responses: {
    200: { description: "Lista de usuarios", content: { "application/json": { schema: z.array(UserSchema) } } },
    401: { description: "No autenticado",    content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "No autorizado",     content: { "application/json": { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method:  "patch",
  path:    "/admin/users/{id}/role",
  tags:    ["Admin"],
  summary: "Cambiar rol de un usuario",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body:   { content: { "application/json": { schema: z.object({ role: z.enum(["USER", "ADMIN"]) }) } } },
  },
  responses: {
    200: { description: "Rol actualizado",       content: { "application/json": { schema: UserSchema } } },
    404: { description: "Usuario no encontrado", content: { "application/json": { schema: ErrorSchema } } },
    401: { description: "No autenticado",        content: { "application/json": { schema: ErrorSchema } } },
    403: { description: "No autorizado",         content: { "application/json": { schema: ErrorSchema } } },
  },
});

// ── Generar documento ──────────────────────────────────────
export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  const document = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title:   "Catalog API",
      version: "1.0.0",
      description: "Plantilla base — reemplaza este texto en src/config/openapi.ts",
    },
    servers: [{ url: "http://localhost:3000" }],
  });

  // Add security schemes to the document
  document.components = {
    securitySchemes: {
      // Esto habilita el botón "Authorize" en Swagger UI
      bearerAuth: {
        type:   "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  };

  return document;
}