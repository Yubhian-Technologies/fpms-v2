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
        internalCommittee: Boolean(deanData.internalCommittee),
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

export const getDeanProfile = async (req, res) => {
  try {
    const doc = await db.collection("users").doc(req.dean.uid).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: "User not found" });
    const d = doc.data();
    return res.json({
      success: true,
      data: {
        name: d.name || "", email: d.email || "", college: d.college || "",
        department: d.department || "", designation: d.designation || "",
        hasPhd: Boolean(d.hasPhd), staffStatus: d.staffStatus || "active",
        statusNote: d.statusNote || "", dateOfJoining: d.dateOfJoining || "",
        phone: d.phone || d.phoneNumber || "",
        subjectsHandled: Array.isArray(d.subjectsHandled) ? d.subjectsHandled : [],
        experience: d.experience != null ? Number(d.experience) : null,
        externalExperience: d.externalExperience != null ? Number(d.externalExperience) : null,
        overallExperience: d.overallExperience != null ? Number(d.overallExperience) : null,
      },
    });
  } catch (err) {
    console.error("[getDeanProfile]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateDeanProfile = async (req, res) => {
  try {
    const { dateOfJoining, externalExperience, phone, subjectsHandled, overallExperience } = req.body;
    const updateData = {};
    if (dateOfJoining !== undefined) updateData.dateOfJoining = String(dateOfJoining).trim();
    if (externalExperience !== undefined && externalExperience !== null && externalExperience !== "")
      updateData.externalExperience = Number(externalExperience);
    if (overallExperience !== undefined && overallExperience !== null && overallExperience !== "")
      updateData.overallExperience = Number(overallExperience);
    if (phone !== undefined) updateData.phone = String(phone).trim();
    if (subjectsHandled !== undefined)
      updateData.subjectsHandled = Array.isArray(subjectsHandled) ? subjectsHandled.map(String).filter(Boolean) : [];
    if (Object.keys(updateData).length === 0)
      return res.status(400).json({ success: false, message: "No fields to update" });
    await db.collection("users").doc(req.dean.uid).update(updateData);
    return res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("[updateDeanProfile]", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
