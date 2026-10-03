/**
 * Background job handlers. Handlers are pure functions of (job data) so the
 * dispatch layer can run them inline when Redis is down — same code, same result.
 */
import { Worker } from 'bullmq';
import { bullConnection } from '../cache/redisClient.js';
import logger from '../utils/logger.js';
import { jobStats } from '../utils/metrics.js';
import { rescoreUser } from '../services/pgTaskService.js';
import { bustUser } from '../cache/taskCache.js';

export const runRecalc = async ({ userId }) => {
    if (!userId) throw new Error('recalc job missing userId');
    try {
        const out = await rescoreUser(userId);
        await bustUser(userId); // scores changed → cached top/stats are stale
        jobStats.completed++;
        return out;
    } catch (err) {
        jobStats.failed++;
        throw err;
    }
};

const HANDLERS = { recalc: runRecalc };

let worker = null;

/** Start the worker when Redis is configured; otherwise dispatch runs inline. */
export const startWorkers = () => {
    if (worker || !process.env.REDIS_URL) return null;
    try {
        worker = new Worker(
            'priosync',
            async (job) => {
                const fn = HANDLERS[job.name];
                if (!fn) throw new Error(`unknown job ${job.name}`);
                return fn(job.data);
            },
            { connection: bullConnection(), concurrency: 5 }
        );
        worker.on('failed', (job, err) => logger.error({ err, job: job?.name }, 'job failed'));
        worker.on('completed', (job) => logger.info({ job: job?.name, id: job?.id }, 'job completed'));
        logger.info('BullMQ worker started (queue: priosync).');
        return worker;
    } catch (err) {
        logger.warn({ err }, 'Worker start failed. Jobs will run inline.');
        return null;
    }
};
