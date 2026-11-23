require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS) || 7,
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim()),
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 10,
  dueSoonHours: Number(process.env.DUE_SOON_HOURS) || 24,
  enableCron: process.env.ENABLE_CRON !== 'false',
};
env.isProd = env.nodeEnv === 'production';
env.isTest = env.nodeEnv === 'test';

if (!env.jwtAccessSecret) throw new Error('JWT_ACCESS_SECRET is required');
if (!env.isTest && !env.mongoUri) throw new Error('MONGO_URI is required');

module.exports = env;
