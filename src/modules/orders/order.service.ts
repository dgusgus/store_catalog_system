// src/modules/orders/order.service.ts

import { prisma } from '../../../lib/prisma.js'
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '../../../src/config/errors.js'
//import { discountsApi } from '../catalog/discounts/discount.service.js'
import type {
  CreateOrderInput,
  UpdateOrderStatusInput,
  OrderFilters,
} from './order.schema.js'

// ── Generador de número de orden ───────────────────────────
// Formato: ORD-0001, ORD-0042, etc.
// Usa el id de la orden recién creada para garantizar unicidad.
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
export async function createOrder(userId: number, input: CreateOrderInput) {

  // 1. Verificar que el usuario existe
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError('Usuario no encontrado', 'USER_NOT_FOUND')

  // 2. Resolver productos y variantes — re-verificamos precios desde la DB
  //    El frontend NO es fuente de verdad para precios
  const resolvedItems = await Promise.all(
    input.items.map(async (item) => {
      const product = await prisma.product.findUnique({
        where:  { id: item.productId, published: true },
        select: { id: true, name: true, price: true },
      })
      if (!product) {
        throw new NotFoundError(
          `Producto #${item.productId} no encontrado o no disponible`,
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
        // Verificar stock suficiente
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
        // Producto sin variante — verificar que no tenga variantes obligatorias
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

  // 3. Calcular subtotal
  const subtotal = resolvedItems.reduce((sum, i) => sum + i.subtotal, 0)

  // 4. Validar y aplicar descuento si existe
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

  // 5. Todo en una transacción atómica:
  //    - Crear la orden + items
  //    - Descontar stock de variantes
  //    - Incrementar usedCount del descuento si aplica
  //    - Asignar orderNumber
  const order = await prisma.$transaction(async (tx) => {

    // Crear orden preliminar (sin orderNumber aún — necesitamos el id)
    const created = await tx.order.create({
      data: {
        orderNumber:   'TEMP', // se actualiza justo abajo
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

    // Asignar orderNumber usando el id generado
    const withNumber = await tx.order.update({
      where:  { id: created.id },
      data:   { orderNumber: formatOrderNumber(created.id) },
      select: orderSelect,
    })

    // Descontar stock de variantes
    for (const item of resolvedItems) {
      if (item.variantId) {
        await tx.variant.update({
          where: { id: item.variantId },
          data:  { stock: { decrement: item.quantity } },
        })
      }
    }

    // Incrementar usedCount del descuento
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

  // Validar transiciones de estado permitidas
  const allowedTransitions: Record<string, string[]> = {
    PENDING:   ['CONFIRMED', 'REJECTED'],
    CONFIRMED: ['DELIVERED'],
    REJECTED:  [],           // estado final
    DELIVERED: [],           // estado final
  }

  if (!allowedTransitions[order.status]?.includes(input.status)) {
    throw new ConflictError(
      `No se puede cambiar de ${order.status} a ${input.status}`,
      'INVALID_STATUS_TRANSITION'
    )
  }

  return prisma.$transaction(async (tx) => {

    // Si se rechaza, devolver el stock a las variantes
    if (input.status === 'REJECTED') {
      for (const item of order.items) {
        if (item.variantId) {
          await tx.variant.update({
            where: { id: item.variantId },
            data:  { stock: { increment: item.quantity } },
          })
        }
      }

      // También revertir el usedCount del descuento si hubo
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

// ── Historial de un cliente (para uso futuro) ──────────────
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