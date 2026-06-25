import { auth, db } from "../config/firebase.js";

const isPrincipalRole = (value) => {
  const normalized = String(value || "").toLowerCase();
  return (
    normalized === "admin" ||
    normalized === "principle" ||
    normalized === "principal" ||
    normalized === "director"
  );
};

const isVicePrincipalRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return (
    normalized === "vice principle" ||
    normalized === "vice principal" ||
    normalized === "vice-principal" ||
    normalized === "viceprincipal" ||
    normalized === "viceprinciple"
  );
};

const isPrincipalOrVicePrincipalRole = (value) =>
  isPrincipalRole(value) || isVicePrincipalRole(value);

const normalizeAdminRole = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "director") return "director";
  if (isPrincipalRole(value)) return "principle";
  if (isVicePrincipalRole(value)) return "vice principle";
  return normalized;
};

export const adminAuth = async (req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";

  // DEV MODE: Use headers instead of Firebase token
  if (isDev) {
    const userId = req.headers["x-user-id"];
    const userEmail = req.headers["x-user-email"];
    const userName = req.headers["x-user-name"];
    const userRole = req.headers["x-user-role"];
    let userCollege = req.headers["x-college"];
    const userDepartment = req.headers["x-department"];

    if (userId && userEmail && userRole) {
      // Always prefer Firestore college — header may be stale after a rename
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists && userDoc.data()?.college) {
          userCollege = userDoc.data().college;
        } else if (!userCollege) {
          const normalizedEmail = String(userEmail).trim().toLowerCase();
          const adminSnap = await db.collection("admins").where("email", "==", normalizedEmail).limit(1).get();
          if (!adminSnap.empty) userCollege = adminSnap.docs[0].data()?.college || "";
          if (!userCollege) {
            const userSnap = await db.collection("users").where("email", "==", normalizedEmail).limit(1).get();
            if (!userSnap.empty) userCollege = userSnap.docs[0].data()?.college || "";
          }
        }
      } catch (e) {
        console.error("[adminAuth] DEV college lookup failed:", e.message);
      }

      console.log("[adminAuth] DEV MODE - Using headers. Role:", userRole);
      req.admin = {
        id: userId,
        uid: userId,
        email: userEmail,
        name: userName || userEmail,
        role: normalizeAdminRole(userRole),
        college: userCollege,
        department: userDepartment,
      };
      return next();
    }
  }

  // PRODUCTION MODE: Verify Firebase token
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedFirebase = await auth.verifyIdToken(token);
    const firebaseRole = decodedFirebase.role || decodedFirebase.claims?.role;

    // Always fetch Firestore doc — used for role fallback + college lookup
    let userDocData = null;
    try {
      const userDoc = await db.collection("users").doc(decodedFirebase.uid).get();
      if (userDoc.exists) userDocData = userDoc.data() || null;
    } catch (docError) {}

    // Resolve role: prefer Firestore (source of truth) over stale JWT claims
    const resolvedFirestoreRole = userDocData?.role || firebaseRole || "";

    const isPrincipal = isPrincipalOrVicePrincipalRole(resolvedFirestoreRole);
    const isDirector = String(resolvedFirestoreRole || "").trim().toLowerCase() === "director";
    const hasPrincipalOrViceClaim = Boolean(
      decodedFirebase.principal ||
      decodedFirebase.vicePrincipal ||
      decodedFirebase.claims?.principal ||
      decodedFirebase.claims?.vicePrincipal,
    );
    const isInternalCommittee =
      String(resolvedFirestoreRole || "").toLowerCase().includes("internal committee") ||
      Boolean(decodedFirebase.internalCommittee || decodedFirebase.claims?.internalCommittee) ||
      Boolean(userDocData?.internalCommittee);
    const isAuthorizedAdmin = isPrincipal || isDirector || hasPrincipalOrViceClaim || isInternalCommittee;

    if (!isAuthorizedAdmin) {
      return res.status(403).json({
        success: false,
        message: "Principal/Vice Principal access only",
      });
    }

    // Prefer Firestore data — token claims may hold stale college after a rename
    let adminCollege =
      userDocData?.college ||
      decodedFirebase.college ||
      decodedFirebase.claims?.college ||
      "";

    if (!adminCollege) {
      try {
        const adminDoc = await db
          .collection("admins")
          .doc(decodedFirebase.uid)
          .get();
        if (adminDoc.exists) {
          adminCollege = adminDoc.data()?.college || "";
        }
        if (!adminCollege && decodedFirebase.email) {
          const normalizedEmail = String(decodedFirebase.email)
            .trim()
            .toLowerCase();
          const snap = await db
            .collection("admins")
            .where("email", "==", normalizedEmail)
            .limit(1)
            .get();
          if (!snap.empty) adminCollege = snap.docs[0].data()?.college || "";
        }

        if (!adminCollege && decodedFirebase.email) {
          const normalizedEmail = String(decodedFirebase.email)
            .trim()
            .toLowerCase();
          const userSnapByEmail = await db
            .collection("users")
            .where("email", "==", normalizedEmail)
            .limit(1)
            .get();
          if (!userSnapByEmail.empty) {
            adminCollege = userSnapByEmail.docs[0].data()?.college || "";
          }
        }
      } catch (e) {
        console.error("[adminAuth] PROD college lookup failed:", e.message);
      }
    }

    req.admin = {
      id: decodedFirebase.uid,
      uid: decodedFirebase.uid,
      email: decodedFirebase.email,
      role: normalizeAdminRole(resolvedFirestoreRole),
      college: adminCollege,
      department:
        decodedFirebase.department ||
        decodedFirebase.claims?.department ||
        userDocData?.department,
      token: decodedFirebase,
    };

    return next();
  } catch (firebaseError) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
