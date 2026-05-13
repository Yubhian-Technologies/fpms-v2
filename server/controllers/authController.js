import bcrypt from "bcryptjs";
import { db, auth } from "../config/firebase.js";
import admin from "firebase-admin";
import { getSuperadminConfig, invalidateSuperadminCache } from "../config/superadminCache.js";

const SUPERADMIN_DOC_ID = process.env.SUPERADMIN_DOC_ID || "root";
const formsCollectionRef = () => db.collection("fpmsForms");

const normalizeRoleValue = (value) => {
  const role = String(value || "")
    .trim()
    .toLowerCase();

  // Normalize principle variations
  if (role === "principal" || role === "principle" || role === "admin") {
    return "principle";
  }

  // Normalize vice principle variations
  if (
    role === "vice principal" ||
    role === "vice principle" ||
    role === "vice-principal" ||
    role === "viceprincipal" ||
    role === "viceprinciple"
  ) {
    return "vice principle";
  }

  // Normalize committee spelling variations
  if (role === "committee" || role === "commitee") {
    return "committee";
  }

  return role;
};

const normalizeAdminManagementRole = (value) => {
  const role = String(value || "")
    .trim()
    .toLowerCase();

  if (role === "principal" || role === "principle" || role === "admin") {
    return "principle";
  }

  if (
    role === "vice principal" ||
    role === "vice principle" ||
    role === "vice-principal" ||
    role === "viceprincipal"
  ) {
    return "vice principle";
  }

  return role;
};

const isPrincipalRole = (value) => {
  const normalized = normalizeAdminManagementRole(value);
  return normalized === "principle";
};

const isVicePrincipalRole = (value) => {
  const normalized = normalizeAdminManagementRole(value);
  return normalized === "vice principle";
};

const inferRoleFromTokenContext = async (decodedToken) => {
  if (decodedToken?.committeeMember) return "committee";

  if (decodedToken?.role) {
    return normalizeRoleValue(decodedToken.role);
  }

  if (decodedToken?.uid) {
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    if (userDoc.exists) {
      const userData = userDoc.data() || {};
      return normalizeRoleValue(userData.role || "");
    }
  }

  return "faculty";
};

const resolveRoleFromAuthorizationHeader = async (authorizationHeader) => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.split(" ")[1];
  if (!token) return null;

  try {
    const decodedFirebase = await auth.verifyIdToken(token);
    return inferRoleFromTokenContext(decodedFirebase);
  } catch (firebaseError) {
    return null;
  }
};

const normalizeRoleKey = (value) => {
  const cleaned = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (
    cleaned === "principal" ||
    cleaned === "principle" ||
    cleaned === "admin"
  ) {
    return "principle";
  }

  if (cleaned === "committee" || cleaned === "commitee") {
    return "committee";
  }

  if (cleaned === "internalcommittee" || cleaned === "internalcommitee") {
    return "internalcommittee";
  }

  if (cleaned === "viceprincipal" || cleaned === "viceprinciple") {
    return "viceprinciple";
  }

  return cleaned;
};

const WORKFLOW_SUBMISSIONS_COLLECTION = "workflowSubmissions";

const resolveSpecificRoleByEmail = async ({ role, email }) => {
  const normalizedRole = String(role || "").trim();
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (!normalizedRole || !normalizedEmail) {
    return normalizedRole;
  }

  try {
    if (normalizeRoleKey(normalizedRole) === "dean") {
      const deanSnapshot = await db
        .collection("users")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

      if (!deanSnapshot.empty) {
        const deanData = deanSnapshot.docs[0].data() || {};
        const specificRole = String(deanData.role || "").trim();
        if (specificRole && normalizeRoleKey(specificRole).startsWith("dean")) {
          return specificRole;
        }
      }
    }

    if (
      normalizeRoleKey(normalizedRole) === "principle" ||
      normalizeRoleKey(normalizedRole) === "viceprinciple"
    ) {
      const userSnapshot = await db
        .collection("users")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();

      if (!userSnapshot.empty) {
        const userData = userSnapshot.docs[0].data() || {};
        const specificRole = String(userData.role || "").trim();
        if (specificRole) return specificRole;
      }
    }
  } catch (error) {}

  return normalizedRole;
};

const resolveActorContextFromAuthorizationHeader = async (
  authorizationHeader,
) => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authorizationHeader.split(" ")[1];
  if (!token) return null;

  try {
    const decodedFirebase = await auth.verifyIdToken(token);
    const email = String(decodedFirebase?.email || "")
      .trim()
      .toLowerCase();

    const roleFromClaim =
      decodedFirebase?.role ||
      decodedFirebase?.claims?.role ||
      (decodedFirebase?.committeeMember ? "committee" : "");

    let userDocData = null;
    try {
      const userDoc = await db
        .collection("users")
        .doc(decodedFirebase.uid)
        .get();
      if (userDoc.exists) userDocData = userDoc.data() || null;
    } catch (docError) {}

    const resolvedRole = String(
      roleFromClaim || userDocData?.role || "faculty",
    );
    const specificRole = await resolveSpecificRoleByEmail({
      role: resolvedRole,
      email,
    });

    return {
      id: decodedFirebase.uid,
      uid: decodedFirebase.uid,
      role: specificRole,
      roleKey: normalizeRoleKey(specificRole),
      email,
      college:
        decodedFirebase?.college ||
        decodedFirebase?.claims?.college ||
        userDocData?.college ||
        "",
      department:
        decodedFirebase?.department ||
        decodedFirebase?.claims?.department ||
        userDocData?.department ||
        "",
      name:
        decodedFirebase?.name ||
        userDocData?.name ||
        (email ? email.split("@")[0] : "User"),
    };
  } catch (firebaseError) {
    return null;
  }
};

const getWorkflowConfig = async () => {
  const data = await getSuperadminConfig();
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const workflowRules = Array.isArray(data.workflowRules) ? data.workflowRules : [];

  const roleLabelByKey = new Map();
  const roleExistsByKey = new Set();

  roles.forEach((roleItem) => {
    const roleLabel = String(roleItem?.name || "").trim();
    const roleKey = normalizeRoleKey(roleLabel);
    if (!roleKey) return;
    roleLabelByKey.set(roleKey, roleLabel);
    roleExistsByKey.add(roleKey);
  });

  return { roles, workflowRules, roleLabelByKey, roleExistsByKey };
};

const normalizeRoleArray = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((item) => String(item || "").trim()).filter(Boolean)),
  );
};

const findWorkflowRuleByRoleKey = (workflowRules, roleKey) => {
  const rules = Array.isArray(workflowRules) ? workflowRules : [];
  return rules.find(
    (item) => normalizeRoleKey(String(item?.role || "")) === roleKey,
  );
};

const buildSubmissionDocId = ({ facultyId, formId, criteriaId, taskId }) => {
  const raw = [facultyId, formId, criteriaId, taskId]
    .map((item) => String(item || "").trim())
    .join("__");
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_");
};

