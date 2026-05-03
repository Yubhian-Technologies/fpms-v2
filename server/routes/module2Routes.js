import express from 'express';
import {
  submitSubsection,
  getFacultySubsections,
  hodViewAllSubmissions,
  hodVerifyCriterion
} from '../controllers/module2Controller.js';
import { facultyAuth } from '../middleware/facultyAuth.js';
import { hodAuth } from '../middleware/hodAuth.js';

const module2Router = express.Router();

module2Router.post('/faculty/:facultyId/subsection/:subId', facultyAuth, submitSubsection);
module2Router.get('/faculty/:facultyId', facultyAuth, getFacultySubsections);
module2Router.get('/all-submissions', hodAuth, hodViewAllSubmissions);
module2Router.put('/verify/:facultyId/:subId/:criterionName', hodAuth, hodVerifyCriterion);

export default module2Router;