// src/modules/orders/order.schema.ts
// customerPhone ahora es opcional — algunos usuarios no tienen teléfono registrado

import { z } from 'zod'
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'

extendZodWithOpenApi(z)

export const createOrderSchema = z.object({
  customerName:  z.string().min(2).max(100),
  customerPhone: z.string().max(20).optional().default(''),  // ← opcional, default vacío

  discountCode: z.string().optional(),

  items: z.array(z.object({
    productId:  z.number().int().positive(),
    variantId:  z.number().int().positive().optional(),
    quantity:   z.number().int().min(1).max(999),
  })).min(1, 'El pedido debe tener al menos un producto'),
}).openapi('CreateOrderInput')

export const updateOrderStatusSchema = z.object({
  status:    z.enum(['CONFIRMED', 'REJECTED', 'DELIVERED']),
  adminNote: z.string().max(500).optional(),
}).openapi('UpdateOrderStatusInput')

export const orderFiltersSchema = z.object({
  status:  z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'DELIVERED']).optional(),
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(50).default(20),
}).openapi('OrderFilters')

export type CreateOrderInput       = z.infer<typeof createOrderSchema>
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>
export type OrderFilters           = z.infer<typeof orderFiltersSchema>