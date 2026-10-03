import express from 'express';
import { parse, confirm, listPlans, getPlan } from '../controllers/pgPlannerController.js';
import { protectPg } from '../middleware/pgAuth.js';
import { parseSchema, confirmSchema, validateBody } from '../validators/planner.js';

/** POST /api/v2/planner/parse|confirm - understand, then materialize. */
export const plannerRouter = express.Router();
plannerRouter.use(protectPg);
plannerRouter.post('/parse', validateBody(parseSchema), parse);
plannerRouter.post('/confirm', validateBody(confirmSchema), confirm);

/** GET /api/v2/plans - versioned plan snapshots + health history. */
export const plansRouter = express.Router();
plansRouter.use(protectPg);
plansRouter.get('/', listPlans);
plansRouter.get('/:id', getPlan);
