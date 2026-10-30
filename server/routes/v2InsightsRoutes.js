import express from 'express';
import { protectMongo } from '../middleware/mongoAuth.js';
import {
    validateQuery, validateBody,
    riskQuery, criticalPathQuery, bottlenecksQuery, capacityQuery, simulateSchema,
    deviationsQuery, driftQuery, calibrationQuery, autoReplanSchema, contextOrderQuery,
    dayPlanQuery, goalScopeQuery, resilienceQuery, resolveSchema, recoverySchema, allocationQuery,
} from '../validators/insights.js';
import {
    getRisk, getCriticalPath, getBottlenecks, getCapacity, simulate,
    getDeviations, getDrift, getCalibration, autoReplan, getContextOrder,
    getDayPlan, getScope, getCommitments, getResilience, resolveConstraints,
    getRecovery, getTraceability, getEfficiency, getPlanDebt, getAllocation,
} from '../controllers/mongoInsightController.js';

const router = express.Router();
router.use(protectMongo);

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
router.get('/resilience', validateQuery(resilienceQuery), getResilience);
router.post('/resolve', validateBody(resolveSchema), resolveConstraints);
router.post('/recovery', validateBody(recoverySchema), getRecovery);
router.get('/traceability', getTraceability);
router.get('/efficiency', validateQuery(goalScopeQuery), getEfficiency);
router.get('/plan-debt', getPlanDebt);
router.get('/allocation', validateQuery(allocationQuery), getAllocation);

export default router;
