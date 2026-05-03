import express from 'express';
import { fetchAppealsByFaculty, submitAppeal } from '../controllers/appealController.js';
import { facultyAuth } from '../middleware/facultyAuth.js';

const appealRouter=express.Router();

appealRouter.post('/:module/:facultyId/:subId/:criterionName',facultyAuth,submitAppeal);
appealRouter.get('/:facultyId',facultyAuth,fetchAppealsByFaculty)

export default appealRouter;