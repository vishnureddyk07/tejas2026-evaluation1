import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAdmin } from "../middleware/adminAuth.js";
import {
	adminLogin,
	createProjectWithQr,
	getProjectsAdmin,
	getVotesAdmin,
	updateProjectAdmin,
	deleteProjectAdmin
} from "../controllers/adminController.js";

const router = Router();

router.post("/login", asyncHandler(adminLogin));
router.get("/projects", requireAdmin, asyncHandler(getProjectsAdmin));
router.post("/projects", requireAdmin, asyncHandler(createProjectWithQr));
router.put("/projects/:projectId", requireAdmin, asyncHandler(updateProjectAdmin));
router.delete("/projects/:projectId", requireAdmin, asyncHandler(deleteProjectAdmin));
router.get("/votes", requireAdmin, asyncHandler(getVotesAdmin));

export default router;