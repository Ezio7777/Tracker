const router = require('express').Router();
const c = require('../controllers/dashboard.controller');
const authenticate = require('../middleware/authenticate');

router.get('/summary', authenticate, c.summary);
module.exports = router;
