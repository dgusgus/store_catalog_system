import type { Request, Response, NextFunction } from "express";
import { registerUser, loginUser, refreshAccessToken, logoutUser } from "./auth.service.js";

// Nota el tercer parámetro `next` — los errores se pasan al handler global
export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error); // ← el errorHandler decide el status code según el tipo
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await loginUser(req.body);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await refreshAccessToken(req.body.refreshToken);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response) {
  await logoutUser(req.body.refreshToken);
  res.status(200).json({ message: "Sesión cerrada" });
}