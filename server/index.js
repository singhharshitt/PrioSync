import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
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
  console.error('JWT_SECRET is missing in environment variables.');
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

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

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

app.get('/api/health', (req, res) => {
  const mongo = isDatabaseReady();
  const postgres = isPostgresReady();
  res.json({
    success: mongo,
    message: mongo ? 'PrioSync API is running' : 'PrioSync API is running without database',
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
const DB_RETRY_INTERVAL_MS = 5000;

const connectDatabaseWithRetry = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    console.error(`Retrying database connection in ${DB_RETRY_INTERVAL_MS / 1000} seconds...`);
    setTimeout(connectDatabaseWithRetry, DB_RETRY_INTERVAL_MS);
  }
};

// Postgres runs alongside Mongo during migration (dual-DB phase).
// Mongo remains primary until the repository swap is verified.
const connectPostgresBestEffort = async () => {
  try {
    await connectPostgres();
  } catch (error) {
    console.error(`Postgres connection error: ${error.message}`);
  }
};

const startServer = () => {
  try {
    app.listen(PORT, () => {
      console.log(`PrioSync Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      connectDatabaseWithRetry();
      connectPostgresBestEffort();
      connectRedis().then(() => startWorkers()).catch(() => {});
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
