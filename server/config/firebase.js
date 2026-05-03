import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log("FIREBASE CONNECTED SUCCESSFULLY");
} catch (error) {
  console.error("FIREBASE CONNECTION FAILED");
  console.error(error);
}

export const auth = admin.auth();
export const db = admin.firestore();      