import express from 'express';
import { protectMongo } from '../middleware/mongoAuth.js';
import { getAiStatus, postScenarioIntent, postFocusBrief, postSessionReflection, postSmartNotes } from '../controllers/mongoAiController.js';

const router = express.Router();
router.use(protectMongo);
router.get('/status', getAiStatus);
router.post('/scenario-intent', postScenarioIntent);
router.post('/focus-brief', postFocusBrief);
router.post('/session-reflection', postSessionReflection);
router.post('/smart-notes', postSmartNotes);

export default router;
