import express from 'express';
import { protectPg } from '../middleware/pgAuth.js';
import {
    validateQuery,
    validateBody,
    riskQuery,
    criticalPathQuery,
    bottlenecksQuery,
    capacityQuery,
    simulateSchema,
    deviationsQuery,
    driftQuery,
    calibrationQuery,
    autoReplanSchema,
    contextOrderQuery,
    dayPlanQuery,
    goalScopeQuery,
} from '../validators/insights.js';
import {
    getRisk,
    getCriticalPath,
    getBottlenecks,
    getCapacity,
    simulate,
    getDeviations,
    getDrift,
    getCalibration,
    autoReplan,
    getContextOrder,
    getDayPlan,
    getScope,
    getCommitments,
} from '../controllers/pgInsightController.js';

const router = express.Router();

router.use(protectPg);

router.get('/risk', validateQuery(riskQuery), getRisk);
router.get('/critical-path', validateQuery(criticalPathQuery), getCriticalPath);
router.get('/bottlenecks', validateQuery(bottlenecksQuery), getBottlenecks);
router.get('/capacity', validateQuery(capacityQuery), getCapacity);
router.post('/simulate', validateBody(simulateSchema), simulate);
router.get('/deviations', validateQuery(deviationsQuery), getDeviations);
router.get('/drift', validateQuery(driftQuery), getDrift);
router.get('/calibration', validateQuery(calibrationQuery), getCalibration);
router.post('/auto-replan', validateBody(autoReplanSchema), autoReplan);
router.get('/context-order', validateQuery(contextOrderQuery), getContextOrder);
router.get('/day-plan', validateQuery(dayPlanQuery), getDayPlan);
router.get('/scope', validateQuery(goalScopeQuery), getScope);
router.get('/commitments', getCommitments);

export default router;
