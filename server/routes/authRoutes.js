import express from "express";
import {
  addAdmin,
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
  getMyReviewerAssignment,
  getReviewerDepartmentSubmissions,
  submitReviewerFeedback,
} from "../controllers/authController.js";
import {
  createCollege,
  deleteCollege,
  getColleges,
  updateCollege,
} from "../controllers/superAdminController.js";
import { committeeAuth } from "../middleware/authMiddleware.js";
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
authRouter.get("/admins", committeeAuth, getAllAdmins);
authRouter.get("/colleges", committeeAuth, getColleges);
authRouter.post("/colleges", committeeAuth, createCollege);
authRouter.put("/colleges/:id", committeeAuth, updateCollege);
authRouter.delete("/colleges/:id", committeeAuth, deleteCollege);
authRouter.get("/roles", committeeAuth, getCommitteeRoles);
authRouter.get("/dashboard-data", committeeAuth, getCommitteeDashboard);
authRouter.get(
  "/workflow-rules",
  committeeAuth,
  getSubmissionAppealWorkflowRules,
);
authRouter.put(
  "/workflow-rules",
  committeeAuth,
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

authRouter.get("/reviewer-assignment", getMyReviewerAssignment);
authRouter.get("/reviewer-submissions", getReviewerDepartmentSubmissions);
authRouter.post("/reviewer-submissions/:submissionId/feedback", submitReviewerFeedback);

export default authRouter;
