const { z } = require('zod');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72)
  .regex(/[A-Za-z]/, 'Password needs a letter')
  .regex(/\d/, 'Password needs a digit');

const register = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password,
}); // unknown keys (e.g. "role") are stripped: public signup is always MEMBER

const login = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

module.exports = { register, login };
