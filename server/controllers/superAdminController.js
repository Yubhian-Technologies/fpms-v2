import admin from "firebase-admin";
import { auth, db } from "../config/firebase.js";
import { invalidateSuperadminCache } from "../config/superadminCache.js";

const SUPERADMIN_DOC_ID = process.env.SUPERADMIN_DOC_ID || "root";

const superadminDocRef = () =>
  db.collection("superadmin").doc(SUPERADMIN_DOC_ID);
const usersCollectionRef = () => db.collection("users");

const generateId = (prefix) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const ensureSuperadminDoc = async () => {
  const docRef = superadminDocRef();
  const doc = await docRef.get();

  if (!doc.exists) {
    await docRef.set({
      roles: [],
      colleges: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return docRef;
};

export const getSuperadminData = async () => {
  const docRef = await ensureSuperadminDoc();
  const doc = await docRef.get();
  const data = doc.data() || {};

  return {
    docRef,
    data,
    roles: Array.isArray(data.roles) ? data.roles : [],
    colleges: Array.isArray(data.colleges) ? data.colleges : [],
  };
};

const getCommitteeUserDoc = async () => {
  let snapshot = await usersCollectionRef()
    .where("committeeMember", "==", true)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    return snapshot.docs[0];
  }

  snapshot = await usersCollectionRef()
    .where("role", "==", "committee")
    .limit(1)
    .get();

  if (!snapshot.empty) {
    return snapshot.docs[0];
  }

  return null;
};

const toStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
};

const normalizeCollegeName = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const findUsersByCollege = async (college) => {
  const candidates = new Set(
    [college?.name, college?.code, college?.id]
      .map((value) => normalizeCollegeName(value))
      .filter(Boolean),
  );

  if (!candidates.size) return [];

  // Read all users once and match against known college identifiers.
  const allUsersSnapshot = await usersCollectionRef().get();
  return allUsersSnapshot.docs.filter((doc) => {
    const data = doc.data() || {};

    const userCollegeValues = [
      data.college,
      data.collegeName,
      data.collegeCode,
      data.collegeId,
    ]
      .map((value) => normalizeCollegeName(value))
      .filter(Boolean);

    return userCollegeValues.some((value) => candidates.has(value));
  });
};

const formsCollectionRef = () => db.collection("fpmsForms");
const criteriaCollectionRef = (formId) =>
  formsCollectionRef().doc(formId).collection("criteria");
const modulesCollectionRef = (formId) =>
  formsCollectionRef().doc(formId).collection("modules");
const tasksCollectionRef = (formId) =>
  formsCollectionRef().doc(formId).collection("tasks");

const MAX_BATCH_OPERATIONS = 400;

const applyBatchOps = async (operations) => {
  if (!operations.length) return;

  for (
    let start = 0;
    start < operations.length;
    start += MAX_BATCH_OPERATIONS
  ) {
    const chunk = operations.slice(start, start + MAX_BATCH_OPERATIONS);
    const batch = db.batch();

    chunk.forEach((operation) => {
      if (operation.type === "delete") {
        batch.delete(operation.ref);
      } else {
        batch.set(operation.ref, operation.data, operation.options || {});
      }
    });

    await batch.commit();
  }
};

const clearSubcollection = async (collectionRef) => {
  const snapshot = await collectionRef.get();
  if (snapshot.empty) return;

  const deleteOps = snapshot.docs.map((doc) => ({
    type: "delete",
    ref: doc.ref,
  }));

  await applyBatchOps(deleteOps);
};

const normalizeMarks = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const normalizeFormPayload = (payload) => {
  const criteriaInput = Array.isArray(payload?.criteria)
    ? payload.criteria
    : [];

  const criteria = criteriaInput.map((criteriaItem, criteriaIndex) => {
    const criteriaId = String(criteriaItem?.id || generateId("criteria"));
    const criteriaName = String(criteriaItem?.criteriaName || "").trim();

    const moduleInput = Array.isArray(criteriaItem?.modules)
      ? criteriaItem.modules
      : [];
    const modules = moduleInput.map((moduleItem, moduleIndex) => {
      const moduleId = String(moduleItem?.id || generateId("module"));
      const moduleNumber = Number.isFinite(Number(moduleItem?.moduleNumber))
        ? Number(moduleItem.moduleNumber)
        : moduleIndex + 1;
      const moduleName = String(moduleItem?.moduleName || "").trim();

      const taskInput = Array.isArray(moduleItem?.tasks)
        ? moduleItem.tasks
        : [];
      const tasks = taskInput.map((taskItem, taskIndex) => ({
        id: String(taskItem?.id || generateId("task")),
        criteriaId,
        moduleId,
        order: taskIndex + 1,
        title: String(taskItem?.title || "").trim(),
        subtitle: String(taskItem?.subtitle || "").trim(),
        description: String(taskItem?.description || "").trim(),
        assessmentCriteria: String(taskItem?.assessmentCriteria || "").trim(),
        evidence: String(taskItem?.evidence || "").trim(),
        reference: String(taskItem?.reference || "").trim(),
        marks: normalizeMarks(taskItem?.marks),
        marksType: String(taskItem?.marksType || "fixed"),
        minMarks: normalizeMarks(taskItem?.minMarks),
        note: String(taskItem?.note || "").trim(),
      }));

      const totalMarks = tasks.reduce((sum, task) => sum + task.marks, 0);

      return {
        id: moduleId,
        criteriaId,
        moduleNumber,
        moduleName,
        order: moduleIndex + 1,
        totalMarks,
        tasks,
      };
    });

    const totalMarks = modules.reduce(
      (sum, moduleItem) => sum + moduleItem.totalMarks,
      0,
    );

    return {
      id: criteriaId,
      criteriaName,
      order: criteriaIndex + 1,
      totalMarks,
      modules,
    };
  });

  const totalMarks = criteria.reduce(
    (sum, criteriaItem) => sum + criteriaItem.totalMarks,
    0,
  );
  const moduleCount = criteria.reduce(
    (sum, criteriaItem) => sum + criteriaItem.modules.length,
    0,
  );
  const taskCount = criteria.reduce(
    (sum, criteriaItem) =>
      sum +
      criteriaItem.modules.reduce(
        (inner, moduleItem) => inner + moduleItem.tasks.length,
        0,
      ),
    0,
  );

  return {
    formTitle: String(payload?.formTitle || "").trim(),
    applicableRoles: toStringArray(payload?.applicableRoles),
    criteria,
    totalMarks,
    criteriaCount: criteria.length,
    moduleCount,
    taskCount,
  };
};

const composeFormResponse = (formDoc, criteriaDocs, moduleDocs, taskDocs) => {
  const formData = formDoc.data() || {};

  const taskByModule = taskDocs.reduce((acc, taskDoc) => {
    const task = taskDoc.data();
    const moduleId = String(task.moduleId || "");
    if (!acc[moduleId]) acc[moduleId] = [];
    acc[moduleId].push({
      id: taskDoc.id,
      title: task.title || "",
      subtitle: task.subtitle || "",
      description: task.description || "",
      assessmentCriteria: task.assessmentCriteria || "",
      evidence: task.evidence || "",
      reference: task.reference || "",
      marks: normalizeMarks(task.marks),
      marksType: task.marksType || "fixed",
      minMarks: normalizeMarks(task.minMarks),
      note: task.note || "",
      order: Number(task.order || 0),
    });
    return acc;
  }, {});

  Object.values(taskByModule).forEach((tasks) =>
    tasks.sort((a, b) => a.order - b.order),
  );

  const modulesByCriteria = moduleDocs.reduce((acc, moduleDoc) => {
    const moduleData = moduleDoc.data();
    const criteriaId = String(moduleData.criteriaId || "");
    if (!acc[criteriaId]) acc[criteriaId] = [];

    const tasks = (taskByModule[moduleDoc.id] || []).map((task) => ({
      id: task.id,
      title: task.title,
      subtitle: task.subtitle,
      description: task.description,
      assessmentCriteria: task.assessmentCriteria,
      evidence: task.evidence,
      reference: task.reference,
      marks: task.marks,
      marksType: task.marksType || "fixed",
      minMarks: task.minMarks,
      note: task.note || "",
    }));

    acc[criteriaId].push({
      id: moduleDoc.id,
      moduleNumber: Number(moduleData.moduleNumber || 0),
      moduleName: moduleData.moduleName || "",
      totalMarks: Number(moduleData.totalMarks || 0),
      order: Number(moduleData.order || 0),
      tasks,
    });

    return acc;
  }, {});

  Object.values(modulesByCriteria).forEach((modules) =>
    modules.sort((a, b) => a.order - b.order),
  );

  const criteria = criteriaDocs
    .map((criteriaDoc) => {
      const criteriaData = criteriaDoc.data();
      return {
        id: criteriaDoc.id,
        criteriaName: criteriaData.criteriaName || "",
        totalMarks: Number(criteriaData.totalMarks || 0),
        order: Number(criteriaData.order || 0),
        modules: modulesByCriteria[criteriaDoc.id] || [],
      };
    })
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...rest }) => rest);

  return {
    id: formDoc.id,
    formTitle: formData.formTitle || "",
    applicableRoles: toStringArray(formData.applicableRoles),
    totalMarks: Number(formData.totalMarks || 0),
    status: formData.status || "draft",
    version: Number(formData.version || 1),
    criteria,
    createdAt: formData.createdAt || null,
    updatedAt: formData.updatedAt || null,
  };
};

