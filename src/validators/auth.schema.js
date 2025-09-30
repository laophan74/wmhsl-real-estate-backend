import { z } from 'zod';

export const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
});

export const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'owner']).optional(),
});
