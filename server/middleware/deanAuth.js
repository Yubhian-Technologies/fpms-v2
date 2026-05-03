import { auth, db } from "../config/firebase.js";

const isDeanRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "dean" || normalized.startsWith("dean");
};

export const deanAuth = async (req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";

  // DEV MODE: Use headers instead of Firebase token
  if (isDev) {
    const userId = req.headers["x-user-id"];
    const userEmail = req.headers["x-user-email"];
    const userName = req.headers["x-user-name"];
    const userRole = req.headers["x-user-role"];
    const userCollege = req.headers["x-college"];
    const userDepartment = req.headers["x-department"];

    if (userId && userEmail && userRole) {
      console.log("[deanAuth] DEV MODE - Using headers. Role:", userRole);
      req.dean = {
        id: userId,
        uid: userId,
        email: userEmail,
        name: userName || userEmail,
        role: userRole,
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
    const firebaseRole =
      decodedFirebase.role ||
      decodedFirebase.claims?.role ||
      decodedFirebase.token?.role;

    let userDocData = null;
    try {
      const userDoc = await db
        .collection("users")
        .doc(decodedFirebase.uid)
        .get();
      if (userDoc.exists) {
        userDocData = userDoc.data() || null;
      }
    } catch (docError) {}

    const resolvedRole = String(firebaseRole || userDocData?.role || "").trim();

    if (!isDeanRole(resolvedRole)) {
      return res.status(403).json({
        success: false,
        message: "Dean access only",
      });
    }

    req.dean = {
      id: decodedFirebase.uid,
      uid: decodedFirebase.uid,
      email: decodedFirebase.email,
      role: resolvedRole,
      college:
        decodedFirebase.college ||
        decodedFirebase.claims?.college ||
        userDocData?.college,
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
