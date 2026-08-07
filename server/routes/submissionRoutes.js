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
  editReview,
  getFormStructure,
  getFormCriteria,
  getFormOrder,
  getCollegePhases,
  getAllReviewedSubmissions,
  getCollegeAllFinalized,
} from "../controllers/submissionController.js";
import optionalAuth from "../middleware/optionalAuth.js";

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);

// Fallback JSON parser — reads the raw body stream if express.json()
// didn't populate req.body (e.g., Content-Type header mismatch in proxy).
const ensureJsonBody = (req, res, next) => {
  if (req.body !== undefined) return next();
  let raw = "";
  req.on("data", (chunk) => { raw += chunk.toString(); });
  req.on("end", () => {
    try { req.body = raw ? JSON.parse(raw) : {}; }
    catch { req.body = {}; }
    next();
  });
  req.on("error", () => { req.body = {}; next(); });
};

// Faculty endpoints
router.post("/submit", ensureJsonBody, submitTask);
router.put("/:id/update", ensureJsonBody, updateSubmission);

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
router.put("/:id/edit-review", editReview);
router.delete("/:id", deleteSubmission);

// All finalized (accepted/reviewed) submissions in reviewer's scope — for editing during evaluation
router.get("/all-reviewed", getAllReviewedSubmissions);

// All finalized submissions across the entire college — for principal Edit Scores tab
router.get("/college-all-finalized", getCollegeAllFinalized);

// College phase map (lets review page check phase per submission regardless of reviewer's own college)
router.get("/college-phases", getCollegePhases);

// Form structure (for review/HOD display ordering)
router.get("/form-order", getFormOrder);
router.get("/form-criteria/:formId", getFormCriteria);
router.get("/form-structure/:formId/criteria/:criteriaId", getFormStructure);

// Appeal reviewer endpoints
router.get("/appeal-queue", getAppealQueue);
router.get("/my-resolved-appeals", getResolvedAppeals);
router.post("/:id/review-appeal", reviewAppeal);

export default router;
