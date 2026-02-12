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
  const { teamNumber, sector, title, department } = req.body;
  
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
  
  try {
    const url = `${config.qrBaseUrl}/vote?projectId=${encodeURIComponent(projectId)}`;
    
    // Generate QR Data URL
    console.log(`[QR] Generating QR code for ${projectId}`);
    const qrDataUrl = await QRCode.toDataURL(url, { 
      width: 512, 
      margin: 2,
      color: {
        dark: "#0A0A0A",
        light: "#FFFFFF"
      }
    });
    
    // Save project WITH QR data URL in database
    const project = {
      id: projectId,
      teamNumber: sanitizeString(teamNumber),
      title: sanitizeString(title),
      sector: sanitizeString(sector || ""),
      department: sanitizeString(department || ""),
      qrDataUrl: qrDataUrl
    };
    
    console.log(`[PROJECT] Saving ${projectId} to database with QR...`);
    await createProject(project);
    console.log(`[PROJECT] ✓ ${projectId} saved to database`);
    
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
  const { sector, title, department } = req.body;

  if (!isNonEmptyString(projectId)) {
    return res.status(400).json({ error: "projectId is required" });
  }

  const updates = {
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

  return res.json({ message: "Project and QR deleted" });
};

export const getVotesAdmin = async (req, res) => {
  const { projectTitle, teamNumber, department, sector, minScore, maxScore } = req.query;
  
  // Clean up empty string filters
  const cleanProjectTitle = projectTitle && projectTitle.trim() !== "" ? projectTitle.trim() : null;
  const cleanTeamNumber = teamNumber && teamNumber.trim() !== "" ? teamNumber.trim() : null;
  const cleanDepartment = department && department.trim() !== "" ? department.trim() : null;
  const cleanSector = sector && sector.trim() !== "" ? sector.trim() : null;
  
  // Fetch all votes with score filters
  const voteFilters = {
    projectId: null,
    minScore: minScore !== undefined && minScore !== "" ? Number(minScore) : null,
    maxScore: maxScore !== undefined && maxScore !== "" ? Number(maxScore) : null,
    from: null,
    to: null
  };

  const votes = await listVotes(voteFilters);
  
  // Always fetch projects to join with votes
  const projects = await listProjects();
  const projectMap = new Map();
  
  projects.forEach(p => {
    projectMap.set(p.id, p);
  });
  
  // Apply project filters if specified
  let filteredVotes = votes;
  if (cleanProjectTitle || cleanTeamNumber || cleanDepartment || cleanSector) {
    filteredVotes = votes.filter(v => {
      const project = projectMap.get(v.projectId);
      if (!project) return false;
      
      const titleMatch = !cleanProjectTitle || (project.title && project.title.toLowerCase().includes(cleanProjectTitle.toLowerCase()));
      const teamMatch = !cleanTeamNumber || project.teamNumber === cleanTeamNumber;
      const deptMatch = !cleanDepartment || (project.department && project.department.toLowerCase().includes(cleanDepartment.toLowerCase()));
      const sectorMatch = !cleanSector || (project.sector && project.sector.toLowerCase().includes(cleanSector.toLowerCase()));
      
      return titleMatch && teamMatch && deptMatch && sectorMatch;
    });
  }

  // Map votes with project details
  return res.json({ 
    votes: filteredVotes.map(v => {
      const project = projectMap.get(v.projectId);
      return {
        ...v,
        project_id: v.projectId,
        voter_name: v.voterName,
        device_hash: v.deviceHash,
        created_at: v.createdAt,
        // Include project details
        teamNumber: project?.teamNumber || v.projectId,
        projectTitle: project?.title || "Unknown",
        department: project?.department || "",
        sector: project?.sector || ""
      };
    })
  });
};