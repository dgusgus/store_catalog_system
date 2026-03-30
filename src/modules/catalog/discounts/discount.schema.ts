import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const createDiscountSchema = z.object({
  code:       z.string().min(3).max(30).toUpperCase(),
  type:       z.enum(["PERCENT", "FIXED"]),
  value:      z.number().positive(),
  minAmount:  z.number().positive().optional(),
  maxUses:    z.number().int().positive().optional(),
  active:     z.boolean().default(true),
  expiresAt:  z.iso.datetime().optional(),
}).openapi("CreateDiscountInput");

export const validateDiscountSchema = z.object({
  code:        z.string().min(1),
  cartAmount:  z.number().positive("El monto del carrito debe ser mayor a 0"),
}).openapi("ValidateDiscountInput");

export type CreateDiscountInput   = z.infer<typeof createDiscountSchema>;
export type ValidateDiscountInput = z.infer<typeof validateDiscountSchema>;