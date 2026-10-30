import express from 'express';
import { register, login, getMe, updateProfile } from '../controllers/mongoAuthController.js';
import { protectMongo } from '../middleware/mongoAuth.js';
import { validate, registerSchema, loginSchema } from '../validators/v2.js';
import { authLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', protectMongo, getMe);
router.put('/profile', protectMongo, updateProfile);

export default router;
