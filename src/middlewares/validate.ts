import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";

// Reemplaza req.body con los datos ya parseados y tipados por Zod.
// Los controllers que usen este middleware pueden asumir que req.body es válido.

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({ errors: result.error.flatten().fieldErrors });
      return;
    }

    req.body = result.data;
    next();
  };
}