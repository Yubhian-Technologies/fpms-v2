import { auth } from "../config/firebase.js";

export const guestAuth = async (req, res, next) => {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const devUserId = req.headers["x-user-id"];
    const devUserRole = req.headers["x-user-role"];
    if (devUserId && devUserRole) {
      req.viewer = {
        uid: String(devUserId),
        email: String(req.headers["x-user-email"] || ""),
        role: String(devUserRole || "guest"),
      };
      return next();
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    const role = String(decoded.role || decoded.claims?.role || "").toLowerCase();
    if (role !== "guest") {
      return res.status(403).json({ success: false, message: "Not authorized (guest only)" });
    }
    req.viewer = { uid: decoded.uid, email: decoded.email, role };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};
