// src/modules/orders/order.schema.ts

import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

extendZodWithOpenApi(z)

// ── Crear orden ────────────────────────────────────────────
// El cliente envía su nombre, teléfono y el carrito completo.
// El backend verifica stock y crea la orden atómicamente.
export const createOrderSchema = z.object({
  customerName:  z.string().min(2).max(100),
  customerPhone: z.string().min(7).max(20),

  // Código de descuento ya validado en el frontend (opcional)
  discountCode: z.string().optional(),

  // Items del carrito — el backend re-verifica precios y stock
  items: z.array(z.object({
    productId:  z.number().int().positive(),
    variantId:  z.number().int().positive().optional(),
    quantity:   z.number().int().min(1).max(999),
  })).min(1, 'El pedido debe tener al menos un producto'),
}).openapi('CreateOrderInput')

// ── Actualizar estado (solo admin) ─────────────────────────
export const updateOrderStatusSchema = z.object({
  status:    z.enum(['CONFIRMED', 'REJECTED', 'DELIVERED']),
  adminNote: z.string().max(500).optional(),
}).openapi('UpdateOrderStatusInput')

// ── Filtros para listar órdenes (admin) ───────────────────
export const orderFiltersSchema = z.object({
  status:  z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'DELIVERED']).optional(),
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(50).default(20),
}).openapi('OrderFilters')

export type CreateOrderInput      = z.infer<typeof createOrderSchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type OrderFilters          = z.infer<typeof orderFiltersSchema>