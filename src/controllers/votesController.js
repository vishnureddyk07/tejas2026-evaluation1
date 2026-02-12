import { getProjectById } from "../services/projectService.js";
import { getDeviceByHash, createDevice } from "../services/deviceService.js";
import { hasVoted, insertVote } from "../services/voteService.js";
import { isNonEmptyString, isValidScore, sanitizeString } from "../utils/validators.js";
import { logActivity } from "../utils/activityLogger.js";
import { getClientIp } from "../utils/ipUtils.js";

export const checkVoteEligibility = async (req, res) => {
  const { projectId, deviceHash } = req.query;

  if (!isNonEmptyString(projectId) || !isNonEmptyString(deviceHash)) {
    return res.status(400).json({ error: "projectId and deviceHash are required" });
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const device = await getDeviceByHash(deviceHash);
  const alreadyVoted = await hasVoted({ projectId, deviceHash });

  if (alreadyVoted) {
    return res.status(200).json({ eligible: false, reason: "DUPLICATE_VOTE", voterName: device?.voter_name || device?.voterName || null });
  }

  return res.status(200).json({ eligible: true, reason: null, voterName: device?.voter_name || device?.voterName || null });
};

export const submitVote = async (req, res) => {
  const { projectId, deviceHash, voterName, score } = req.body;

  if (!isNonEmptyString(projectId) || !isNonEmptyString(deviceHash)) {
    return res.status(400).json({ error: "projectId and deviceHash are required" });
  }

  if (!isValidScore(score)) {
    return res.status(400).json({ error: "Score must be an integer between 0 and 10" });
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  const device = await getDeviceByHash(deviceHash);
  const sanitizedName = sanitizeString(voterName);

  if (device) {
    const existingName = device.voter_name || device.voterName;
    if (sanitizedName && existingName !== sanitizedName) {
      return res.status(409).json({ error: "Voter name is locked to this device" });
    }
  } else {
    if (!isNonEmptyString(sanitizedName)) {
      return res.status(400).json({ error: "voterName is required for first-time devices" });
    }
    await createDevice({ deviceHash, voterName: sanitizedName });
  }

  const alreadyVoted = await hasVoted({ projectId, deviceHash });
  if (alreadyVoted) {
    return res.status(409).json({ error: "Duplicate vote detected" });
  }

  const nameToStore = device ? (device.voter_name || device.voterName) : sanitizedName;
  const voteId = await insertVote({
    projectId,
    deviceHash,
    score: Number(score),
    voterName: nameToStore
  });

  // Log vote submission
  const ipAddress = getClientIp(req);
  await logActivity("vote", "submit", {
    projectId,
    score: Number(score),
    voterName: nameToStore,
    deviceHash: deviceHash.substring(0, 8) + "...", // Only log partial hash for privacy
    ipAddress
  }, nameToStore);

  return res.status(201).json({
    id: voteId,
    message: "Your vote has been recorded successfully.",
    timestamp: new Date().toISOString()
  });
};
