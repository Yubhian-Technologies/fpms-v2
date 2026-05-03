import express from "express";
import { getSignedUploadParams } from "../controllers/cloudinaryController.js";
import optionalAuth from "../middleware/optionalAuth.js";

const router = express.Router();

// POST /api/cloudinary/sign
// Returns signed upload credentials so the browser uploads directly to Cloudinary.
router.post("/sign", optionalAuth, getSignedUploadParams);

export default router;
