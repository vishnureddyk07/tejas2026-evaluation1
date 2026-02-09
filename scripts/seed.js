import { initDb } from "../src/db/index.js";
import { insertProjects } from "../src/services/projectService.js";

const categories = [
  "AI & ML",
  "IoT",
  "Robotics",
  "Cybersecurity",
  "HealthTech",
  "EdTech",
  "Sustainability",
  "FinTech",
  "Smart Campus",
  "AR/VR"
];

const adjectives = [
  "Nova",
  "Quantum",
  "Pulse",
  "Aurora",
  "Vertex",
  "Nimbus",
  "Spectra",
  "Zenith",
  "Catalyst",
  "Eclipse"
];

const nouns = [
  "Sense",
  "Grid",
  "Forge",
  "Flow",
  "Guard",
  "Sync",
  "Beacon",
  "Pulse",
  "Path",
  "Atlas"
];

const buildProject = (index) => {
  const id = `PRJ-${String(index + 1).padStart(3, "0")}`;
  const title = `${adjectives[index % adjectives.length]} ${nouns[index % nouns.length]}`;
  const teamName = `Team ${String.fromCharCode(65 + (index % 26))}${index % 10}`;
  const category = categories[index % categories.length];
  const description = `A ${category} project that showcases ${title.toLowerCase()} for real-world impact at TEJUS 2026.`;

  return {
    id,
    title,
    team_name: teamName,
    category,
    sector: category,
    abstract: description,
    team_members: `${teamName} Members`,
    department: "CSE",
    description,
    created_at: new Date()
  };
};

const seed = async () => {
  await initDb();
  const projects = Array.from({ length: 160 }, (_, index) => buildProject(index));
  const inserted = await insertProjects(projects);
  console.log(`Seeded ${inserted} projects.`);
  process.exit(0);
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
