import { auth } from "../config/firebase.js";

export const superadminAuth = async (req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";

  // DEV MODE: Use headers instead of Firebase token
  if (isDev) {
    const userId = req.headers["x-user-id"];
    const userEmail = req.headers["x-user-email"];
    const userName = req.headers["x-user-name"];
    const userRole = req.headers["x-user-role"];

    if (userId && userEmail && userRole) {
      console.log("[superadminAuth] DEV MODE - Using headers. Role:", userRole);
      req.superadmin = {
        uid: userId,
        email: userEmail,
        name: userName || userEmail,
        role: userRole,
      };
      return next();
    }
  }

  // PRODUCTION MODE: Verify Firebase token
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No Firebase token provided",
      });
    }

    const idToken = authHeader.split(" ")[1];

    const decoded = await auth.verifyIdToken(idToken);

    const isSuperAdmin =
      decoded.role === "superadmin" ||
      decoded.superadmin === true ||
      (process.env.SUPERADMIN_EMAIL &&
        decoded.email === process.env.SUPERADMIN_EMAIL);

    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Super admin access only",
      });
    }

    req.superadmin = {
      uid: decoded.uid,
      email: decoded.email,
      role: "superadmin",
      token: decoded,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase token",
    });
  }
};
