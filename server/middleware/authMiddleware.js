import { auth } from "../config/firebase.js";

export const committeeAuth = async (req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";

  // In development, if we have x-user headers, use them directly
  if (isDev) {
    const devUserId = req.headers["x-user-id"];
    const devUserRole = req.headers["x-user-role"];

    if (devUserId && devUserRole) {
      console.log(
        "[committeeAuth] DEV MODE - Using headers. Role:",
        devUserRole,
      );

      req.committee = {
        uid: String(devUserId),
        email: String(req.headers["x-user-email"] || ""),
        role: String(devUserRole || "committee"),
        committeeMember: true,
        token: null,
      };

      // In dev mode, allow any authenticated user to access committee routes
      return next();
    }
  }

  // Production: require Firebase token
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
    const role = decodedFirebase.role || decodedFirebase.claims?.role;
    const isCommitteeMember = Boolean(
      decodedFirebase.committeeMember ||
      decodedFirebase.claims?.committeeMember,
    );

    if (role !== "committee" && !isCommitteeMember) {
      return res.status(403).json({
        success: false,
        message: "Not authorized (committee only)",
      });
    }

    req.committee = {
      uid: decodedFirebase.uid,
      email: decodedFirebase.email,
      role: "committee",
      committeeMember: isCommitteeMember,
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
