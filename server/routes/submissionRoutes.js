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
import upload from "../middleware/upload.js";
import cloudinary from "../config/cloudinary.js";

const router = express.Router();

// Apply optional auth to all routes
router.use(optionalAuth);

// Cloudinary direct-upload signature (avoids Vercel 4.5MB body limit)
router.get("/cloudinary-sign", (req, res) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("Cloudinary env vars missing:", { cloudName: !!cloudName, apiKey: !!apiKey, apiSecret: !!apiSecret });
    return res.status(500).json({ success: false, message: "Cloudinary not configured on server" });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { folder: "task_evidence", timestamp };
  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

  res.json({ signature, timestamp, cloudName, apiKey });
});

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
