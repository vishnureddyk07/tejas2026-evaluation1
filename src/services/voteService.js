import crypto from "crypto";
import { getDb } from "../db/index.js";

export const hasVoted = async ({ projectId, deviceHash }) => {
  const db = getDb();
  return db.votes.hasVoted({ projectId, deviceHash });
};

export const insertVote = async ({ projectId, deviceHash, score, voterName }) => {
  const db = getDb();
  const id = crypto.randomUUID();
  await db.votes.insert({ id, projectId, deviceHash, score, voterName });
  return id;
};

export const listVotes = async ({ projectId, minScore, maxScore, from, to }) => {
  const db = getDb();
  return db.votes.list({ projectId, minScore, maxScore, from, to });
};

export const deleteVotesByProject = async (projectId) => {
  const db = getDb();
  return db.votes.removeByProject(projectId);
};

export const deleteVoteById = async (voteId) => {
  const db = getDb();
  return db.votes.removeById(voteId);
};
