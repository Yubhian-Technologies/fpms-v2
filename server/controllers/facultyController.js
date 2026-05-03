import bcrypt from "bcryptjs";
import { db } from "../config/firebase.js";

const SUPERADMIN_DOC_ID = process.env.SUPERADMIN_DOC_ID || "root";

const normDesig = (s) =>
  String(s || "")
    .trim()
    .toLowerCase()
    .replace(/f{2,}/g, "f")
    .replace(/s{2,}/g, "s");

const getDesignationTarget = async (college, designation, hasPhd) => {
  if (!college || !designation) return "";
  try {
    const saDoc = await db
      .collection("superadmin")
      .doc(SUPERADMIN_DOC_ID)
      .get();
    if (!saDoc.exists) return "";
    const col = (saDoc.data()?.colleges || []).find(
      (c) =>
        String(c?.name || "")
          .trim()
          .toLowerCase() === college.toLowerCase(),
    );
    if (!col) return "";
    const candidates = (col.designations || []).filter(
      (d) => normDesig(d?.name) === normDesig(designation),
    );
    if (candidates.length === 0) return "";
    if (hasPhd !== undefined && candidates.length > 1) {
      const exact = candidates.find((d) => Boolean(d.phd) === Boolean(hasPhd));
      if (exact) return exact.target || "";
    }
    return candidates[0].target || "";
  } catch (e) {
    return "";
  }
};

export const facultyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    const snapshot = await db
      .collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const facultyDoc = snapshot.docs[0];
    const facultyData = facultyDoc.data();

    const normalizedRole = String(facultyData.role || "")
      .trim()
      .toLowerCase();
    if (
      !(normalizedRole === "faculty" || normalizedRole.startsWith("faculty"))
    ) {
      return res.status(403).json({
        success: false,
        message: "Faculty access only",
      });
    }

    if (facultyData.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Faculty account is inactive",
      });
    }

    const isMatch = await bcrypt.compare(password, facultyData.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const designationTarget = await getDesignationTarget(
      facultyData.college,
      facultyData.designation,
      facultyData.hasPhd,
    );

    return res.status(200).json({
      success: true,
      message: "Faculty login successful",
      user: {
        id: facultyDoc.id,
        uid: facultyDoc.id,
        name: facultyData.name,
        email: facultyData.email,
        role: "faculty",
        college: facultyData.college || "",
        department: facultyData.department,
        designation: facultyData.designation,
        designationTarget,
        hasPhd: Boolean(facultyData.hasPhd ?? false),
      },
    });
  } catch (error) {
    console.error("Faculty login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
