// src/modules/orders/order.service.ts

import { prisma } from '../../../lib/prisma.js'
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../config/errors.js'
import type {
  CreateOrderInput,
  UpdateOrderStatusInput,
  OrderFilters,
} from './order.schema.js'

// ── Generador de número de orden ───────────────────────────
function formatOrderNumber(id: number): string {
  return `ORD-${String(id).padStart(4, '0')}`
}

// ── Selección reutilizable ─────────────────────────────────
const orderSelect = {
  id:            true,
  orderNumber:   true,
  status:        true,
  customerName:  true,
  customerPhone: true,
  subtotal:      true,
  discountCode:  true,
  discountAmount: true,
  total:         true,
  adminNote:     true,
  createdAt:     true,
  updatedAt:     true,
  user: {
    select: { id: true, name: true, email: true },
  },
  items: {
    select: {
      id:          true,
      productId:   true,
      variantId:   true,
      productName: true,
      variantName: true,
      unitPrice:   true,
      quantity:    true,
      subtotal:    true,
    },
  },
} as const

// ── Crear orden ────────────────────────────────────────────
// IMPORTANTE: NO descuenta stock al crear.
// El stock se descuenta solo cuando el admin CONFIRMA (PENDING → CONFIRMED).
// Esto evita reservar stock de pedidos que nunca se confirman.
export async function createOrder(userId: number, input: CreateOrderInput) {

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND')

  // Resolver productos y variantes — verificar que existen y tienen stock
  // No descontamos aún, solo validamos disponibilidad
  const resolvedItems = await Promise.all(
    input.items.map(async (item) => {
      const product = await prisma.product.findUnique({
        where:  { id: item.productId, published: true },
        select: { id: true, name: true, price: true },
      })
      if (!product) {
        throw new NotFoundError(
          `Producto #${item.productId} no disponible`,
          'PRODUCT_NOT_FOUND'
        )
      }

      let variantName: string | undefined
      let unitPrice = Number(product.price)

      if (item.variantId) {
        const variant = await prisma.variant.findUnique({
          where: { id: item.variantId },
        })
        if (!variant || variant.productId !== item.productId) {
          throw new NotFoundError(
            `Variante #${item.variantId} no encontrada`,
            'VARIANT_NOT_FOUND'
          )
        }
        // Solo verificamos que hay stock disponible — no lo descontamos todavía
        if (variant.stock < item.quantity) {
          throw new ConflictError(
            `Stock insuficiente para "${product.name} — ${variant.name}". ` +
            `Disponible: ${variant.stock}`,
            'INSUFFICIENT_STOCK'
          )
        }
        variantName = variant.name
        unitPrice   = variant.price ? Number(variant.price) : unitPrice
      } else {
        const hasVariants = await prisma.variant.count({
          where: { productId: item.productId },
        })
        if (hasVariants > 0) {
          throw new ValidationError(
            `"${product.name}" requiere seleccionar una variante`,
            'VARIANT_REQUIRED'
          )
        }
      }

      return {
        productId:   item.productId,
        variantId:   item.variantId,
        productName: product.name,
        variantName,
        unitPrice,
        quantity:    item.quantity,
        subtotal:    unitPrice * item.quantity,
      }
    })
  )

  // Calcular subtotal
  const subtotal = resolvedItems.reduce((sum, i) => sum + i.subtotal, 0)

  // Validar descuento si existe
  let discountAmount = 0
  if (input.discountCode) {
    const discount = await prisma.discount.findUnique({
      where: { code: input.discountCode },
    })

    const now = new Date()
    const isValid =
      discount &&
      discount.active &&
      (!discount.expiresAt || discount.expiresAt > now) &&
      (!discount.maxUses || discount.usedCount < discount.maxUses) &&
      (!discount.minAmount || subtotal >= Number(discount.minAmount))

    if (!isValid) {
      throw new ValidationError(
        'El código de descuento ya no es válido',
        'INVALID_DISCOUNT'
      )
    }

    discountAmount = discount.type === 'PERCENT'
      ? (subtotal * Number(discount.value)) / 100
      : Math.min(Number(discount.value), subtotal)

    discountAmount = Math.round(discountAmount * 100) / 100
  }

  const total = Math.max(0, subtotal - discountAmount)

  // Crear la orden en una transacción
  // Solo incrementamos usedCount del descuento — el stock se toca al confirmar
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber:   'TEMP',
        userId,
        customerName:  input.customerName,
        customerPhone: input.customerPhone,
        subtotal,
        discountCode:   input.discountCode,
        discountAmount,
        total,
        items: {
          create: resolvedItems.map((i) => ({
            productId:   i.productId,
            variantId:   i.variantId,
            productName: i.productName,
            variantName: i.variantName,
            unitPrice:   i.unitPrice,
            quantity:    i.quantity,
            subtotal:    i.subtotal,
          })),
        },
      },
      select: { id: true },
    })

    const withNumber = await tx.order.update({
      where:  { id: created.id },
      data:   { orderNumber: formatOrderNumber(created.id) },
      select: orderSelect,
    })

    // Incrementar usedCount del descuento al crear (para evitar que lo usen
    // múltiples veces mientras está pendiente)
    if (input.discountCode) {
      await tx.discount.update({
        where: { code: input.discountCode },
        data:  { usedCount: { increment: 1 } },
      })
    }

    return withNumber
  })

  return order
}

