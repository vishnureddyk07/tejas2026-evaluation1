import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import helmet from "helmet";
import cors from "cors";
import config from "./config/index.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import projectsRoutes from "./routes/projects.js";
import votesRoutes from "./routes/votes.js";
import healthRoutes from "./routes/health.js";
import adminRoutes from "./routes/admin.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust proxy headers (for Render, Vercel, etc.)
app.set("trust proxy", 1);

console.log("=== APP STARTUP DEBUG ===");
console.log("process.env.ADMIN_USERS:", process.env.ADMIN_USERS);
console.log("config.adminUsers:", config.adminUsers);
console.log("========================");

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: "10kb" }));
app.use(apiLimiter);

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "vote.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(publicDir, "admin", "index.html"));
});

app.get("/admin/login", (req, res) => {
  res.sendFile(path.join(publicDir, "admin", "login.html"));
});

app.get("/admin/dashboard", (req, res) => {
  res.sendFile(path.join(publicDir, "admin", "dashboard.html"));
});

app.get("/api/debug/config", (req, res) => {
  res.json({
    env_ADMIN_USERS: process.env.ADMIN_USERS,
    config_adminUsers: config.adminUsers,
    NODE_ENV: process.env.NODE_ENV
  });
});

app.get("/vote", (req, res) => {
  res.sendFile(path.join(publicDir, "vote.html"));
});

app.get("/qr/:projectId.png", async (req, res) => {
  try {
    // Set CORS headers explicitly for cross-origin image loading from Vercel frontend
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    
    const { getProjectById } = await import("./services/projectService.js");
    const QRCode = await import("qrcode");
    
    const project = await getProjectById(req.params.projectId);
    
    if (!project) {
      return res.status(404).send("Project not found");
    }
    
    // If project has stored QR data URL, use it
    if (project.qrDataUrl) {
      const base64Data = project.qrDataUrl.replace(/^data:image\/png;base64,/, "");
      const imgBuffer = Buffer.from(base64Data, "base64");
      return res.send(imgBuffer);
    }
    
    // Otherwise, generate QR on-the-fly (for old projects)
    const url = `${config.qrBaseUrl}/vote?projectId=${encodeURIComponent(project.id)}`;
    const qrBuffer = await QRCode.default.toBuffer(url, {
      width: 512,
      margin: 2,
      color: { dark: "#0A0A0A", light: "#FFFFFF" }
    });
    
    res.send(qrBuffer);
  } catch (error) {
    console.error("[QR] Error serving QR:", error.message, error);
    res.status(500).send("Error generating QR code");
  }
});

app.use("/api/health", healthRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/votes", votesRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

export default app;
