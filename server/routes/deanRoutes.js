import express from "express";

import { adminAuth } from "../middleware/adminAuth.js";
import { deanAuth } from "../middleware/deanAuth.js";
import { deanLogin, getDeanProfile, updateDeanProfile } from "../controllers/deanController.js";
import {
  addDean,
  deleteDean,
  getAllDeans,
  getDeanColleges,
  getDeanCollegeDetails,
  getDeanEligibleRoles,
  updateDean,
} from "../controllers/adminController.js";

const deanRouter = express.Router();

deanRouter.post("/login", deanLogin);
deanRouter.get("/profile", deanAuth, getDeanProfile);
deanRouter.put("/profile", deanAuth, updateDeanProfile);

deanRouter.post("/add-dean", adminAuth, addDean);

deanRouter.get("/all-deans", adminAuth, getAllDeans);
deanRouter.get("/roles", adminAuth, getDeanEligibleRoles);
deanRouter.get("/colleges", adminAuth, getDeanColleges);
deanRouter.get("/college-details", adminAuth, getDeanCollegeDetails);

deanRouter.delete("/delete/:id", adminAuth, deleteDean);
deanRouter.put("/update/:id", adminAuth, updateDean);

export default deanRouter;
