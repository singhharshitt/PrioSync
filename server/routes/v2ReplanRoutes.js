import express from 'express';
import { getMissed, propose, accept, log, overrideRec, acceptRec, getAdherence } from '../controllers/mongoReplanController.js';
import { protectMongo } from '../middleware/mongoAuth.js';
import { validateBody, proposeSchema, acceptSchema, overrideSchema, acceptRecSchema } from '../validators/replan.js';

export const replansRouter = express.Router();
replansRouter.use(protectMongo);
replansRouter.get('/missed', getMissed);
replansRouter.post('/propose', validateBody(proposeSchema), propose);
replansRouter.post('/accept', validateBody(acceptSchema), accept);
replansRouter.get('/log', log);

export const recommendationsRouter = express.Router();
recommendationsRouter.use(protectMongo);
recommendationsRouter.post('/override', validateBody(overrideSchema), overrideRec);
recommendationsRouter.post('/accept', validateBody(acceptRecSchema), acceptRec);
recommendationsRouter.get('/adherence', getAdherence);
