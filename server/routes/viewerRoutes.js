import { Router } from "express";
import { viewerAuth } from "../middleware/viewerAuth.js";
import { getViewerStats } from "../controllers/viewerController.js";

const viewerRouter = Router();

viewerRouter.get("/stats", viewerAuth, getViewerStats);

export default viewerRouter;
