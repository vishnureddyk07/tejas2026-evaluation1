import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

export const createMongoAdapter = async (dbUrl, { inMemory = false } = {}) => {
  let memoryServer;
  let resolvedUrl = dbUrl;
  if (inMemory) {
    memoryServer = await MongoMemoryServer.create();
    resolvedUrl = memoryServer.getUri();
  }

  const client = new MongoClient(resolvedUrl);
  await client.connect();
  const db = client.db();

  const projects = db.collection("projects");
  const devices = db.collection("devices");
  const votes = db.collection("votes");
  const activityLogs = db.collection("activityLogs");

  await projects.createIndex({ id: 1 }, { unique: true });
  await devices.createIndex({ deviceHash: 1 }, { unique: true });
  await votes.createIndex({ projectId: 1, deviceHash: 1 }, { unique: true });
  await activityLogs.createIndex({ timestamp: -1 });

  return {
    close: async () => {
      await client.close();
      if (memoryServer) {
        await memoryServer.stop();
      }
    },
    projects: {
      getById: async (id) => {
        // Use projection to only fetch needed fields for voting
        return projects.findOne(
          { id },
          { projection: { _id: 0, id: 1, teamNumber: 1, title: 1, sector: 1, department: 1, qrDataUrl: 1 } }
        );
      },
      listAll: async () => {
        return projects.find({}, { projection: { _id: 0 } }).toArray();
      },
      create: async (project) => {
        await projects.insertOne(project);
        return project;
      },
      update: async (id, updates) => {
        await projects.updateOne({ id }, { $set: updates });
        return projects.findOne({ id });
      },
      remove: async (id) => {
        await projects.deleteOne({ id });
      },
      removeAll: async () => {
        await projects.deleteMany({});
      },
      insertMany: async (projectList) => {
        if (!projectList.length) return 0;
        const existing = await projects.find({}, { projection: { id: 1 } }).toArray();
        const existingIds = new Set(existing.map((item) => item.id));
        const filtered = projectList.filter((project) => !existingIds.has(project.id));
        if (!filtered.length) return 0;
        await projects.insertMany(filtered);
        return filtered.length;
      }
    },
    devices: {
      getByHash: async (deviceHash) => {
        return devices.findOne({ deviceHash });
      },
      create: async ({ deviceHash, voterName }) => {
        await devices.insertOne({ deviceHash, voterName, createdAt: new Date() });
      },
      removeAll: async () => {
        await devices.deleteMany({});
      }
    },
    votes: {
      hasVoted: async ({ projectId, deviceHash }) => {
        const count = await votes.countDocuments({ projectId, deviceHash }, { limit: 1 });
        return count > 0;
      },
      insert: async ({ id, projectId, deviceHash, score, voterName }) => {
        await votes.insertOne({
          id,
          projectId,
          deviceHash,
          voterName,
          score,
          createdAt: new Date()
        });
      },
      list: async ({ projectId, minScore, maxScore, from, to }) => {
        const query = {};
        if (projectId) query.projectId = projectId;
        if (minScore !== null && minScore !== undefined) {
          query.score = { ...query.score, $gte: minScore };
        }
        if (maxScore !== null && maxScore !== undefined) {
          query.score = { ...query.score, $lte: maxScore };
        }
        if (from || to) {
          query.createdAt = {};
          if (from) query.createdAt.$gte = new Date(from);
          if (to) query.createdAt.$lte = new Date(to);
        }
        return votes.find(query, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      },
      removeByProject: async (projectId) => {
        await votes.deleteMany({ projectId });
      },
      removeById: async (voteId) => {
        const result = await votes.deleteOne({ id: voteId });
        return result.deletedCount > 0;
      },
      removeAll: async () => {
        await votes.deleteMany({});
      }
    },
    activityLogs: {
      insert: async (log) => {
        await activityLogs.insertOne(log);
      },
      list: async ({ type, action, user, limit = 100 }) => {
        const query = {};
        if (type) query.type = type;
        if (action) query.action = action;
        if (user) query.user = user;
        return activityLogs.find(query, { projection: { _id: 0 } }).sort({ timestamp: -1 }).limit(limit).toArray();
      },
      getAll: async (limit = 100) => {
        return activityLogs.find({}, { projection: { _id: 0 } }).sort({ timestamp: -1 }).limit(limit).toArray();
      }
    }
  };
};