const buildActorIdentifierSet = (actor) => {
  const actorId = String(actor?.id || "")
    .trim()
    .toLowerCase();
  const actorUid = String(actor?.uid || "")
    .trim()
    .toLowerCase();
  const actorEmail = String(actor?.email || "")
    .trim()
    .toLowerCase();

  return new Set([actorId, actorUid, actorEmail].filter(Boolean));
};

const isOwnedByActor = (item, actorIdentifierSet) => {
  const facultyId = String(item?.facultyId || "")
    .trim()
    .toLowerCase();
  const facultyUid = String(item?.facultyUid || "")
    .trim()
    .toLowerCase();
  const facultyEmail = String(item?.facultyEmail || "")
    .trim()
    .toLowerCase();

  return (
    (facultyId && actorIdentifierSet.has(facultyId)) ||
    (facultyUid && actorIdentifierSet.has(facultyUid)) ||
    (facultyEmail && actorIdentifierSet.has(facultyEmail))
  );
};

const buildSubmittedAssignments = (roles, createdAtIso) =>
  normalizeRoleArray(roles).map((roleLabel) => ({
    role: roleLabel,
    roleKey: normalizeRoleKey(roleLabel),
    status: "submitted",
    assignedAt: createdAtIso,
    reviewedAt: null,
    reviewerUserId: null,
    verifiedScore: null,
    remarks: "",
  }));

