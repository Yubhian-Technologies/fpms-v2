//adminController

import bcrypt from "bcryptjs";
import { db, auth } from "../config/firebase.js";
import admin from "firebase-admin";
import { getFirebaseIdToken } from "../utils/firebaseTokenHelper.js";
import { invalidateSuperadminCache } from "../config/superadminCache.js";

const SUPERADMIN_DOC_ID = process.env.SUPERADMIN_DOC_ID || "root";
const USERS_COLLECTION = "users";

const normalizeDeanRole = (value) => String(value || "").trim();

const isDeanRole = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .includes("dean");

const isHodRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "hod" || normalized.startsWith("hod");
};

const normalizeInternalCommitteeRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\-_]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized.includes("internal") && normalized.includes("committee")) {
    return "internal committee";
  }

  return normalized;
};

const isInternalCommitteeRole = (value) =>
  normalizeInternalCommitteeRole(value) === "internal committee";

const isPrincipalManagementRole = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return (
    normalized === "principal" ||
    normalized === "principle" ||
    normalized === "admin"
  );
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const snapshot = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data();

    if (!isPrincipalManagementRole(adminData.role)) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, adminData.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = await getFirebaseIdToken(adminDoc.id, email, password);

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        id: adminDoc.id,
        name: adminData.name,
        email: adminData.email,
        college: adminData.college,
        role: adminData.role || "admin",
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const addHod = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      pass,
      confirmPassword,
      confirm_pass,
      department,
      college,
      level,
      hasPhd,
      designation,
      dateOfJoining,
      experience,
    } = req.body;

    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedDepartment = String(department || "").trim();
    const normalizedCollege = String(college || "").trim();
    const principalCollege = String(req.admin?.college || "").trim();
    const resolvedCollege = principalCollege || normalizedCollege;
    const resolvedPassword = String(password ?? pass ?? "");
    const normalizedDesignation = String(designation || "").trim();
    const resolvedConfirmPassword = String(
      confirmPassword ?? confirm_pass ?? "",
    );
    const normalizedLevel = Number(level);

    if (
      !normalizedName ||
      !normalizedEmail ||
      !resolvedPassword ||
      !normalizedDepartment ||
      !normalizedDesignation ||
      !resolvedCollege
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!Number.isFinite(normalizedLevel)) {
      return res.status(400).json({
        success: false,
        message: "Level is required",
      });
    }

    if (resolvedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (
      resolvedConfirmPassword &&
      resolvedPassword !== resolvedConfirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation does not match",
      });
    }

    try {
      const existingAuthUser = await auth.getUserByEmail(normalizedEmail);
      const firestoreDoc = await db
        .collection(USERS_COLLECTION)
        .doc(existingAuthUser.uid)
        .get();
      if (firestoreDoc.exists) {
        return res.status(409).json({
          success: false,
          message: "HOD already exists",
        });
      }
      // Orphaned Auth account (Firestore record was deleted) — remove it
      await auth.deleteUser(existingAuthUser.uid);
    } catch (error) {
      if (error?.code && error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    const userRecord = await auth.createUser({
      email: normalizedEmail,
      password: resolvedPassword,
      displayName: normalizedName,
    });

    await auth.setCustomUserClaims(userRecord.uid, {
      role: "hod",
      level: normalizedLevel,
      college: resolvedCollege,
      department: normalizedDepartment,
      designation: normalizedDesignation,
      hod: true,
    });

    const hashedPassword = await bcrypt.hash(resolvedPassword, 10);

    await db
      .collection(USERS_COLLECTION)
      .doc(userRecord.uid)
      .set(
        {
          uid: userRecord.uid,
          name: normalizedName,
          email: normalizedEmail,
          password: hashedPassword,
          department: normalizedDepartment,
          college: resolvedCollege,
          designation: normalizedDesignation,
          level: normalizedLevel,
          hasPhd: Boolean(hasPhd),
          role: "hod",
          isActive: true,
          ...(dateOfJoining ? { dateOfJoining: String(dateOfJoining) } : {}),
          ...(experience !== undefined
            ? { experience: Number(experience) }
            : {}),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return res.status(201).json({
      success: true,
      message: "HOD added successfully",
    });
  } catch (error) {
    console.error("Add HOD error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
export const addDean = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      pass,
      confirmPassword,
      confirm_pass,
      department,
      college,
      role,
      level,
      hasPhd,
      designation,
      dateOfJoining,
      experience,
    } = req.body;

    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedCollege = String(college || "").trim();
    const principalCollege = String(req.admin?.college || "").trim();
    const resolvedCollege = principalCollege || normalizedCollege;
    const normalizedDepartment = String(department || "").trim();
    const normalizedDesignation = String(designation || "").trim();
    const resolvedPassword = String(password ?? pass ?? "");
    const resolvedConfirmPassword = String(
      confirmPassword ?? confirm_pass ?? "",
    );
    const normalizedRole = normalizeDeanRole(role);
    const normalizedLevel = Number(level);

    if (
      !normalizedName ||
      !normalizedEmail ||
      !resolvedPassword ||
      !resolvedCollege ||
      !normalizedDesignation ||
      !normalizedRole
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!isDeanRole(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Role must include Dean",
      });
    }

    if (!Number.isFinite(normalizedLevel)) {
      return res.status(400).json({
        success: false,
        message: "Level is required",
      });
    }

    if (resolvedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (
      resolvedConfirmPassword &&
      resolvedPassword !== resolvedConfirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation does not match",
      });
    }

    try {
      const existingAuthUser = await auth.getUserByEmail(normalizedEmail);
      const firestoreDoc = await db
        .collection(USERS_COLLECTION)
        .doc(existingAuthUser.uid)
        .get();
      if (firestoreDoc.exists) {
        return res.status(409).json({
          success: false,
          message: "DEAN already exists",
        });
      }
      await auth.deleteUser(existingAuthUser.uid);
    } catch (error) {
      if (error?.code && error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    const userRecord = await auth.createUser({
      email: normalizedEmail,
      password: resolvedPassword,
      displayName: normalizedName,
    });

    await auth.setCustomUserClaims(userRecord.uid, {
      role: normalizedRole,
      level: normalizedLevel,
      college: resolvedCollege,
      department: normalizedDepartment,
      designation: normalizedDesignation,
      dean: true,
    });

    const hashedPassword = await bcrypt.hash(resolvedPassword, 10);

    await db
      .collection(USERS_COLLECTION)
      .doc(userRecord.uid)
      .set(
        {
          uid: userRecord.uid,
          name: normalizedName,
          email: normalizedEmail,
          password: hashedPassword,
          department: normalizedDepartment,
          designation: normalizedDesignation,
          college: resolvedCollege,
          hasPhd: Boolean(hasPhd),
          role: normalizedRole,
          level: normalizedLevel,
          isActive: true,
          ...(dateOfJoining ? { dateOfJoining: String(dateOfJoining) } : {}),
          ...(experience !== undefined
            ? { experience: Number(experience) }
            : {}),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return res.status(201).json({
      success: true,
      message: "Dean added successfully",
    });
  } catch (error) {
    console.error("Add Dean error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getAllHods = async (req, res) => {
  try {
    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();

    const snapshot = await db.collection(USERS_COLLECTION).get();

    const hods = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((item) => isHodRole(item.role || ""))
      .filter((item) => {
        if (!principalCollege) return true;
        const itemCollege = String(item.college || "")
          .trim()
          .toLowerCase();
        return itemCollege === principalCollege;
      });

    return res.status(200).json({
      success: true,
      data: hods,
    });
  } catch (error) {
    console.error("Get HODs error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getAllDeans = async (req, res) => {
  try {
    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();

    const snapshot = await db.collection(USERS_COLLECTION).get();

    const deans = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((item) => isDeanRole(item.role || ""))
      .filter((item) => {
        if (!principalCollege) return true;
        const itemCollege = String(item.college || "")
          .trim()
          .toLowerCase();
        return itemCollege === principalCollege;
      });

    return res.status(200).json({
      success: true,
      data: deans,
    });
  } catch (error) {
    console.error("Get DEANS error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getHodRoleOption = async (req, res) => {
  try {
    const superadminDoc = await db
      .collection("superadmin")
      .doc(SUPERADMIN_DOC_ID)
      .get();

    if (!superadminDoc.exists) {
      return res.status(200).json({
        success: true,
        data: { name: "hod", level: 0 },
      });
    }

    const data = superadminDoc.data() || {};
    const roles = Array.isArray(data.roles) ? data.roles : [];

    const hodRole = roles
      .map((item) => ({
        id: item.id,
        name: String(item.name || "").trim(),
        level: Number(item.level),
      }))
      .find(
        (item) =>
          item.name && Number.isFinite(item.level) && isHodRole(item.name),
      );

    return res.status(200).json({
      success: true,
      data: {
        id: hodRole?.id,
        name: hodRole?.name || "hod",
        level: Number(hodRole?.level ?? 0),
      },
    });
  } catch (error) {
    console.error("Get HOD role option error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getInternalCommitteeRoleOption = async (req, res) => {
  try {
    const superadminDoc = await db
      .collection("superadmin")
      .doc(SUPERADMIN_DOC_ID)
      .get();

    if (!superadminDoc.exists) {
      return res.status(200).json({
        success: true,
        data: { name: "internal committee", level: 0 },
      });
    }

    const data = superadminDoc.data() || {};
    const roles = Array.isArray(data.roles) ? data.roles : [];

    const roleOption = roles
      .map((item) => ({
        id: item.id,
        name: String(item.name || "").trim(),
        level: Number(item.level),
      }))
      .find(
        (item) =>
          item.name &&
          Number.isFinite(item.level) &&
          isInternalCommitteeRole(item.name),
      );

    return res.status(200).json({
      success: true,
      data: {
        id: roleOption?.id,
        name: roleOption?.name || "internal committee",
        level: Number(roleOption?.level ?? 0),
      },
    });
  } catch (error) {
    console.error("Get internal committee role option error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAllInternalCommittees = async (req, res) => {
  try {
    const actorRole = String(req.admin?.role || "")
      .trim()
      .toLowerCase();
    if (!isPrincipalManagementRole(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "Only principal can manage internal committee",
      });
    }

    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();

    if (!principalCollege) {
      return res.status(400).json({
        success: false,
        message: "Principal college not found",
      });
    }

    const snapshot = await db.collection(USERS_COLLECTION).get();
    const members = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => Boolean(item.internalCommittee) || isInternalCommitteeRole(item.role || ""))
      .filter(
        (item) =>
          String(item.college || "")
            .trim()
            .toLowerCase() === principalCollege,
      );

    return res.status(200).json({ success: true, data: members });
  } catch (error) {
    console.error("Get internal committee users error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const addInternalCommittee = async (req, res) => {
  try {
    const actorRole = String(req.admin?.role || "")
      .trim()
      .toLowerCase();
    if (!isPrincipalManagementRole(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "Only principal can add internal committee users",
      });
    }

    const principalCollege = String(req.admin?.college || "").trim();
    if (!principalCollege) {
      return res.status(400).json({
        success: false,
        message: "Principal college not found",
      });
    }

    const {
      name,
      email,
      password,
      pass,
      confirmPassword,
      confirm_pass,
      phone,
      role,
      level,
      dateOfJoining,
      experience,
      hasPhd,
    } = req.body || {};

    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedPhone = String(phone || "").trim();
    const resolvedPassword = String(password ?? pass ?? "");
    const resolvedConfirmPassword = String(
      confirmPassword ?? confirm_pass ?? "",
    );
    const normalizedRole = normalizeInternalCommitteeRole(
      role || "internal committee",
    );
    const normalizedLevel = Number(level);

    if (
      !normalizedName ||
      !normalizedEmail ||
      !normalizedPhone ||
      !resolvedPassword ||
      level === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!isInternalCommitteeRole(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role for internal committee user",
      });
    }

    if (!Number.isFinite(normalizedLevel)) {
      return res.status(400).json({
        success: false,
        message: "Invalid level",
      });
    }

    if (resolvedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (
      resolvedConfirmPassword &&
      resolvedPassword !== resolvedConfirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Password confirmation does not match",
      });
    }

    try {
      const existingAuthUser = await auth.getUserByEmail(normalizedEmail);
      const firestoreDoc = await db
        .collection(USERS_COLLECTION)
        .doc(existingAuthUser.uid)
        .get();
      if (firestoreDoc.exists) {
        return res.status(409).json({
          success: false,
          message: "User already exists",
        });
      }
      await auth.deleteUser(existingAuthUser.uid);
    } catch (error) {
      if (error?.code && error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    const userRecord = await auth.createUser({
      email: normalizedEmail,
      password: resolvedPassword,
      displayName: normalizedName,
    });

    await auth.setCustomUserClaims(userRecord.uid, {
      role: normalizedRole,
      level: normalizedLevel,
      college: principalCollege,
      internalCommittee: true,
    });

    const hashedPassword = await bcrypt.hash(resolvedPassword, 10);

    await db
      .collection(USERS_COLLECTION)
      .doc(userRecord.uid)
      .set(
        {
          uid: userRecord.uid,
          name: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
          password: hashedPassword,
          role: normalizedRole,
          level: normalizedLevel,
          college: principalCollege,
          internalCommittee: true,
          hasPhd: Boolean(hasPhd),
          ...(dateOfJoining ? { dateOfJoining: String(dateOfJoining) } : {}),
          ...(experience !== undefined
            ? { experience: Number(experience) }
            : {}),
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return res.status(201).json({
      success: true,
      message: "Internal committee user added successfully",
    });
  } catch (error) {
    console.error("Add internal committee user error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const assignExistingUserAsInternalCommittee = async (req, res) => {
  try {
    const actorRole = String(req.admin?.role || "").trim().toLowerCase();
    if (!isPrincipalManagementRole(actorRole)) {
      return res.status(403).json({ success: false, message: "Only principal can add internal committee users" });
    }

    const principalCollege = String(req.admin?.college || "").trim();
    if (!principalCollege) {
      return res.status(400).json({ success: false, message: "Principal college not found" });
    }

    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, message: "userId is required" });
    }

    const userRef = db.collection(USERS_COLLECTION).doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const userData = userDoc.data() || {};
    const userCollege = String(userData.college || "").trim().toLowerCase();

    if (userCollege !== principalCollege.toLowerCase()) {
      return res.status(403).json({ success: false, message: "User does not belong to your college" });
    }

    if (Boolean(userData.internalCommittee) || isInternalCommitteeRole(userData.role || "")) {
      return res.status(409).json({ success: false, message: "User is already an internal committee member" });
    }

    // Preserve original role — only flag the user as internal committee
    await auth.setCustomUserClaims(userId, {
      role: userData.role,
      level: userData.level || 0,
      college: userData.college || principalCollege,
      department: userData.department || "",
      internalCommittee: true,
    });

    await userRef.set({
      internalCommittee: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ success: true, message: "User assigned as internal committee member" });
  } catch (error) {
    console.error("Assign existing user as internal committee error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateInternalCommittee = async (req, res) => {
  try {
    const actorRole = String(req.admin?.role || "")
      .trim()
      .toLowerCase();
    if (!isPrincipalManagementRole(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "Only principal can update internal committee users",
      });
    }

    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();
    if (!principalCollege) {
      return res.status(400).json({
        success: false,
        message: "Principal college not found",
      });
    }

    const { id } = req.params;
    const memberRef = db.collection(USERS_COLLECTION).doc(id);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Internal committee user not found",
      });
    }

    const currentData = memberDoc.data() || {};
    const memberCollege = String(currentData.college || "")
      .trim()
      .toLowerCase();

    if (memberCollege !== principalCollege) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (!isInternalCommitteeRole(currentData.role || "")) {
      return res.status(400).json({
        success: false,
        message: "Selected user is not an internal committee member",
      });
    }

    const {
      name,
      email,
      phone,
      level,
      password,
      pass,
      confirmPassword,
      confirm_pass,
      dateOfJoining,
      experience,
      hasPhd,
    } = req.body || {};

    const updateData = {};
    const authUpdatePayload = {};

    if (name) {
      updateData.name = String(name).trim();
      authUpdatePayload.displayName = String(name).trim();
    }
    if (email) {
      updateData.email = String(email).trim().toLowerCase();
      authUpdatePayload.email = String(email).trim().toLowerCase();
    }
    if (phone !== undefined) updateData.phone = String(phone || "").trim();
    if (level !== undefined) {
      const normalizedLevel = Number(level);
      if (!Number.isFinite(normalizedLevel)) {
        return res.status(400).json({
          success: false,
          message: "Invalid level",
        });
      }
      updateData.level = normalizedLevel;
    }
    if (dateOfJoining !== undefined)
      updateData.dateOfJoining = String(dateOfJoining || "");
    if (experience !== undefined) updateData.experience = Number(experience);
    if (hasPhd !== undefined) updateData.hasPhd = Boolean(hasPhd);
    updateData.college = currentData.college || principalCollege;

    const resolvedPassword = String(password ?? pass ?? "");
    const resolvedConfirmPassword = String(
      confirmPassword ?? confirm_pass ?? "",
    );

    if (resolvedPassword) {
      if (resolvedPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }
      if (
        resolvedConfirmPassword &&
        resolvedPassword !== resolvedConfirmPassword
      ) {
        return res.status(400).json({
          success: false,
          message: "Password confirmation does not match",
        });
      }
      updateData.password = await bcrypt.hash(resolvedPassword, 10);
      authUpdatePayload.password = resolvedPassword;
    }

    const nextLevel = Number(
      updateData.level !== undefined ? updateData.level : currentData.level,
    );
    const nextEmail = String(updateData.email || currentData.email || "")
      .trim()
      .toLowerCase();
    const nextName = String(updateData.name || currentData.name || "").trim();

    if (nextName) authUpdatePayload.displayName = nextName;
    if (nextEmail) authUpdatePayload.email = nextEmail;

    if (Object.keys(authUpdatePayload).length > 0) {
      await auth.updateUser(id, authUpdatePayload);
    }

    await auth.setCustomUserClaims(id, {
      role: "internal committee",
      level: Number.isFinite(nextLevel) ? nextLevel : 0,
      college: String(currentData.college || "").trim(),
      internalCommittee: true,
    });

    updateData.role = "internal committee";
    updateData.internalCommittee = true;
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await memberRef.set(updateData, { merge: true });

    return res.status(200).json({
      success: true,
      message: "Internal committee user updated successfully",
    });
  } catch (error) {
    console.error("Update internal committee user error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteInternalCommittee = async (req, res) => {
  try {
    const actorRole = String(req.admin?.role || "")
      .trim()
      .toLowerCase();
    if (!isPrincipalManagementRole(actorRole)) {
      return res.status(403).json({
        success: false,
        message: "Only principal can delete internal committee users",
      });
    }

    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();
    if (!principalCollege) {
      return res.status(400).json({
        success: false,
        message: "Principal college not found",
      });
    }

    const { id } = req.params;
    const memberRef = db.collection(USERS_COLLECTION).doc(id);
    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Internal committee user not found",
      });
    }

    const currentData = memberDoc.data() || {};
    const memberCollege = String(currentData.college || "")
      .trim()
      .toLowerCase();

    if (memberCollege !== principalCollege) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (!currentData.internalCommittee && !isInternalCommitteeRole(currentData.role || "")) {
      return res.status(400).json({
        success: false,
        message: "Selected user is not an internal committee member",
      });
    }

    // Old-style: role was changed to "internal committee", revert via promotedFromRole
    if (currentData.promotedFromRole) {
      const revertRole = String(currentData.promotedFromRole);
      await auth.setCustomUserClaims(id, {
        role: revertRole,
        level: currentData.level || 0,
        college: currentData.college || "",
        department: currentData.department || "",
        internalCommittee: false,
      });
      await memberRef.set({
        role: revertRole,
        internalCommittee: false,
        promotedFromRole: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.status(200).json({ success: true, message: "Internal committee assignment removed" });
    }

    // New-style: role was never changed, just clear the flag
    if (currentData.internalCommittee) {
      await auth.setCustomUserClaims(id, {
        role: currentData.role,
        level: currentData.level || 0,
        college: currentData.college || "",
        department: currentData.department || "",
        internalCommittee: false,
      });
      await memberRef.set({
        internalCommittee: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return res.status(200).json({ success: true, message: "Internal committee assignment removed" });
    }

    // Created user — full delete
    try {
      await auth.deleteUser(id);
    } catch (authError) {
      if (authError?.code !== "auth/user-not-found") {
        throw authError;
      }
    }

    await memberRef.delete();

    return res.status(200).json({
      success: true,
      message: "Internal committee user deleted successfully",
    });
  } catch (error) {
    console.error("Delete internal committee user error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getDeanEligibleRoles = async (req, res) => {
  try {
    const superadminDoc = await db
      .collection("superadmin")
      .doc(SUPERADMIN_DOC_ID)
      .get();

    if (!superadminDoc.exists) {
      return res.status(200).json({ success: true, data: [] });
    }

    const data = superadminDoc.data() || {};
    const roles = Array.isArray(data.roles) ? data.roles : [];

    const result = roles
      .map((item) => ({
        id: item.id,
        name: String(item.name || "").trim(),
        level: Number(item.level),
      }))
      .filter(
        (item) =>
          item.name && Number.isFinite(item.level) && isDeanRole(item.name),
      )
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Get dean roles error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getDeanColleges = async (req, res) => {
  try {
    const principalCollege = String(req.admin?.college || "").trim();

    const superadminDoc = await db
      .collection("superadmin")
      .doc(SUPERADMIN_DOC_ID)
      .get();

    if (!superadminDoc.exists) {
      return res.status(200).json({ success: true, data: [] });
    }

    const data = superadminDoc.data() || {};
    const colleges = Array.isArray(data.colleges) ? data.colleges : [];

    const result = colleges
      .map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
      }))
      .filter((item) => item.name)
      .filter((item) =>
        principalCollege
          ? String(item.name || "")
              .trim()
              .toLowerCase() === principalCollege.toLowerCase()
          : true,
      )
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Get dean colleges error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getDeanCollegeDetails = async (req, res) => {
  try {
    console.log("[getDeanCollegeDetails] Admin user:", {
      uid: req.admin?.uid,
      id: req.admin?.id,
      college: req.admin?.college,
    });

    const adminUid = String(req.admin?.uid || req.admin?.id || "").trim();

    if (!adminUid) {
      console.log("[getDeanCollegeDetails] No admin UID found");
      return res.status(401).json({
        success: false,
        message: "Admin user not authenticated",
      });
    }

    // Fetch admin user from users collection
    const adminUserDoc = await db
      .collection(USERS_COLLECTION)
      .doc(adminUid)
      .get();

    if (!adminUserDoc.exists) {
      console.log(
        "[getDeanCollegeDetails] Admin user doc not found:",
        adminUid,
      );
      return res.status(404).json({
        success: false,
        message: "Admin user not found in database",
      });
    }

    const adminData = adminUserDoc.data() || {};
    let principalCollege = String(adminData.college || req.admin?.college || "").trim();

    if (!principalCollege) {
      const adminsDoc = await db.collection("admins").doc(adminUid).get();
      if (adminsDoc.exists) principalCollege = String(adminsDoc.data()?.college || "").trim();
    }

    console.log("[getDeanCollegeDetails] Admin data:", {
      college: principalCollege,
      role: adminData.role,
    });

    if (!principalCollege) {
      return res.status(400).json({
        success: false,
        message: "Admin college not found in user profile",
      });
    }

    const superadminDoc = await db
      .collection("superadmin")
      .doc(SUPERADMIN_DOC_ID)
      .get();

    if (!superadminDoc.exists) {
      console.log(
        "[getDeanCollegeDetails] Superadmin doc not found, returning basic data",
      );
      return res.status(200).json({
        success: true,
        data: {
          name: principalCollege,
          code: "",
        },
      });
    }

    const data = superadminDoc.data() || {};
    const colleges = Array.isArray(data.colleges) ? data.colleges : [];

    const matchedCollege = colleges.find(
      (item) =>
        String(item?.name || "")
          .trim()
          .toLowerCase() === principalCollege.toLowerCase(),
    );

    console.log("[getDeanCollegeDetails] Matched college:", matchedCollege);

    return res.status(200).json({
      success: true,
      data: {
        id: matchedCollege?.id,
        name: matchedCollege?.name || principalCollege,
        code: matchedCollege?.code || "",
      },
    });
  } catch (error) {
    console.error("Get dean college details error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getPrincipalCollegeDetails = async (req, res) => {
  try {
    console.log("[getPrincipalCollegeDetails] Admin user:", {
      uid: req.admin?.uid,
      id: req.admin?.id,
      college: req.admin?.college,
    });

    const adminUid = String(req.admin?.uid || req.admin?.id || "").trim();

    if (!adminUid) {
      console.log("[getPrincipalCollegeDetails] No admin UID found");
      return res.status(401).json({
        success: false,
        message: "Admin user not authenticated",
      });
    }

    // Fetch admin user — check users collection first, then admins collection
    let adminData = {};
    const adminUserDoc = await db
      .collection(USERS_COLLECTION)
      .doc(adminUid)
      .get();

    if (adminUserDoc.exists) {
      adminData = adminUserDoc.data() || {};
    } else {
      // Admin accounts live in the "admins" collection, not "users"
      const adminsDoc = await db.collection("admins").doc(adminUid).get();
      if (adminsDoc.exists) {
        adminData = adminsDoc.data() || {};
      } else {
        // Try by email as last resort
        const adminEmail = String(req.admin?.email || "")
          .trim()
          .toLowerCase();
        if (adminEmail) {
          const snap = await db
            .collection("admins")
            .where("email", "==", adminEmail)
            .limit(1)
            .get();
          if (!snap.empty) adminData = snap.docs[0].data() || {};
        }
      }
    }

    if (!Object.keys(adminData).length) {
      console.log(
        "[getPrincipalCollegeDetails] Admin user doc not found:",
        adminUid,
      );
      return res.status(404).json({
        success: false,
        message: "Admin user not found in database",
      });
    }
    const principalCollege = String(adminData.college || req.admin?.college || "").trim();

    console.log("[getPrincipalCollegeDetails] Admin data:", {
      college: principalCollege,
      role: adminData.role,
    });

    if (!principalCollege) {
      return res.status(400).json({
        success: false,
        message: "Admin college not found in user profile",
      });
    }

    const superadminDoc = await db
      .collection("superadmin")
      .doc(SUPERADMIN_DOC_ID)
      .get();

    if (!superadminDoc.exists) {
      console.log(
        "[getPrincipalCollegeDetails] Superadmin doc not found, returning basic data",
      );
      return res.status(200).json({
        success: true,
        data: {
          name: principalCollege,
          code: "",
          branches: [],
        },
      });
    }

    const data = superadminDoc.data() || {};
    const colleges = Array.isArray(data.colleges) ? data.colleges : [];

    const matchedCollege = colleges.find(
      (item) =>
        String(item?.name || "")
          .trim()
          .toLowerCase() === principalCollege.toLowerCase(),
    );

    console.log(
      "[getPrincipalCollegeDetails] Matched college:",
      matchedCollege,
    );

    const branches = Array.isArray(matchedCollege?.branches)
      ? matchedCollege.branches
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      : [];

    return res.status(200).json({
      success: true,
      data: {
        id: matchedCollege?.id,
        name: matchedCollege?.name || principalCollege,
        code: matchedCollege?.code || "",
        branches,
        assessmentStart: matchedCollege?.assessmentStart || null,
        assessmentEnd: matchedCollege?.assessmentEnd || null,
        evaluationEnd: matchedCollege?.evaluationEnd || null,
        appealEnd: matchedCollege?.appealEnd || null,
        appealReviewEnd: matchedCollege?.appealReviewEnd || null,
      },
    });
  } catch (error) {
    console.error("Get principal college details error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updatePrincipalCollegeBranches = async (req, res) => {
  try {
    let principalCollege = String(req.admin?.college || "").trim();

    // If college not in middleware, try fetching from users collection
    if (!principalCollege) {
      const adminUid = String(req.admin?.uid || req.admin?.id || "").trim();
      if (adminUid) {
        try {
          const adminUserDoc = await db
            .collection(USERS_COLLECTION)
            .doc(adminUid)
            .get();
          if (adminUserDoc.exists) {
            const adminData = adminUserDoc.data() || {};
            principalCollege = String(adminData.college || "").trim();
            console.log(
              "[updatePrincipalCollegeBranches] Fetched college from users collection:",
              principalCollege,
            );
          }
        } catch (err) {
          console.error(
            "[updatePrincipalCollegeBranches] Error fetching from users collection:",
            err,
          );
        }
      }
    }

    console.log(
      "[updatePrincipalCollegeBranches] Using college:",
      principalCollege,
    );

    if (!principalCollege) {
      return res.status(400).json({
        success: false,
        message: "Principal college not found in user profile",
      });
    }

    const nextBranchesInput = Array.isArray(req.body?.branches)
      ? req.body.branches
      : [];

    const normalizedBranches = Array.from(
      new Set(
        nextBranchesInput
          .map((item) => String(item || "").trim())
          .filter(Boolean),
      ),
    );

    const superadminRef = db.collection("superadmin").doc(SUPERADMIN_DOC_ID);
    const superadminDoc = await superadminRef.get();

    if (!superadminDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Superadmin settings not found",
      });
    }

    const data = superadminDoc.data() || {};
    const colleges = Array.isArray(data.colleges) ? data.colleges : [];

    console.log(
      "[updatePrincipalCollegeBranches] Available colleges:",
      colleges.map((c) => c?.name),
    );

    const collegeIndex = colleges.findIndex(
      (item) =>
        String(item?.name || "")
          .trim()
          .toLowerCase() === principalCollege.toLowerCase(),
    );

    if (collegeIndex === -1) {
      console.error(
        "[updatePrincipalCollegeBranches] College not found. Looking for:",
        principalCollege,
      );
      return res.status(404).json({
        success: false,
        message: "Principal college not found",
      });
    }

    const nextColleges = [...colleges];
    nextColleges[collegeIndex] = {
      ...nextColleges[collegeIndex],
      branches: normalizedBranches,
      updatedAt: new Date().toISOString(),
    };

    await superadminRef.set(
      {
        colleges: nextColleges,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return res.status(200).json({
      success: true,
      message: "Departments updated successfully",
      data: {
        college: nextColleges[collegeIndex].name,
        branches: normalizedBranches,
      },
    });
  } catch (error) {
    console.error("Update principal college branches error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const updateHod = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      password,
      pass,
      confirmPassword,
      confirm_pass,
      department,
      college,
      level,
      hasPhd,
      designation,
      dateOfJoining,
      experience,
    } = req.body;

    const hodRef = db.collection(USERS_COLLECTION).doc(id);
    const hodDoc = await hodRef.get();
    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();

    if (!hodDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "HOD not found",
      });
    }

    if (principalCollege) {
      const hodCollege = String(hodDoc.data()?.college || "")
        .trim()
        .toLowerCase();
      if (hodCollege !== principalCollege) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    const updateData = {};
    const currentData = hodDoc.data() || {};

    if (name) updateData.name = String(name).trim();
    if (email) updateData.email = String(email).trim().toLowerCase();
    if (department) updateData.department = String(department).trim();
    if (designation !== undefined) {
      updateData.designation = String(designation).trim();
    }
    if (college)
      updateData.college = String(req.admin?.college || college).trim();
    if (level !== undefined) {
      const normalizedLevel = Number(level);
      if (!Number.isFinite(normalizedLevel)) {
        return res.status(400).json({
          success: false,
          message: "Invalid level",
        });
      }
      updateData.level = normalizedLevel;
    }
    if (hasPhd !== undefined) updateData.hasPhd = Boolean(hasPhd);
    if (dateOfJoining !== undefined)
      updateData.dateOfJoining = String(dateOfJoining);
    if (experience !== undefined) updateData.experience = Number(experience);

    const resolvedPassword = String(password ?? pass ?? "");
    const resolvedConfirmPassword = String(
      confirmPassword ?? confirm_pass ?? "",
    );

    if (resolvedPassword) {
      if (resolvedPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      if (
        resolvedConfirmPassword &&
        resolvedPassword !== resolvedConfirmPassword
      ) {
        return res.status(400).json({
          success: false,
          message: "Password confirmation does not match",
        });
      }

      updateData.password = await bcrypt.hash(resolvedPassword, 10);
    }

    const nextName = String(updateData.name || currentData.name || "").trim();
    const nextEmail = String(updateData.email || currentData.email || "")
      .trim()
      .toLowerCase();
    const nextDepartment = String(
      updateData.department || currentData.department || "",
    ).trim();
    const nextDesignation = String(
      updateData.designation || currentData.designation || "",
    ).trim();
    const nextCollege = String(
      updateData.college || currentData.college || "",
    ).trim();
    const nextLevel = Number(
      updateData.level !== undefined ? updateData.level : currentData.level,
    );

    const authUpdatePayload = {};
    if (nextName) authUpdatePayload.displayName = nextName;
    if (nextEmail) authUpdatePayload.email = nextEmail;
    if (resolvedPassword) authUpdatePayload.password = resolvedPassword;

    if (Object.keys(authUpdatePayload).length > 0) {
      await auth.updateUser(id, authUpdatePayload);
    }

    await auth.setCustomUserClaims(id, {
      role: "hod",
      level: Number.isFinite(nextLevel) ? nextLevel : 0,
      college: nextCollege,
      department: nextDepartment,
      designation: nextDesignation,
      hod: true,
    });

    updateData.role = "hod";
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await hodRef.set(updateData, { merge: true });

    return res.status(200).json({
      success: true,
      message: "HOD updated successfully",
    });
  } catch (error) {
    console.error("Update HOD error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
export const updateDean = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      password,
      pass,
      confirmPassword,
      confirm_pass,
      department,
      college,
      role,
      level,
      hasPhd,
      designation,
      dateOfJoining,
      experience,
    } = req.body;

    const deanRef = db.collection(USERS_COLLECTION).doc(id);
    const deanDoc = await deanRef.get();
    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();

    if (!deanDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Dean not found",
      });
    }

    if (principalCollege) {
      const deanCollege = String(deanDoc.data()?.college || "")
        .trim()
        .toLowerCase();
      if (deanCollege !== principalCollege) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    const updateData = {};
    const currentData = deanDoc.data() || {};

    if (name) updateData.name = String(name).trim();
    if (email) updateData.email = String(email).trim().toLowerCase();
    if (department !== undefined)
      updateData.department = String(department || "").trim();
    const normalizedDesignation =
      designation !== undefined ? String(designation).trim() : undefined;
    if (college) {
      updateData.college = String(req.admin?.college || college).trim();
    }
    if (role !== undefined) {
      const normalizedRole = normalizeDeanRole(role);
      if (!normalizedRole || !isDeanRole(normalizedRole)) {
        return res.status(400).json({
          success: false,
          message: "Role must include Dean",
        });
      }
      updateData.role = normalizedRole;
    }
    if (normalizedDesignation !== undefined) {
      updateData.designation = normalizedDesignation;
    }
    if (level !== undefined) {
      const normalizedLevel = Number(level);
      if (!Number.isFinite(normalizedLevel)) {
        return res.status(400).json({
          success: false,
          message: "Invalid level",
        });
      }
      updateData.level = normalizedLevel;
    }
    if (hasPhd !== undefined) updateData.hasPhd = Boolean(hasPhd);
    if (dateOfJoining !== undefined)
      updateData.dateOfJoining = String(dateOfJoining);
    if (experience !== undefined) updateData.experience = Number(experience);

    const resolvedPassword = String(password ?? pass ?? "");
    const resolvedConfirmPassword = String(
      confirmPassword ?? confirm_pass ?? "",
    );

    if (resolvedPassword) {
      if (resolvedPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }

      if (
        resolvedConfirmPassword &&
        resolvedPassword !== resolvedConfirmPassword
      ) {
        return res.status(400).json({
          success: false,
          message: "Password confirmation does not match",
        });
      }

      updateData.password = await bcrypt.hash(resolvedPassword, 10);
    }

    const nextName = String(updateData.name || currentData.name || "").trim();
    const nextEmail = String(updateData.email || currentData.email || "")
      .trim()
      .toLowerCase();
    const nextDepartment = String(
      updateData.department !== undefined
        ? updateData.department
        : currentData.department || "",
    ).trim();
    const nextCollege = String(
      updateData.college || currentData.college || "",
    ).trim();
    const nextRole = String(updateData.role || currentData.role || "").trim();
    const nextLevel = Number(
      updateData.level !== undefined ? updateData.level : currentData.level,
    );

    const authUpdatePayload = {};
    if (nextName) authUpdatePayload.displayName = nextName;
    if (nextEmail) authUpdatePayload.email = nextEmail;
    if (resolvedPassword) authUpdatePayload.password = resolvedPassword;

    try {
      if (Object.keys(authUpdatePayload).length > 0) {
        await auth.updateUser(id, authUpdatePayload);
      }

      await auth.setCustomUserClaims(id, {
        role: nextRole,
        level: Number.isFinite(nextLevel) ? nextLevel : 0,
        college: nextCollege,
        department: nextDepartment,
        designation: normalizedDesignation ?? currentData.designation ?? "",
        dean: true,
      });
    } catch (authError) {
      if (authError?.code === "auth/user-not-found") {
        // Orphaned Firestore doc — recreate the Firebase Auth account
        const newRecord = await auth.createUser({
          uid: id,
          email: nextEmail,
          displayName: nextName,
          ...(resolvedPassword ? { password: resolvedPassword } : {}),
        });
        await auth.setCustomUserClaims(newRecord.uid, {
          role: nextRole,
          level: Number.isFinite(nextLevel) ? nextLevel : 0,
          college: nextCollege,
          department: nextDepartment,
          designation: normalizedDesignation ?? currentData.designation ?? "",
          dean: true,
        });
      } else {
        throw authError;
      }
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await deanRef.set(updateData, { merge: true });

    return res.status(200).json({
      success: true,
      message: "Dean updated successfully",
    });
  } catch (error) {
    console.error("Update Dean error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Server error",
    });
  }
};

export const deleteHod = async (req, res) => {
  try {
    const { id } = req.params;
    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();

    const hodRef = db.collection(USERS_COLLECTION).doc(id);
    const hodDoc = await hodRef.get();

    if (!hodDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "HOD not found",
      });
    }

    if (principalCollege) {
      const hodCollege = String(hodDoc.data()?.college || "")
        .trim()
        .toLowerCase();
      if (hodCollege !== principalCollege) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    try {
      await auth.deleteUser(id);
    } catch (authError) {
      if (authError?.code !== "auth/user-not-found") {
        throw authError;
      }
    }

    await hodRef.delete();

    return res.status(200).json({
      success: true,
      message: "HOD deleted successfully",
    });
  } catch (error) {
    console.error("Delete HOD error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const deleteDean = async (req, res) => {
  try {
    const { id } = req.params;
    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();

    const deanRef = db.collection(USERS_COLLECTION).doc(id);
    const deanDoc = await deanRef.get();

    if (!deanDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "dean not found",
      });
    }

    if (principalCollege) {
      const deanCollege = String(deanDoc.data()?.college || "")
        .trim()
        .toLowerCase();
      if (deanCollege !== principalCollege) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
    }

    try {
      await auth.deleteUser(id);
    } catch (authError) {
      if (authError?.code !== "auth/user-not-found") {
        throw authError;
      }
    }

    await deanRef.delete();

    return res.status(200).json({
      success: true,
      message: "dean deleted successfully",
    });
  } catch (error) {
    console.error("Delete dean error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const normDesigAdmin = (s) =>
  String(s || "")
    .trim()
    .toLowerCase();

export const getCollegeDashboard = async (req, res) => {
  try {
    const adminUid = String(req.admin?.uid || req.admin?.id || "").trim();
    const adminDoc = await db.collection("users").doc(adminUid).get();

    const adminData = adminDoc.exists ? adminDoc.data() : {};

    // Resolve college with multiple fallbacks
    let college = String(adminData?.college || req.admin?.college || "").trim();

    if (!college) {
      // Try admins collection by UID
      const adminsDoc = await db.collection("admins").doc(adminUid).get();
      if (adminsDoc.exists) college = String(adminsDoc.data()?.college || "").trim();
    }
    if (!college && req.admin?.email) {
      // Try admins collection by email
      const snap = await db.collection("admins")
        .where("email", "==", String(req.admin.email).trim().toLowerCase())
        .limit(1).get();
      if (!snap.empty) college = String(snap.docs[0].data()?.college || "").trim();
    }

    if (!college) {
      return res.status(400).json({ success: false, message: "College not found for this account. Please contact your administrator." });
    }

    /* -------- FETCH SUBMISSIONS -------- */
    const submissionsSnap = await db.collection("submissions").get();

    const allSubmissions = submissionsSnap.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    const submissionsMap = new Map();
    allSubmissions.forEach((sub) => {
      if (!submissionsMap.has(sub.userId)) {
        submissionsMap.set(sub.userId, []);
      }
      submissionsMap.get(sub.userId).push(sub);
    });

    /* -------- BUILD DESIGNATION TARGET MAP FOR COLLEGE -------- */
    const saDoc = await db
      .collection("superadmin")
      .doc(SUPERADMIN_DOC_ID)
      .get();
    const saColleges = saDoc.exists ? saDoc.data()?.colleges || [] : [];
    const collegeDef = saColleges.find(
      (c) =>
        String(c?.name || "")
          .trim()
          .toLowerCase() === (college || "").toLowerCase(),
    );
    const designationTargetMap = {};
    (collegeDef?.designations || []).forEach((d) => {
      if (d?.name) {
        // PhD-aware key: prefer lookup by name+phd combo
        const phdKey = `${normDesigAdmin(d.name)}__${d.phd ? "phd" : "nophd"}`;
        designationTargetMap[phdKey] = d.target || "";
        // Fallback name-only key for data that may lack hasPhd field
        if (!designationTargetMap[normDesigAdmin(d.name)]) {
          designationTargetMap[normDesigAdmin(d.name)] = d.target || "";
        }
      }
    });

    /* -------- FETCH STAFF OF SAME COLLEGE -------- */
    const staffSnap = await db
      .collection("users")
      .where("college", "==", college)
      .get();

    const staff = staffSnap.docs.map((doc) => {
      const data = doc.data();
      const phdKey = `${normDesigAdmin(data.designation || "")}__${data.hasPhd ? "phd" : "nophd"}`;
      return {
        ...data,
        id: doc.id,
        designationTarget:
          designationTargetMap[phdKey] ||
          designationTargetMap[normDesigAdmin(data.designation || "")] ||
          "",
        submissions: submissionsMap.get(data.uid) || [],
      };
    });

    return res.json({
      success: true,
      data: { staff },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getCollegeDesignations = async (req, res) => {
  try {
    const role = String(req.admin?.role || "").toLowerCase();
    // Use principal/admin access instead of HOD
    let college = String(req.admin?.college || "").trim();

    // If college not in middleware, try fetching from users collection
    if (!college) {
      const userId = String(req.admin?.uid || req.admin?.id || "").trim();
      if (userId) {
        try {
          const userDoc = await db
            .collection(USERS_COLLECTION)
            .doc(userId)
            .get();
          if (userDoc.exists) {
            const userData = userDoc.data() || {};
            college = String(userData.college || "").trim();
            console.log(
              "[getCollegeDesignations] Fetched college from users collection:",
              college,
            );
          }
        } catch (err) {
          console.error(
            "[getCollegeDesignations] Error fetching from users collection:",
            err,
          );
        }
      }
    }

    console.log("[getCollegeDesignations] START - College:", college);

    const superadminDoc = await db
      .collection("superadmin")
      .doc(SUPERADMIN_DOC_ID)
      .get();

    if (!superadminDoc.exists) {
      console.log("[getCollegeDesignations] Superadmin doc does not exist");
      return res.status(200).json({
        success: true,
        data: { college, designations: [] },
      });
    }

    const superadminData = superadminDoc.data();
    const colleges = superadminData?.colleges || [];

    if (role === "committee") {
      const result = colleges.map((c) => ({
        college: c.name,
        designations: Array.isArray(c.designations)
          ? c.designations.filter((d) => d && d.name && String(d.name).trim())
          : [],
      }));

      return res.status(200).json({
        success: true,
        data: result,
      });
    }

    // ✅ THEN: handle other roles
    if (!college) {
      return res.status(200).json({
        success: true,
        data: { college: "", designations: [] },
      });
    }

    const matchedCollege = colleges.find(
      (c) =>
        String(c?.name || "")
          .trim()
          .toLowerCase() === college.toLowerCase(),
    );

    if (matchedCollege) {
      const designations = Array.isArray(matchedCollege.designations)
        ? matchedCollege.designations.filter(
            (d) => d && d.name && String(d.name).trim(),
          )
        : [];
      console.log(
        "[getCollegeDesignations] SUCCESS - Found",
        designations.length,
        "designations:",
        designations,
      );
      return res.status(200).json({
        success: true,
        data: { college, designations },
      });
    } else {
      console.log(
        "[getCollegeDesignations] No matching college found for:",
        college,
      );
      return res.status(200).json({
        success: true,
        data: { college, designations: [] },
      });
    }
  } catch (error) {
    console.error("[getCollegeDesignations] ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCollegeFacultyForReview = async (req, res) => {
  try {
    const principalCollege = String(req.admin?.college || "")
      .trim()
      .toLowerCase();

    if (!principalCollege) {
      return res.status(400).json({
        success: false,
        message: "Principal college not found",
      });
    }

    const snapshot = await db.collection(USERS_COLLECTION).get();

    const EXCLUDED_ROLES = new Set([
      "principal", "principle", "admin",
      "vice principal", "vice principle", "viceprincipal",
      "internal committee", "internal commitee",
      "committee", "commitee",
      "superadmin",
    ]);

    const faculty = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => {
        const role = String(item.role || "").trim().toLowerCase();
        if (EXCLUDED_ROLES.has(role)) return false;
        const itemCollege = String(item.college || "").trim().toLowerCase();
        return itemCollege === principalCollege;
      })
      .map((item) => ({
        id: item.id,
        uid: item.uid || item.id,
        name: item.name || "",
        email: item.email || "",
        department: item.department || "",
        designation: item.designation || "",
        role: item.role || "",
        college: item.college || "",
      }));

    return res.status(200).json({ success: true, data: faculty });
  } catch (error) {
    console.error("Get college faculty error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateCollegeDesignations = async (req, res) => {
  try {
    // Use principal/admin access instead of HOD
    let college = String(req.admin?.college || "").trim();

    // If college not in middleware, try fetching from users collection
    if (!college) {
      const userId = String(req.admin?.uid || req.admin?.id || "").trim();
      if (userId) {
        try {
          const userDoc = await db
            .collection(USERS_COLLECTION)
            .doc(userId)
            .get();
          if (userDoc.exists) {
            const userData = userDoc.data() || {};
            college = String(userData.college || "").trim();
            console.log(
              "[updateCollegeDesignations] Fetched college from users collection:",
              college,
            );
          }
        } catch (err) {
          console.error(
            "[updateCollegeDesignations] Error fetching from users collection:",
            err,
          );
        }
      }
    }

    console.log("[updateCollegeDesignations] Using college:", college);

    if (!college) {
      return res.status(400).json({
        success: false,
        message: "Admin college not found in user profile",
      });
    }

    // Normalize designations with target and phd flag
    const nextDesignations = (req.body?.designations || []).map((d) => ({
      name: String(d.name || "").trim(),
      target: String(d.target || "").trim(),
      phd: Boolean(d.phd),
    }));

    const superadminRef = db.collection("superadmin").doc(SUPERADMIN_DOC_ID);
    const superadminDoc = await superadminRef.get();

    if (!superadminDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Superadmin settings not found",
      });
    }

    const data = superadminDoc.data() || {};
    const colleges = Array.isArray(data.colleges) ? data.colleges : [];

    const collegeIndex = colleges.findIndex(
      (item) =>
        String(item?.name || "")
          .trim()
          .toLowerCase() === college.toLowerCase(),
    );

    if (collegeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Admin college not found",
      });
    }

    const nextColleges = [...colleges];
    nextColleges[collegeIndex] = {
      ...nextColleges[collegeIndex],
      designations: nextDesignations,
      updatedAt: new Date().toISOString(),
    };

    await superadminRef.set(
      {
        colleges: nextColleges,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return res.status(200).json({
      success: true,
      message: "Designations updated successfully",
      data: {
        college: nextColleges[collegeIndex].name,
        designations: nextDesignations,
      },
    });
  } catch (error) {
    console.error("[updateCollegeDesignations] ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const exportPrincipalReport = async (req, res) => {
  try {
    const principalCollege = String(req.admin?.college || "").trim();
    if (!principalCollege) {
      return res.status(400).json({ success: false, message: "Principal college not found" });
    }

    const [usersSnap, subsSnap] = await Promise.all([
      db.collection(USERS_COLLECTION).where("college", "==", principalCollege).get(),
      db.collection("submissions").where("college", "==", principalCollege).get(),
    ]);

    // Excluded system roles
    const excludedRoles = new Set(["committee", "viewer", "superadmin", "principal", "principle", "viceprincipal", "vice principal", "vice-principal", "director"]);

    // uid → submissions[]
    const subsByUser = {};
    subsSnap.docs.forEach((doc) => {
      const sub = { id: doc.id, ...doc.data() };
      if (!subsByUser[sub.userId]) subsByUser[sub.userId] = [];
      subsByUser[sub.userId].push(sub);
    });

    // Build staff list
    const staff = usersSnap.docs
      .map((doc) => {
        const d = doc.data();
        const role = String(d.role || "").trim().toLowerCase();
        if (excludedRoles.has(role)) return null;
        return {
          uid: d.uid || doc.id,
          name: d.name || d.email || doc.id,
          role,
          department: String(d.department || "").trim(),
          subs: (subsByUser[d.uid || doc.id] || []).sort((a, b) => {
            const cn = String(a.criteriaName || "").localeCompare(String(b.criteriaName || ""));
            if (cn !== 0) return cn;
            const mn = String(a.moduleName || "").localeCompare(String(b.moduleName || ""));
            if (mn !== 0) return mn;
            return String(a.taskName || "").localeCompare(String(b.taskName || ""));
          }),
        };
      })
      .filter(Boolean);

    const isDean = (role) => String(role || "").toLowerCase().includes("dean");

    // Group: deans → own sheet, rest → by department
    const deans = staff.filter((s) => isDean(s.role));
    const byDept = {};
    staff.filter((s) => !isDean(s.role) && s.department).forEach((s) => {
      if (!byDept[s.department]) byDept[s.department] = [];
      byDept[s.department].push(s);
    });

    return res.json({
      success: true,
      data: { deans, byDept },
    });
  } catch (err) {
    console.error("[exportPrincipalReport]", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updatePrincipalCollegeDeadlines = async (req, res) => {
  try {
    const principalCollege = String(req.admin?.college || "").trim();
    if (!principalCollege) {
      return res.status(400).json({ success: false, message: "Principal college not found. Please login again." });
    }

    const { assessmentStart, assessmentEnd, evaluationEnd, appealEnd, appealReviewEnd } = req.body;

    const docRef = db.collection("superadmin").doc(SUPERADMIN_DOC_ID);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ success: false, message: "Configuration not found" });
    }

    const colleges = Array.isArray(docSnap.data()?.colleges) ? docSnap.data().colleges : [];
    const index = colleges.findIndex(
      (c) => String(c?.name || "").trim().toLowerCase() === principalCollege.toLowerCase(),
    );

    if (index === -1) {
      return res.status(404).json({ success: false, message: "College not found in configuration" });
    }

    const toISO = (val) => (val ? new Date(val).toISOString() : null);

    const updates = {};
    if (assessmentStart !== undefined) updates.assessmentStart = toISO(assessmentStart);
    if (assessmentEnd !== undefined) updates.assessmentEnd = toISO(assessmentEnd);
    if (evaluationEnd !== undefined) updates.evaluationEnd = toISO(evaluationEnd);
    if (appealEnd !== undefined) updates.appealEnd = toISO(appealEnd);
    if (appealReviewEnd !== undefined) updates.appealReviewEnd = toISO(appealReviewEnd);

    const nextColleges = [...colleges];
    nextColleges[index] = { ...nextColleges[index], ...updates, updatedAt: new Date().toISOString() };

    await docRef.set({ colleges: nextColleges, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    invalidateSuperadminCache();

    return res.status(200).json({ success: true, message: "Deadlines updated successfully" });
  } catch (error) {
    console.error("updatePrincipalCollegeDeadlines error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