const saveFormHierarchy = async (formId, payload, superadminUid) => {
  const normalized = normalizeFormPayload(payload);

  if (!normalized.formTitle) {
    return { error: "Form title is required", status: 400 };
  }

  if (normalized.applicableRoles.length === 0) {
    return { error: "At least one applicable role is required", status: 400 };
  }

  const formRef = formsCollectionRef().doc(formId);
  const existing = await formRef.get();

  await formRef.set(
    {
      formTitle: normalized.formTitle,
      applicableRoles: normalized.applicableRoles,
      totalMarks: normalized.totalMarks,
      criteriaCount: normalized.criteriaCount,
      moduleCount: normalized.moduleCount,
      taskCount: normalized.taskCount,
      status: payload?.status || "draft",
      version: existing.exists ? Number(existing.data()?.version || 1) + 1 : 1,
      createdBy: existing.exists
        ? existing.data()?.createdBy || superadminUid
        : superadminUid,
      createdAt: existing.exists
        ? existing.data()?.createdAt ||
          admin.firestore.FieldValue.serverTimestamp()
        : admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await Promise.all([
    clearSubcollection(criteriaCollectionRef(formId)),
    clearSubcollection(modulesCollectionRef(formId)),
    clearSubcollection(tasksCollectionRef(formId)),
  ]);

  const writes = [];

  normalized.criteria.forEach((criteriaItem) => {
    writes.push({
      type: "set",
      ref: criteriaCollectionRef(formId).doc(criteriaItem.id),
      data: {
        criteriaName: criteriaItem.criteriaName,
        totalMarks: criteriaItem.totalMarks,
        order: criteriaItem.order,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });

    criteriaItem.modules.forEach((moduleItem) => {
      writes.push({
        type: "set",
        ref: modulesCollectionRef(formId).doc(moduleItem.id),
        data: {
          criteriaId: criteriaItem.id,
          moduleNumber: moduleItem.moduleNumber,
          moduleName: moduleItem.moduleName,
          totalMarks: moduleItem.totalMarks,
          taskCount: moduleItem.tasks.length,
          order: moduleItem.order,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      });

      moduleItem.tasks.forEach((taskItem) => {
        writes.push({
          type: "set",
          ref: tasksCollectionRef(formId).doc(taskItem.id),
          data: {
            criteriaId: criteriaItem.id,
            moduleId: moduleItem.id,
            order: taskItem.order,
            title: taskItem.title,
            subtitle: taskItem.subtitle,
            description: taskItem.description,
            assessmentCriteria: taskItem.assessmentCriteria,
            evidence: taskItem.evidence,
            reference: taskItem.reference,
            marks: taskItem.marks,
            marksType: taskItem.marksType || "fixed",
            minMarks: taskItem.minMarks || 0,
            note: taskItem.note || "",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
      });
    });
  });

  await applyBatchOps(writes);

  return { formRef, normalized };
};

export const getRoles = async (req, res) => {
  try {
    const { roles } = await getSuperadminData();

    const sortedRoles = roles.sort(
      (a, b) => Number(a.level || 0) - Number(b.level || 0),
    );

    return res.status(200).json({ success: true, data: sortedRoles });
  } catch (error) {
    console.error("Get roles error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createRole = async (req, res) => {
  try {
    const { name, level } = req.body;

    if (!name || level === undefined) {
      return res.status(400).json({
        success: false,
        message: "Role name and level are required",
      });
    }

    const { docRef, roles } = await getSuperadminData();

    const roleData = {
      id: generateId("role"),
      name: String(name).trim(),
      level: Number(level),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(
      {
        roles: [...roles, roleData],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    invalidateSuperadminCache();

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: roleData,
    });
  } catch (error) {
    console.error("Create role error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, level } = req.body;

    const { docRef, roles } = await getSuperadminData();
    const index = roles.findIndex((item) => item.id === id);

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Role not found" });
    }

    const updates = {};

    if (name !== undefined) updates.name = String(name).trim();
    if (level !== undefined) updates.level = Number(level);

    const nextRoles = [...roles];
    nextRoles[index] = {
      ...nextRoles[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(
      {
        roles: nextRoles,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    invalidateSuperadminCache();

    return res
      .status(200)
      .json({ success: true, message: "Role updated successfully" });
  } catch (error) {
    console.error("Update role error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;

    const { docRef, roles } = await getSuperadminData();
    const exists = roles.some((item) => item.id === id);

    if (!exists) {
      return res
        .status(404)
        .json({ success: false, message: "Role not found" });
    }

    await docRef.set(
      {
        roles: roles.filter((item) => item.id !== id),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    invalidateSuperadminCache();

    return res
      .status(200)
      .json({ success: true, message: "Role deleted successfully" });
  } catch (error) {
    console.error("Delete role error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getColleges = async (req, res) => {
  try {
    const { colleges } = await getSuperadminData();

    const sortedColleges = colleges.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );

    return res.status(200).json({ success: true, data: sortedColleges });
  } catch (error) {
    console.error("Get colleges error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createCollege = async (req, res) => {
  try {
    const {
      name,
      location,
      code,
      isActive = true,
      branches = [],
      deadline,
      assessmentStart,
      assessmentEnd,
      evaluationEnd,
      appealEnd,
      appealReviewEnd,
    } = req.body;

    if (!name || !location || !code) {
      return res.status(400).json({
        success: false,
        message: "Name, location, and code are required",
      });
    }

    const { docRef, colleges } = await getSuperadminData();

    const collegeData = {
      id: generateId("college"),
      name: String(name).trim(),
      location: String(location).trim(),
      code: String(code).trim().toUpperCase(),
      isActive: Boolean(isActive),
      branches: toStringArray(branches),
      deadline: deadline ? new Date(deadline).toISOString() : null,
      assessmentStart: assessmentStart ? new Date(assessmentStart).toISOString() : null,
      assessmentEnd: assessmentEnd ? new Date(assessmentEnd).toISOString() : null,
      evaluationEnd: evaluationEnd ? new Date(evaluationEnd).toISOString() : null,
      appealEnd: appealEnd ? new Date(appealEnd).toISOString() : null,
      appealReviewEnd: appealReviewEnd ? new Date(appealReviewEnd).toISOString() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(
      {
        colleges: [...colleges, collegeData],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    invalidateSuperadminCache();

    return res.status(201).json({
      success: true,
      message: "College created successfully",
      data: collegeData,
    });
  } catch (error) {
    console.error("Create college error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateCollege = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location, code, isActive, branches, deadline, assessmentStart, assessmentEnd, evaluationEnd, appealEnd, appealReviewEnd } = req.body;

    const { docRef, colleges } = await getSuperadminData();
    const index = colleges.findIndex((item) => item.id === id);

    if (index === -1) {
      return res
        .status(404)
        .json({ success: false, message: "College not found" });
    }

    const updates = {};

    if (name !== undefined) updates.name = String(name).trim();
    if (location !== undefined) updates.location = String(location).trim();
    if (code !== undefined) updates.code = String(code).trim().toUpperCase();
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (branches !== undefined) updates.branches = toStringArray(branches);
    if (deadline !== undefined)
      updates.deadline = deadline ? new Date(deadline).toISOString() : null;
    if (assessmentStart !== undefined)
      updates.assessmentStart = assessmentStart ? new Date(assessmentStart).toISOString() : null;
    if (assessmentEnd !== undefined)
      updates.assessmentEnd = assessmentEnd ? new Date(assessmentEnd).toISOString() : null;
    if (evaluationEnd !== undefined)
      updates.evaluationEnd = evaluationEnd ? new Date(evaluationEnd).toISOString() : null;
    if (appealEnd !== undefined)
      updates.appealEnd = appealEnd ? new Date(appealEnd).toISOString() : null;
    if (appealReviewEnd !== undefined)
      updates.appealReviewEnd = appealReviewEnd ? new Date(appealReviewEnd).toISOString() : null;

    const oldName = colleges[index].name;
    const newName = updates.name;
    const nameChanged = newName && newName !== oldName;

    const nextColleges = [...colleges];
    nextColleges[index] = {
      ...nextColleges[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await docRef.set(
      {
        colleges: nextColleges,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // When name changes, migrate all users and submissions to the new name
    if (nameChanged) {
      const CHUNK = 400;
      const migrate = async (collection) => {
        const snap = await db.collection(collection)
          .where("college", "==", oldName)
          .get();
        for (let i = 0; i < snap.docs.length; i += CHUNK) {
          const batch = db.batch();
          snap.docs.slice(i, i + CHUNK).forEach((doc) => batch.update(doc.ref, { college: newName }));
          await batch.commit();
        }
      };
      await Promise.all([migrate("users"), migrate("submissions")]);
    }

    invalidateSuperadminCache();

    return res
      .status(200)
      .json({ success: true, message: "College updated successfully" });
  } catch (error) {
    console.error("Update college error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteCollege = async (req, res) => {
  try {
    const { id } = req.params;

    const { docRef, colleges } = await getSuperadminData();
    const targetCollege = colleges.find((item) => item.id === id);

    if (!targetCollege) {
      return res
        .status(404)
        .json({ success: false, message: "College not found" });
    }

    const collegeName = String(targetCollege.name || "").trim();

    const matchedUserDocs = await findUsersByCollege(targetCollege);
    let deletedAuthCount = 0;
    let authUserNotFoundCount = 0;
    let missingUidCount = 0;
    const failedAuthDeletes = [];

    for (const userDoc of matchedUserDocs) {
      const userData = userDoc.data() || {};
      const uid = String(userData.uid || userDoc.id || "").trim();

      if (!uid) {
        missingUidCount += 1;
        continue;
      }

      try {
        await auth.deleteUser(uid);
        deletedAuthCount += 1;
      } catch (error) {
        if (error?.code === "auth/user-not-found") {
          authUserNotFoundCount += 1;
        } else {
          failedAuthDeletes.push({
            uid,
            message: String(error?.message || "Unknown auth delete error"),
          });
        }
      }
    }

    if (matchedUserDocs.length) {
      const deleteUserOps = matchedUserDocs.map((doc) => ({
        type: "delete",
        ref: doc.ref,
      }));
      await applyBatchOps(deleteUserOps);
    }



    await docRef.set(
      {
        colleges: colleges.filter((item) => item.id !== id),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    invalidateSuperadminCache();

    return res.status(200).json({
      success: true,
      message: "College deleted successfully",
      data: {
        collegeId: id,
        collegeName,
        usersDeleted: matchedUserDocs.length,
        authUsersDeleted: deletedAuthCount,
        authUsersNotFound: authUserNotFoundCount,
        usersMissingUid: missingUidCount,
        authDeleteFailures: failedAuthDeletes,
      },
    });
  } catch (error) {
    console.error("Delete college error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const registerCommitteeMember = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      role = "committee",
      level = 1,
    } = req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedName = String(name || "").trim();
    const normalizedPhone = String(phone || "").trim();
    const normalizedRole = String(role || "committee");
    const normalizedLevel = Number(level || 1);

    if (!normalizedName || !normalizedEmail || !normalizedPhone || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, phone, and password are required",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const existingCommitteeDoc = await getCommitteeUserDoc();
    const existingCommittee = existingCommitteeDoc
      ? existingCommitteeDoc.data() || {}
      : null;

    let userRecord = null;
    const candidateUid = String(
      existingCommittee?.uid || existingCommitteeDoc?.id || "",
    ).trim();

    if (candidateUid) {
      try {
        userRecord = await auth.getUser(candidateUid);
      } catch (error) {
        userRecord = null;
      }
    }

    if (!userRecord) {
      try {
        userRecord = await auth.getUserByEmail(normalizedEmail);
      } catch (error) {
        userRecord = null;
      }
    }

    if (!userRecord) {
      userRecord = await auth.createUser({
        email: normalizedEmail,
        password: String(password),
        displayName: normalizedName,
      });
    } else {
      await auth.updateUser(userRecord.uid, {
        email: normalizedEmail,
        password: String(password),
        displayName: normalizedName,
      });
    }

    await auth.setCustomUserClaims(userRecord.uid, {
      role: "committee",
      level: normalizedLevel,
      committeeMember: true,
    });

    const committeeData = {
      uid: userRecord.uid,
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      role: normalizedRole,
      level: normalizedLevel,
      committeeMember: true,
      isActive: true,
      registeredAt:
        existingCommittee?.registeredAt ||
        admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await usersCollectionRef()
      .doc(userRecord.uid)
      .set(
        {
          ...committeeData,
          createdAt:
            existingCommittee?.uid === userRecord.uid &&
            existingCommittee?.createdAt
              ? existingCommittee.createdAt
              : admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    if (existingCommitteeDoc && existingCommitteeDoc.id !== userRecord.uid) {
      await usersCollectionRef().doc(existingCommitteeDoc.id).delete();
    }

    return res.status(existingCommitteeDoc ? 200 : 201).json({
      success: true,
      message: existingCommitteeDoc
        ? "Committee member Firebase Auth account synced successfully"
        : "Committee member registered successfully using Firebase Auth",
      data: committeeData,
    });
  } catch (error) {
    console.error("Register committee member error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

export const getCommitteeMember = async (req, res) => {
  try {
    const committeeDoc = await getCommitteeUserDoc();

    if (!committeeDoc) {
      return res.status(200).json({ success: true, data: null });
    }

    const data = committeeDoc.data() || {};

    return res.status(200).json({
      success: true,
      data: {
        uid: data.uid || committeeDoc.id,
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        role: data.role || "committee",
        level: Number(data.level || 1),
        registeredAt: data.registeredAt || data.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Get committee member error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateCommitteeMember = async (req, res) => {
  try {
    const { name, phone, password, role, level } = req.body;

    const committeeDoc = await getCommitteeUserDoc();
    if (!committeeDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Committee member not found" });
    }

    const current = committeeDoc.data() || {};
    const committeeUid = String(current.uid || committeeDoc.id || "").trim();

    if (!committeeUid) {
      return res
        .status(404)
        .json({ success: false, message: "Committee member not found" });
    }

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (name !== undefined) updates.name = String(name).trim();
    if (phone !== undefined) updates.phone = String(phone).trim();
    if (role !== undefined) updates.role = String(role);
    if (level !== undefined) updates.level = Number(level);

    if (password !== undefined) {
      if (String(password).length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }
      await auth.updateUser(committeeUid, { password: String(password) });
    }

    if (name !== undefined) {
      await auth.updateUser(committeeUid, { displayName: String(name).trim() });
    }

    const effectiveLevel =
      level !== undefined ? Number(level) : Number(current.level || 1);
    await auth.setCustomUserClaims(committeeUid, {
      role: "committee",
      level: effectiveLevel,
      committeeMember: true,
    });

    const userUpdates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      role: "committee",
      committeeMember: true,
      isActive: true,
      uid: committeeUid,
    };

    if (name !== undefined) userUpdates.name = String(name).trim();
    if (phone !== undefined) userUpdates.phone = String(phone).trim();
    if (level !== undefined) userUpdates.level = Number(level);
    else if (current.level !== undefined)
      userUpdates.level = Number(current.level);

    await usersCollectionRef().doc(committeeUid).set(userUpdates, {
      merge: true,
    });

    if (committeeDoc.id !== committeeUid) {
      await usersCollectionRef().doc(committeeDoc.id).delete();
    }

    return res.status(200).json({
      success: true,
      message: "Committee member updated successfully",
    });
  } catch (error) {
    console.error("Update committee member error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

export const deleteCommitteeMember = async (req, res) => {
  try {
    const committeeDoc = await getCommitteeUserDoc();
    if (!committeeDoc) {
      return res
        .status(404)
        .json({ success: false, message: "Committee member not found" });
    }

    const current = committeeDoc.data() || {};
    const committeeUid = String(current.uid || committeeDoc.id || "").trim();

    if (!committeeUid) {
      return res
        .status(404)
        .json({ success: false, message: "Committee member not found" });
    }

    try {
      await auth.deleteUser(committeeUid);
    } catch (error) {
      if (error?.code !== "auth/user-not-found") {
        throw error;
      }
    }

    await usersCollectionRef().doc(committeeUid).delete();

    if (committeeDoc.id !== committeeUid) {
      await usersCollectionRef().doc(committeeDoc.id).delete();
    }

    return res.status(200).json({
      success: true,
      message: "Committee member deleted successfully",
    });
  } catch (error) {
    console.error("Delete committee member error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

export const getForms = async (req, res) => {
  try {
    const snapshot = await formsCollectionRef()
      .orderBy("updatedAt", "desc")
      .get();

    const forms = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        formTitle: data.formTitle || "",
        applicableRoles: toStringArray(data.applicableRoles),
        totalMarks: Number(data.totalMarks || 0),
        criteriaCount: Number(data.criteriaCount || 0),
        moduleCount: Number(data.moduleCount || 0),
        taskCount: Number(data.taskCount || 0),
        status: data.status || "draft",
        version: Number(data.version || 1),
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      };
    });

    return res.status(200).json({ success: true, data: forms });
  } catch (error) {
    console.error("Get forms error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getFormById = async (req, res) => {
  try {
    const { id } = req.params;
    const formRef = formsCollectionRef().doc(id);
    const formDoc = await formRef.get();

    if (!formDoc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    }

    const [criteriaSnapshot, modulesSnapshot, tasksSnapshot] =
      await Promise.all([
        criteriaCollectionRef(id).get(),
        modulesCollectionRef(id).get(),
        tasksCollectionRef(id).get(),
      ]);

    const form = composeFormResponse(
      formDoc,
      criteriaSnapshot.docs,
      modulesSnapshot.docs,
      tasksSnapshot.docs,
    );

    return res.status(200).json({ success: true, data: form });
  } catch (error) {
    console.error("Get form by id error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createForm = async (req, res) => {
  try {
    const formId = generateId("form");
    const result = await saveFormHierarchy(
      formId,
      req.body,
      req.superadmin?.uid || "system",
    );

    if (result.error) {
      return res
        .status(result.status)
        .json({ success: false, message: result.error });
    }

    return res.status(201).json({
      success: true,
      message: "Form created successfully",
      data: { id: formId },
    });
  } catch (error) {
    console.error("Create form error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

export const updateForm = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await formsCollectionRef().doc(id).get();

    if (!existing.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    }

    const result = await saveFormHierarchy(
      id,
      req.body,
      req.superadmin?.uid || "system",
    );
    if (result.error) {
      return res
        .status(result.status)
        .json({ success: false, message: result.error });
    }

    return res
      .status(200)
      .json({ success: true, message: "Form updated successfully" });
  } catch (error) {
    console.error("Update form error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

export const deleteForm = async (req, res) => {
  try {
    const { id } = req.params;
    const formRef = formsCollectionRef().doc(id);
    const existing = await formRef.get();

    if (!existing.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    }

    await Promise.all([
      clearSubcollection(criteriaCollectionRef(id)),
      clearSubcollection(modulesCollectionRef(id)),
      clearSubcollection(tasksCollectionRef(id)),
    ]);

    await formRef.delete();

    return res
      .status(200)
      .json({ success: true, message: "Form deleted successfully" });
  } catch (error) {
    console.error("Delete form error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

export const registerSuperAdmin = async (req, res) => {
  try {
    // One-time setup guard — permanently block once a superadmin exists.
    // This prevents anyone from creating a second superadmin account via
    // this public endpoint after initial setup is complete.
    const saDocRef = superadminDocRef();
    const saDoc = await saDocRef.get();
    if (saDoc.exists && saDoc.data()?.superadminRegistered === true) {
      return res.status(403).json({
        success: false,
        message: "Super admin setup is already complete",
      });
    }

    const { email, password, name } = req.body;

    // Validate inputs
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedName = String(name || "").trim();
    const normalizedPassword = String(password || "");

    if (!normalizedEmail || !normalizedPassword || !normalizedName) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and name are required",
      });
    }

    if (normalizedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if email is already registered
    try {
      const existingAuthUser = await auth.getUserByEmail(normalizedEmail);
      const firestoreDoc = await db
        .collection("users")
        .doc(existingAuthUser.uid)
        .get();
      if (firestoreDoc.exists) {
        return res.status(409).json({
          success: false,
          message: "A user with this email already exists",
        });
      }
      // Orphaned Auth account — delete it so fresh creation proceeds
      await auth.deleteUser(existingAuthUser.uid);
    } catch (error) {
      // User doesn't exist, continue with registration
    }

    // Create Firebase Auth user
    const userRecord = await auth.createUser({
      email: normalizedEmail,
      password: normalizedPassword,
      displayName: normalizedName,
    });

    // Set custom claims for superadmin role
    await auth.setCustomUserClaims(userRecord.uid, {
      role: "superadmin",
      superadmin: true,
    });

    // Note: Superadmin does NOT get a document in the users collection
    // It's only authenticated via Firebase Auth with custom claims

    // Mark setup as complete so the one-time guard permanently blocks future attempts.
    await saDocRef.set({ superadminRegistered: true }, { merge: true });
    invalidateSuperadminCache();

    // Generate a custom token for immediate login
    const customToken = await auth.createCustomToken(userRecord.uid);

    return res.status(201).json({
      success: true,
      message: "Super Admin registered successfully",
      data: {
        uid: userRecord.uid,
        email: normalizedEmail,
        name: normalizedName,
        token: customToken,
      },
    });
  } catch (error) {
    console.error("Register SuperAdmin error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to register Super Admin",
    });
  }
};

export const updateSuperAdminCredentials = async (req, res) => {
  try {
    const { currentEmail, currentPassword, newEmail, newPassword, newName } =
      req.body;

    if (!currentEmail || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: "Current email and password are required",
      });
    }

    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ success: false, message: "Server configuration error" });
    }

    // Verify current credentials via Firebase REST API
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(currentEmail).trim().toLowerCase(),
          password: String(currentPassword),
          returnSecureToken: true,
        }),
      },
    );

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.idToken) {
      return res
        .status(401)
        .json({ success: false, message: "Current credentials are incorrect" });
    }

    // Confirm account has superadmin claims
    const decoded = await auth.verifyIdToken(verifyData.idToken);
    if (!decoded.superadmin && decoded.role !== "superadmin") {
      return res
        .status(403)
        .json({ success: false, message: "Account is not a superadmin" });
    }

    const updateData = {};
    if (newEmail) updateData.email = String(newEmail).trim().toLowerCase();
    if (newPassword) {
      if (String(newPassword).length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters",
        });
      }
      updateData.password = String(newPassword);
    }
    if (newName) updateData.displayName = String(newName).trim();

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No changes provided" });
    }

    await auth.updateUser(decoded.uid, updateData);

    return res.status(200).json({
      success: true,
      message: "Superadmin credentials updated successfully",
    });
  } catch (error) {
    console.error("Update superadmin credentials error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Server error" });
  }
};

export const getInternalCommittees = async (req, res) => {
  try {
    const snapshot = await db
      .collection("users")
      .where("internalCommittee", "==", true)
      .get();

    const members = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        email: data.email || "",
        role: data.role || "",
        college: data.college || "",
        department: data.department || "",
      };
    });

    const byCollege = members.reduce((acc, member) => {
      const college = member.college || "Unknown";
      if (!acc[college]) acc[college] = [];
      acc[college].push(member);
      return acc;
    }, {});

    return res.status(200).json({ success: true, data: byCollege });
  } catch (error) {
    console.error("Get internal committees error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCollegeStaff = async (req, res) => {
  try {
    const { college } = req.query;
    if (!college) return res.status(400).json({ success: false, message: "College is required" });

    const snap = await db.collection("users")
      .where("college", "==", String(college).trim())
      .select("uid", "name", "email", "role", "department", "designation")
      .get();

    const excluded = new Set(["committee", "viewer", "superadmin"]);
    const staff = snap.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }))
      .filter((s) => !excluded.has(String(s.role || "").toLowerCase()));

    return res.json({ success: true, data: staff });
  } catch (err) {
    console.error("getCollegeStaff error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const resetCollegeEvaluations = async (req, res) => {
  try {
    const { college, department, userId } = req.body;
    if (!college || !String(college).trim()) {
      return res.status(400).json({ success: false, message: "College name is required" });
    }
    const collegeName = String(college).trim();

    // Statuses that have HOD review data attached
    const reviewedStatuses = ["reviewed", "accepted", "auto-approved"];

    let query = db.collection("submissions").where("college", "==", collegeName);
    if (department && String(department).trim()) {
      query = query.where("department", "==", String(department).trim());
    }
    if (userId && String(userId).trim()) {
      query = query.where("userId", "==", String(userId).trim());
    }

    const snapshot = await query.get();

    const toReset = snapshot.docs.filter((doc) =>
      reviewedStatuses.includes(doc.data().status)
    );

    if (toReset.length === 0) {
      return res.status(200).json({ success: true, message: "No evaluated submissions found for the selected scope.", count: 0 });
    }

    const CHUNK = 400;
    for (let i = 0; i < toReset.length; i += CHUNK) {
      const batch = db.batch();
      toReset.slice(i, i + CHUNK).forEach((doc) => {
        batch.update(doc.ref, {
          status: "submitted",
          reviewerScore: null,
          reviewerReason: null,
          reviewedBy: null,
          reviewerId: null,
          reviewedAt: null,
          finalScore: null,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    }

    return res.status(200).json({
      success: true,
      message: `Reset ${toReset.length} submission(s) back to submitted.`,
      count: toReset.length,
    });
  } catch (error) {
    console.error("resetCollegeEvaluations error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── Duplicate submission helpers ──────────────────────────────────────────────
// Group submissions by userId+taskId, determine which to keep (scored > newest)
const buildDuplicateGroups = (docs) => {
  const groups = {};
  docs.forEach((doc) => {
    const d = doc.data ? { id: doc.id, ...doc.data() } : doc;
    const key = `${d.userId}||${d.taskId}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  });

  return Object.values(groups)
    .filter((subs) => subs.length > 1)
    .map((subs) => {
      const sorted = [...subs].sort((a, b) => {
        // Prefer the one that already has a reviewer score
        const aScored = a.reviewerScore != null ? 1 : 0;
        const bScored = b.reviewerScore != null ? 1 : 0;
        if (bScored !== aScored) return bScored - aScored;
        // Otherwise keep the newest submission
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
      return { keep: sorted[0], toDelete: sorted.slice(1) };
    });
};

export const previewDuplicateSubmissions = async (req, res) => {
  try {
    const college = String(req.query.college || "").trim();
    if (!college) return res.status(400).json({ success: false, message: "College is required" });

    const snap = await db.collection("submissions").where("college", "==", college).get();
    const groups = buildDuplicateGroups(snap.docs);
    const toDeleteAll = groups.flatMap((g) => g.toDelete);

    return res.json({
      success: true,
      data: {
        totalGroups: groups.length,
        totalToDelete: toDeleteAll.length,
        groups: groups.map((g) => ({
          keep: {
            id: g.keep.id,
            taskName: g.keep.taskName,
            userName: g.keep.userName,
            department: g.keep.department,
            status: g.keep.status,
            reviewerScore: g.keep.reviewerScore ?? null,
            createdAt: g.keep.createdAt || null,
          },
          toDelete: g.toDelete.map((s) => ({
            id: s.id,
            status: s.status,
            reviewerScore: s.reviewerScore ?? null,
            createdAt: s.createdAt || null,
          })),
        })),
      },
    });
  } catch (err) {
    console.error("previewDuplicateSubmissions error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteDuplicateSubmissions = async (req, res) => {
  try {
    const college = String(req.body.college || "").trim();
    if (!college) return res.status(400).json({ success: false, message: "College is required" });

    const snap = await db.collection("submissions").where("college", "==", college).get();
    const groups = buildDuplicateGroups(snap.docs);
    const toDeleteIds = groups.flatMap((g) => g.toDelete.map((s) => s.id));

    if (toDeleteIds.length === 0) {
      return res.json({ success: true, message: "No duplicates found.", count: 0 });
    }

    const CHUNK = 400;
    for (let i = 0; i < toDeleteIds.length; i += CHUNK) {
      const batch = db.batch();
      toDeleteIds.slice(i, i + CHUNK).forEach((id) => {
        batch.delete(db.collection("submissions").doc(id));
      });
      await batch.commit();
    }

    return res.json({
      success: true,
      message: `Deleted ${toDeleteIds.length} duplicate submission(s). ${groups.length} task(s) deduplicated.`,
      count: toDeleteIds.length,
    });
  } catch (err) {
    console.error("deleteDuplicateSubmissions error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
