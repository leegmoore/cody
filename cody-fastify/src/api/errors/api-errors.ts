export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details);
  }
}

export class NotImplementedError extends AppError {
  constructor(message: string) {
    super(message, 501, "NOT_IMPLEMENTED");
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}
