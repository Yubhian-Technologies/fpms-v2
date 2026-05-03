import express from 'express';
import { hodAuth } from '../middleware/hodAuth.js';

import { adminAuth } from '../middleware/adminAuth.js';
import { adminVerifyCriterion, adminViewHodSubmissions, getHodSubsections, hodSubmitSubsection } from '../controllers/module1HodController.js';

const module1HodPartbRouter=express.Router();


module1HodPartbRouter.post('/:hodId/subsection/:subId', hodAuth,hodSubmitSubsection );
module1HodPartbRouter.get('/:hodId', hodAuth,getHodSubsections );
module1HodPartbRouter.get('/admin/all-submissions',adminAuth,adminViewHodSubmissions);
module1HodPartbRouter.put('/admin/verify/:hodId/:subId/:criterionName',adminAuth,adminVerifyCriterion);


export default module1HodPartbRouter;