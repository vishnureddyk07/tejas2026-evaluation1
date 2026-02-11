import crypto from "crypto";
import jwt from "jsonwebtoken";

// Use JWT for token management (persists across server restarts)
const JWT_SECRET = process.env.JWT_SECRET || "tejus-secret-key-2026";
const TOKEN_EXPIRY = "24h";

export const issueAdminToken = (user) => {
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
  return token;
};

export const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  
  if (!token) {
    return res.status(401).json({ error: "Unauthorized - No token provided" });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    return next();
  } catch (error) {
    console.error("[AUTH] Token verification failed:", error.message);
    return res.status(401).json({ error: "Unauthorized - Invalid or expired token" });
  }
};