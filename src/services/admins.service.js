import { db } from "../config/firebase.js";
import crypto from "crypto";

const uuid = () => crypto.randomUUID();

export async function createAdmin(payload) {
  const now = new Date();
  const doc = {
    admin_id: uuid(),
    username: payload.username,
    password: payload.password, // NOTE: sample; store hash in real apps
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    metadata: {
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
      tags: payload?.metadata?.tags || [],
      custom_fields: payload?.metadata?.custom_fields || {},
    },
  };
  const ref = db().collection('admins').doc(doc.admin_id);
  await ref.set(doc);
  return { id: ref.id, ...doc };
}

export async function listAdmins({ limit = 20, offset = 0 }) {
  try {
    let ref = db().collection('admins')
      .where('metadata.deleted_at', '==', null)
      .orderBy('metadata.created_at', 'desc')
      .offset(offset)
      .limit(limit);
    const snap = await ref.get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return items;
  } catch (err) {
    // Fallback when Firestore composite index is missing
    // Strategy: fetch (limit+offset) docs by created_at desc, filter deleted_at === null in memory, then slice.
    console.warn('[admins.list] missing index, using fallback without where filter:', err?.message || err);
    const take = Math.max(0, Number(limit)) + Math.max(0, Number(offset));
    let ref = db().collection('admins')
      .orderBy('metadata.created_at', 'desc')
      .limit(take || limit);
    const snap = await ref.get();
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtered = all.filter(x => !x?.metadata?.deleted_at);
    return filtered.slice(offset, offset + limit);
  }
}

export async function getAdminById(id) {
  const doc = await db().collection('admins').doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function updateAdmin(id, patch) {
  const ref = db().collection('admins').doc(id);
  const now = new Date();
  const payload = { ...patch, 'metadata.updated_at': now };
  await ref.set(payload, { merge: true });
  const updated = await ref.get();
  return { id: updated.id, ...updated.data() };
}

export async function softDeleteAdmin(id) {
  const ref = db().collection('admins').doc(id);
  const now = new Date();
  await ref.set({ metadata: { deleted_at: now, updated_at: now } }, { merge: true });
  const snap = await ref.get();
  return { id: snap.id, ...snap.data() };
}
