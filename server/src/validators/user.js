const { z } = require('zod');
const { ROLE_LIST } = require('../constants/roles');
const { pagination } = require('./common');

const listUsersQuery = z.object({
  role: z.enum(ROLE_LIST).optional(),
  q: z.string().trim().max(100).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ...pagination,
});
const updateRole = z.object({ role: z.enum(ROLE_LIST) }).strict();
const updateStatus = z.object({ isActive: z.boolean() }).strict();

module.exports = { listUsersQuery, updateRole, updateStatus };
