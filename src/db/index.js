import config from "../config/index.js";
import { createMongoAdapter } from "./mongo.js";
import { createSqlAdapter } from "./sql.js";

let adapter;

export const initDb = async () => {
  if (adapter) return adapter;

  if (config.dbProvider === "mongo") {
    adapter = await createMongoAdapter(config.dbUrl, { inMemory: config.dbInMemory });
  } else {
    adapter = await createSqlAdapter(config.dbUrl, config.dbProvider);
  }

  return adapter;
};

export const getDb = () => {
  if (!adapter) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return adapter;
};
