import mongoose from 'mongoose';

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

  console.log(`MongoDB connected: ${conn.connection.host}`);
  return conn;
};

// Log connection events for debugging
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Mongoose will auto-reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconnected successfully.');
});

mongoose.connection.on('error', (err) => {
  console.error(`MongoDB connection error: ${err.message}`);
});

export default connectDB;

