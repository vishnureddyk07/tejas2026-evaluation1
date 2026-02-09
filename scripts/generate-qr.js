import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import QRCode from "qrcode";
import config from "../src/config/index.js";
import { initDb } from "../src/db/index.js";
import { listProjects } from "../src/services/projectService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const generate = async () => {
  await initDb();
  const projects = await listProjects();
  const outputDir = path.join(__dirname, "..", "public", "qr");
  ensureDir(outputDir);

  for (const project of projects) {
    const url = `${config.qrBaseUrl}/vote?projectId=${encodeURIComponent(project.id)}`;
    const filePath = path.join(outputDir, `${project.id}.png`);
    await QRCode.toFile(filePath, url, {
      width: 512,
      margin: 2,
      color: {
        dark: "#0A0A0A",
        light: "#FFFFFF"
      }
    });
  }

  console.log(`Generated ${projects.length} QR codes in public/qr.`);
  process.exit(0);
};

generate().catch((error) => {
  console.error(error);
  process.exit(1);
});
