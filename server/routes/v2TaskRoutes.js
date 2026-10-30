import express from 'express';
import {
    getTasks, getTask, createTask, updateTask, deleteTask,
    replaceDependencies, getTopTasks, getStats, getDAG,
    getExplain, getNext, logFocusSession, recalc,
} from '../controllers/mongoTaskController.js';
import { protectMongo } from '../middleware/mongoAuth.js';
import {
    validate, taskCreateSchema, taskUpdateSchema,
    dependenciesSchema, focusSessionSchema,
} from '../validators/v2.js';

const router = express.Router();

router.use(protectMongo);

router.get('/top', getTopTasks);
router.get('/stats', getStats);
router.get('/dag', getDAG);
router.get('/next', getNext);
router.post('/recalc', recalc);
router.post('/focus-session', validate(focusSessionSchema), logFocusSession);

router.route('/').get(getTasks).post(validate(taskCreateSchema), createTask);
router.route('/:id').get(getTask).put(validate(taskUpdateSchema), updateTask).delete(deleteTask);
router.get('/:id/explain', getExplain);
router.put('/:id/dependencies', validate(dependenciesSchema), replaceDependencies);

export default router;
