import { ZodError } from "zod";
import { AppError } from "../utils/errors.js";

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Route ${req.method} ${req.originalUrl} was not found`,
    requestId: req.id,
  });
}

export function errorHandler(error, req, res, _next) {
  if (error instanceof ZodError) {
    req.log?.warn({ issues: error.issues }, "Request validation failed");
    return res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "The request body is invalid",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
      requestId: req.id,
    });
  }

  if (error instanceof AppError) {
    req.log?.warn({ code: error.code, details: error.details }, error.message);
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      details: error.details,
      requestId: req.id,
    });
  }

  req.log?.error({ err: error }, "Unhandled request error");
  return res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: "An unexpected error occurred",
    requestId: req.id,
  });
}
