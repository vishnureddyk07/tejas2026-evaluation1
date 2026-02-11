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
  const users = parseAdminUsers();
  console.log("DEBUG: Checking credentials. Config adminUsers:", config.adminUsers);
  console.log("DEBUG: Parsed users:", users);
  console.log("DEBUG: Looking for email:", email, "password:", password);
  const found = users.some((user) => user.email === email && user.password === password);
  console.log("DEBUG: Credential check result:", found);
  return found;
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
  console.log(`[AUTH] Login attempt: ${email}`);
  
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    console.warn("[AUTH] Invalid credentials provided");
    return res.status(400).json({ error: "Email and password are required" });
  }
  
  if (!isValidCredential(email, password)) {
    console.warn(`[AUTH] Login failed for ${email}`);
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  const token = issueAdminToken({ email });
  console.log(`[AUTH] ✓ Login successful for ${email}`);
  return res.json({ token, email });
};

export const createProjectWithQr = async (req, res) => {
  const { teamNumber, teamName, sector, title, department } = req.body;
  
  console.log(`[PROJECT] Creating project: ${teamNumber}`);

  if (!isNonEmptyString(teamNumber)) {
    console.warn("[PROJECT] Team number required");
    return res.status(400).json({ error: "teamNumber is required" });
  }

  if (!isNonEmptyString(title)) {
    console.warn("[PROJECT] Project title required");
    return res.status(400).json({ error: "title is required" });
  }

  const projectId = teamNumber;
  const project = {
    id: projectId,
    teamNumber: sanitizeString(teamNumber),
    teamName: sanitizeString(teamName || ""),
    title: sanitizeString(title),
    sector: sanitizeString(sector || ""),
    department: sanitizeString(department || "")
  };

  try {
    console.log(`[PROJECT] Saving ${projectId} to database...`);
    await createProject(project);
    console.log(`[PROJECT] ✓ ${projectId} saved to database`);
    
    const url = `${config.qrBaseUrl}/vote?projectId=${encodeURIComponent(projectId)}`;
    
    // Generate QR Data URL for preview
    console.log(`[QR] Generating QR code for ${projectId}`);
    const qrDataUrl = await QRCode.toDataURL(url, { 
      width: 512, 
      margin: 2,
      color: {
        dark: "#0A0A0A",
        light: "#FFFFFF"
      }
    });
    
    // Generate QR file for gallery
    const qrDir = path.join(__dirname, "..", "..", "public", "qr");
    ensureDir(qrDir);
    const qrFilePath = path.join(qrDir, `${projectId}.png`);
    
    await QRCode.toFile(qrFilePath, url, { 
      width: 512, 
      margin: 2,
      color: {
        dark: "#0A0A0A",
        light: "#FFFFFF"
      }
    });
    
    console.log(`[QR] ✓ QR code saved to ${qrFilePath}`);
    return res.status(201).json({ project, qrDataUrl });
  } catch (error) {
    console.error(`[PROJECT] Error creating ${projectId}:`, error.message);
    throw error;
  }
};

export const getProjectsAdmin = async (req, res) => {
  const projects = await listProjects();
  return res.json({ projects });
};

export const updateProjectAdmin = async (req, res) => {
  const { projectId } = req.params;
  const { teamName, sector, title, department } = req.body;

  if (!isNonEmptyString(projectId)) {
    return res.status(400).json({ error: "projectId is required" });
  }

  const updates = {
    teamName: sanitizeString(teamName || ""),
    title: sanitizeString(title || ""),
    sector: sanitizeString(sector || ""),
    department: sanitizeString(department || "")
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
  const { projectTitle, teamNumber, department, sector, minScore, maxScore } = req.query;
  
  // Fetch all votes with score filters
  const voteFilters = {
    projectId: null,
    minScore: minScore !== undefined ? Number(minScore) : null,
    maxScore: maxScore !== undefined ? Number(maxScore) : null,
    from: null,
    to: null
  };

  const votes = await listVotes(voteFilters);
  
  // If project filters are specified, get projects and filter votes
  if (projectTitle || teamNumber || department || sector) {
    const projects = await listProjects();
    const projectMap = new Map();
    
    projects.forEach(p => {
      const titleMatch = !projectTitle || (p.title && p.title.toLowerCase().includes(projectTitle.toLowerCase()));
      const teamMatch = !teamNumber || p.teamNumber === teamNumber;
      const deptMatch = !department || (p.department && p.department.toLowerCase().includes(department.toLowerCase()));
      const sectorMatch = !sector || (p.sector && p.sector.toLowerCase().includes(sector.toLowerCase()));
      
      if (titleMatch && teamMatch && deptMatch && sectorMatch) {
        projectMap.set(p.id, p);
      }
    });
    
    // Filter votes to only include matching projects
    return res.json({ 
      votes: votes.filter(v => projectMap.has(v.projectId)).map(v => ({
        ...v,
        project_id: v.projectId,
        voter_name: v.voterName,
        device_hash: v.deviceHash,
        created_at: v.createdAt
      }))
    });
  }

  return res.json({ 
    votes: votes.map(v => ({
      ...v,
      project_id: v.projectId,
      voter_name: v.voterName,
      device_hash: v.deviceHash,
      created_at: v.createdAt
    }))
  });
};