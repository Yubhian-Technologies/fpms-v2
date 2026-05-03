import { auth, db } from "../config/firebase.js";

const isHodRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "hod" || normalized.startsWith("hod");
};

export const hodAuth = async (req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";

  // In development, if we have x-user headers, use them directly
  if (isDev) {
    const devUserId = req.headers["x-user-id"];
    const devUserRole = req.headers["x-user-role"];

    if (devUserId && devUserRole) {
      const normalizedRole = String(devUserRole || "").trim();

      console.log(
        "[hodAuth] DEV MODE - Using headers. Role:",
        normalizedRole,
        "College:",
        req.headers["x-college"],
      );

      if (!isHodRole(normalizedRole)) {
        return res
          .status(403)
          .json({ success: false, message: "HOD access only" });
      }

      req.hod = {
        id: String(devUserId),
        uid: String(devUserId),
        email: String(req.headers["x-user-email"] || ""),
        role: normalizedRole,
        college: String(req.headers["x-college"] || ""),
        department: String(req.headers["x-department"] || ""),
        token: null,
      };

      return next();
    }
  }

  // Production: require Firebase token
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "No token provided" });
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

    if (!isHodRole(resolvedRole)) {
      return res.status(403).json({
        success: false,
        message: "HOD access only",
      });
    }

    req.hod = {
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
