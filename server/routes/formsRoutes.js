
import express from "express";
import { getUserForms } from "../controllers/formsController.js";

const formRouter = express.Router();

formRouter.get("/myForms", getUserForms);

export default formRouter;