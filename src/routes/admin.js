import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import {
	adminLogin,
	createProjectWithQr,
	getProjectsAdmin,
	getVotesAdmin,
	updateProjectAdmin,
	deleteProjectAdmin,
	getActivityLogs,
	deleteVote,
	downloadActivityLogsExcel
} from "../controllers/adminController.js";

const router = Router();

router.post("/login", asyncHandler(adminLogin));
router.get("/projects", requireAdmin, asyncHandler(getProjectsAdmin));
router.post("/projects", requireAdmin, asyncHandler(createProjectWithQr));
router.put("/projects/:projectId", requireAdmin, asyncHandler(updateProjectAdmin));
router.delete("/projects/:projectId", requireAdmin, asyncHandler(deleteProjectAdmin));
router.get("/votes", requireAdmin, asyncHandler(getVotesAdmin));
router.delete("/votes/:voteId", requireAdmin, asyncHandler(deleteVote));
router.get("/activity-logs", requireAdmin, asyncHandler(getActivityLogs));
router.get("/download-activity-logs", requireAdmin, asyncHandler(downloadActivityLogsExcel));

export default router;