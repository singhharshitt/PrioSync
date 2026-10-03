import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import logger from './utils/logger.js';
import { requestLogger, httpMetrics } from './middleware/observability.js';
import { renderMetrics } from './utils/metrics.js';
import { cacheMeta } from './cache/taskCache.js';
import connectDB, { isDatabaseReady } from './config/db.js';
import { connectPostgres, isPostgresReady } from './db/pgClient.js';
import { connectRedis, isRedisReady } from './cache/redisClient.js';
import { startWorkers } from './jobs/workers.js';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import v2AuthRoutes from './routes/v2AuthRoutes.js';
import v2TaskRoutes from './routes/v2TaskRoutes.js';
import { plannerRouter, plansRouter } from './routes/v2PlannerRoutes.js';
import { replansRouter, recommendationsRouter } from './routes/v2ReplanRoutes.js';
import errorHandler from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env'), override: false });

const app = express();

if (!process.env.JWT_SECRET) {
  logger.fatal('JWT_SECRET is missing in environment variables.');
  process.exit(1);
}

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);

/**
 * Security headers on every response (HSTS, no-sniff, frameguard, ...).
 * The API serves JSON, so CSP is defense-in-depth; directives stay permissive
 * for styles/fonts in case error pages ever render HTML. Revisit before
 * serving any documents from this origin.
 */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: [
          "'self'",
          ...(process.env.NODE_ENV === 'development' ? ['ws://localhost:*', 'http://localhost:*'] : []),
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

app.use(requestLogger);
app.use(httpMetrics);

const requireDatabaseConnection = (req, res, next) => {
  if (isDatabaseReady()) {
    next();
    return;
  }

  res.status(503).json({
    success: false,
    message: 'Database is temporarily unavailable. Please try again shortly.',
  });
};

// Root route — Render health checks hit this
app.get('/', (req, res) => {
  res.send('PrioSync Backend API is running');
});

app.use('/api/auth', requireDatabaseConnection, authRoutes);
app.use('/api/tasks', requireDatabaseConnection, taskRoutes);

// V2 (Postgres): additive, v1 untouched. Requires PG pool, not Mongo.
const requirePostgres = (req, res, next) => {
  if (isPostgresReady()) {
    next();
    return;
  }
  res.status(503).json({
    success: false,
    message: 'Postgres is temporarily unavailable. Please try again shortly.',
  });
};
app.use('/api/v2/auth', requirePostgres, v2AuthRoutes);
app.use('/api/v2/tasks', requirePostgres, v2TaskRoutes);
app.use('/api/v2/planner', requirePostgres, plannerRouter);
app.use('/api/v2/plans', requirePostgres, plansRouter);
app.use('/api/v2/replans', requirePostgres, replansRouter);
app.use('/api/v2/recommendations', requirePostgres, recommendationsRouter);

app.get('/api/metrics', (req, res) => {
  res.type('text/plain; version=0.0.4').send(renderMetrics(cacheMeta));
});

app.get('/api/health', (req, res) => {
  const mongo = isDatabaseReady();
  const postgres = isPostgresReady();
  res.json({
    success: mongo || postgres,
    message: mongo || postgres ? 'PrioSync API is running' : 'PrioSync API is running without database',
    databaseConnected: mongo,
    postgresConnected: postgres,
    redisConnected: isRedisReady(),
    timestamp: new Date(),
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

/*
 * Mongo retry with exponential backoff: 5s, 10s, 20s, ... capped at 5 min.
 * A fixed 5s loop turns an unreachable Atlas into an error line every few
 * seconds forever. First failure is logged in full (warn); later attempts are
 * debug-level so the console reflects actual state changes, not every retry.
 */
const MONGO_RETRY_BASE_MS = 5000;
const MONGO_RETRY_MAX_MS = 5 * 60 * 1000;
let mongoRetryAttempt = 0;

const connectDatabaseWithRetry = async () => {
  try {
    await connectDB();
    mongoRetryAttempt = 0;
  } catch (error) {
    const delay = Math.min(MONGO_RETRY_BASE_MS * 2 ** mongoRetryAttempt, MONGO_RETRY_MAX_MS);
    mongoRetryAttempt += 1;
    if (mongoRetryAttempt === 1) {
      logger.warn({ err: error, nextRetryInMs: delay }, 'MongoDB unavailable; retrying with backoff.');
    } else {
      logger.debug({ attempt: mongoRetryAttempt, nextRetryInMs: delay }, 'MongoDB retry scheduled.');
    }
    setTimeout(connectDatabaseWithRetry, delay);
  }
};

// Postgres runs alongside Mongo during migration (dual-DB phase).
// Mongo remains primary until the repository swap is verified.
// Same backoff discipline as Mongo: Neon free-tier computes suspend after
// idle minutes, so the first connection after idle can time out — the loop
// keeps trying quietly instead of failing once at boot.
const PG_RETRY_BASE_MS = 5000;
const PG_RETRY_MAX_MS = 5 * 60 * 1000;
let pgRetryAttempt = 0;

const connectPostgresWithRetry = async () => {
  if (isPostgresReady()) {
    pgRetryAttempt = 0;
    return;
  }
  try {
    await connectPostgres();
    pgRetryAttempt = 0;
  } catch (error) {
    const delay = Math.min(PG_RETRY_BASE_MS * 2 ** pgRetryAttempt, PG_RETRY_MAX_MS);
    pgRetryAttempt += 1;
    if (pgRetryAttempt === 1) {
      logger.warn({ err: error, nextRetryInMs: delay }, 'Postgres unavailable; retrying with backoff.');
    } else {
      logger.debug({ attempt: pgRetryAttempt, nextRetryInMs: delay }, 'Postgres retry scheduled.');
    }
    setTimeout(connectPostgresWithRetry, delay);
  }
};

const startServer = () => {
  try {
    app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'PrioSync server running');
      connectDatabaseWithRetry();
      connectPostgresWithRetry();
      connectRedis().then(() => startWorkers()).catch(() => {});
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
