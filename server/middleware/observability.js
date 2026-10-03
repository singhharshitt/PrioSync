import pinoHttp from 'pino-http';
import logger from '../utils/logger.js';
import { recordHttp } from '../utils/metrics.js';

/** Structured request logging (skips scraping noise). */
export const requestLogger = pinoHttp({
    logger,
    autoLogging: {
        ignore: (req) => req.url === '/api/health' || req.url === '/api/metrics',
    },
    customProps: (req) => ({ userId: req.user?.id || undefined }),
});

/** Per-route latency/error counters. Mount BEFORE routes; reads req.route at finish. */
export const httpMetrics = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const route = `${req.baseUrl || ''}${req.route?.path || req.path || 'unknown'}`;
        recordHttp(req.method, route, res.statusCode, Date.now() - start);
    });
    next();
};
