import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config/index.js";
import { issueAdminToken } from "../middleware/adminAuth.js";
import { createProject, listProjects, updateProject, deleteProject } from "../services/projectService.js";
import { listVotes, deleteVotesByProject, deleteVoteById } from "../services/voteService.js";
import { isNonEmptyString, sanitizeString } from "../utils/validators.js";
import { logActivity, getActivityLogsFromDb } from "../utils/activityLogger.js";
import { getClientIp } from "../utils/ipUtils.js";
import XLSX from "xlsx";

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

export const adminLogin = async (req, res) => {
  const { email, password } = req.body;
  const ipAddress = getClientIp(req);
  console.log(`[AUTH] Login attempt: ${email} from ${ipAddress}`);
  
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    console.warn("[AUTH] Invalid credentials provided");
    await logActivity("auth", "login_failed", { email, reason: "Invalid format", ipAddress }, email);
    return res.status(400).json({ error: "Email and password are required" });
  }
  
  if (!isValidCredential(email, password)) {
    console.warn(`[AUTH] Login failed for ${email}`);
    await logActivity("auth", "login_failed", { email, reason: "Invalid credentials", ipAddress }, email);
    return res.status(401).json({ error: "Invalid credentials" });
  }
  
  const token = issueAdminToken({ email });
  console.log(`[AUTH] ✓ Login successful for ${email} from ${ipAddress}`);
  await logActivity("auth", "login_success", { email, ipAddress }, email);
  return res.json({ token, email });
};

export const createProjectWithQr = async (req, res) => {
  const { teamNumber, sector, title, department } = req.body;
  const ipAddress = getClientIp(req);
  
  console.log(`[PROJECT] Creating project: ${teamNumber} from ${ipAddress}`);

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
    
    await logActivity("project", "create", { 
      projectId, 
      teamNumber, 
      title, 
      sector, 
      department,
      ipAddress
    }, req.admin?.email || "admin");
    
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
  const ipAddress = getClientIp(req);

  if (!isNonEmptyString(projectId)) {
    return res.status(400).json({ error: "projectId is required" });
  }

  const updates = {
    title: sanitizeString(title || ""),
    sector: sanitizeString(sector || ""),
    department: sanitizeString(department || "")
  };

  const updated = await updateProject(projectId, updates);
  
  await logActivity("project", "update", { 
    projectId, 
    updates,
    ipAddress 
  }, req.admin?.email || "admin");
  
  return res.json({ project: updated });
};

export const deleteProjectAdmin = async (req, res) => {
  const { projectId } = req.params;
  const ipAddress = getClientIp(req);
  if (!isNonEmptyString(projectId)) {
    return res.status(400).json({ error: "projectId is required" });
  }

  await deleteVotesByProject(projectId);
  await deleteProject(projectId);

  await logActivity("project", "delete", { projectId, ipAddress }, req.admin?.email || "admin");

  return res.json({ message: "Project and QR deleted" });
};

export const getVotesAdmin = async (req, res) => {
  const { projectTitle, teamNumber, department, sector, voterName, minScore, maxScore } = req.query;
  
  // Clean up empty string filters
  const cleanProjectTitle = projectTitle && projectTitle.trim() !== "" ? projectTitle.trim() : null;
  const cleanTeamNumber = teamNumber && teamNumber.trim() !== "" ? teamNumber.trim() : null;
  const cleanDepartment = department && department.trim() !== "" ? department.trim() : null;
  const cleanSector = sector && sector.trim() !== "" ? sector.trim() : null;
  const cleanVoterName = voterName && voterName.trim() !== "" ? voterName.trim() : null;
  
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
  if (cleanProjectTitle || cleanTeamNumber || cleanDepartment || cleanSector || cleanVoterName) {
    filteredVotes = votes.filter(v => {
      const project = projectMap.get(v.projectId);
      if (!project) return false;
      
      const titleMatch = !cleanProjectTitle || (project.title && project.title.toLowerCase().includes(cleanProjectTitle.toLowerCase()));
      const teamMatch = !cleanTeamNumber || project.teamNumber === cleanTeamNumber;
      const deptMatch = !cleanDepartment || (project.department && project.department.toLowerCase().includes(cleanDepartment.toLowerCase()));
      const sectorMatch = !cleanSector || (project.sector && project.sector.toLowerCase().includes(cleanSector.toLowerCase()));
      const voterMatch = !cleanVoterName || (v.voterName && v.voterName.toLowerCase().includes(cleanVoterName.toLowerCase()));
      
      return titleMatch && teamMatch && deptMatch && sectorMatch && voterMatch;
    });
  }

  // Map votes with project details
  const mappedVotes = filteredVotes.map(v => {
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
  });

  // Calculate statistics
  const stats = {
    count: filteredVotes.length,
    totalScore: filteredVotes.reduce((sum, v) => sum + (v.score || 0), 0),
    averageScore: filteredVotes.length > 0 
      ? filteredVotes.reduce((sum, v) => sum + (v.score || 0), 0) / filteredVotes.length 
      : 0
  };

  // Log filter usage
  if (cleanProjectTitle || cleanTeamNumber || cleanDepartment || cleanSector || cleanVoterName) {
    await logActivity("filter", "apply", { 
      projectTitle: cleanProjectTitle,
      teamNumber: cleanTeamNumber,
      department: cleanDepartment,
      sector: cleanSector,
      voterName: cleanVoterName,
      resultsCount: filteredVotes.length
    }, req.admin?.email || "admin");
  }

  return res.json({ 
    votes: mappedVotes,
    stats: stats
  });
};

