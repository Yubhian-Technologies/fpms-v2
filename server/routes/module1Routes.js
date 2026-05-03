import express from 'express';
import { submitSubsection,getFacultySubsections, hodViewAllSubmissions, hodVerifyCriterion } from '../controllers/module1Controller.js';
import { facultyAuth } from '../middleware/facultyAuth.js';
import { hodAuth } from '../middleware/hodAuth.js';

const module1Router = express.Router();

module1Router.post('/faculty/:facultyId/subsection/:subId', facultyAuth, submitSubsection);
module1Router.get('/faculty/:facultyId', facultyAuth, getFacultySubsections);
module1Router.get('/all-submissions',hodAuth,hodViewAllSubmissions);
module1Router.put('/verify/:facultyId/:subId/:criterionName',hodAuth,hodVerifyCriterion);


export default module1Router;
