import { jwtVerify } from "jose";
import { env } from "../config/env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);

/**
 * JWT authentication middleware.
 * Checks Authorization: Bearer <token> header first,
 * then falls back to the session_token cookie (for browser/frontend clients).
 * Attaches the decoded payload to req.user on success.
 * Returns HTTP 401 for missing or invalid tokens.
 */
export async function authMiddleware(req, res, next) {
  let token = null;

  // Prefer Authorization header (API clients)
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // Fall back to cookie (browser/frontend clients)
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)session_token=([^;]+)/);
    if (match) {
      token = match[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: "nagar-auth",
      audience: "nagar-services",
    });
    req.user = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
