import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { fetchProjectById } from "../controllers/projectsController.js";

const router = Router();

router.get("/:projectId", asyncHandler(fetchProjectById));

export default router;
