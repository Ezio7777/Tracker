const { z } = require('zod');
const { pagination } = require('./common');

const listNotificationsQuery = z.object({
  unread: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  scope: z.enum(['me', 'all']).default('me'), // "all" is admin-only
  ...pagination,
});

module.exports = { listNotificationsQuery };
