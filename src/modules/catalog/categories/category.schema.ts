import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// slug: convierte "Ropa Deportiva" → "ropa-deportiva" automáticamente
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCategorySchema = z.object({
  name:        z.string().min(2).max(80),
  slug:        z.string().regex(slugRegex, "Slug inválido: solo minúsculas, números y guiones"),
  description: z.string().max(300).optional(),
  imageUrl:    z.url().optional(),
  parentId:    z.number().int().positive().optional(),
}).openapi("CreateCategoryInput");

export const updateCategorySchema = createCategorySchema.partial().openapi("UpdateCategoryInput");

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;