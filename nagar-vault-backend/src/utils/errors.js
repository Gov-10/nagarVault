export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function assert(condition, statusCode, code, message, details) {
  if (!condition) {
    throw new AppError(statusCode, code, message, details);
  }
}
