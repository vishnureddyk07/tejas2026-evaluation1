import { getProjectById } from "../services/projectService.js";

export const fetchProjectById = async (req, res) => {
  const { projectId } = req.params;
  const project = await getProjectById(projectId);

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  return res.json({
    id: project.id,
    title: project.title,
    teamName: project.team_name || project.teamName,
    category: project.category,
    sector: project.sector || "",
    abstract: project.abstract || "",
    teamMembers: project.team_members || project.teamMembers || "",
    department: project.department || "",
    description: project.description
  });
};
