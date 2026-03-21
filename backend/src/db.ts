import 'dotenv/config';
import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const err = new Error('MONGODB_URI is not defined');
    console.error(err);
    throw err;
  }

  try {
    await mongoose.connect(uri, {
      appName: process.env.appName,
    });
    console.log('MongoDB connected');
  } catch (e) {
    console.error(e);
    throw e;
  }
}
