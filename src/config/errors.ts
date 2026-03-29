// Clase base para errores operacionales (los que tú lanzas intencionalmente).
// Los errores que NO son AppError son bugs inesperados → siempre 500.
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,       // clave legible: "EMAIL_TAKEN", "USER_NOT_FOUND"
  ) {
    super(message);
    this.name = "AppError";
    // Necesario para que instanceof funcione correctamente con clases que extienden Error en TS
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Subclases con status codes fijos — evitan números mágicos en los servicios
export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado", code?: string) {
    super(message, 404, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflicto con el estado actual", code?: string) {
    super(message, 409, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autenticado", code?: string) {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No tienes permisos", code?: string) {
    super(message, 403, code);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Datos inválidos", code?: string) {
    super(message, 400, code);
  }
}