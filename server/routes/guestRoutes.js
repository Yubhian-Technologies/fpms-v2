import { Router } from "express";
import { guestAuth } from "../middleware/guestAuth.js";
import {
  getViewerStats,
  getCollegeFaculty,
  getViewerCollegeDashboard,
  getViewerPrincipalName,
  getGuestFacultySubmissions,
} from "../controllers/viewerController.js";

const guestRouter = Router();

guestRouter.get("/stats", guestAuth, getViewerStats);
guestRouter.get("/college-faculty", guestAuth, getCollegeFaculty);
guestRouter.get("/college-dashboard", guestAuth, getViewerCollegeDashboard);
guestRouter.get("/principal-name", guestAuth, getViewerPrincipalName);
guestRouter.get("/faculty-submissions", guestAuth, getGuestFacultySubmissions);

export default guestRouter;
