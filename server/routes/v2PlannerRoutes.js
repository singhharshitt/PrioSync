import express from 'express';
import { parse, confirm, listPlans, getPlan } from '../controllers/mongoPlannerController.js';
import { protectMongo } from '../middleware/mongoAuth.js';
import { parseSchema, confirmSchema, validateBody } from '../validators/planner.js';

export const plannerRouter = express.Router();
plannerRouter.use(protectMongo);
plannerRouter.post('/parse', validateBody(parseSchema), parse);
plannerRouter.post('/confirm', validateBody(confirmSchema), confirm);

export const plansRouter = express.Router();
plansRouter.use(protectMongo);
plansRouter.get('/', listPlans);
plansRouter.get('/:id', getPlan);
