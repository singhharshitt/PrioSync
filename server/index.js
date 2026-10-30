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
import { connectRedis, isRedisReady } from './cache/redisClient.js';
import { startWorkers } from './jobs/workers.js';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import v2AuthRoutes from './routes/v2AuthRoutes.js';
import v2TaskRoutes from './routes/v2TaskRoutes.js';
import { plannerRouter, plansRouter } from './routes/v2PlannerRoutes.js';
import { replansRouter, recommendationsRouter } from './routes/v2ReplanRoutes.js';
import aiRouter from './routes/v2AiRoutes.js';
import insightsRouter from './routes/v2InsightsRoutes.js';
import preferencesRouter from './routes/v2PreferencesRoutes.js';
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

/** Guard: MongoDB must be connected. Used by both v1 and v2 routes. */
const requireDatabase = (req, res, next) => {
  if (isDatabaseReady()) return next();
  res.status(503).json({
    success: false,
    message: 'Database is temporarily unavailable. Please try again shortly.',
  });
};

// Root route - health check probe
app.get('/', (req, res) => {
  res.send('PrioSync Backend API is running');
});

// v1 routes (legacy, Mongo-backed)
app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/tasks', requireDatabase, taskRoutes);

// v2 routes (current, also Mongo-backed — no more Postgres)
app.use('/api/v2/auth', requireDatabase, v2AuthRoutes);
app.use('/api/v2/tasks', requireDatabase, v2TaskRoutes);
app.use('/api/v2/planner', requireDatabase, plannerRouter);
app.use('/api/v2/plans', requireDatabase, plansRouter);
app.use('/api/v2/replans', requireDatabase, replansRouter);
app.use('/api/v2/recommendations', requireDatabase, recommendationsRouter);
app.use('/api/v2/insights', requireDatabase, insightsRouter);
app.use('/api/v2/preferences', requireDatabase, preferencesRouter);
app.use('/api/v2/ai', requireDatabase, aiRouter);

app.get('/api/metrics', (req, res) => {
  res.type('text/plain; version=0.0.4').send(renderMetrics(cacheMeta));
});

app.get('/api/health', (req, res) => {
  const mongo = isDatabaseReady();
  res.json({
    success: mongo,
    message: mongo ? 'PrioSync API is running' : 'PrioSync API is running without database',
    databaseConnected: mongo,
    redisConnected: isRedisReady(),
    timestamp: new Date(),
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

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

const startServer = () => {
  try {
    app.listen(PORT, () => {
      logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'PrioSync server running');
      connectDatabaseWithRetry();
      connectRedis().then(() => startWorkers()).catch(() => {});
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
};

startServer();
