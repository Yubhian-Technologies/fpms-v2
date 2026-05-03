import express from 'express';
import {
  submitSubsection,
  getFacultySubsections,
  hodViewAllSubmissions,
  hodVerifyCriterion
} from '../controllers/module5Controller.js';
import { facultyAuth } from '../middleware/facultyAuth.js';
import { hodAuth } from '../middleware/hodAuth.js';

const module5Router = express.Router();

module5Router.post('/faculty/:facultyId/subsection/:subId', facultyAuth, submitSubsection);
module5Router.get('/faculty/:facultyId', facultyAuth, getFacultySubsections);
module5Router.get('/all-submissions', hodAuth, hodViewAllSubmissions);
module5Router.put('/verify/:facultyId/:subId/:criterionName', hodAuth, hodVerifyCriterion);

export default module5Router;