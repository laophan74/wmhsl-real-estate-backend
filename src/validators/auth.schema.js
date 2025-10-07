import { z } from 'zod';

// Hard switch: username + password only for login
export const loginBody = z.object({
  username: z.string().min(2).max(50),
  password: z.string().min(6).max(100),
});

// Registration (still optional feature) now requires username; keep email for contact but not for login
export const registerBody = z.object({
  username: z.string().min(2).max(50),
  email: z.string().email().optional(),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'owner']).optional(),
});
