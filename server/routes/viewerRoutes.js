import { Router } from "express";
import { viewerAuth } from "../middleware/viewerAuth.js";
import { getViewerStats, getCollegeFaculty } from "../controllers/viewerController.js";

const viewerRouter = Router();

viewerRouter.get("/stats", viewerAuth, getViewerStats);
viewerRouter.get("/college-faculty", viewerAuth, getCollegeFaculty);

export default viewerRouter;
