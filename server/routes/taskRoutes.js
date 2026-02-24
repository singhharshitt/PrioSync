import express from 'express';
import {
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    getTopTasks,
    getStats,
    getDAG,
    logFocusSession,
} from '../controllers/taskController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All task routes require authentication
router.use(protect);

router.get('/top', getTopTasks);
router.get('/stats', getStats);
router.get('/dag', getDAG);
router.post('/focus-session', logFocusSession);

router.route('/').get(getTasks).post(createTask);
router.route('/:id').get(getTask).put(updateTask).delete(deleteTask);

export default router;
