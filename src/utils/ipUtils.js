// Utility to extract client IP address from request
// Handles various proxy scenarios (Render, Vercel, nginx, etc.)
export const getClientIp = (req) => {
  // Check for IP from proxy headers (in order of preference)
  const forwardedFor = req.headers["x-forwarded-for"];
  if (forwardedFor) {
    // x-forwarded-for can be a comma-separated list, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  // Check for other common proxy headers
  const xRealIp = req.headers["x-real-ip"];
  if (xRealIp) {
    return xRealIp;
  }

  // Check for CF-Connecting-IP (Cloudflare)
  const cfConnectingIp = req.headers["cf-connecting-ip"];
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Check for socket connection
  if (req.socket?.remoteAddress) {
    return req.socket.remoteAddress;
  }

  // Check for connection
  if (req.connection?.remoteAddress) {
    return req.connection.remoteAddress;
  }

  // Check req.ip (Express)
  if (req.ip) {
    return req.ip;
  }

  // Fallback
  return "Unknown";
};
