const crypto = require('crypto');
if (!globalThis.crypto) globalThis.crypto = crypto;

const mongoose = require('mongoose');
const config = require('./config');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    console.log('🔄 Will retry connecting to MongoDB in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