export const submitWorkflowTask = async (req, res) => {
  try {
    const actor = await resolveActorContextFromAuthorizationHeader(
      req.headers.authorization,
    );

    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      formId,
      criteriaId,
      moduleId,
      moduleName,
      taskId,
      taskTitle,
      claimedScore,
      maxMarks,
      evidenceUrl,
      description,
    } = req.body || {};

    const normalizedFormId = String(formId || "").trim();
    const normalizedCriteriaId = String(criteriaId || "").trim();
    const normalizedModuleId = String(moduleId || "").trim();
    const normalizedTaskId = String(taskId || "").trim();

    if (!normalizedFormId || !normalizedCriteriaId || !normalizedTaskId) {
      return res.status(400).json({
        success: false,
        message: "formId, criteriaId and taskId are required",
      });
    }

    const workflowConfig = await getWorkflowConfig();
    const currentRule = findWorkflowRuleByRoleKey(
      workflowConfig.workflowRules,
      actor.roleKey,
    );

    const submitToRoles = normalizeRoleArray(currentRule?.submitToRoles);
    const appealToRoles = normalizeRoleArray(currentRule?.appealToRoles);

    if (submitToRoles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No submitToRoles configured for current role",
      });
    }

    const actorId = String(actor.id || actor.uid || actor.email || "").trim();
    const actorUid = String(actor.uid || actorId || "").trim();
    const actorName = String(actor.name || "").trim();
    const actorEmail = String(actor.email || "").trim();
    const actorCollege = String(actor.college || "").trim();
    const actorDepartment = String(actor.department || "").trim();

    const submissionId = buildSubmissionDocId({
      facultyId: actorId,
      formId: normalizedFormId,
      criteriaId: normalizedCriteriaId,
      taskId: normalizedTaskId,
    });

    const now = admin.firestore.FieldValue.serverTimestamp();
    const createdAtIso = new Date().toISOString();

    const submissionRef = db
      .collection(WORKFLOW_SUBMISSIONS_COLLECTION)
      .doc(submissionId);
    const submissionDoc = await submissionRef.get();
    const existing = submissionDoc.exists ? submissionDoc.data() || {} : {};

    const assignments = buildSubmittedAssignments(submitToRoles, createdAtIso);

    const claimed = Number(claimedScore || 0);
    const boundedClaimed = Number.isFinite(claimed)
      ? Math.max(0, Math.min(claimed, Number(maxMarks || 0)))
      : 0;

    await submissionRef.set(
      {
        id: submissionId,
        formId: normalizedFormId,
        criteriaId: normalizedCriteriaId,
        moduleId: normalizedModuleId,
        moduleName: String(moduleName || "").trim(),
        taskId: normalizedTaskId,
        taskTitle: String(taskTitle || "").trim(),
        facultyId: actorId,
        facultyUid: actorUid,
        facultyName: actorName,
        facultyEmail: actorEmail,
        college: actorCollege,
        department: actorDepartment,
        submittedByRole: actor.role,
        submittedByRoleKey: actor.roleKey,
        submitToRoles,
        appealToRoles,
        completionPolicy: "ANY_ONE_REVIEWED",
        claimedScore: boundedClaimed,
        maxMarks: Number(maxMarks || 0),
        evidenceUrl: String(evidenceUrl || ""),
        description: String(description || ""),
        workflowType: "submission",
        currentFlow: "submission",
        currentFlowRoles: submitToRoles,
        verifiedScore:
          existing.verifiedScore !== undefined &&
          Number.isFinite(Number(existing.verifiedScore))
            ? Number(existing.verifiedScore)
            : null,
        status: "submitted",
        activeRoleKeys: submitToRoles.map((role) => normalizeRoleKey(role)),
        assignments,
        lastAppeal: existing.lastAppeal || null,
        version:
          Number.isFinite(Number(existing.version)) &&
          Number(existing.version) >= 0
            ? Number(existing.version) + 1
            : 1,
        updatedAt: now,
        updatedBy: actorId,
        createdAt: existing.createdAt || now,
      },
      { merge: true },
    );

    return res.status(200).json({
      success: true,
      message: "Task submitted to workflow roles",
      data: {
        id: submissionId,
        submitToRoles,
        appealToRoles,
        completionPolicy: "ANY_ONE_REVIEWED",
      },
    });
  } catch (error) {
    console.error("Submit workflow task error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getMyWorkflowTaskStatuses = async (req, res) => {
  try {
    const actor = await resolveActorContextFromAuthorizationHeader(
      req.headers.authorization,
    );

    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const formId = String(req.query?.formId || "").trim();
    const criteriaId = String(req.query?.criteriaId || "").trim();

    if (!formId || !criteriaId) {
      return res.status(400).json({
        success: false,
        message: "formId and criteriaId are required",
      });
    }

    const actorId = String(actor.id || "").trim();
    const actorUid = String(actor.uid || "").trim();
    const actorEmail = String(actor.email || "")
      .trim()
      .toLowerCase();

    const actorIdentifierSet = new Set(
      [actorId, actorUid, actorEmail]
        .map((item) =>
          String(item || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );

    const snapshot = await db
      .collection(WORKFLOW_SUBMISSIONS_COLLECTION)
      .where("formId", "==", formId)
      .where("criteriaId", "==", criteriaId)
      .get();

    const data = snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((item) => isOwnedByActor(item, actorIdentifierSet))
      .map((item) => {
        const docId = item.id;
        const itemData = item;
        const assignments = Array.isArray(itemData.assignments)
          ? itemData.assignments
          : [];
        const reviewedAssignment = assignments.find(
          (assignment) => String(assignment?.status || "") === "reviewed",
        );

        const status = String(itemData.status || "pending");
        const mappedStatus =
          status === "approved"
            ? "approved"
            : status === "appealed"
              ? "appealed"
              : status === "submitted"
                ? "submitted"
                : reviewedAssignment
                  ? "approved"
                  : "pending";

        return {
          id: docId,
          taskId: String(itemData.taskId || ""),
          moduleId: String(itemData.moduleId || ""),
          currentFlow: String(itemData.currentFlow || "submission"),
          status: mappedStatus,
          canAppeal:
            mappedStatus === "approved" &&
            Array.isArray(itemData.appealToRoles) &&
            itemData.appealToRoles.length > 0,
          claimedScore:
            itemData.claimedScore !== undefined &&
            Number.isFinite(Number(itemData.claimedScore))
              ? Number(itemData.claimedScore)
              : 0,
          evidenceUrl: String(itemData.evidenceUrl || ""),
          description: String(itemData.description || ""),
          activeRoleKeys: Array.isArray(itemData.activeRoleKeys)
            ? itemData.activeRoleKeys
            : [],
          submitToRoles: Array.isArray(itemData.submitToRoles)
            ? itemData.submitToRoles
            : [],
          appealToRoles: Array.isArray(itemData.appealToRoles)
            ? itemData.appealToRoles
            : [],
          verifiedScore:
            itemData.verifiedScore !== undefined &&
            Number.isFinite(Number(itemData.verifiedScore))
              ? Number(itemData.verifiedScore)
              : null,
          assignments,
        };
      });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Get workflow task statuses error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getWorkflowReviewQueue = async (req, res) => {
  try {
    const actor = await resolveActorContextFromAuthorizationHeader(
      req.headers.authorization,
    );

    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const snapshot = await db
      .collection(WORKFLOW_SUBMISSIONS_COLLECTION)
      .where("activeRoleKeys", "array-contains", actor.roleKey)
      .get();

    const queue = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => {
        const status = String(item.status || "").toLowerCase();
        if (status !== "submitted" && status !== "appealed") return false;

        const assignments = Array.isArray(item.assignments)
          ? item.assignments
          : [];
        const myAssignment = assignments.find(
          (assignment) =>
            normalizeRoleKey(
              String(assignment?.roleKey || assignment?.role || ""),
            ) === actor.roleKey,
        );

        return String(myAssignment?.status || "") === "submitted";
      });

    return res.status(200).json({ success: true, data: queue });
  } catch (error) {
    console.error("Get workflow review queue error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const reviewWorkflowSubmission = async (req, res) => {
  try {
    const actor = await resolveActorContextFromAuthorizationHeader(
      req.headers.authorization,
    );

    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { submissionId } = req.params;
    const { verifiedScore, remarks } = req.body || {};

    const actorId = String(actor.id || actor.uid || actor.email || "").trim();
    const normalizedSubmissionId = String(submissionId || "").trim();
    if (!normalizedSubmissionId) {
      return res.status(400).json({
        success: false,
        message: "submissionId is required",
      });
    }

    const submissionRef = db
      .collection(WORKFLOW_SUBMISSIONS_COLLECTION)
      .doc(normalizedSubmissionId);
    const submissionDoc = await submissionRef.get();

    if (!submissionDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const submission = submissionDoc.data() || {};
    const assignments = Array.isArray(submission.assignments)
      ? submission.assignments
      : [];

    const currentRoleAssignmentIndex = assignments.findIndex(
      (item) =>
        normalizeRoleKey(String(item?.roleKey || item?.role || "")) ===
        actor.roleKey,
    );

    if (currentRoleAssignmentIndex === -1) {
      return res.status(403).json({
        success: false,
        message: "Current role is not assigned to this submission",
      });
    }

    const currentRoleAssignment = assignments[currentRoleAssignmentIndex];
    if (String(currentRoleAssignment?.status || "") !== "submitted") {
      return res.status(400).json({
        success: false,
        message: "This assignment is already reviewed",
      });
    }

    const workflowConfig = await getWorkflowConfig();
    const nextRule = findWorkflowRuleByRoleKey(
      workflowConfig.workflowRules,
      actor.roleKey,
    );

    const currentFlow =
      String(submission.currentFlow || "")
        .trim()
        .toLowerCase() === "appeal" ||
      String(submission.status || "")
        .trim()
        .toLowerCase() === "appealed"
        ? "appeal"
        : "submission";

    const nextSubmitToRoles =
      currentFlow === "appeal"
        ? normalizeRoleArray(nextRule?.appealToRoles)
        : normalizeRoleArray(nextRule?.submitToRoles);
    const nowIso = new Date().toISOString();
    const now = admin.firestore.FieldValue.serverTimestamp();

    const nextAssignments = assignments.map((assignment) => {
      const assignmentRoleKey = normalizeRoleKey(
        String(assignment?.roleKey || assignment?.role || ""),
      );

      if (assignmentRoleKey === actor.roleKey) {
        return {
          ...assignment,
          roleKey: assignmentRoleKey,
          status: "reviewed",
          reviewedAt: nowIso,
          reviewerUserId: actorId,
          verifiedScore:
            verifiedScore !== undefined &&
            Number.isFinite(Number(verifiedScore))
              ? Number(verifiedScore)
              : Number(submission.claimedScore || 0),
          remarks: String(remarks || ""),
        };
      }

      if (String(assignment?.status || "") === "submitted") {
        return {
          ...assignment,
          roleKey: assignmentRoleKey,
          status: "skipped",
          reviewedAt: assignment.reviewedAt || nowIso,
          remarks:
            assignment.remarks ||
            "Skipped due to parallel ANY_ONE_REVIEWED completion",
        };
      }

      return {
        ...assignment,
        roleKey: assignmentRoleKey,
      };
    });

    const assignmentByRoleKey = new Map(
      nextAssignments.map((item) => [
        normalizeRoleKey(String(item?.roleKey || item?.role || "")),
        item,
      ]),
    );

    nextSubmitToRoles.forEach((roleLabel) => {
      const roleKey = normalizeRoleKey(roleLabel);
      if (!roleKey) return;

      if (!assignmentByRoleKey.has(roleKey)) {
        assignmentByRoleKey.set(roleKey, {
          role: roleLabel,
          roleKey,
          status: "submitted",
          assignedAt: nowIso,
          reviewedAt: null,
          reviewerUserId: null,
          verifiedScore: null,
          remarks: "",
        });
      }
    });

    const mergedAssignments = Array.from(assignmentByRoleKey.values());
    const hasNextStep = nextSubmitToRoles.length > 0;
    const boundedVerifiedScore =
      verifiedScore !== undefined && Number.isFinite(Number(verifiedScore))
        ? Number(verifiedScore)
        : Number(submission.claimedScore || 0);

    await submissionRef.set(
      {
        assignments: mergedAssignments,
        submitToRoles:
          currentFlow === "submission"
            ? hasNextStep
              ? nextSubmitToRoles
              : []
            : submission.submitToRoles || [],
        currentFlow,
        currentFlowRoles: hasNextStep ? nextSubmitToRoles : [],
        activeRoleKeys: hasNextStep
          ? nextSubmitToRoles.map((role) => normalizeRoleKey(role))
          : [],
        status: hasNextStep
          ? currentFlow === "appeal"
            ? "appealed"
            : "submitted"
          : "approved",
        verifiedScore: boundedVerifiedScore,
        reviewedByRole: actor.role,
        reviewedByRoleKey: actor.roleKey,
        reviewedByUserId: actorId,
        reviewedAt: now,
        updatedAt: now,
        updatedBy: actorId,
      },
      { merge: true },
    );

    await db.collection("workflowSubmissionReviews").add({
      submissionId: normalizedSubmissionId,
      flowType: currentFlow,
      reviewerRole: actor.role,
      reviewerRoleKey: actor.roleKey,
      reviewerUserId: actorId,
      claimedScore: Number(submission.claimedScore || 0),
      verifiedScore: boundedVerifiedScore,
      remarks: String(remarks || ""),
      nextSubmitToRoles,
      createdAt: now,
    });

    return res.status(200).json({
      success: true,
      message: hasNextStep
        ? "Reviewed and moved to next workflow roles"
        : "Reviewed and finalized",
      data: {
        submissionId: normalizedSubmissionId,
        flowType: currentFlow,
        nextSubmitToRoles,
        status: hasNextStep
          ? currentFlow === "appeal"
            ? "appealed"
            : "submitted"
          : "approved",
      },
    });
  } catch (error) {
    console.error("Review workflow submission error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const submitWorkflowAppeal = async (req, res) => {
  try {
    const actor = await resolveActorContextFromAuthorizationHeader(
      req.headers.authorization,
    );

    if (!actor) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { formId, criteriaId, taskId, reason, requestedScore } =
      req.body || {};

    const normalizedFormId = String(formId || "").trim();
    const normalizedCriteriaId = String(criteriaId || "").trim();
    const normalizedTaskId = String(taskId || "").trim();

    if (!normalizedFormId || !normalizedCriteriaId || !normalizedTaskId) {
      return res.status(400).json({
        success: false,
        message: "formId, criteriaId and taskId are required",
      });
    }

    const actorId = String(actor.id || actor.uid || actor.email || "").trim();
    const submissionId = buildSubmissionDocId({
      facultyId: actorId,
      formId: normalizedFormId,
      criteriaId: normalizedCriteriaId,
      taskId: normalizedTaskId,
    });

    const submissionRef = db
      .collection(WORKFLOW_SUBMISSIONS_COLLECTION)
      .doc(submissionId);
    const submissionDoc = await submissionRef.get();

    if (!submissionDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Submission not found for this task",
      });
    }

    const submission = submissionDoc.data() || {};
    const actorIdentifierSet = buildActorIdentifierSet(actor);
    if (!isOwnedByActor(submission, actorIdentifierSet)) {
      return res.status(403).json({
        success: false,
        message: "You can only appeal your own submission",
      });
    }

    const workflowConfig = await getWorkflowConfig();
    const currentRule = findWorkflowRuleByRoleKey(
      workflowConfig.workflowRules,
      actor.roleKey,
    );

    const appealToRoles = normalizeRoleArray(
      currentRule?.appealToRoles || submission.appealToRoles,
    );

    if (appealToRoles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No appealToRoles configured for current role",
      });
    }

    const nowIso = new Date().toISOString();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const requested = Number(requestedScore);

    await submissionRef.set(
      {
        status: "appealed",
        currentFlow: "appeal",
        currentFlowRoles: appealToRoles,
        activeRoleKeys: appealToRoles.map((role) => normalizeRoleKey(role)),
        assignments: buildSubmittedAssignments(appealToRoles, nowIso),
        lastAppeal: {
          requestedByUserId: actorId,
          requestedByRole: actor.role,
          requestedByRoleKey: actor.roleKey,
          reason: String(reason || "").trim(),
          requestedScore: Number.isFinite(requested) ? requested : null,
          createdAtIso: nowIso,
        },
        updatedAt: now,
        updatedBy: actorId,
      },
      { merge: true },
    );

    return res.status(200).json({
      success: true,
      message: "Appeal submitted to workflow roles",
      data: {
        id: submissionId,
        appealToRoles,
        status: "appealed",
      },
    });
  } catch (error) {
    console.error("Submit workflow appeal error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


const resolveRoleFromFirebase = async (decodedToken, email) => {
  if (decodedToken?.committeeMember) {
    return {
      role: "committee",
      level:
        decodedToken?.level !== undefined
          ? Number(decodedToken.level)
          : undefined,
      college: decodedToken?.college || "", // ← add this
      department: decodedToken?.department || "",
      designation: decodedToken?.designation || "",
    };
  }

  if (decodedToken?.role) {
    const resolvedRole = String(decodedToken.role);
    const userSnap = await db.collection("users").doc(decodedToken.uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    let college = decodedToken?.college || "";
    const department = decodedToken?.department || "";
    const designation = userData?.designation || "";
    const hasPhd = userData?.hasPhd;

    // Principle/admin college lives in the "admins" collection, not in token claims
    if (
      !college &&
      (resolvedRole === "principle" ||
        resolvedRole === "principal" ||
        resolvedRole === "admin")
    ) {
      try {
        const adminSnap = await db
          .collection("admins")
          .where(
            "email",
            "==",
            String(email || "")
              .trim()
              .toLowerCase(),
          )
          .limit(1)
          .get();
        if (!adminSnap.empty) {
          college = adminSnap.docs[0].data()?.college || "";
        }
      } catch (e) {
        console.error(
          "resolveRoleFromFirebase: failed to fetch admin college",
          e,
        );
      }
    }

    return {
      role: resolvedRole,
      level:
        decodedToken?.level !== undefined
          ? Number(decodedToken.level)
          : undefined,
      college,
      department,
      designation,
      hasPhd,
    };
  }

  const userDoc = await db.collection("users").doc(decodedToken.uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data() || {};
    if (
      userData.committeeMember ||
      String(userData.role || "").toLowerCase() === "committee"
    ) {
      return {
        role: "committee",
        level:
          userData.level !== undefined ? Number(userData.level) : undefined,
        college: userData.college || "",
        department: userData.department || "",
        designation: userData.designation || "",
        hasPhd: userData.hasPhd,
      };
    }

    return {
      role: String(userData.role || "faculty"),
      level: userData.level !== undefined ? Number(userData.level) : undefined,
      college: userData.college || "",
      department: userData.department || "",
      designation: userData.designation || "",
      hasPhd: userData.hasPhd,
    };
  }

  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  if (normalizedEmail) {
    const committeeUserSnapshot = await db
      .collection("users")
      .where("email", "==", normalizedEmail)
      .limit(1)
      .get();

    if (!committeeUserSnapshot.empty) {
      const committeeData = committeeUserSnapshot.docs[0].data() || {};
      if (
        committeeData.committeeMember ||
        String(committeeData.role || "").toLowerCase() === "committee"
      ) {
        return {
          role: "committee",
          level:
            committeeData.level !== undefined
              ? Number(committeeData.level)
              : undefined,
          college: committeeData.college || "", // ← add this
          department: committeeData.department || "",
          designation: committeeData.designation || "",
        };
      }
    }
  }

  // Last resort: check admins collection by email
  const normalizedEmailFinal = String(email || "")
    .trim()
    .toLowerCase();
  if (normalizedEmailFinal) {
    try {
      const adminSnap = await db
        .collection("admins")
        .where("email", "==", normalizedEmailFinal)
        .limit(1)
        .get();
      if (!adminSnap.empty) {
        const adminData = adminSnap.docs[0].data() || {};
        return {
          role: "principle",
          level: undefined,
          college: adminData.college || "",
          department: "",
          designation: adminData.designation || "",
        };
      }
    } catch (e) {
      console.error("resolveRoleFromFirebase: admins fallback failed", e);
    }
  }

  return {
    role: "faculty",
    level: undefined,
    college: "",
    department: "",
    designation: "",
  };
};

export const unifiedLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Firebase web API key is not configured",
      });
    }

    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          password: String(password),
          returnSecureToken: true,
        }),
      },
    );

    const firebaseData = await firebaseResponse.json();
    if (!firebaseResponse.ok || !firebaseData?.idToken) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const decodedToken = await auth.verifyIdToken(firebaseData.idToken);
    const resolved = await resolveRoleFromFirebase(
      decodedToken,
      normalizedEmail,
    );

    // Look up the designation target from the superadmin college settings
    let designationTarget = "";
    let resolvedHasPhd = resolved.hasPhd;
    const resolvedCollege = resolved.college || "";
    const resolvedDesignation = resolved.designation || "";
    if (resolvedCollege && resolvedDesignation) {
      try {
        const normDesig = (s) => String(s || "").trim().toLowerCase();
        const saData = await getSuperadminConfig();
        const col = (saData.colleges || []).find(
          (c) => String(c?.name || "").trim().toLowerCase() === resolvedCollege.toLowerCase(),
        );
        if (col) {
          const candidates = (col.designations || []).filter(
            (d) => normDesig(d?.name) === normDesig(resolvedDesignation),
          );
          if (candidates.length > 0) {
            let des = candidates[0];
            if (resolvedHasPhd !== undefined && candidates.length > 1) {
              const exact = candidates.find(
                (d) => Boolean(d.phd) === Boolean(resolvedHasPhd),
              );
              if (exact) des = exact;
            }
            designationTarget = des?.target || "";
            if (resolvedHasPhd === undefined && des) {
              resolvedHasPhd = Boolean(des.phd);
            }
          }
        }
      } catch (e) {
        console.error("[unifiedLogin] designationTarget lookup failed:", e.message);
      }
    }

    return res.status(200).json({
      success: true,
      token: firebaseData.idToken,
      user: {
        id: decodedToken.uid,
        name: decodedToken.name || normalizedEmail.split("@")[0] || "User",
        email: decodedToken.email || normalizedEmail,
        role: resolved.role,
        level: resolved.level,
        college: resolved.college || "",
        department: resolved.department || "",
        designation: resolved.designation || "",
        designationTarget,
        hasPhd: Boolean(resolvedHasPhd ?? false),
      },
    });
  } catch (error) {
    console.error("Unified login error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to login at this time",
    });
  }
};

