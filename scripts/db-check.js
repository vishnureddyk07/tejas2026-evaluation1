import { initDb, getDb } from "../src/db/index.js";

const check = async () => {
  await initDb();
  const db = getDb();
  const projects = await db.projects.listAll();
  console.log(`DB connectivity OK. Projects count: ${projects.length}`);
  process.exit(0);
};

check().catch((error) => {
  console.error("DB connectivity failed:", error.message);
  process.exit(1);
});