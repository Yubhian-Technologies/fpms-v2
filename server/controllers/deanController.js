import bcrypt from "bcryptjs";
import { db } from "../config/firebase.js";
import admin from "firebase-admin";
import { getFirebaseIdToken } from "../utils/firebaseTokenHelper.js";

const SUPERADMIN_DOC_ID = process.env.SUPERADMIN_DOC_ID || "root";

const normDesig = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

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

export const deanLogin = async (req, res) => {
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

    const deanDoc = snapshot.docs[0];
    const deanData = deanDoc.data();

    const normalizedRole = String(deanData.role || "")
      .trim()
      .toLowerCase();
    if (!normalizedRole.includes("dean")) {
      return res.status(403).json({
        success: false,
        message: "Dean access only",
      });
    }

    const isMatch = await bcrypt.compare(password, deanData.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const designationTarget = await getDesignationTarget(
      deanData.college,
      deanData.designation,
      deanData.hasPhd,
    );

    const token = await getFirebaseIdToken(deanDoc.id, normalizedEmail, password);

    return res.status(200).json({
      success: true,
      message: "Dean login successful",
      token,
      user: {
        id: deanDoc.id,
        uid: deanDoc.id,
        name: deanData.name,
        email: deanData.email,
        role: deanData.role || "dean",
        college: deanData.college || "",
        department: deanData.department || "",
        designation: deanData.designation || "",
        designationTarget,
        hasPhd: Boolean(deanData.hasPhd ?? false),
      },
    });
  } catch (error) {
    console.error("Dean login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
