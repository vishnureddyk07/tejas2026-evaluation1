import { getDb } from "../db/index.js";

export const getDeviceByHash = async (deviceHash) => {
  const db = getDb();
  return db.devices.getByHash(deviceHash);
};

export const createDevice = async ({ deviceHash, voterName }) => {
  const db = getDb();
  return db.devices.create({ deviceHash, voterName });
};
