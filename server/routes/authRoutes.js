import express from "express";
import {
  addAdmin,
  addViewer,
  getViewers,
  committeeLogin,
  getAllAdmins,
  deleteAdmin,
  updateAdmin,
  fetchAppealsForCommittee,
  verifyAppealByCommittee,
  getCommitteeRoles,
  getSubmissionAppealWorkflowRules,
  updateSubmissionAppealWorkflowRules,
  submitWorkflowTask,
  submitWorkflowAppeal,
  getMyWorkflowTaskStatuses,
  getWorkflowReviewQueue,
  reviewWorkflowSubmission,
  unifiedLogin,
  getApplicableForms,
  getCriteriaModulesTasks,
  getCommitteeDashboard,
  changePassword,
} from "../controllers/authController.js";
import {
  createCollege,
  deleteCollege,
  getColleges,
  updateCollege,
} from "../controllers/superAdminController.js";
import { committeeAuth } from "../middleware/authMiddleware.js";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  fetchAllHodAppeals,
  verifyHodAppeal,
} from "../controllers/appealHodController.js";

const authRouter = express.Router();

authRouter.post("/login", committeeLogin);
authRouter.post("/unified-login", unifiedLogin);
authRouter.get("/forms", getApplicableForms);
authRouter.get("/forms/:formId/criteria/:criteriaId", getCriteriaModulesTasks);
authRouter.post("/admin-add", committeeAuth, addAdmin);
authRouter.post("/viewer-add", committeeAuth, addViewer);
authRouter.get("/viewers", committeeAuth, getViewers);
authRouter.get("/admins", committeeAuth, getAllAdmins);
authRouter.get("/colleges", committeeAuth, getColleges);
authRouter.post("/colleges", committeeAuth, createCollege);
authRouter.put("/colleges/:id", committeeAuth, updateCollege);
authRouter.delete("/colleges/:id", committeeAuth, deleteCollege);
authRouter.get("/roles", committeeAuth, getCommitteeRoles);
authRouter.get("/admin-workflow-roles", adminAuth, getCommitteeRoles);
authRouter.get("/dashboard-data", committeeAuth, getCommitteeDashboard);
authRouter.get(
  "/workflow-rules",
  adminAuth,
  getSubmissionAppealWorkflowRules,
);
authRouter.put(
  "/workflow-rules",
  adminAuth,
  updateSubmissionAppealWorkflowRules,
);
authRouter.post("/workflow/submissions/task", submitWorkflowTask);
authRouter.post("/workflow/submissions/task/appeal", submitWorkflowAppeal);
authRouter.get("/workflow/submissions/my-statuses", getMyWorkflowTaskStatuses);
authRouter.get("/workflow/submissions/review-queue", getWorkflowReviewQueue);
authRouter.post(
  "/workflow/submissions/:submissionId/review",
  reviewWorkflowSubmission,
);

authRouter.delete("/delete/:id", committeeAuth, deleteAdmin);
authRouter.put("/update/:id", committeeAuth, updateAdmin);
authRouter.get("/appeals", committeeAuth, fetchAppealsForCommittee);
authRouter.put("/appeals/:appealId", committeeAuth, verifyAppealByCommittee);
authRouter.get("/hod-appeals", committeeAuth, fetchAllHodAppeals);
authRouter.put("/hod-appeals/:appealId", committeeAuth, verifyHodAppeal);

authRouter.post("/change-password", changePassword);


export default authRouter;
