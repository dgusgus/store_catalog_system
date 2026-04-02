import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../../rbac/rbac.middleware.js";
import { requireRole } from "../../rbac/rbac.middleware.js";
import { validate } from "../../../middlewares/validate.js";
import {
  createProductSchema, updateProductSchema,
  createVariantSchema, updateVariantSchema,
  createImageSchema,   productFiltersSchema,
} from "./product.schema.js";
import * as service from "./product.service.js";

const router = Router();

// ── Helpers ────────────────────────────────────────────────
// Parsea los query params contra el schema de filtros
function parseFilters(req: Request) {
  return productFiltersSchema.parse(req.query);
}

// ── Públicos (tienda) ──────────────────────────────────────


// ── Admin — productos ──────────────────────────────────────

// GET /products/admin?published=false — ve borradores también
router.get("/admin", verifyToken, requireRole("ADMIN"),
async (req, res, next) => {
  try { res.json(await service.getAdminProducts(parseFilters(req))); }
  catch (e) { next(e); }
}
);
// ② Público — listado general
router.get("/", async (req, res, next) => {
  try { res.json(await service.getProducts(parseFilters(req))); }
  catch (e) { next(e); }
});

// GET /products/:slug
router.get("/:slug", async (req, res, next) => {
  try { res.json(await service.getProductBySlug(req.params.slug)); }
  catch (e) { next(e); }
});

// POST /products
router.post("/", verifyToken, requireRole("ADMIN"), validate(createProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await service.createProduct(req.body)); }
    catch (e) { next(e); }
  }
);

// PATCH /products/:id
router.patch("/:id", verifyToken, requireRole("ADMIN"), validate(updateProductSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.updateProduct(Number(req.params.id), req.body)); }
    catch (e) { next(e); }
  }
);

// DELETE /products/:id
router.delete("/:id", verifyToken, requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      await service.deleteProduct(Number(req.params.id));
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

// ── Admin — variantes ──────────────────────────────────────

// POST /products/:id/variants
router.post("/:id/variants", verifyToken, requireRole("ADMIN"), validate(createVariantSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await service.addVariant(Number(req.params.id), req.body)); }
    catch (e) { next(e); }
  }
);

// PATCH /products/:id/variants/:variantId
router.patch("/:id/variants/:variantId", verifyToken, requireRole("ADMIN"), validate(updateVariantSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.json(await service.updateVariant(Number(req.params.variantId), req.body)); }
    catch (e) { next(e); }
  }
);

// DELETE /products/:id/variants/:variantId
router.delete("/:id/variants/:variantId", verifyToken, requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      await service.deleteVariant(Number(req.params.variantId));
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

// ── Admin — imágenes ───────────────────────────────────────

// POST /products/:id/images
router.post("/:id/images", verifyToken, requireRole("ADMIN"), validate(createImageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(201).json(await service.addImage(Number(req.params.id), req.body)); }
    catch (e) { next(e); }
  }
);

// DELETE /products/:id/images/:imageId
router.delete("/:id/images/:imageId", verifyToken, requireRole("ADMIN"),
  async (req, res, next) => {
    try {
      await service.deleteImage(Number(req.params.imageId));
      res.status(204).send();
    } catch (e) { next(e); }
  }
);

// PATCH /products/:id/images/reorder — reordena imágenes drag & drop
router.patch("/:id/images/reorder", verifyToken, requireRole("ADMIN"),
  validate(
    // Schema inline para el reorder — array de ids en el nuevo orden
    // import z arriba si no lo tienes
    (await import("zod")).z.object({
      imageIds: (await import("zod")).z.array(
        (await import("zod")).z.number().int().positive()
      ).min(1),
    })
  ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.reorderImages(Number(req.params.id), req.body.imageIds);
      res.json({ message: "Imágenes reordenadas" });
    } catch (e) { next(e); }
  }
);

export default router;