// Get activity logs for developer view
export const getActivityLogs = async (req, res) => {
  try {
    // RESTRICT TO DEVELOPER ONLY
    const userEmail = req.admin?.email || "unknown";
    if (userEmail !== "vishnureddy@tejas") {
      console.warn(`[SECURITY] Unauthorized activity log access attempt by ${userEmail}`);
      return res.status(403).json({ 
        error: "Access denied. Only the developer (vishnureddy@tejas) can view activity logs.",
        userEmail 
      });
    }

    // Get filter parameters
    const { type, action, user, limit = 100 } = req.query;
    
    // Fetch logs from database
    let logs = await getActivityLogsFromDb({ type, action, user, limit: parseInt(limit) || 100 });
    
    // Parse JSON details field
    const formattedLogs = logs.map(log => ({
      ...log,
      details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
      ipAddress: log.ip_address
    }));
    
    // Sort by timestamp descending
    formattedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return res.json({
      logs: formattedLogs,
      total: formattedLogs.length,
      restrictedTo: "vishnureddy@tejas"
    });
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return res.status(500).json({ error: "Failed to fetch activity logs" });
  }
};

// Delete a vote
export const deleteVote = async (req, res) => {
  try {
    const { voteId } = req.params;
    const ipAddress = getClientIp(req);
    
    console.log(`[VOTE] Attempting to delete vote: ${voteId} from ${ipAddress}`);
    
    if (!isNonEmptyString(voteId)) {
      return res.status(400).json({ error: "Vote ID is required" });
    }

    const success = await deleteVoteById(voteId);
    
    console.log(`[VOTE] Delete result for ${voteId}:`, success);
    
    if (!success) {
      return res.status(404).json({ error: "Vote not found" });
    }

    // Log vote deletion
    await logActivity("vote", "delete", { voteId, ipAddress }, req.admin?.email || "admin");

    return res.json({ message: "Vote deleted successfully", voteId });
  } catch (error) {
    console.error("Error deleting vote:", error);
    return res.status(500).json({ error: "Failed to delete vote" });
  }
};

// Download activity logs as Excel
export const downloadActivityLogsExcel = async (req, res) => {
  try {
    // RESTRICT TO DEVELOPER ONLY
    const userEmail = req.admin?.email || "unknown";
    if (userEmail !== "vishnureddy@tejas") {
      console.warn(`[SECURITY] Unauthorized activity log download attempt by ${userEmail}`);
      return res.status(403).json({ 
        error: "Access denied. Only the developer (vishnureddy@tejas) can download activity logs.",
        userEmail 
      });
    }

    // Get filter parameters
    const { type, action, user, limit = 500 } = req.query;
    
    // Fetch logs from database
    let logs = await getActivityLogsFromDb({ type, action, user, limit: parseInt(limit) || 500 });
    
    // Parse JSON details field
    const formattedLogs = logs.map(log => ({
      Timestamp: new Date(log.timestamp).toLocaleString('en-US', { 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      Type: log.type,
      Action: log.action,
      User: log.user || '-',
      IP_Address: log.ip_address || '-',
      Details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details)
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(formattedLogs);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 22 },  // Timestamp
      { wch: 12 },  // Type
      { wch: 15 },  // Action
      { wch: 20 },  // User
      { wch: 18 },  // IP_Address
      { wch: 50 }   // Details
    ];
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "Activity Logs");
    
    // Generate buffer
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="activity-logs-${new Date().getTime()}.xlsx"`);
    
    // Send the buffer
    return res.send(buffer);
  } catch (error) {
    console.error("Error downloading activity logs:", error);
    return res.status(500).json({ error: "Failed to download activity logs" });
  }
};