import express from 'express';
import { facultyLogin, getProfile, updateProfile } from '../controllers/facultyController.js';
import { facultyAuth } from '../middleware/facultyAuth.js';

const facultyRouter = express.Router();
facultyRouter.post('/login', facultyLogin);
facultyRouter.get('/profile', facultyAuth, getProfile);
facultyRouter.put('/profile', facultyAuth, updateProfile);

export default facultyRouter;
