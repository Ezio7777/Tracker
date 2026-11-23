const router = require('express').Router();
const c = require('../controllers/notification.controller');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const v = require('../validators/notification');
const { idParam } = require('../validators/common');

router.use(authenticate);
router.get('/', validate(v.listNotificationsQuery, 'query'), c.list);
router.get('/unread-count', c.unreadCount);
router.patch('/read-all', c.markAllRead);
router.patch('/:id/read', validate(idParam, 'params'), c.markRead);

module.exports = router;
