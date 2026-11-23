const router = require('express').Router();
const c = require('../controllers/workItem.controller');
const comments = require('../controllers/comment.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const v = require('../validators/workItem');
const cv = require('../validators/comment');
const { idParam } = require('../validators/common');

router.use(authenticate);
router.post('/', validate(v.createWorkItem), c.create);
router.get('/', validate(v.listWorkItemsQuery, 'query'), c.list);
router.get('/:id', validate(idParam, 'params'), c.getOne);
router.patch('/:id', validate(idParam, 'params'), validate(v.updateWorkItem), c.update);
router.delete('/:id', authorize('ADMIN'), validate(idParam, 'params'), c.remove);
router.post('/:id/escalate', validate(idParam, 'params'), c.escalate);
router.get('/:id/history', validate(idParam, 'params'), c.history);
router.post('/:id/comments', validate(idParam, 'params'), validate(cv.createComment), comments.add);
router.get('/:id/comments', validate(idParam, 'params'), validate(cv.listCommentsQuery, 'query'), comments.list);

module.exports = router;
