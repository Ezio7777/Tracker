const { z } = require('zod');
const { pagination } = require('./common');

const createComment = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
const listCommentsQuery = z.object({ ...pagination, limit: z.coerce.number().int().min(1).max(100).default(50) });

module.exports = { createComment, listCommentsQuery };
