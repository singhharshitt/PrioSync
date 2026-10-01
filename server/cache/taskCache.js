/**
 * Cache-aside for hot user-scoped reads.
 *   top   GET /api/v2/tasks/top    TTL 60s   — invalidated by any task write
 *   stats GET /api/v2/tasks/stats  TTL 120s  — invalidated by task writes + focus sessions
 * Miss/Redis-down → caller falls through to Postgres (never fails the request).
 */
import { getRedis, isRedisReady } from './redisClient.js';

const TTL_TOP = 60;
const TTL_STATS = 120;

const key = (userId, kind) => `v2:${userId}:${kind}`;

export const cacheMeta = { hits: 0, misses: 0 };

export const readThrough = async (userId, kind, loader) => {
    const ttl = kind === 'top' ? TTL_TOP : TTL_STATS;
    if (!isRedisReady()) return { data: await loader(), cached: false };
    try {
        const hit = await getRedis().get(key(userId, kind));
        if (hit) {
            cacheMeta.hits++;
            return { data: JSON.parse(hit), cached: true };
        }
    } catch {
        /* fall through to Postgres */
    }
    cacheMeta.misses++;
    const data = await loader();
    try {
        await getRedis().set(key(userId, kind), JSON.stringify(data), 'EX', ttl);
    } catch {
        /* cache write failure must not fail the request */
    }
    return { data, cached: false };
};

/** Call after any mutation that changes a user's tasks, scores, or sessions. */
export const bustUser = async (userId) => {
    if (!isRedisReady()) return;
    try {
        await getRedis().del(key(userId, 'top'), key(userId, 'stats'));
    } catch {
        /* best-effort */
    }
};
