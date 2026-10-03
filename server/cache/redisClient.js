/**
 * Redis connection (optional). Best-effort: the API works without Redis -
 * caching degrades to direct Postgres reads and jobs run inline.
 * Set REDIS_URL (Upstash/Render/local) to enable cache + queues.
 */
import Redis from 'ioredis';
import logger from '../utils/logger.js';

let redis = null;
let failed = false;

export const isRedisReady = () => !!redis && redis.status === 'ready';

export const getRedis = () => redis;

export const redisUrl = () => process.env.REDIS_URL || null;

export const connectRedis = async () => {
    if (redis || failed) return redis;
    const url = redisUrl();
    if (!url) {
        logger.warn('REDIS_URL not set. Running without cache/queues (direct Postgres).');
        return null;
    }
    try {
        redis = new Redis(url, {
            maxRetriesPerRequest: 2,
            enableOfflineQueue: false,
            connectTimeout: 5000,
            lazyConnect: true,
        });
        redis.on('error', (err) => logger.error({ err }, 'Redis error'));
        await redis.connect();
        await redis.ping();
        logger.info('Redis connected.');
        return redis;
    } catch (err) {
        logger.warn({ err }, 'Redis unavailable. Continuing without cache/queues.');
        try {
            redis?.disconnect();
        } catch {
            /* noop */
        }
        redis = null;
        failed = true;
        return null;
    }
};

/** BullMQ requires maxRetriesPerRequest:null - separate connection, same URL. */
export const bullConnection = () => {
    const url = redisUrl();
    if (!url) return null;
    const conn = new Redis(url, { maxRetriesPerRequest: null, enableOfflineQueue: false });
    conn.on('error', (err) => logger.error({ err }, 'BullMQ connection error'));
    return conn;
};
