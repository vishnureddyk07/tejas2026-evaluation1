import { getProjectById } from "../services/projectService.js";

export const fetchProjectById = async (req, res) => {
  const { projectId } = req.params;
  const project = await getProjectById(projectId);

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  return res.json({
    id: project.id,
    teamNumber: project.teamNumber || project.id,
    title: project.title || "",
    sector: project.sector || "",
    department: project.department || ""
  });
};
