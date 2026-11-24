require('dotenv').config();

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
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

if (!env.jwtAccessSecret) throw new Error('JWT_ACCESS_SECRET is required (see .env.example)');
if (!env.databaseUrl) throw new Error('DATABASE_URL is required (see .env.example)');

module.exports = env;
