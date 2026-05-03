import express from "express";
import {
  submitSubsection,
  getFacultySubsections,
  hodViewAllSubmissions,
  hodVerifyCriterion,
} from "../controllers/module4Controller.js";
import { facultyAuth } from "../middleware/facultyAuth.js";
import { hodAuth } from "../middleware/hodAuth.js";

const module4Router = express.Router();

module4Router.post(
  "/faculty/:facultyId/subsection/:subId",
  facultyAuth,
  submitSubsection,
);
module4Router.get("/faculty/:facultyId", facultyAuth, getFacultySubsections);
module4Router.get("/all-submissions", hodAuth, hodViewAllSubmissions);
module4Router.put(
  "/verify/:facultyId/:subId/:criterionName",
  hodAuth,
  hodVerifyCriterion,
);

export default module4Router;
