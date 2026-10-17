import express from 'express';
import { protectPg } from '../middleware/pgAuth.js';
import { validateBody } from '../validators/planner.js';
import {
    scenarioIntentSchema,
    focusBriefSchema,
    sessionReflectionSchema,
    smartNotesSchema,
} from '../validators/ai.js';
import {
    getAiStatus,
    postScenarioIntent,
    postFocusBrief,
    postSessionReflection,
    postSmartNotes,
} from '../controllers/pgAiController.js';

const router = express.Router();

router.use(protectPg);

router.get('/status', getAiStatus);
router.post('/scenario-intent', validateBody(scenarioIntentSchema), postScenarioIntent);
router.post('/focus-brief', validateBody(focusBriefSchema), postFocusBrief);
router.post('/session-reflection', validateBody(sessionReflectionSchema), postSessionReflection);
router.post('/smart-notes', validateBody(smartNotesSchema), postSmartNotes);

export default router;
