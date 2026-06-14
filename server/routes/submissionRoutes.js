import express from "express";
import {
  submitTask,
  getMySubmissions,
  getReviewQueue,
  getReviewedSubmissions,
  reviewSubmission,
  acceptReview,
  raiseAppeal,
  getAppealQueue,
  reviewAppeal,
  getResolvedAppeals,
  getUserTotal,
  updateSubmission,
  deleteSubmission,
  getReviewAccess,
} from "../controllers/submissionController.js";
import optionalAuth from "../middleware/optionalAuth.js";

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);

// Faculty endpoints
router.post("/submit", submitTask);
router.put("/:id/update", updateSubmission);

router.get("/my-submissions", getMySubmissions);
router.post("/:id/accept", acceptReview);
router.post("/:id/appeal", raiseAppeal);
router.get("/user-total", getUserTotal);

// Dynamic review panel access (workflow-based)
router.get("/review-access", getReviewAccess);

// Reviewer endpoints (HOD/Committee)
router.get("/review-queue", getReviewQueue);
router.get("/my-reviewed", getReviewedSubmissions);
router.post("/:id/review", reviewSubmission);
router.delete("/:id", deleteSubmission);

// Appeal reviewer endpoints
router.get("/appeal-queue", getAppealQueue);
router.get("/my-resolved-appeals", getResolvedAppeals);
router.post("/:id/review-appeal", reviewAppeal);

export default router;
