import express from 'express';
import { facultyLogin } from '../controllers/facultyController.js';

const facultyRouter = express.Router();
facultyRouter.post('/login',facultyLogin);


export default facultyRouter;
