import app from "./app.js";
import config from "./config/index.js";
import { initDb, getDb } from "./db/index.js";
import { initActivityLogger } from "./utils/activityLogger.js";

const startServer = async () => {
  console.log("=== SERVER STARTUP ===");
  console.log(`Environment: ${config.env}`);
  console.log(`Port: ${config.port}`);
  console.log(`DB Provider: ${config.dbProvider}`);
  console.log(`In-Memory DB: ${config.dbInMemory}`);
  console.log("====================\n");

  try {
    console.log("[SERVER] Initializing database...");
    await initDb();
    console.log("[SERVER] ✓ Database ready");

    // Initialize activity logger with database reference
    const db = getDb();
    initActivityLogger(db);
    console.log("[SERVER] ✓ Activity logger initialized");

    const server = app.listen(config.port, () => {
      console.log(`\n✓ TEJUS 2k26 server running on port ${config.port}\n`);
    });

    // Handle graceful shutdown
    process.on("SIGTERM", () => {
      console.log("[SERVER] SIGTERM received, shutting down gracefully");
      server.close(() => {
        console.log("[SERVER] ✓ Server closed");
        process.exit(0);
      });
    });

  } catch (error) {
    console.error("[SERVER] ✗ Failed to start server:", error.message);
    console.error("[SERVER] Details:", error);
    process.exit(1);
  }
};

startServer();
