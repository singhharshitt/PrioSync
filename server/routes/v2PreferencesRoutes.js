import express from 'express';
import { protectPg } from '../middleware/pgAuth.js';
import { validateBody, preferencesSchema } from '../validators/preferences.js';
import { getPreferences, updatePreferences } from '../controllers/pgPreferencesController.js';

const router = express.Router();

router.use(protectPg);

router.get('/', getPreferences);
router.put('/', validateBody(preferencesSchema), updatePreferences);

export default router;
