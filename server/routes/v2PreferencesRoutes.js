import express from 'express';
import { protectMongo } from '../middleware/mongoAuth.js';
import { validateBody, preferencesSchema } from '../validators/preferences.js';
import { getPreferences, updatePreferences } from '../controllers/mongoPreferencesController.js';

const router = express.Router();
router.use(protectMongo);
router.get('/', getPreferences);
router.put('/', validateBody(preferencesSchema), updatePreferences);

export default router;
