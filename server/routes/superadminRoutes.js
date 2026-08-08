import express from "express";
import {
  createForm,
  createCollege,
  createRole,
  deleteForm,
  deleteCollege,
  deleteCommitteeMember,
  deleteRole,
  getFormById,
  getForms,
  getColleges,
  getCommitteeMember,
  getInternalCommittees,
  getRoles,
  registerCommitteeMember,
  registerSuperAdmin,
  updateSuperAdminCredentials,
  updateForm,
  updateCollege,
  updateCommitteeMember,
  updateRole,
  resetCollegeEvaluations,
  getCollegeStaff,
  previewDuplicateSubmissions,
  deleteDuplicateSubmissions,
} from "../controllers/superAdminController.js";
import { addGuest, getGuests, deleteGuest } from "../controllers/authController.js";
import { superadminAuth } from "../middleware/superAdminAuth.js";

const superadminRouter = express.Router();

// PUBLIC ROUTES — no auth required
superadminRouter.post("/register", registerSuperAdmin);
// Requires knowing the current superadmin password — self-authenticating
superadminRouter.put("/credentials", updateSuperAdminCredentials);

superadminRouter.get("/roles", superadminAuth, getRoles);
superadminRouter.post("/roles", superadminAuth, createRole);
superadminRouter.put("/roles/:id", superadminAuth, updateRole);
superadminRouter.delete("/roles/:id", superadminAuth, deleteRole);

superadminRouter.get("/colleges", superadminAuth, getColleges);
superadminRouter.post("/colleges", superadminAuth, createCollege);
superadminRouter.put("/colleges/:id", superadminAuth, updateCollege);
superadminRouter.delete("/colleges/:id", superadminAuth, deleteCollege);

superadminRouter.post(
  "/committee-member/register",
  superadminAuth,
  registerCommitteeMember,
);
superadminRouter.get("/committee-member", superadminAuth, getCommitteeMember);
superadminRouter.get("/internal-committees", superadminAuth, getInternalCommittees);
superadminRouter.put(
  "/committee-member",
  superadminAuth,
  updateCommitteeMember,
);
superadminRouter.delete(
  "/committee-member",
  superadminAuth,
  deleteCommitteeMember,
);

superadminRouter.get("/forms", superadminAuth, getForms);
superadminRouter.get("/forms/:id", superadminAuth, getFormById);
superadminRouter.post("/forms", superadminAuth, createForm);
superadminRouter.put("/forms/:id", superadminAuth, updateForm);
superadminRouter.delete("/forms/:id", superadminAuth, deleteForm);

superadminRouter.get("/college-staff", superadminAuth, getCollegeStaff);
superadminRouter.post("/reset-evaluations", superadminAuth, resetCollegeEvaluations);
superadminRouter.get("/duplicate-submissions", superadminAuth, previewDuplicateSubmissions);
superadminRouter.delete("/duplicate-submissions", superadminAuth, deleteDuplicateSubmissions);

// Guest user management (superadmin only)
superadminRouter.get("/guests", superadminAuth, getGuests);
superadminRouter.post("/guests", superadminAuth, addGuest);
superadminRouter.delete("/guests/:id", superadminAuth, deleteGuest);

export default superadminRouter;
