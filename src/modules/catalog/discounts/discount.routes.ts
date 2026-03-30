import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../rbac/rbac.middleware.js";
import { requireRole } from "../../rbac/rbac.middleware.js";
import { validate } from "../../../middlewares/validate.js";
import { createDiscountSchema, validateDiscountSchema } from "./discount.schema.js";
import * as service from "./discount.service.js";

const router = Router();

// ── Público — valida un código desde el carrito de la PWA ──
router.post("/validate", validate(validateDiscountSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.validateDiscount(req.body)); }
    catch (e) { next(e); }
  }
);

// ── Admin ──────────────────────────────────────────────────
router.get("/", verifyToken, requireRole("ADMIN"),
  async (_req, res, next) => {
    try { res.json(await service.getAllDiscounts()); }
    catch (e) { next(e); }
  }
);

router.post("/", verifyToken, requireRole("ADMIN"), validate(createDiscountSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await service.createDiscount(req.body)); }
    catch (e) { next(e); }
  }
);

// PATCH /discounts/:id/toggle — activa o desactiva sin borrar
router.patch("/:id/toggle", verifyToken, requireRole("ADMIN"),
  async (req, res, next) => {
    try { res.json(await service.toggleDiscount(Number(req.params.id))); }
    catch (e) { next(e); }
  }
);

router.delete("/:id", verifyToken, requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      await service.deleteDiscount(Number(req.params.id));
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

export default router;