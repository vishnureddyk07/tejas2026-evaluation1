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

app.use("/api/health", healthRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/votes", votesRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

export default app;
