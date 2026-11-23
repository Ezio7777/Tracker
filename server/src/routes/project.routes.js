const router = require('express').Router();
const { z } = require('zod');
const c = require('../controllers/project.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const v = require('../validators/project');
const { idParam, objectId } = require('../validators/common');

const memberParams = z.object({ id: objectId, userId: objectId });

router.use(authenticate);
router.post('/', authorize('ADMIN', 'MANAGER'), validate(v.createProject), c.create);
router.get('/', validate(v.listProjectsQuery, 'query'), c.list);
router.get('/:id', validate(idParam, 'params'), c.getOne);
router.patch('/:id', validate(idParam, 'params'), validate(v.updateProject), c.update);
router.post('/:id/members', validate(idParam, 'params'), validate(v.addMember), c.addMember);
router.delete('/:id/members/:userId', validate(memberParams, 'params'), c.removeMember);

module.exports = router;
