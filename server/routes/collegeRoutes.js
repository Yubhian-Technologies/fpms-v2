import express from "express";
import { getUserCollegeDeadline, getDesignationsByCollege } from "../controllers/collegeController.js";
import optionalAuth from "../middleware/optionalAuth.js";

const collegeRouter = express.Router();

collegeRouter.get("/user-deadline", optionalAuth, getUserCollegeDeadline);
collegeRouter.get("/designations", optionalAuth, getDesignationsByCollege);

export default collegeRouter;