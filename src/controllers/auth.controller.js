import { loginBody, registerBody } from '../validators/auth.schema.js';
import { verifyAdminCredentials, hashPassword, findAdminByEmail } from '../services/auth.service.js';
import { db } from '../config/firebase.js';

export const login = async (req, res, next) => {
  try {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
    }
    const { email, password } = parsed.data;
    const admin = await verifyAdminCredentials(email, password);
    if (!admin) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    req.session.user = admin;
    return res.json({ user: admin });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res) => {
  req.session = null;
  return res.json({ ok: true });
};

export const me = async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  return res.json({ user: req.session.user });
};

// Optional: register a new admin locally (guarded behind env)
export const register = async (req, res, next) => {
  try {
    if (process.env.ALLOW_ADMIN_REGISTER !== 'true') {
      return res.status(403).json({ error: 'REGISTRATION_DISABLED' });
    }
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'INVALID_BODY', details: parsed.error.flatten() });
    const { email, password, name, role } = parsed.data;
    const exists = await findAdminByEmail(email);
    if (exists) return res.status(409).json({ error: 'EMAIL_EXISTS' });
    const password_hash = await hashPassword(password);
    const now = new Date().toISOString();
    const doc = {
      email,
      name: name || '',
      role: role || 'admin',
      password_hash,
      metadata: { created_at: now, updated_at: now, deleted_at: null },
    };
    const ref = await db().collection('admins').add(doc);
    return res.status(201).json({ id: ref.id, ...doc });
  } catch (err) {
    next(err);
  }
};
