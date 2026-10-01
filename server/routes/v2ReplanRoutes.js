import express from 'express';
import { getMissed, propose, accept, log, overrideRec, acceptRec, getAdherence } from '../controllers/pgReplanController.js';
import { protectPg } from '../middleware/pgAuth.js';
import { validateBody, proposeSchema, acceptSchema, overrideSchema, acceptRecSchema } from '../validators/replan.js';

/** GET/POST /api/v2/replans/* — missed detection, proposals, audited acceptance. */
export const replansRouter = express.Router();
replansRouter.use(protectPg);
replansRouter.get('/missed', getMissed);
replansRouter.post('/propose', validateBody(proposeSchema), propose);
replansRouter.post('/accept', validateBody(acceptSchema), accept);
replansRouter.get('/log', log);

/** POST /api/v2/recommendations/* — accept/override feedback + adherence. */
export const recommendationsRouter = express.Router();
recommendationsRouter.use(protectPg);
recommendationsRouter.post('/override', validateBody(overrideSchema), overrideRec);
recommendationsRouter.post('/accept', validateBody(acceptRecSchema), acceptRec);
recommendationsRouter.get('/adherence', getAdherence);
