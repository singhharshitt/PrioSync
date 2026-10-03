/**
 * Enqueue-or-run: with Redis, jobs go to BullMQ (durable, retried, off-request);
 * without Redis, the SAME handler runs inline so behavior never silently differs.
 */
import { Queue } from 'bullmq';
import logger from '../utils/logger.js';
import { bullConnection, isRedisReady } from '../cache/redisClient.js';
import { runRecalc } from './workers.js';

let queue = null;

const getQueue = () => {
    if (queue || !isRedisReady()) return queue;
    queue = new Queue('priosync', { connection: bullConnection() });
    queue.on('error', (err) => console.error(`queue error: ${err.message}`));
    return queue;
};

export const enqueueRecalc = async (userId) => {
    const q = getQueue();
    if (!q) {
        logger.info({ userId }, 'no Redis — recalc running inline');
        const result = await runRecalc({ userId });
        return { queued: false, ranInline: true, result };
    }
    try {
        const job = await q.add(
            'recalc',
            { userId },
            { removeOnComplete: 20, removeOnFail: 50, attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
        );
        return { queued: true, jobId: job.id };
    } catch (err) {
        logger.warn({ err, userId }, 'enqueue failed, running inline');
        const result = await runRecalc({ userId });
        return { queued: false, ranInline: true, result };
    }
};
