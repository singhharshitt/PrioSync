import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import connectDB, { isDatabaseReady } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
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

app.get('/api/health', (req, res) => {
  res.json({
    success: isDatabaseReady(),
    message: isDatabaseReady() ? 'PrioSync API is running' : 'PrioSync API is running without database',
    databaseConnected: isDatabaseReady(),
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

const startServer = () => {
  try {
    app.listen(PORT, () => {
      console.log(`PrioSync Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      connectDatabaseWithRetry();
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