// ── Listar órdenes (admin) ─────────────────────────────────
export async function getOrders(filters: OrderFilters) {
  const where = filters.status ? { status: filters.status } : {}
  const skip  = (filters.page - 1) * filters.limit

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      skip,
      take:    filters.limit,
      orderBy: { createdAt: 'desc' },
      select:  orderSelect,
    }),
    prisma.order.count({ where }),
  ])

  return {
    items,
    pagination: {
      total,
      page:       filters.page,
      limit:      filters.limit,
      totalPages: Math.ceil(total / filters.limit),
      hasNext:    filters.page < Math.ceil(total / filters.limit),
      hasPrev:    filters.page > 1,
    },
  }
}

// ── Obtener orden por id ───────────────────────────────────
export async function getOrderById(id: number) {
  const order = await prisma.order.findUnique({
    where:  { id },
    select: orderSelect,
  })
  if (!order) throw new NotFoundError('Orden no encontrada', 'ORDER_NOT_FOUND')
  return order
}

// ── Actualizar estado (admin) ──────────────────────────────
export async function updateOrderStatus(
  id: number,
  input: UpdateOrderStatusInput
) {
  const order = await prisma.order.findUnique({
    where:   { id },
    include: { items: true },
  })
  if (!order) throw new NotFoundError('Orden no encontrada', 'ORDER_NOT_FOUND')

  const allowedTransitions: Record<string, string[]> = {
    PENDING:   ['CONFIRMED', 'REJECTED'],
    CONFIRMED: ['DELIVERED'],
    REJECTED:  [],
    DELIVERED: [],
  }

  if (!allowedTransitions[order.status]?.includes(input.status)) {
    throw new ConflictError(
      `No se puede cambiar de ${order.status} a ${input.status}`,
      'INVALID_STATUS_TRANSITION'
    )
  }

  return prisma.$transaction(async (tx) => {

    // CONFIRMAR → descontar stock ahora
    if (input.status === 'CONFIRMED') {
      for (const item of order.items) {
        if (item.variantId) {
          // Verificar que sigue habiendo stock suficiente
          const variant = await tx.variant.findUnique({
            where: { id: item.variantId },
          })
          if (!variant || variant.stock < item.quantity) {
            throw new ConflictError(
              `Sin stock suficiente para completar este pedido`,
              'INSUFFICIENT_STOCK'
            )
          }
          await tx.variant.update({
            where: { id: item.variantId },
            data:  { stock: { decrement: item.quantity } },
          })
        }
      }
    }

    // RECHAZAR → devolver usedCount del descuento (no hay stock que devolver)
    if (input.status === 'REJECTED') {
      if (order.discountCode) {
        await tx.discount.update({
          where: { code: order.discountCode },
          data:  { usedCount: { decrement: 1 } },
        })
      }
    }

    return tx.order.update({
      where:  { id },
      data:   { status: input.status, adminNote: input.adminNote },
      select: orderSelect,
    })
  })
}

// ── Historial de un cliente ────────────────────────────────
export async function getUserOrders(userId: number, filters: OrderFilters) {
  const where = {
    userId,
    ...(filters.status ? { status: filters.status } : {}),
  }
  const skip = (filters.page - 1) * filters.limit

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      skip,
      take:    filters.limit,
      orderBy: { createdAt: 'desc' },
      select:  orderSelect,
    }),
    prisma.order.count({ where }),
  ])

  return {
    items,
    pagination: {
      total,
      page:       filters.page,
      limit:      filters.limit,
      totalPages: Math.ceil(total / filters.limit),
      hasNext:    filters.page < Math.ceil(total / filters.limit),
      hasPrev:    filters.page > 1,
    },
  }
}