const router = require('express').Router();
const c = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const v = require('../validators/user');
const { idParam } = require('../validators/common');

router.use(authenticate);
router.get('/', authorize('ADMIN', 'MANAGER'), validate(v.listUsersQuery, 'query'), c.list);
router.patch('/:id/role', authorize('ADMIN'), validate(idParam, 'params'), validate(v.updateRole), c.updateRole);
router.patch('/:id/status', authorize('ADMIN'), validate(idParam, 'params'), validate(v.updateStatus), c.updateStatus);

module.exports = router;
