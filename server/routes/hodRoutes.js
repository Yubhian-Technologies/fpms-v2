import express from "express";
import {
  hodLogin,
  addFaculty,
  getAllFaculty,
  getFacultyRoleOption,
  getHodCollegeDetails,
  updateFaculty,
  deleteFaculty,
  getHodDashboard,
  exportHodReport,
} from "../controllers/hodController.js";
import { hodAuth } from "../middleware/hodAuth.js";

const hodRouter = express.Router();

hodRouter.post("/login", hodLogin);

hodRouter.post("/add-faculty", hodAuth, addFaculty);

hodRouter.get("/all-faculty", hodAuth, getAllFaculty);
hodRouter.get("/college-details", hodAuth, getHodCollegeDetails);
hodRouter.get("/faculty-role", hodAuth, getFacultyRoleOption);


hodRouter.put("/update-faculty/:id", hodAuth, updateFaculty);
hodRouter.get('/hod-dashboard', hodAuth, getHodDashboard);
hodRouter.get('/export-report', hodAuth, exportHodReport);
hodRouter.delete("/delete-faculty/:id", hodAuth, deleteFaculty);

export default hodRouter;
