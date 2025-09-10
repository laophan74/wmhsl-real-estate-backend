import admin from "firebase-admin";
import fs from "fs";
import path from "path";

// Dùng CWD để resolve đường dẫn tương đối từ gốc repo (ổn định hơn ESM import URL)
function readServiceAccountFromFile() {
  const rel = process.env.FIREBASE_KEY_FILE; // ví dụ: stone-real-estate-...b064.json
  if (!rel) {
    throw new Error("Missing FIREBASE_KEY_FILE in .env");
  }
  const absPath = path.resolve(process.cwd(), rel); // luôn ra đường dẫn tuyệt đối
  if (!fs.existsSync(absPath)) {
    throw new Error(`Service account JSON not found at: ${absPath}`);
  }
  const raw = fs.readFileSync(absPath, "utf8");
  return JSON.parse(raw);
}

let initialized = false;

export function initFirebase() {
  if (initialized) return admin;

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL } = process.env;
  let { FIREBASE_PRIVATE_KEY } = process.env;

  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    FIREBASE_PRIVATE_KEY = FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY,
      }),
    });
  } else {
    const serviceAccount = readServiceAccountFromFile();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  initialized = true;
  return admin;
}

export function db() {
  return admin.firestore();
}
