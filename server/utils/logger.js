/**
 * Structured JSON logger. Levels via LOG_LEVEL (default: development→debug, else info).
 * Secrets (Authorization, password, tokens, connection strings) are redacted.
 */
import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

const logger = pino({
    level,
    redact: {
        paths: [
            'req.headers.authorization',
            '*.password',
            '*.passwordHash',
            '*.password_hash',
            '*.token',
            'MONGO_URI',
            'POSTGRES_URI',
            'POSTGRESS_URI',
            'DATABASE_URL',
            'REDIS_URL',
            'LLM_API_KEY',
            'JWT_SECRET',
        ],
        censor: '***',
    },
});

export default logger;
