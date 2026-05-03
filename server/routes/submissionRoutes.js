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
} from "../controllers/submissionController.js";
import optionalAuth from "../middleware/optionalAuth.js";
import upload from "../middleware/upload.js";

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);

// Faculty endpoints
router.post("/submit", (req, res, next) => {
  upload.single("evidence")(req, res, (err) => {
    if (err) {
      console.error("Multer/Cloudinary error message:", err.message);
      console.error("Multer/Cloudinary error full:", JSON.stringify(err, null, 2));
      return res.status(500).json({ success: false, message: err.message || "File upload failed" });
    }
    next();
  });
}, submitTask);

router.put("/:id/update", (req, res, next) => {
  upload.single("evidence")(req, res, (err) => {
    if (err) {
      console.error("Multer/Cloudinary error message:", err.message);
      console.error("Multer/Cloudinary error full:", JSON.stringify(err, null, 2));
      return res.status(500).json({ success: false, message: err.message || "File upload failed" });
    }
    next();
  });
}, updateSubmission);

router.get("/my-submissions", getMySubmissions);
router.post("/:id/accept", acceptReview);
router.post("/:id/appeal", raiseAppeal);
router.get("/user-total", getUserTotal);

// Reviewer endpoints (HOD/Committee)
router.get("/review-queue", getReviewQueue);
router.get("/my-reviewed", getReviewedSubmissions);
router.post("/:id/review", reviewSubmission);

// Appeal reviewer endpoints
router.get("/appeal-queue", getAppealQueue);
router.get("/my-resolved-appeals", getResolvedAppeals);
router.post("/:id/review-appeal", reviewAppeal);

export default router;
