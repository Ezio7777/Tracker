const { z } = require('zod');
const { ALL_STATUSES, PRIORITIES } = require('../constants/statuses');
const { uuid, isoDate, pagination } = require('./common');

const createWorkItem = z
  .object({
    type: z.enum(['TASK', 'TICKET']),
    title: z.string().trim().min(3).max(200),
    description: z.string().max(5000).optional().default(''),
    priority: z.enum(PRIORITIES).optional(),
    project: uuid.nullable().optional(),
    assignee: uuid.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
  })
  .strict()
  .refine((d) => d.type !== 'TASK' || !!d.project, {
    message: 'project is required for a TASK',
    path: ['project'],
  });

const updateWorkItem = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().max(5000),
    status: z.enum(ALL_STATUSES),
    priority: z.enum(PRIORITIES),
    assignee: uuid.nullable(),
    dueDate: isoDate.nullable(),
  })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

const listWorkItemsQuery = z.object({
  status: z.enum(ALL_STATUSES).optional(),
  type: z.enum(['TASK', 'TICKET']).optional(),
  priority: z.enum(PRIORITIES).optional(),
  project: uuid.optional(),
  assignee: z.union([uuid, z.literal('me')]).optional(),
  requester: z.union([uuid, z.literal('me')]).optional(),
  q: z.string().trim().max(100).optional(),
  dueBefore: isoDate.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'status', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...pagination,
});

module.exports = { createWorkItem, updateWorkItem, listWorkItemsQuery };
