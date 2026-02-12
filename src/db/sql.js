import knexLib from "knex";

const buildKnex = (dbUrl, provider) => {
  const client = provider === "postgres" ? "pg" : "mysql2";
  return knexLib({
    client,
    connection: dbUrl,
    pool: { min: 2, max: 10 }
  });
};

const ensureSchema = async (knex) => {
  const hasProjects = await knex.schema.hasTable("projects");
  if (!hasProjects) {
    await knex.schema.createTable("projects", (table) => {
      table.string("id").primary();
      table.string("title").notNullable();
      table.string("team_name").notNullable();
      table.string("category").notNullable();
      table.string("sector").notNullable().defaultTo("");
      table.text("abstract").notNullable().defaultTo("");
      table.text("team_members").notNullable().defaultTo("");
      table.string("department").notNullable().defaultTo("");
      table.text("description").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  if (hasProjects) {
    const hasSector = await knex.schema.hasColumn("projects", "sector");
    if (!hasSector) {
      await knex.schema.table("projects", (table) => {
        table.string("sector").notNullable().defaultTo("");
      });
    }
    const hasAbstract = await knex.schema.hasColumn("projects", "abstract");
    if (!hasAbstract) {
      await knex.schema.table("projects", (table) => {
        table.text("abstract").notNullable().defaultTo("");
      });
    }
    const hasTeamMembers = await knex.schema.hasColumn("projects", "team_members");
    if (!hasTeamMembers) {
      await knex.schema.table("projects", (table) => {
        table.text("team_members").notNullable().defaultTo("");
      });
    }
    const hasDepartment = await knex.schema.hasColumn("projects", "department");
    if (!hasDepartment) {
      await knex.schema.table("projects", (table) => {
        table.string("department").notNullable().defaultTo("");
      });
    }
  }

  const hasDevices = await knex.schema.hasTable("devices");
  if (!hasDevices) {
    await knex.schema.createTable("devices", (table) => {
      table.string("device_hash").primary();
      table.string("voter_name").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  }

  const hasVotes = await knex.schema.hasTable("votes");
  if (!hasVotes) {
    await knex.schema.createTable("votes", (table) => {
      table.string("id").primary();
      table.string("project_id").notNullable();
      table.string("device_hash").notNullable();
      table.string("voter_name").notNullable();
      table.integer("score").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.unique(["project_id", "device_hash"], "votes_project_device_unique");
    });
  }

  if (hasVotes) {
    const hasVoterName = await knex.schema.hasColumn("votes", "voter_name");
    if (!hasVoterName) {
      await knex.schema.table("votes", (table) => {
        table.string("voter_name").notNullable().defaultTo("");
      });
    }
  }
};

export const createSqlAdapter = async (dbUrl, provider) => {
  const knex = buildKnex(dbUrl, provider);
  await ensureSchema(knex);

  return {
    close: async () => {
      await knex.destroy();
    },
    projects: {
      getById: async (id) => {
        const row = await knex("projects").where({ id }).first();
        return row || null;
      },
      listAll: async () => {
        return knex("projects").select(
          "id",
          "title",
          "team_name",
          "category",
          "sector",
          "abstract",
          "team_members",
          "department",
          "description",
          "created_at"
        );
      },
      create: async (project) => {
        await knex("projects").insert(project);
        return project;
      },
      update: async (id, updates) => {
        await knex("projects").where({ id }).update(updates);
        const row = await knex("projects").where({ id }).first();
        return row || null;
      },
      remove: async (id) => {
        await knex("projects").where({ id }).delete();
      },
      removeAll: async () => {
        await knex("projects").delete();
      },
      insertMany: async (projects) => {
        if (!projects.length) return 0;
        const existing = await knex("projects").select("id");
        const existingIds = new Set(existing.map((row) => row.id));
        const filtered = projects.filter((project) => !existingIds.has(project.id));
        if (!filtered.length) return 0;
        await knex("projects").insert(filtered);
        return filtered.length;
      }
    },
    devices: {
      getByHash: async (deviceHash) => {
        const row = await knex("devices").where({ device_hash: deviceHash }).first();
        return row || null;
      },
      create: async ({ deviceHash, voterName }) => {
        await knex("devices").insert({ device_hash: deviceHash, voter_name: voterName });
      },
      removeAll: async () => {
        await knex("devices").delete();
      }
    },
    votes: {
      hasVoted: async ({ projectId, deviceHash }) => {
        const row = await knex("votes").where({ project_id: projectId, device_hash: deviceHash }).first();
        return Boolean(row);
      },
      insert: async ({ id, projectId, deviceHash, score, voterName }) => {
        await knex("votes").insert({
          id,
          project_id: projectId,
          device_hash: deviceHash,
          voter_name: voterName,
          score
        });
      },
      list: async ({ projectId, minScore, maxScore, from, to }) => {
        const query = knex("votes").select("id", "project_id", "device_hash", "voter_name", "score", "created_at");
        if (projectId) query.where({ project_id: projectId });
        if (minScore !== null && minScore !== undefined) query.where("score", ">=", minScore);
        if (maxScore !== null && maxScore !== undefined) query.where("score", "<=", maxScore);
        if (from) query.where("created_at", ">=", from);
        if (to) query.where("created_at", "<=", to);
        return query.orderBy("created_at", "desc");
      },
      removeByProject: async (projectId) => {
        await knex("votes").where({ project_id: projectId }).delete();
      },
      removeById: async (voteId) => {
        const result = await knex("votes").where({ id: voteId }).delete();
        return result > 0;
      },
      removeAll: async () => {
        await knex("votes").delete();
      }
    }
  };
};
