import mongoose from 'mongoose';
import logger from '../utils/logger.js';

export const isDatabaseReady = () => mongoose.connection.readyState === 1;

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in environment variables.');
  }

  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,   // Wait 10s for server selection
    socketTimeoutMS: 45000,            // Close sockets after 45s of inactivity
    family: 4,                         // Force IPv4 — fixes SRV DNS issues on Windows
    maxPoolSize: 10,                   // Connection pool size
    retryWrites: true,                 // Retry failed writes
  });

  logger.info({ host: conn.connection.host }, 'MongoDB connected.');
  return conn;
};

/*
 * State-transition logging only. Mongoose emits disconnected/error on EVERY
 * failed retry attempt — logging them unconditionally floods the console
 * (one error block per retry). We log the first failure of an outage, stay
 * silent while the state is unchanged, and log recovery.
 */
let inOutage = false;
let lastErrorMessage = null;

mongoose.connection.on('disconnected', () => {
  if (inOutage) return;
  inOutage = true;
  logger.warn('MongoDB disconnected - retrying with backoff (v1 routes unavailable until it returns).');
});

const markConnected = () => {
  inOutage = false;
  lastErrorMessage = null;
  logger.info('MongoDB reconnected.');
};

mongoose.connection.on('reconnected', markConnected);
// Initial successful connect emits 'connected' (not 'reconnected') — clear the
// outage flag either way so a later disconnect logs again.
mongoose.connection.on('connected', () => {
  if (inOutage) markConnected();
});

mongoose.connection.on('error', (err) => {
  // Retries are already reported once per outage by index.js backoff logic;
  // keep per-attempt detail out of the console (visible with LOG_LEVEL=debug).
  if (err?.message === lastErrorMessage) return;
  lastErrorMessage = err?.message || 'unknown error';
  logger.debug({ err }, 'MongoDB connection error');
});

export default connectDB;
