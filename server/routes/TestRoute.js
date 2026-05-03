import { Router } from "express";
import { testApi } from "../controllers/TestController.js";

const router = Router();

router.get("/test", testApi);

export default router;
