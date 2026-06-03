import { auth } from "../config/firebase.js";

/**
 * Gets a Firebase ID token for a user after bcrypt verification succeeds.
 * If the Firebase Auth account is missing or has a stale password,
 * it auto-creates/repairs it using the admin SDK, then retries sign-in.
 */
export const getFirebaseIdToken = async (uid, email, password) => {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) return null;

  const signIn = async () => {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    const data = await res.json();
    return data?.idToken || null;
  };

  try {
    const token = await signIn();
    if (token) return token;

    // Sign-in failed — Firebase Auth account missing or password mismatch.
    // Use admin SDK to create or repair it, then retry.
    try {
      await auth.updateUser(uid, { password, email });
    } catch (updateErr) {
      if (updateErr?.code === "auth/user-not-found") {
        await auth.createUser({ uid, email, password, displayName: email });
      } else {
        throw updateErr;
      }
    }

    return await signIn();
  } catch (_) {
    return null;
  }
};
