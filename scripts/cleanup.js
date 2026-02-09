import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, getDb } from "../src/db/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clearQrFolder = () => {
  const qrDir = path.join(__dirname, "..", "public", "qr");
  if (!fs.existsSync(qrDir)) return 0;
  const files = fs.readdirSync(qrDir);
  files.forEach((file) => {
    fs.unlinkSync(path.join(qrDir, file));
  });
  return files.length;
};

const cleanup = async () => {
  await initDb();
  const db = getDb();

  await db.votes.removeAll();
  await db.devices.removeAll();
  await db.projects.removeAll();

  const deletedQr = clearQrFolder();
  console.log(`Deleted ${deletedQr} QR files.`);
  console.log("Database collections/tables cleared.");
  process.exit(0);
};

cleanup().catch((error) => {
  console.error(error);
  process.exit(1);
});