import { db } from "./firebase.js";

const SUPERADMIN_DOC_ID = process.env.SUPERADMIN_DOC_ID || "root";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

let _cache = null;
let _cachedAt = 0;

const isFresh = () => _cache !== null && Date.now() - _cachedAt < TTL_MS;

const resolveDoc = async () => {
  let doc = await db.collection("superadmin").doc("config").get();
  if (!doc.exists) doc = await db.collection("superadmin").doc(SUPERADMIN_DOC_ID).get();
  if (!doc.exists) {
    const snap = await db.collection("superadmin").limit(1).get();
    if (!snap.empty) doc = snap.docs[0];
  }
  return doc.exists ? doc.data() || {} : {};
};

// Returns cached superadmin config. Re-fetches from Firestore at most once per
// 5 minutes per warm serverless instance, eliminating the hot-document read
// that previously ran on every single API request.
export const getSuperadminConfig = async () => {
  if (isFresh()) return _cache;
  _cache = await resolveDoc();
  _cachedAt = Date.now();
  return _cache;
};

export const invalidateSuperadminCache = () => {
  _cache = null;
  _cachedAt = 0;
};
