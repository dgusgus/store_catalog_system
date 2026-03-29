import { Router } from "express";
import { register, login, refresh, logout } from "./auth.controller.js";
import { validate } from "../../middlewares/validate.js";
import { authLimiter } from "../../middlewares/rateLimiter.js";
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from "./auth.schema.js";

const router = Router();

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login",    authLimiter, validate(loginSchema),    login);
router.post("/refresh",  validate(refreshSchema), refresh);
router.post("/logout",   validate(logoutSchema),  logout);

export default router;