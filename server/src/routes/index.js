const router = require('express').Router();

router.get('/health', (_req, res) => res.json({ status: 'ok' }));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));
router.use('/projects', require('./project.routes'));
router.use('/work-items', require('./workItem.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/dashboard', require('./dashboard.routes'));

module.exports = router;
