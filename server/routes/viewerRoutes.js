import { Router } from "express";
import { viewerAuth } from "../middleware/viewerAuth.js";
import { getViewerStats, getCollegeFaculty, getViewerCollegeDashboard, getViewerPrincipalName } from "../controllers/viewerController.js";

const viewerRouter = Router();

viewerRouter.get("/stats", viewerAuth, getViewerStats);
viewerRouter.get("/college-faculty", viewerAuth, getCollegeFaculty);
viewerRouter.get("/college-dashboard", viewerAuth, getViewerCollegeDashboard);
viewerRouter.get("/principal-name", viewerAuth, getViewerPrincipalName);

export default viewerRouter;
