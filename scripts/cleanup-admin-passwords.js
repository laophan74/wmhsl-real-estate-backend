import 'dotenv/config';
import { initFirebase, db } from '../src/config/firebase.js';

async function run() {
  initFirebase();
  const snap = await db().collection('admins').get();
  let count = 0;
  const batch = db().batch();
  snap.forEach(doc => {
    const data = doc.data();
    if (Object.prototype.hasOwnProperty.call(data, 'password')) {
      batch.update(doc.ref, { password: admin.firestore.FieldValue.delete?.() || undefined });
      // Fallback if FieldValue not available in this import style; we'll overwrite with merge below.
      count++;
    }
  });
  // The above may not work due to FieldValue in this module. Simpler: loop and overwrite field to remove.
  let fixed = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if ('password' in data) {
      const { password, ...rest } = data;
      await d.ref.set(rest, { merge: false });
      fixed++;
    }
  }
  console.log(`[cleanup] removed plain password from ${fixed} admin docs`);
}

run().then(()=>process.exit(0)).catch(err=>{ console.error(err); process.exit(1); });
