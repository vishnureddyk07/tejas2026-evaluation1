import crypto from "crypto";

const tokenStore = new Map();

export const issueAdminToken = (user) => {
  const token = crypto.randomUUID();
  tokenStore.set(token, { user, createdAt: Date.now() });
  return token;
};

export const requireAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !tokenStore.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.admin = tokenStore.get(token);
  return next();
};