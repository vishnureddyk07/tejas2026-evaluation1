import app from "./app.js";
import config from "./config/index.js";
import { initDb } from "./db/index.js";

const startServer = async () => {
  await initDb();
  app.listen(config.port, () => {
    console.log(`TEJUS 2026 server running on port ${config.port}`);
  });
};

startServer();
