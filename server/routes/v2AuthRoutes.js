import express from 'express';
import { register, login, getMe, updateProfile } from '../controllers/pgAuthController.js';
import { protectPg } from '../middleware/pgAuth.js';
import { validate, registerSchema, loginSchema } from '../validators/v2.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', protectPg, getMe);
router.put('/profile', protectPg, updateProfile);

export default router;
