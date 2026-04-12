// src/modules/orders/order.routes.ts

import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { verifyToken }  from '../rbac/rbac.middleware.js'
import { requireRole }  from '../rbac/rbac.middleware.js'
import { validate }     from '../../middlewares/validate.js'
import {
  createOrderSchema,
  updateOrderStatusSchema,
  orderFiltersSchema,
} from './order.schema.js'
import * as service from './order.service.js'

const router = Router()

// ── Cliente autenticado ────────────────────────────────────

// POST /orders — crea una nueva orden
router.post('/',
  verifyToken,
  validate(createOrderSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await service.createOrder(req.user!.sub, req.body)
      res.status(201).json(order)
    } catch (e) { next(e) }
  }
)

// GET /orders/my — historial del cliente autenticado
router.get('/my',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = orderFiltersSchema.parse(req.query)
      res.json(await service.getUserOrders(req.user!.sub, filters))
    } catch (e) { next(e) }
  }
)

// ── Admin ──────────────────────────────────────────────────

// GET /orders — lista todas las órdenes
router.get('/',
  verifyToken,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = orderFiltersSchema.parse(req.query)
      res.json(await service.getOrders(filters))
    } catch (e) { next(e) }
  }
)

// GET /orders/:id — detalle de una orden
router.get('/:id',
  verifyToken,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.getOrderById(Number(req.params.id)))
    } catch (e) { next(e) }
  }
)

// PATCH /orders/:id/status — aceptar o rechazar
router.patch('/:id/status',
  verifyToken,
  requireRole('ADMIN'),
  validate(updateOrderStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.updateOrderStatus(Number(req.params.id), req.body))
    } catch (e) { next(e) }
  }
)

// PATCH /orders/:id/received — cliente confirma que recibió el pedido
router.patch('/:id/received',
  verifyToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await service.confirmOrderReceived(
        Number(req.params.id),
        req.user!.sub
      )
      res.json(order)
    } catch (e) { next(e) }
  }
)

export default router