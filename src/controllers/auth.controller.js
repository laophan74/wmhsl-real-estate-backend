import { loginBody, registerBody } from '../validators/auth.schema.js';
import { verifyAdminCredentials, hashPassword, findAdminByUsername } from '../services/auth.service.js';
import { generateToken, verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
import { db } from '../config/firebase.js';

export const login = async (req, res, next) => {
  try {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
    }
  const { username, password } = parsed.data;
  const admin = await verifyAdminCredentials(username, password);
    if (!admin) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    
    // Generate JWT token instead of using session
    const token = generateToken(admin);
    
    return res.json({ 
      user: admin,
      token: token,
      tokenType: 'Bearer'
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res) => {
  // With JWT, logout is handled client-side by removing the token
  // Server-side logout would require token blacklisting (not implemented)
  return res.json({ 
    ok: true, 
    message: 'Logout successful. Please remove token from client storage.' 
  });
};

export const me = async (req, res) => {
  // User info is now available from the JWT token (attached by requireAuth middleware)
  if (!req.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  return res.json({ user: req.user });
};

// Optional: register a new admin locally (guarded behind env)
export const register = async (req, res, next) => {
  try {
    if (process.env.ALLOW_ADMIN_REGISTER !== 'true') {
      return res.status(403).json({ error: 'REGISTRATION_DISABLED' });
    }
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
    const { username, email, password, name, role } = parsed.data;
    // enforce lowercase username canonical form
    const uname = username.toLowerCase();
    const exists = await findAdminByUsername(uname);
    if (exists) return res.status(409).json({ error: 'USERNAME_EXISTS' });
    const password_hash = await hashPassword(password);
    const now = new Date().toISOString();
    const doc = {
      username: uname,
      email: email || '',
      name: name || '',
      role: role || 'admin',
      password_hash,
      metadata: { created_at: now, updated_at: now, deleted_at: null },
    };
    try {
      const ref = await db().collection('admins').add(doc);
      return res.status(201).json({ id: ref.id, ...doc });
    } catch (e) {
      return res.status(500).json({ error: 'CREATE_ADMIN_FAILED' });
    }
  } catch (err) {
    next(err);
  }
};
