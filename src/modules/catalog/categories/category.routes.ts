import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../rbac/rbac.middleware.js";
import { requireRole } from "../../rbac/rbac.middleware.js";
import { validate } from "../../../middlewares/validate.js";
import { createCategorySchema, updateCategorySchema } from "./category.schema.js";
import * as service from "./category.service.js";

const router = Router();

// ── Públicos ───────────────────────────────────────────────
router.get("/", async (_req, res, next) => {
  try { res.json(await service.getAllCategories()); }
  catch (e) { next(e); }
});

router.get("/:slug", async (req, res, next) => {
  try { res.json(await service.getCategoryBySlug(req.params.slug)); }
  catch (e) { next(e); }
});

// ── Protegidos ADMIN ───────────────────────────────────────
router.post("/",
  verifyToken, requireRole("ADMIN"), validate(createCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await service.createCategory(req.body)); }
    catch (e) { next(e); }
  }
);

router.patch("/:id",
  verifyToken, requireRole("ADMIN"), validate(updateCategorySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.updateCategory(Number(req.params.id), req.body)); }
    catch (e) { next(e); }
  }
);

router.delete("/:id",
  verifyToken, requireRole("ADMIN"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.deleteCategory(Number(req.params.id));
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

export default router;