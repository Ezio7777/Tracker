const { z } = require('zod');
const { uuid, pagination } = require('./common');

const createProject = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000).optional().default(''),
}).strict();

const updateProject = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
}).partial().strict().refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

const addMember = z.object({ userId: uuid }).strict();

const listProjectsQuery = z.object({
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  q: z.string().trim().max(100).optional(),
  ...pagination,
});

module.exports = { createProject, updateProject, addMember, listProjectsQuery };
