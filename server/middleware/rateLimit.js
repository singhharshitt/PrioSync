/**
 * Fixed-window in-memory rate limiter (auth endpoints).
 * Redis-backed sliding windows are the prod upgrade; this stops casual
 * credential-stuffing with zero infra and is honest about its limits:
 * per-process state (use sticky sessions or Redis if horizontally scaled).
 */
const buckets = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
    }
}, 60000).unref();

export const rateLimit = ({ windowMs = 60000, max = 60 } = {}) =>
    (req, res, next) => {
        const key = `${req.ip}:${req.baseUrl}${req.path}`;
        const now = Date.now();
        let b = buckets.get(key);
        if (!b || b.resetAt <= now) {
            b = { count: 0, resetAt: now + windowMs };
            buckets.set(key, b);
        }
        b.count++;
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', String(Math.max(0, max - b.count)));
        if (b.count > max) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests. Slow down and retry shortly.',
            });
        }
        next();
    };

export const authLimiter = rateLimit({
    windowMs: 60000,
    max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 60,
});
