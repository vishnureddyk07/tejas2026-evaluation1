import { getDb } from "../db/index.js";

export const getProjectById = async (projectId) => {
  const db = getDb();
  return db.projects.getById(projectId);
};

export const listProjects = async () => {
  const db = getDb();
  return db.projects.listAll();
};

export const createProject = async (project) => {
  const db = getDb();
  return db.projects.create(project);
};

export const updateProject = async (projectId, updates) => {
  const db = getDb();
  return db.projects.update(projectId, updates);
};

export const deleteProject = async (projectId) => {
  const db = getDb();
  return db.projects.remove(projectId);
};

export const insertProjects = async (projects) => {
  const db = getDb();
  return db.projects.insertMany(projects);
};
