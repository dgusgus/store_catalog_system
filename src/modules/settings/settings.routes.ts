// src/modules/settings/settings.routes.ts

import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { verifyToken }    from '../rbac/rbac.middleware.js'
import { requireRole }    from '../rbac/rbac.middleware.js'
import { validate }       from '../../middlewares/validate.js'
import { updateSettingsSchema } from './settings.schema.js'
import * as service from './settings.service.js'

const router = Router()

// GET /settings — público, lo usa el checkout para obtener el número de WhatsApp
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.getSettings())
  } catch (e) { next(e) }
})

// PATCH /settings — solo admin
router.patch('/',
  verifyToken,
  requireRole('ADMIN'),
  validate(updateSettingsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.updateSettings(req.body))
    } catch (e) { next(e) }
  }
)

export default router