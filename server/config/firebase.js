import admin from 'firebase-admin';

function parsePrivateKey(raw) {
  if (!raw) return undefined;
  const s = String(raw);
  // Vercel UI / copy-paste from .env stores literal \n — convert to real newlines
  return s.includes('\\n') ? s.replace(/\\n/g, '\n') : s;
}

let _auth;
let _db;

try {
  // Guard against re-initialization on serverless warm restarts
  if (admin.apps.length === 0) {
    const projectId   = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey  = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    console.log('[Firebase] Init — project:', projectId || 'MISSING',
      '| email:', clientEmail ? 'set' : 'MISSING',
      '| key:', privateKey ? `${privateKey.length} chars` : 'MISSING');

    admin.initializeApp({
      credential: admin.credential.cert({
        type: 'service_account',
        project_id:     projectId,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key:    privateKey,
        client_email:   clientEmail,
        client_id:      process.env.FIREBASE_CLIENT_ID,
        auth_uri:  'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
      }),
    });
  } else {
    console.log('[Firebase] Reusing existing app');
  }

  _auth = admin.auth();
  _db   = admin.firestore();
  console.log('FIREBASE CONNECTED SUCCESSFULLY');
} catch (error) {
  // Re-throw so the serverless function fails fast and Vercel logs the real cause.
  // Without this, _db and _auth stay undefined and every request silently returns 500.
  throw new Error(`Firebase initialization failed: ${error.message}`);
}

export const auth = _auth;
export const db   = _db;
