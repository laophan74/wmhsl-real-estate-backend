import bcrypt from 'bcryptjs';
import { db } from '../config/firebase.js';

const ADMINS_COLLECTION = 'admins';

export async function findAdminByEmail(email) {
  const snap = await db().collection(ADMINS_COLLECTION).where('email', '==', email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function verifyAdminCredentials(email, password) {
  const admin = await findAdminByEmail(email);
  if (!admin || admin?.metadata?.deleted_at) return null;
  const { password_hash } = admin;
  if (!password_hash) return null;
  const ok = await bcrypt.compare(password, password_hash);
  if (!ok) return null;
  // keep only safe fields in session
  const safe = {
    id: admin.id,
    email: admin.email,
    name: admin.name || '',
    role: admin.role || 'admin',
  };
  return safe;
}

export async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}
