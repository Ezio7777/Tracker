// Shared by jest's globalSetup and every test file.
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret';
process.env.BCRYPT_ROUNDS = '4';
process.env.ENABLE_CRON = 'false';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://tracker:tracker@localhost:5432/tracker_test';
