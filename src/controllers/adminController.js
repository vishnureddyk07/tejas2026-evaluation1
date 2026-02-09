import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config/index.js";
import { issueAdminToken } from "../middleware/adminAuth.js";
import { createProject, listProjects, updateProject, deleteProject } from "../services/projectService.js";
import { listVotes, deleteVotesByProject } from "../services/voteService.js";
import { isNonEmptyString, sanitizeString } from "../utils/validators.js";

const parseAdminUsers = () => {
  return config.adminUsers
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const dividerIndex = pair.indexOf(":");
      if (dividerIndex === -1) {
        return { email: pair, password: "" };
      }
      const email = pair.slice(0, dividerIndex).trim();
      const password = pair.slice(dividerIndex + 1).trim();
      return { email, password };
    });
};

const isValidCredential = (email, password) => {
  return parseAdminUsers().some((user) => user.email === email && user.password === password);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

export const adminLogin = (req, res) => {
  const { email, password } = req.body;
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (!isValidCredential(email, password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = issueAdminToken({ email });
  return res.json({ token, email });
};

export const createProjectWithQr = async (req, res) => {
  const { title, sector, abstract, teamMembers, department } = req.body;

  if (!isNonEmptyString(title) || !isNonEmptyString(sector)) {
    return res.status(400).json({ error: "title and sector are required" });
  }

  const safeTitle = sanitizeString(title);
  const projectId = `PRJ-${Date.now().toString().slice(-6)}`;

  const project = {
    id: projectId,
    title: safeTitle,
    team_name: sanitizeString(teamMembers || "Team TEJUS"),
    category: sanitizeString(sector),
    sector: sanitizeString(sector),
    abstract: sanitizeString(abstract || ""),
    team_members: sanitizeString(teamMembers || ""),
    department: sanitizeString(department || ""),
    description: sanitizeString(abstract || "")
  };

  await createProject(project);
  const url = `${config.qrBaseUrl}/vote?projectId=${encodeURIComponent(projectId)}`;
  const qrDataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
  const qrDir = path.join(__dirname, "..", "..", "public", "qr");
  ensureDir(qrDir);
  const qrFilePath = path.join(qrDir, `${projectId}.png`);
  await QRCode.toFile(qrFilePath, url, { width: 512, margin: 2 });

  return res.status(201).json({ project, qrDataUrl });
};

export const getProjectsAdmin = async (req, res) => {
  const projects = await listProjects();
  return res.json({ projects });
};

export const updateProjectAdmin = async (req, res) => {
  const { projectId } = req.params;
  const { title, sector, abstract, teamMembers, department } = req.body;

  if (!isNonEmptyString(projectId)) {
    return res.status(400).json({ error: "projectId is required" });
  }

  const updates = {
    title: sanitizeString(title || ""),
    category: sanitizeString(sector || ""),
    sector: sanitizeString(sector || ""),
    abstract: sanitizeString(abstract || ""),
    team_members: sanitizeString(teamMembers || ""),
    department: sanitizeString(department || ""),
    description: sanitizeString(abstract || "")
  };

  const updated = await updateProject(projectId, updates);
  return res.json({ project: updated });
};

export const deleteProjectAdmin = async (req, res) => {
  const { projectId } = req.params;
  if (!isNonEmptyString(projectId)) {
    return res.status(400).json({ error: "projectId is required" });
  }

  await deleteVotesByProject(projectId);
  await deleteProject(projectId);

  const qrDir = path.join(__dirname, "..", "..", "public", "qr");
  const qrFilePath = path.join(qrDir, `${projectId}.png`);
  if (fs.existsSync(qrFilePath)) {
    fs.unlinkSync(qrFilePath);
  }

  return res.json({ message: "Project and QR deleted" });
};

export const getVotesAdmin = async (req, res) => {
  const { projectId, minScore, maxScore, from, to } = req.query;
  const filters = {
    projectId: projectId || null,
    minScore: minScore !== undefined ? Number(minScore) : null,
    maxScore: maxScore !== undefined ? Number(maxScore) : null,
    from: from || null,
    to: to || null
  };

  const votes = await listVotes(filters);
  return res.json({ votes });
};