export const committeeLogin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  if (email !== process.env.COMMITTEE_EMAIL) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const isMatch = await bcrypt.compare(
    password,
    process.env.COMMITTEE_PASSWORD,
  );

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password",
    });
  }

  const payload = {
    role: "committee",
    email,
    type: "committee",
  };

  // For Firebase auth, return a simple success without JWT token
  return res.json({
    success: true,
    message: "Committee login successful",
    user: {
      email,
      role: "committee",
      name: "Committee Member",
    },
  });
};

export const addAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      college,
      phone,
      level,
      experience,
      hasPhd,
      role,
      dateOfJoining,
    } = req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedName = String(name || "").trim();
    const normalizedPhone = String(phone || "").trim();
    const normalizedCollege = String(college || "").trim();
    const normalizedLevel = Number(level);
    const normalizedExperience = Number(experience);
    const normalizedRole = normalizeAdminManagementRole(role || "principle");

    if (
      !isPrincipalRole(normalizedRole) &&
      !isVicePrincipalRole(normalizedRole)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    if (
      !normalizedName ||
      !normalizedEmail ||
      !password ||
      !normalizedCollege ||
      !normalizedPhone ||
      level === undefined ||
      experience === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (
      !Number.isFinite(normalizedLevel) ||
      !Number.isFinite(normalizedExperience) ||
      normalizedExperience < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid level or experience",
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    let userRecord;

    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
      return res.status(409).json({
        success: false,
        message: "Principal already exists",
      });
    } catch (error) {
      userRecord = await auth.createUser({
        email: normalizedEmail,
        password: String(password),
        displayName: normalizedName,
      });
    }

    await auth.setCustomUserClaims(userRecord.uid, {
      role: normalizedRole,
      level: normalizedLevel,
      principal: isPrincipalRole(normalizedRole),
      vicePrincipal: isVicePrincipalRole(normalizedRole),
    });

    const hashedPassword = await bcrypt.hash(String(password), 10);

    await db
      .collection("users")
      .doc(userRecord.uid)
      .set(
        {
          uid: userRecord.uid,
          name: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
          role: normalizedRole,
          level: normalizedLevel,
          password: hashedPassword,
          college: normalizedCollege,
          experience: normalizedExperience,
          hasPhd: Boolean(hasPhd),
          principal: isPrincipalRole(normalizedRole),
          vicePrincipal: isVicePrincipalRole(normalizedRole),
          isActive: true,
          ...(dateOfJoining ? { dateOfJoining: String(dateOfJoining) } : {}),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

    return res.status(201).json({
      success: true,
      message: "Principal added successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();

    const admins = usersSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((item) => {
        const normalizedRole = normalizeAdminManagementRole(item.role || "");
        return (
          isPrincipalRole(normalizedRole) || isVicePrincipalRole(normalizedRole)
        );
      });

    return res.json({
      success: true,
      data: admins,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const adminRef = db.collection("users").doc(id);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    try {
      await auth.deleteUser(id);
    } catch (authError) {
      if (authError?.code !== "auth/user-not-found") {
        throw authError;
      }
    }

    await adminRef.delete();

    return res.json({
      success: true,
      message: "Principal deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      password,
      college,
      phone,
      level,
      experience,
      hasPhd,
      role,
      dateOfJoining,
    } = req.body;

    const adminRef = db.collection("users").doc(id);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    const updateData = {};
    const authUpdate = {};

    if (name) {
      updateData.name = String(name).trim();
      authUpdate.displayName = String(name).trim();
    }
    if (email) {
      updateData.email = String(email).trim().toLowerCase();
      authUpdate.email = String(email).trim().toLowerCase();
    }
    if (phone) updateData.phone = String(phone).trim();
    if (college) updateData.college = String(college).trim();

    const currentData = adminDoc.data() || {};
    const resolvedRole = normalizeAdminManagementRole(
      role !== undefined ? role : currentData.role || "principle",
    );

    if (!isPrincipalRole(resolvedRole) && !isVicePrincipalRole(resolvedRole)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    updateData.role = resolvedRole;
    updateData.principal = isPrincipalRole(resolvedRole);
    updateData.vicePrincipal = isVicePrincipalRole(resolvedRole);
    if (level !== undefined) updateData.level = Number(level);
    if (experience !== undefined) updateData.experience = Number(experience);
    if (hasPhd !== undefined) updateData.hasPhd = Boolean(hasPhd);
    if (dateOfJoining !== undefined)
      updateData.dateOfJoining = String(dateOfJoining);

    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 6 characters long",
        });
      }
      updateData.password = await bcrypt.hash(String(password), 10);
      authUpdate.password = String(password);
    }

    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    const nextLevel =
      level !== undefined
        ? Number(level)
        : Number((adminDoc.data() || {}).level || 1);

    await auth.setCustomUserClaims(id, {
      role: resolvedRole,
      level: nextLevel,
      principal: isPrincipalRole(resolvedRole),
      vicePrincipal: isVicePrincipalRole(resolvedRole),
    });

    if (Object.keys(authUpdate).length > 0) {
      await auth.updateUser(id, authUpdate);
    }

    await adminRef.update(updateData);

    return res.json({
      success: true,
      message: "Principal updated successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const fetchAppealsForCommittee = async (req, res) => {
  try {
    const snapshot = await db.collection("appeals").get();
    const appeals = [];

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Fetch faculty details
      let faculty = {
        name: "Unknown",
        email: "Unknown",
        department: "Unknown",
        college: "Unknown",
      };
      try {
        const facultyRef = db.collection("faculty").doc(data.facultyId);
        const facultyDoc = await facultyRef.get();
        if (facultyDoc.exists) {
          const facultyData = facultyDoc.data();
          faculty = {
            name: facultyData.name || "Unknown",
            email: facultyData.email || "Unknown",
            department: facultyData.department || "Unknown",
            college: facultyData.college || "Unknown",
          };
        }
      } catch (err) {
        console.warn(`Failed to fetch faculty for ID: ${data.facultyId}`, err);
      }

      // Only include appeals with claimedScore and hodScore
      if (data.claimedScore !== undefined && data.hodScore !== undefined) {
        appeals.push({
          id: doc.id,
          faculty,
          ...data,
        });
      }
    }

    return res.status(200).json({ success: true, data: appeals });
  } catch (error) {
    console.error("Fetch Committee Appeals Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyAppealByCommittee = async (req, res) => {
  try {
    const { appealId } = req.params;
    const { committeeScore, committeeRemarks } = req.body;

    if (committeeScore === undefined) {
      return res.status(400).json({
        success: false,
        message: "Committee score is required",
      });
    }

    const ref = db.collection("appeals").doc(appealId);
    const doc = await ref.get();

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        message: "Appeal not found",
      });
    }

    const appealData = doc.data();

    if (
      appealData.claimedScore === undefined ||
      appealData.hodScore === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Appeal cannot be verified: missing faculty or HOD score",
      });
    }

    await ref.update({
      committeeScore,
      committeeRemarks: committeeRemarks || "",
      verifiedByCommittee: true,
      status: "committee_verified",
      committeeVerifiedAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Appeal successfully verified by committee",
    });
  } catch (error) {
    console.error("Verify Appeal Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCommitteeColleges = async (req, res) => {
  try {
    const superadminDocId = process.env.SUPERADMIN_DOC_ID || "root";
    const superadminDoc = await db
      .collection("superadmin")
      .doc(superadminDocId)
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
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Get committee colleges error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getCommitteeRoles = async (req, res) => {
  try {
    const superadminDocId = process.env.SUPERADMIN_DOC_ID || "root";
    const superadminDoc = await db
      .collection("superadmin")
      .doc(superadminDocId)
      .get();

    if (!superadminDoc.exists) {
      return res.status(200).json({ success: true, data: [] });
    }

    const data = superadminDoc.data() || {};
    const roles = Array.isArray(data.roles) ? data.roles : [];

    const result = roles
      .map((item) => ({
        id: item.id,
        name: item.name,
        level: Number(item.level),
      }))
      .filter((item) => item.name && Number.isFinite(item.level))
      .sort(
        (a, b) =>
          a.level - b.level || String(a.name).localeCompare(String(b.name)),
      );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Get committee roles error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getSubmissionAppealWorkflowRules = async (req, res) => {
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
    const workflowRules = Array.isArray(data.workflowRules)
      ? data.workflowRules
      : [];

    const roleNames = new Set(
      roles.map((item) => normalizeRoleKey(item?.name || "")).filter(Boolean),
    );

    const normalizeRoleList = (value, fallbackValue) => {
      const fromValue = Array.isArray(value)
        ? value.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

      if (fromValue.length > 0) {
        return Array.from(new Set(fromValue));
      }

      const fallback = String(fallbackValue || "").trim();
      return fallback ? [fallback] : [];
    };

    const result = workflowRules
      .map((item) => ({
        role: String(item?.role || "").trim(),
        submitToRoles: normalizeRoleList(
          item?.submitToRoles,
          item?.submitToRole,
        ).filter((role) => roleNames.has(normalizeRoleKey(role))),
        appealToRoles: normalizeRoleList(
          item?.appealToRoles,
          item?.appealToRole,
        ).filter((role) => roleNames.has(normalizeRoleKey(role))),
      }))
      .filter(
        (item) => item.role && roleNames.has(normalizeRoleKey(item.role)),
      );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Get workflow rules error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateSubmissionAppealWorkflowRules = async (req, res) => {
  try {
    const rules = Array.isArray(req.body?.rules) ? req.body.rules : null;

    if (!rules) {
      return res.status(400).json({
        success: false,
        message: "Rules must be provided",
      });
    }

    const superadminRef = db.collection("superadmin").doc(SUPERADMIN_DOC_ID);
    const superadminDoc = await superadminRef.get();
    const data = superadminDoc.exists ? superadminDoc.data() || {} : {};

    const roles = Array.isArray(data.roles) ? data.roles : [];
    const roleNames = new Set(
      roles.map((item) => normalizeRoleKey(item?.name || "")).filter(Boolean),
    );

    const normalizeRoleList = (value, fallbackValue) => {
      const fromValue = Array.isArray(value)
        ? value.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

      if (fromValue.length > 0) {
        return Array.from(new Set(fromValue));
      }

      const fallback = String(fallbackValue || "").trim();
      return fallback ? [fallback] : [];
    };

    const normalizedRules = rules
      .map((item) => ({
        role: String(item?.role || "").trim(),
        submitToRoles: normalizeRoleList(
          item?.submitToRoles,
          item?.submitToRole,
        ),
        appealToRoles: normalizeRoleList(
          item?.appealToRoles,
          item?.appealToRole,
        ),
      }))
      .filter((item) => item.role);

    const allowedAppealRoleKeys = new Set([
      "committee",
      "principle",
      "internalcommittee",
    ]);

    const hasInvalidRole = normalizedRules.some(
      (item) =>
        !roleNames.has(normalizeRoleKey(item.role)) ||
        item.submitToRoles.some(
          (role) => !roleNames.has(normalizeRoleKey(role)),
        ) ||
        item.appealToRoles.some(
          (role) => !roleNames.has(normalizeRoleKey(role)),
        ),
    );

    if (hasInvalidRole) {
      return res.status(400).json({
        success: false,
        message: "Workflow rules contain invalid roles",
      });
    }

    const hasInvalidAppealReviewer = normalizedRules.some((item) =>
      item.appealToRoles.some(
        (role) => !allowedAppealRoleKeys.has(normalizeRoleKey(role)),
      ),
    );

    if (hasInvalidAppealReviewer) {
      return res.status(400).json({
        success: false,
        message:
          "Appeal roles can only include Principal, Committee, or Internal Committee",
      });
    }

    const uniqueByRole = new Map();
    normalizedRules.forEach((item) => {
      uniqueByRole.set(item.role, item);
    });

    await superadminRef.set(
      {
        workflowRules: Array.from(uniqueByRole.values()),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    invalidateSuperadminCache();

    return res.status(200).json({
      success: true,
      message: "Workflow rules updated successfully",
      data: Array.from(uniqueByRole.values()),
    });
  } catch (error) {
    console.error("Update workflow rules error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getApplicableForms = async (req, res) => {
  try {
    let role = await resolveRoleFromAuthorizationHeader(
      req.headers.authorization,
    );

    // Dev mode fallback: check x-user-role header
    if (!role && req.headers["x-user-role"]) {
      role = normalizeRoleValue(req.headers["x-user-role"]);
    }

    const requesterRole = role;
    const requestedRole = normalizeRoleValue(req.query?.role || "");
    const canOverrideRole = [
      "committee",
      "principle",
      "vice principle",
      "internal committee",
    ].includes(String(requesterRole || ""));

    if (requestedRole && canOverrideRole) {
      role = requestedRole;
    }

    if (!role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const formsSnapshot = await formsCollectionRef()
      .orderBy("updatedAt", "desc")
      .get();

    const forms = await Promise.all(
      formsSnapshot.docs.map(async (doc) => {
        const data = doc.data() || {};
        const applicableRoles = Array.isArray(data.applicableRoles)
          ? data.applicableRoles.map((item) => normalizeRoleValue(item))
          : [];

        if (!applicableRoles.includes(role)) {
          return null;
        }

        const criteriaSnapshot = await formsCollectionRef()
          .doc(doc.id)
          .collection("criteria")
          .orderBy("order", "asc")
          .get();

        const criteria = criteriaSnapshot.docs.map((criteriaDoc) => {
          const criteriaData = criteriaDoc.data() || {};
          return {
            id: criteriaDoc.id,
            criteriaName: String(criteriaData.criteriaName || "").trim(),
            order: Number(criteriaData.order || 0),
          };
        });

        return {
          id: doc.id,
          formTitle: String(data.formTitle || "").trim(),
          applicableRoles,
          criteria,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      data: forms.filter(Boolean),
    });
  } catch (error) {
    console.error("Get applicable forms error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getCriteriaModulesTasks = async (req, res) => {
  try {
    const { formId, criteriaId } = req.params;
    let role = await resolveRoleFromAuthorizationHeader(
      req.headers.authorization,
    );

    // Dev mode fallback: check x-user-role header
    if (!role && req.headers["x-user-role"]) {
      role = normalizeRoleValue(req.headers["x-user-role"]);
    }

    if (!role) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const formDoc = await formsCollectionRef().doc(formId).get();
    if (!formDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    const formData = formDoc.data() || {};
    const applicableRoles = Array.isArray(formData.applicableRoles)
      ? formData.applicableRoles.map((item) => normalizeRoleValue(item))
      : [];

    if (!applicableRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied for this role",
      });
    }

    const criteriaDoc = await formsCollectionRef()
      .doc(formId)
      .collection("criteria")
      .doc(criteriaId)
      .get();
    if (!criteriaDoc.exists) {
      return res.status(404).json({
        success: false,
        message: "Criteria not found",
      });
    }

    const [modulesSnapshot, tasksSnapshot] = await Promise.all([
      formsCollectionRef()
        .doc(formId)
        .collection("modules")
        .where("criteriaId", "==", criteriaId)
        .get(),
      formsCollectionRef()
        .doc(formId)
        .collection("tasks")
        .where("criteriaId", "==", criteriaId)
        .get(),
    ]);

    const tasksByModuleId = tasksSnapshot.docs.reduce((acc, doc) => {
      const data = doc.data() || {};
      const moduleId = String(data.moduleId || "");
      if (!acc[moduleId]) acc[moduleId] = [];
      acc[moduleId].push({
        id: doc.id,
        title: String(data.title || "").trim(),
        subtitle: String(data.subtitle || "").trim(),
        description: String(data.description || "").trim(),
        assessmentCriteria: String(data.assessmentCriteria || "").trim(),
        evidence: String(data.evidence || "").trim(),
        reference: String(data.reference || "").trim(),
        marks: Number(data.marks || 0),
        marksType: String(data.marksType || "fixed"),
        minMarks: data.minMarks !== undefined ? Number(data.minMarks) : null,
        note: String(data.note || ""),
        order: Number(data.order || 0),
      });
      return acc;
    }, {});

    Object.values(tasksByModuleId).forEach((items) => {
      items.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    });

    const modules = modulesSnapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          moduleNumber: Number(data.moduleNumber || 0),
          moduleName: String(data.moduleName || "").trim(),
          totalMarks: Number(data.totalMarks || 0),
          order: Number(data.order || 0),
          tasks: tasksByModuleId[doc.id] || [],
        };
      })
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    const criteriaData = criteriaDoc.data() || {};

    return res.status(200).json({
      success: true,
      data: {
        formId,
        formTitle: String(formData.formTitle || "").trim(),
        criteria: {
          id: criteriaDoc.id,
          criteriaName: String(criteriaData.criteriaName || "").trim(),
          totalMarks: Number(criteriaData.totalMarks || 0),
          modules,
        },
      },
    });
  } catch (error) {
    console.error("Get criteria modules/tasks error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getCommitteeDashboard = async (req, res) => {
  try {
    const normDesig = (s) => String(s || "").trim().toLowerCase();

    // Optional college filter — when provided, scopes all queries to one college
    // which is critical at scale (prevents full-collection reads).
    const filterCollege = String(req.query?.college || "").trim();

    // Build designation target map from cache — zero Firestore reads
    const saData = await getSuperadminConfig();
    const collegeDesignationMap = {};
    (saData.colleges || []).forEach((c) => {
      const key = String(c?.name || "").trim().toLowerCase();
      collegeDesignationMap[key] = {};
      (c.designations || []).forEach((d) => {
        if (d?.name) collegeDesignationMap[key][normDesig(d.name)] = d.target || "";
      });
    });

    // Fetch users — scoped to college when provided, hard-capped to prevent OOM
    let usersQuery = db.collection("users");
    if (filterCollege) usersQuery = usersQuery.where("college", "==", filterCollege);
    const usersSnap = await usersQuery.limit(500).get();

    // Fetch submissions — scoped to college when provided
    let subsQuery = db.collection("submissions");
    if (filterCollege) subsQuery = subsQuery.where("college", "==", filterCollege);
    const submissionsSnap = await subsQuery.limit(2000).get();

    const submissionsMap = new Map();
    submissionsSnap.docs.forEach((doc) => {
      const sub = { id: doc.id, ...doc.data() };
      if (!submissionsMap.has(sub.userId)) submissionsMap.set(sub.userId, []);
      submissionsMap.get(sub.userId).push(sub);
    });

    const staff = usersSnap.docs.map((doc) => {
      const data = doc.data();
      const collegeKey = String(data.college || "").trim().toLowerCase();
      const designTargetMap = collegeDesignationMap[collegeKey] || {};
      return {
        ...data,
        id: doc.id,
        designationTarget: designTargetMap[normDesig(data.designation || "")] || "",
        submissions: submissionsMap.get(data.uid) || [],
      };
    });

    return res.json({ success: true, data: { staff } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Old password and new password are required",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Server configuration error",
      });
    }

    // Resolve user email and uid from token or dev headers
    let userEmail = null;
    let userUid = null;

    const authHeader = req.headers.authorization;
    const isDev = process.env.NODE_ENV !== "production";

    if (isDev && req.headers["x-user-email"] && req.headers["x-user-id"]) {
      userEmail = String(req.headers["x-user-email"]).trim().toLowerCase();
      userUid = String(req.headers["x-user-id"]);
    } else if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = await auth.verifyIdToken(token);
        userEmail = decoded.email;
        userUid = decoded.uid;
      } catch {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: "Could not determine user email",
      });
    }

    // Verify old password by signing in with Firebase REST API
    const verifyResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userEmail,
          password: String(oldPassword),
          returnSecureToken: true,
        }),
      },
    );

    const verifyData = await verifyResponse.json();
    if (!verifyResponse.ok || !verifyData?.idToken) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Resolve uid from the verified token if not already set
    if (!userUid) {
      const decoded = await auth.verifyIdToken(verifyData.idToken);
      userUid = decoded.uid;
    }

    // Update password via Firebase Admin SDK
    await auth.updateUser(userUid, { password: String(newPassword) });

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("[changePassword] Error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const resolveActorFromRequest = async (req) => {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const userId = req.headers["x-user-id"];
    const userEmail = req.headers["x-user-email"];
    const userName = req.headers["x-user-name"];
    const userRole = req.headers["x-user-role"];
    const userCollege = req.headers["x-college"];
    const userDepartment = req.headers["x-department"];

    if (userId && userEmail) {
      return {
        uid: userId,
        id: userId,
        email: userEmail,
        name: userName || userEmail,
        role: normalizeRoleValue(userRole || "faculty"),
        roleKey: normalizeRoleKey(userRole || "faculty"),
        college: userCollege || "",
        department: userDepartment || "",
      };
    }
  }

  return resolveActorContextFromAuthorizationHeader(req.headers.authorization);
};

export const getMyReviewerAssignment = async (req, res) => {
  try {
    const actor = await resolveActorFromRequest(req);
    if (!actor?.uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const snapshot = await db
      .collection("departmentReviewers")
      .where("reviewerUid", "==", actor.uid)
      .where("isActive", "==", true)
      .get();

    const assignments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({ success: true, data: assignments });
  } catch (error) {
    console.error("Get reviewer assignment error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getReviewerDepartmentSubmissions = async (req, res) => {
  try {
    const actor = await resolveActorFromRequest(req);
    if (!actor?.uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const assignmentSnap = await db
      .collection("departmentReviewers")
      .where("reviewerUid", "==", actor.uid)
      .where("isActive", "==", true)
      .get();

    if (assignmentSnap.empty) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned as a reviewer for any department",
      });
    }

    const myReviewsSnap = await db
      .collection("departmentReviews")
      .where("reviewerUid", "==", actor.uid)
      .get();

    const reviewedSubmissionIds = new Set(
      myReviewsSnap.docs.map((d) => d.data().submissionId),
    );

    const allSubmissions = [];

    for (const assignDoc of assignmentSnap.docs) {
      const assignment = assignDoc.data();

      const subSnap = await db
        .collection("submissions")
        .where("college", "==", assignment.college)
        .where("department", "==", assignment.department)
        .where("userRole", "==", "faculty")
        .get();

      const subs = subSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        assignmentId: assignDoc.id,
        assignedDepartment: assignment.department,
        isReviewedByMe: reviewedSubmissionIds.has(doc.id),
      }));

      allSubmissions.push(...subs);
    }

    return res.status(200).json({ success: true, data: allSubmissions });
  } catch (error) {
    console.error("Get reviewer submissions error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const submitReviewerFeedback = async (req, res) => {
  try {
    const actor = await resolveActorFromRequest(req);
    if (!actor?.uid) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { submissionId } = req.params;
    const { verifiedScore, remarks } = req.body || {};

    if (verifiedScore === undefined || verifiedScore === null) {
      return res
        .status(400)
        .json({ success: false, message: "Verified score is required" });
    }

    const subDoc = await db
      .collection("submissions")
      .doc(String(submissionId))
      .get();

    if (!subDoc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const subData = subDoc.data() || {};

    if (subData.userRole && subData.userRole !== "faculty") {
      return res.status(403).json({
        success: false,
        message: "Peer reviewers can only review faculty submissions. HOD and other role submissions follow the committee workflow.",
      });
    }

    const assignSnap = await db
      .collection("departmentReviewers")
      .where("reviewerUid", "==", actor.uid)
      .where("college", "==", subData.college)
      .where("department", "==", subData.department)
      .where("isActive", "==", true)
      .get();

    if (assignSnap.empty) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to review this department's submissions",
      });
    }

    const existingReviewSnap = await db
      .collection("departmentReviews")
      .where("submissionId", "==", String(submissionId))
      .where("reviewerUid", "==", actor.uid)
      .get();

    if (!existingReviewSnap.empty) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this submission",
      });
    }

    await db.collection("departmentReviews").add({
      submissionId: String(submissionId),
      reviewerUid: actor.uid,
      reviewerName: actor.name || "",
      reviewerEmail: actor.email || "",
      college: subData.college || "",
      department: subData.department || "",
      verifiedScore: Number(verifiedScore),
      remarks: String(remarks || ""),
      status: "reviewed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("submissions").doc(String(submissionId)).update({
      peerReviewScore: Number(verifiedScore),
      peerReviewReason: String(remarks || ""),
      peerReviewerId: actor.uid,
      peerReviewerName: actor.name || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res
      .status(201)
      .json({ success: true, message: "Review submitted successfully" });
  } catch (error) {
    console.error("Submit reviewer feedback error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
