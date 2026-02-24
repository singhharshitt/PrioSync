import mongoose from 'mongoose';

export const isDatabaseReady = () => mongoose.connection.readyState === 1;

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing in environment variables.');
  }

  const conn = await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
  });

  console.log(`MongoDB connected: ${conn.connection.host}`);
  return conn;
};

export default connectDB;
