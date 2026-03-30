import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ── Variantes ──────────────────────────────────────────────
export const createVariantSchema = z.object({
  sku:   z.string().min(1).max(100),
  name:  z.string().min(1).max(150),  // "Rojo / M", "Azul / XL"
  stock: z.number().int().min(0).default(0),
  price: z.number().positive().optional(),  // null = hereda precio del producto
}).openapi("CreateVariantInput");

export const updateVariantSchema = createVariantSchema.partial().openapi("UpdateVariantInput");

// ── Imágenes ───────────────────────────────────────────────
export const createImageSchema = z.object({
  url:      z.url("La URL de la imagen no es válida"),
  alt:      z.string().max(200).optional(),
  position: z.number().int().min(0).default(0),
}).openapi("CreateImageInput");

// ── Producto ───────────────────────────────────────────────
export const createProductSchema = z.object({
  name:         z.string().min(2).max(200),
  slug:         z.string().regex(slugRegex, "Slug inválido: solo minúsculas, números y guiones"),
  description:  z.string().max(5000).optional(),
  price:        z.number().positive("El precio debe ser mayor a 0"),
  comparePrice: z.number().positive().optional(),
  published:    z.boolean().default(false),
  categoryId:   z.number().int().positive(),
  tags:         z.array(z.string().min(1)).optional(),  // ["nuevo", "oferta"]
  variants:     z.array(createVariantSchema).optional(),
  images:       z.array(createImageSchema).optional(),
}).openapi("CreateProductInput");

export const updateProductSchema = createProductSchema
  .omit({ variants: true, images: true })  // variantes e imágenes tienen sus propios endpoints
  .partial()
  .openapi("UpdateProductInput");

// ── Filtros de búsqueda (query params) ────────────────────
export const productFiltersSchema = z.object({
  q:          z.string().optional(),                    // búsqueda por nombre
  category:   z.string().optional(),                    // slug de categoría
  tag:        z.string().optional(),                    // slug de tag
  minPrice:   z.coerce.number().positive().optional(),
  maxPrice:   z.coerce.number().positive().optional(),
  inStock:    z.coerce.boolean().optional(),            // solo con stock > 0
  published:  z.coerce.boolean().optional(),            // solo para admin
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(50).default(20),
  orderBy:    z.enum(["price_asc", "price_desc", "newest", "name"]).default("newest"),
}).openapi("ProductFilters");

export type CreateProductInput  = z.infer<typeof createProductSchema>;
export type UpdateProductInput  = z.infer<typeof updateProductSchema>;
export type CreateVariantInput  = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput  = z.infer<typeof updateVariantSchema>;
export type CreateImageInput    = z.infer<typeof createImageSchema>;
export type ProductFilters      = z.infer<typeof productFiltersSchema>;