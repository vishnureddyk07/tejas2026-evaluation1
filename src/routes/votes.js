import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkVoteEligibility, submitVote } from "../controllers/votesController.js";

const router = Router();

router.get("/check", asyncHandler(checkVoteEligibility));
router.post("/", asyncHandler(submitVote));

export default router;
