
import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkVoteEligibility, submitVote, votingStatus } from "../controllers/votesController.js";
import rateLimit from "express-rate-limit";


const router = Router();

// Rate limiter: max 10 votes per minute per IP
const voteLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 10,
	message: { error: "Too many votes from this IP, please try again later." },
	standardHeaders: true,
	legacyHeaders: false
});


router.get("/check", asyncHandler(checkVoteEligibility));
router.get("/status", asyncHandler(votingStatus));
router.post("/", voteLimiter, asyncHandler(submitVote));

export default router;
