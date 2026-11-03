import express from "express";
import optionalAuth from "../middleware/optionalAuth.js";
import { superadminAuth } from "../middleware/superAdminAuth.js";
import {
  getAcademicYears,
  backfillAcademicYear,
  rolloverAcademicYear,
  importFormsFromYear,
} from "../controllers/academicYearController.js";

const router = express.Router();

// Year list for every role's year selector
router.get("/", optionalAuth, getAcademicYears);

// Superadmin: tag existing records, then close the current year and open the next
router.post("/backfill", superadminAuth, backfillAcademicYear);
router.post("/rollover", superadminAuth, rolloverAcademicYear);

// Superadmin: copy chosen forms from a past year into the current year
router.post("/import-forms", superadminAuth, importFormsFromYear);

export default router;
