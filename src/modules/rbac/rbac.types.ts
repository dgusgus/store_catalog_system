// Extiende el tipo de Request de Express para incluir el usuario autenticado
// después de que el middleware verifyToken lo inyecte.

export interface AuthUser {
  sub: number;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}