import { db } from "../config/firebase.js";

export const optionalAuth = async (req, res, next) => {
  try {
    // Check for user info in headers (passed from frontend)
    const userId = req.headers['x-user-id'];
    const userEmail = req.headers['x-user-email'];
    const userName = req.headers['x-user-name'];
    const userRole = req.headers['x-user-role'];
    const college = req.headers['x-college'];
    const department = req.headers['x-department'];

    if (userId) {
      req.user = {
        uid: userId,
        id: userId,
        email: userEmail || '',
        name: userName || '',
        role: userRole || 'faculty',
        college: college || '',
        department: department || '',
      };
    }

    next();
  } catch (error) {
    console.error("Optional auth error:", error);
    // Don't block the request, just continue without user info
    next();
  }
};

export default optionalAuth;
