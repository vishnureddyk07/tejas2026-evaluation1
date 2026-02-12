import dotenv from "dotenv";

dotenv.config();

const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 3000),
  dbProvider: (process.env.DB_PROVIDER || "mongo").toLowerCase(),
  dbUrl: process.env.DB_URL || "mongodb://localhost:27017/tejus2026",
  dbInMemory: String(process.env.DB_IN_MEMORY || "false").toLowerCase() === "true",
  qrBaseUrl: process.env.QR_BASE_URL || "http://localhost:3000",
  adminUsers: process.env.ADMIN_USERS || "admin@tejas:Admin@2026,judge1@tejas:Judge@2026,madhan@tejas:Madhan@2026,parameshwari@tejas:Parameshwari@2026,vishnureddy@tejas:Vishnureddy@2026"
};

const supportedProviders = new Set(["mongo", "postgres", "mysql"]);
if (!supportedProviders.has(config.dbProvider)) {
  throw new Error(`Unsupported DB_PROVIDER: ${config.dbProvider}. Use mongo, postgres, or mysql.`);
}

export default config;
