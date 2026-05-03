
import { db } from "../config/firebase.js";

export const getUserForms = async (req, res) => {
  try {
    // Get logged-in user info
    const userId = req.user?.uid || req.user?.id || req.headers["x-user-id"];
    const userRole = (req.user?.role || req.headers["x-user-role"] || "").trim();

    if (!userId || !userRole) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated or role missing",
      });
    }

    console.log(`[getUserForms] Fetching forms for userId: ${userId}, role: ${userRole}`);

    // Query fpmsForms where applicableRoles contains the user's role
    const snapshot = await db
      .collection("fpmsForms")
      .where("applicableRoles", "array-contains", userRole)
      .get();

    const forms = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    console.log(`[getUserForms] Found ${forms.length} forms for role: ${userRole}`);
    console.log(forms)
    return res.status(200).json({
      success: true,
      data: forms,
    });
  } catch (error) {
    console.error("[getUserForms] Error fetching forms:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching user forms",
    });
  }
};