import express from 'express';
import {
  submitSubsection,
  getFacultySubsections,
  hodViewAllSubmissions,
  hodVerifyCriterion
} from '../controllers/module3Controller.js';
import { facultyAuth } from '../middleware/facultyAuth.js';
import { hodAuth } from '../middleware/hodAuth.js';

const module3Router = express.Router();

module3Router.post('/faculty/:facultyId/subsection/:subId', facultyAuth, submitSubsection);
module3Router.get('/faculty/:facultyId', facultyAuth, getFacultySubsections);
module3Router.get('/all-submissions', hodAuth, hodViewAllSubmissions);
module3Router.put('/verify/:facultyId/:subId/:criterionName', hodAuth, hodVerifyCriterion);

export default module3Router;