const { z } = require('zod');

const uuid = z.string().uuid('Invalid id').transform((s) => s.toLowerCase()); // ids are compared as strings, so keep them lowercase
const isoDate = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date')
  .transform((s) => new Date(s));
const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
};
const idParam = z.object({ id: uuid });

module.exports = { uuid, isoDate, pagination, idParam };
