const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const c = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const v = require('../validators/auth');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, skip: () => env.isTest });

router.post('/register', limiter, validate(v.register), c.register);
router.post('/login', limiter, validate(v.login), c.login);
router.post('/refresh', c.refresh);
router.post('/logout', c.logout);
router.get('/me', authenticate, c.me);

module.exports = router;
