import express from "express";
import {
  adminLogin,
  addHod,
  addInternalCommittee,
  assignExistingUserAsInternalCommittee,
  deleteInternalCommittee,
  getAllHods,
  getAllInternalCommittees,
  getHodRoleOption,
  getInternalCommitteeRoleOption,
  getPrincipalCollegeDetails,
  updatePrincipalCollegeBranches,
  updateInternalCommittee,
  updateHod,
  deleteHod,
  getCollegeDashboard,
  getCollegeDesignations,
  updateCollegeDesignations,
  getCollegeFacultyForReview,
} from "../controllers/adminController.js";
import { adminAuth } from "../middleware/adminAuth.js";

const adminRouter = express.Router();

adminRouter.post("/login", adminLogin);

adminRouter.post("/add-hod", adminAuth, addHod);
adminRouter.post("/add-internal-committee", adminAuth, addInternalCommittee);
adminRouter.post("/internal-committee/assign", adminAuth, assignExistingUserAsInternalCommittee);

adminRouter.get("/all-hods", adminAuth, getAllHods);
adminRouter.get("/internal-committees", adminAuth, getAllInternalCommittees);
adminRouter.get("/hod-role", adminAuth, getHodRoleOption);
adminRouter.get(
  "/internal-committee-role",
  adminAuth,
  getInternalCommitteeRoleOption,
);
adminRouter.get("/college-details", adminAuth, getPrincipalCollegeDetails);
adminRouter.put("/college-branches", adminAuth, updatePrincipalCollegeBranches);
adminRouter.get("/designations", adminAuth, getCollegeDesignations);
adminRouter.put("/designations", adminAuth, updateCollegeDesignations);

adminRouter.delete("/delete/:id", adminAuth, deleteHod);
adminRouter.delete(
  "/internal-committee/:id",
  adminAuth,
  deleteInternalCommittee,
);
adminRouter.put("/update/:id", adminAuth, updateHod);
adminRouter.put("/internal-committee/:id", adminAuth, updateInternalCommittee);
adminRouter.get("/college-dashboard", adminAuth, getCollegeDashboard);

adminRouter.get("/college-faculty", adminAuth, getCollegeFacultyForReview);

export default adminRouter;
