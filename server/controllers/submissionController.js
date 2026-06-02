import admin from "firebase-admin";
import { db } from "../config/firebase.js";
import { getSuperadminConfig } from "../config/superadminCache.js";

// Returns current assessment phase based on college config dates
const getCollegePhase = (collegeDef) => {
  const toEndOfDay = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return d;
  };
  const now = new Date();
  const deadline = toEndOfDay(collegeDef?.deadline);
  const evaluationEnd = toEndOfDay(collegeDef?.evaluationEnd);
  const appealEnd = toEndOfDay(collegeDef?.appealEnd);
  const appealReviewEnd = toEndOfDay(collegeDef?.appealReviewEnd);

  if (!deadline || now <= deadline) return "submission";
  if (!evaluationEnd || now <= evaluationEnd) return "evaluation";
  if (!appealEnd || now <= appealEnd) return "appeal";
  if (!appealReviewEnd || now <= appealReviewEnd) return "appeal-review";
  return "locked";
};

// Runs auto-approval for every college whose evaluation period has passed.
// Used when the caller (e.g. committee) has no single college context.
const autoApproveAllColleges = async () => {
  try {
    const saData = await getSuperadminConfig();
    await Promise.all(
      (saData.colleges || [])
        .filter((c) => {
          const phase = getCollegePhase(c);
          return phase === "appeal" || phase === "appeal-review" || phase === "locked";
        })
        .map((c) => autoApproveUnreviewedForCollege(String(c.name || "").trim()))
    );
  } catch (err) {
    console.error("autoApproveAllColleges error:", err);
  }
};

// Auto-approves all "submitted" (unreviewed) submissions for a college when
// the evaluation period has ended. Idempotent — safe to call on every fetch.
const autoApproveUnreviewedForCollege = async (college) => {
  if (!college) return;
  try {
    const saData = await getSuperadminConfig();
    const collegeDef = (saData.colleges || []).find(
      (c) => String(c?.name || "").trim().toLowerCase() === college.trim().toLowerCase()
    );
    const phase = getCollegePhase(collegeDef);
    if (phase !== "appeal" && phase !== "appeal-review" && phase !== "locked") return;

    const snapshot = await db.collection("submissions")
      .where("college", "==", college)
      .where("status", "==", "submitted")
      .get();
    if (snapshot.empty) return;

    const now = new Date().toISOString();
    const CHUNK = 400;
    for (let i = 0; i < snapshot.docs.length; i += CHUNK) {
      const batch = db.batch();
      snapshot.docs.slice(i, i + CHUNK).forEach((doc) => {
        const claimedScore = Number(doc.data().claimedScore ?? 0);
        batch.update(doc.ref, {
          status: "auto-approved",
          reviewerScore: claimedScore,
          finalScore: claimedScore,
          reviewerReason: "Auto-approved: evaluation period ended without HOD review.",
          reviewerId: "system",
          reviewerRole: "system",
          updatedAt: now,
        });
      });
      await batch.commit();
    }
  } catch (err) {
    console.error("autoApproveUnreviewedForCollege error:", err);
  }
};

const normalizeRoleForWorkflow = (value) => {
  const role = String(value || "")
    .trim()
    .toLowerCase();

  if (role === "principal" || role === "principle" || role === "admin") {
    return "principle";
  }

  if (role === "committee" || role === "commitee") {
    return "committee";
  }

  if (role === "internal committee" || role === "internal commitee") {
    return "internal committee";
  }

  return role;
};

const isPrincipalRole = (value) =>
  normalizeRoleForWorkflow(value) === "principle";
const isCommitteeRole = (value) =>
  normalizeRoleForWorkflow(value) === "committee";
const isInternalCommitteeRole = (value) =>
  normalizeRoleForWorkflow(value) === "internal committee";

const parseBearerToken = (authorizationHeader) => {
  const value = String(authorizationHeader || "").trim();
  if (!value.toLowerCase().startsWith("bearer ")) return "";
  return value.slice(7).trim();
};

const resolveReviewerScope = async (req) => {
  const scope = {
    userId: String(
      req.user?.uid || req.user?.id || req.headers["x-user-id"] || "",
    ).trim(),
    userEmail: String(req.user?.email || req.headers["x-user-email"] || "")
      .trim()
      .toLowerCase(),
    userRole: normalizeRoleForWorkflow(
      req.user?.role || req.headers["x-user-role"] || "",
    ),
    college: String(req.user?.college || req.headers["x-college"] || "").trim(),
    department: String(
      req.user?.department || req.headers["x-department"] || "",
    ).trim(),
  };

  const token = parseBearerToken(req.headers?.authorization);
  if (token) {
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);

      if (!scope.userId) scope.userId = String(decodedToken?.uid || "").trim();
      if (!scope.userEmail) {
        scope.userEmail = String(decodedToken?.email || "")
          .trim()
          .toLowerCase();
      }
      if (!scope.userRole) {
        scope.userRole = normalizeRoleForWorkflow(
          decodedToken?.role || decodedToken?.claims?.role || "",
        );
      }
      if (!scope.college) {
        scope.college = String(
          decodedToken?.college || decodedToken?.claims?.college || "",
        ).trim();
      }
      if (!scope.department) {
        scope.department = String(
          decodedToken?.department || decodedToken?.claims?.department || "",
        ).trim();
      }
    } catch (error) {
      console.warn("resolveReviewerScope: token decode failed", error?.message);
    }
  }

  const fillScopeFromUsersDoc = (userData = {}) => {
    if (!scope.userRole) {
      scope.userRole = normalizeRoleForWorkflow(userData.role || "");
    }
    if (!scope.college) scope.college = String(userData.college || "").trim();
    if (!scope.department) {
      scope.department = String(userData.department || "").trim();
    }
  };

  if (
    scope.userId &&
    (!scope.college || !scope.department || !scope.userRole)
  ) {
    try {
      const userDoc = await db.collection("users").doc(scope.userId).get();
      if (userDoc.exists) fillScopeFromUsersDoc(userDoc.data() || {});
    } catch (error) {
      console.warn(
        "resolveReviewerScope: users doc lookup failed",
        error?.message,
      );
    }
  }

  if (
    scope.userEmail &&
    (!scope.college || !scope.department || !scope.userRole)
  ) {
    try {
      const usersByEmail = await db
        .collection("users")
        .where("email", "==", scope.userEmail)
        .limit(1)
        .get();

      if (!usersByEmail.empty) {
        fillScopeFromUsersDoc(usersByEmail.docs[0].data() || {});
      }
    } catch (error) {
      console.warn(
        "resolveReviewerScope: users email lookup failed",
        error?.message,
      );
    }
  }

  if (isPrincipalRole(scope.userRole) && !scope.college) {
    try {
      if (scope.userId) {
        const adminDoc = await db.collection("admins").doc(scope.userId).get();
        if (adminDoc.exists) {
          scope.college = String(adminDoc.data()?.college || "").trim();
        }
      }

      if (!scope.college && scope.userEmail) {
        const adminsByEmail = await db
          .collection("admins")
          .where("email", "==", scope.userEmail)
          .limit(1)
          .get();

        if (!adminsByEmail.empty) {
          scope.college = String(
            adminsByEmail.docs[0].data()?.college || "",
          ).trim();
        }
      }
    } catch (error) {
      console.warn(
        "resolveReviewerScope: admins lookup failed",
        error?.message,
      );
    }
  }

  return scope;
};

const loadWorkflowRules = async (college) => {
  const data = await getSuperadminConfig();
  const normalizedCollege = String(college || "").trim();
  if (normalizedCollege && data.collegeWorkflowRules && Array.isArray(data.collegeWorkflowRules[normalizedCollege])) {
    return data.collegeWorkflowRules[normalizedCollege];
  }
  return Array.isArray(data.workflowRules) ? data.workflowRules : [];
};



const getEffectiveAppealRoleIds = (submission, workflowRules = []) => {
  const submitterRole = normalizeRoleForWorkflow(submission?.userRole || "");

  const matchingRule = workflowRules.find(
    (rule) => normalizeRoleForWorkflow(rule?.role) === submitterRole,
  );

  const fromRule = Array.isArray(matchingRule?.appealToRoles)
    ? matchingRule.appealToRoles
    : [];
  const fromSubmission = Array.isArray(submission?.appealToRoleIds)
    ? submission.appealToRoleIds
    : [];

  const source = fromRule.length > 0 ? fromRule : fromSubmission;
  return Array.from(
    new Set(
      source.map((role) => normalizeRoleForWorkflow(role)).filter(Boolean),
    ),
  );
};

// Submit a task (Faculty)
export const submitTask = async (req, res) => {
  try {
    const {
      formId,
      formTitle,
      criteriaId,
      criteriaName,
      taskId,
      taskName,
      moduleId,
      moduleName,
      maxMarks,
      marksType,
      minMarks,
      claimedScore,
      evidence,
      description,
      criteriaTotalMarks,
      moduleTotalMarks,
    } = req.body;

    const userId = req.user?.uid || req.user?.id || req.headers["x-user-id"];
    const userEmail = req.user?.email || req.headers["x-user-email"];
    const userName =
      req.user?.name || req.user?.displayName || req.headers["x-user-name"];
    const userRole = (
      req.user?.role ||
      req.headers["x-user-role"] ||
      "faculty"
    ).toLowerCase();

    // Fetch college and department from users collection
    let college = "";
    let department = "";

    if (userId) {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        college = userData.college || "";
        department = userData.department || "";
      }
    }


    if (
      !userId ||
      !formId ||
      !criteriaId ||
      !taskId ||
      claimedScore === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }
    let finalEvidence = "";

    if (req.file) {
      finalEvidence = req.file.path;
    } else {
      finalEvidence = evidence || "";
    }

    // Phase check: submissions only allowed during the submission phase (applies to all roles)
    const saData = await getSuperadminConfig();
    const collegeDef = (saData.colleges || []).find(
      (c) => String(c?.name || "").trim().toLowerCase() === (college || "").trim().toLowerCase()
    );
    if (collegeDef) {
      const phase = getCollegePhase(collegeDef);
      if (phase === "evaluation") {
        return res.status(403).json({ success: false, message: "Submission period has ended. Evaluations are now in progress." });
      }
      if (phase === "appeal") {
        return res.status(403).json({ success: false, message: "Submission period has ended. Appeal period is now active." });
      }
      if (phase === "appeal-review") {
        return res.status(403).json({ success: false, message: "Submission period has ended. Appeal review is in progress." });
      }
      if (phase === "locked") {
        return res.status(403).json({ success: false, message: "Scores are locked. No submissions are accepted." });
      }
    }

    const workflowRules = await loadWorkflowRules(college);
    if (!workflowRules.length) {
      return res.status(400).json({
        success: false,
        message: "Superadmin configuration not found",
      });
    }

    const userRule = workflowRules.find(
      (r) => (r.role || "").toLowerCase().trim() === userRole.trim(),
    );

    if (
      !userRule ||
      !Array.isArray(userRule.submitToRoles) ||
      userRule.submitToRoles.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: `No workflow configured for role: ${userRole}. Available roles: ${workflowRules.map((r) => r.role).join(", ")}`,
      });
    }

    const submitToRoleIds = userRule.submitToRoles.map((role) =>
      role.toLowerCase(),
    );
    const appealToRoleIds = (userRule.appealToRoles || []).map((role) =>
      role.toLowerCase(),
    );

    // Check if submission already exists for this task
    const existingSnapshot = await db
      .collection("submissions")
      .where("userId", "==", userId)
      .where("formId", "==", formId)
      .where("criteriaId", "==", criteriaId)
      .where("moduleId", "==", moduleId)
      .where("taskId", "==", taskId)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      const existing = existingSnapshot.docs[0];
      return res.status(200).json({
        success: true,
        message: "Submission already exists",
        data: {
          id: existing.id,
          ...existing.data(),
          submitToRoleIds,
          appealToRoleIds,
        },
      });
    }

    // Create new submission
    const submission = {
      formId,
      formTitle: formTitle || formId,
      criteriaId,
      criteriaName: criteriaName || criteriaId,
      taskId,
      taskName: taskName || taskId,
      moduleId: moduleId || null,
      moduleName: moduleName || null,
      userId,
      userEmail: userEmail || "",
      userName: userName || "",
      userRole,
      college: college || "",
      department: department || "",
      claimedScore: Number(claimedScore),
      evidence: finalEvidence,
      description: description || "",
      maxMarks: Number(maxMarks || 0),
      marksType: marksType || "fixed",
      minMarks: Number(minMarks || 0),
      criteriaTotalMarks: Number(criteriaTotalMarks || 0),
      moduleTotalMarks: Number(moduleTotalMarks || 0),
      reviewerScore: null,
      reviewerReason: null,
      isAppealed: false,
      appealReason: null,
      appealRequestedScore: null,
      appealerScore: null,
      appealerReason: null,
      status: "submitted",
      finalScore: null,
      submitToRoleIds,
      appealToRoleIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("submissions").add(submission);

    return res.status(201).json({
      success: true,
      message: "Task submitted successfully",
      data: { id: docRef.id, ...submission, submitToRoleIds, appealToRoleIds },
    });
  } catch (error) {
    console.error("submitTask error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error submitting task",
    });
  }
};

export const updateSubmission = async (req, res) => {
  try {
    const { id } = req.params; // submission ID from URL
    const { description, claimedScore } = req.body;

    const userId = req.user?.uid || req.user?.id || req.headers["x-user-id"];

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Submission ID is required",
      });
    }

    const docRef = db.collection("submissions").doc(id);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const data = docSnap.data();

    // 🔐 Allow only owner to edit
    if (data.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // 🔒 LOCK if reviewer has given score
    if (data.reviewerScore !== null) {
      return res.status(400).json({
        success: false,
        message: "Cannot edit after review",
      });
    }

    // If new file uploaded
    let finalEvidence = data.evidence;
    if (req.file) {
      finalEvidence = req.file.path;
    }

    await docRef.update({
      description: description ?? data.description,
      claimedScore:
        claimedScore !== undefined ? Number(claimedScore) : data.claimedScore,
      evidence: finalEvidence,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Submission updated successfully",
    });
  } catch (error) {
    console.error("updateSubmission error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Get my submissions
export const getMySubmissions = async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id || req.headers["x-user-id"];
    let userCollege = String(
      req.user?.college || req.headers["x-college"] || "",
    ).trim();
    const { formId, criteriaId } = req.query;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    if (!userCollege && userId) {
      try {
        const userDoc = await db.collection("users").doc(String(userId)).get();
        if (userDoc.exists) {
          userCollege = String(userDoc.data()?.college || "").trim();
        }
      } catch (_) {}
    }

    // Auto-approve unreviewed submissions if evaluation period has ended
    await autoApproveUnreviewedForCollege(userCollege);

    let query = db.collection("submissions").where("userId", "==", userId);

    if (formId) query = query.where("formId", "==", formId);
    if (criteriaId) query = query.where("criteriaId", "==", criteriaId);

    const snapshot = await query.get();

    // Map all documents with complete field data
    const submissions = snapshot.docs.map((doc) => {
      const data = doc.data();

      // Return complete document with all fields
      return {
        id: doc.id,
        formId: data.formId || null,
        formTitle: data.formTitle || null,
        criteriaId: data.criteriaId || null,
        criteriaName: data.criteriaName || null,
        taskId: data.taskId || null,
        taskName: data.taskName || null,
        moduleId: data.moduleId || null,
        moduleName: data.moduleName || null,
        userId: data.userId || null,
        userEmail: data.userEmail || null,
        userName: data.userName || null,
        userRole: data.userRole || null,
        college: data.college || null,
        department: data.department || null,
        claimedScore: data.claimedScore || null,
        criteriaTotalMarks: data.criteriaTotalMarks || null,
        moduleTotalMarks: data.moduleTotalMarks || null,
        evidence: data.evidence || null,
        description: data.description || null,
        maxMarks: data.maxMarks || null,
        marksType: data.marksType || "fixed",
        minMarks: data.minMarks || null,
        reviewerScore: data.reviewerScore || null,
        reviewerReason: data.reviewerReason || null,
        reviewerId: data.reviewerId || null,
        reviewerRole: data.reviewerRole || null,
        isAppealed: data.isAppealed || false,
        appealReason: data.appealReason || null,
        appealRequestedScore: data.appealRequestedScore || null,
        appealerScore: data.appealerScore || null,
        appealerReason: data.appealerReason || null,
        appealerId: data.appealerId || null,
        appealerRole: data.appealerRole || null,
        status: data.status || "pending",
        finalScore: data.finalScore || null,
        submitToRoleIds: data.submitToRoleIds || [],
        appealToRoleIds: data.appealToRoleIds || [],
        createdAt: data.createdAt || null,
        updatedAt: data.updatedAt || null,
      };
    });

    return res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error("getMySubmissions error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching submissions",
    });
  }
};

// Get review queue (HOD/Committee)
export const getReviewQueue = async (req, res) => {
  try {
    const { userId, userRole, college, department } = await resolveReviewerScope(req);

    if (!userRole) {
      return res
        .status(401)
        .json({ success: false, message: "User role not found" });
    }

    if (isPrincipalRole(userRole) && !college) {
      return res.status(403).json({
        success: false,
        message: "Principal college not found. Please login again.",
      });
    }

    // Auto-approve unreviewed submissions if evaluation period has ended
    if (college) {
      await autoApproveUnreviewedForCollege(college);
    } else if (isCommitteeRole(userRole)) {
      await autoApproveAllColleges();
    }

    let query = db
      .collection("submissions")
      .where("status", "==", "submitted")
      .where("submitToRoleIds", "array-contains", userRole);

    if (college) query = query.where("college", "==", college);
    if (
      department &&
      !isCommitteeRole(userRole) &&
      !isInternalCommitteeRole(userRole) &&
      !isPrincipalRole(userRole)
    ) {
      query = query.where("department", "==", department);
    }

    const snapshot = await query.get();
    let submissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error("getReviewQueue error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching review queue",
    });
  }
};

// Get reviewed submissions (HOD/Committee)
export const getReviewedSubmissions = async (req, res) => {
  try {
    const { userId, userRole, college, department } =
      await resolveReviewerScope(req);

    if (!userId || !userRole) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    if (isPrincipalRole(userRole) && !college) {
      return res.status(403).json({
        success: false,
        message: "Principal college not found. Please login again.",
      });
    }

    // Fetch all submissions reviewed by this user (regardless of current status)
    let query = db.collection("submissions").where("reviewerId", "==", userId);

    if (college) query = query.where("college", "==", college);
    if (
      department &&
      !isCommitteeRole(userRole) &&
      !isInternalCommitteeRole(userRole) &&
      !isPrincipalRole(userRole)
    ) {
      query = query.where("department", "==", department);
    }

    const snapshot = await query.get();
    const submissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error("getReviewedSubmissions error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching reviewed submissions",
    });
  }
};

// Review a submission
export const reviewSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerScore, reviewerReason } = req.body;
    const reviewerId =
      req.user?.uid || req.user?.id || req.headers["x-user-id"];
    const reviewerRole = req.user?.role || req.headers["x-user-role"];

    if (reviewerScore === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Reviewer score required" });
    }

    const docRef = db.collection("submissions").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Phase check: block review after evaluation period ends
    const subData = doc.data();
    const saDataForReview = await getSuperadminConfig();
    const collegeDefForReview = (saDataForReview.colleges || []).find(
      (c) => String(c?.name || "").trim().toLowerCase() === String(subData?.college || "").trim().toLowerCase()
    );
    if (collegeDefForReview) {
      const phase = getCollegePhase(collegeDefForReview);
      if (phase === "submission") {
        return res.status(403).json({ success: false, message: "Evaluation has not started yet. HODs can only review during the evaluation period." });
      }
      if (phase === "appeal") {
        return res.status(403).json({ success: false, message: "Evaluation period has ended. Reviews are no longer accepted." });
      }
      if (phase === "appeal-review") {
        return res.status(403).json({ success: false, message: "Evaluation period has ended. Reviews are no longer accepted." });
      }
      if (phase === "locked") {
        return res.status(403).json({ success: false, message: "Scores are locked. The appeal period has ended." });
      }
    }

    await docRef.update({
      status: "reviewed",
      reviewerScore: Number(reviewerScore),
      reviewerReason: reviewerReason || "",
      reviewerId: reviewerId || null,
      reviewerRole: reviewerRole || null,
      finalScore: Number(reviewerScore),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Submission reviewed successfully",
    });
  } catch (error) {
    console.error("reviewSubmission error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error reviewing submission",
    });
  }
};

// Raise an appeal
export const raiseAppeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { appealReason, appealRequestedScore } = req.body;

    if (!appealReason) {
      return res
        .status(400)
        .json({ success: false, message: "Appeal reason required" });
    }

    const docRef = db.collection("submissions").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const data = doc.data();
    if (data.status !== "reviewed") {
      return res.status(400).json({
        success: false,
        message: "Can only appeal reviewed submissions",
      });
    }

    if (data.isAppealed) {
      return res.status(400).json({
        success: false,
        message: "Appeal already submitted",
      });
    }

    // Phase check: appeals only allowed during the appeal period
    const saDataForAppeal = await getSuperadminConfig();
    const collegeDefForAppeal = (saDataForAppeal.colleges || []).find(
      (c) => String(c?.name || "").trim().toLowerCase() === String(data?.college || "").trim().toLowerCase()
    );
    if (collegeDefForAppeal) {
      const phase = getCollegePhase(collegeDefForAppeal);
      if (phase === "submission" || phase === "evaluation") {
        return res.status(403).json({ success: false, message: "Appeals are not open yet. The evaluation period must end first." });
      }
      if (phase === "appeal-review") {
        return res.status(403).json({ success: false, message: "The appeal window has closed. No new appeals are accepted." });
      }
      if (phase === "locked") {
        return res.status(403).json({ success: false, message: "Scores are locked. The appeal period has ended." });
      }
    }

    const workflowRules = await loadWorkflowRules(data.college);
    const effectiveAppealToRoleIds = getEffectiveAppealRoleIds(
      data,
      workflowRules,
    );

    await docRef.update({
      status: "appealed",
      isAppealed: true,
      appealReason,
      appealToRoleIds: effectiveAppealToRoleIds,
      appealRequestedScore: appealRequestedScore
        ? Number(appealRequestedScore)
        : data.claimedScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Appeal submitted successfully",
      data: { appealToRoleIds: effectiveAppealToRoleIds },
    });
  } catch (error) {
    console.error("raiseAppeal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error raising appeal",
    });
  }
};

// Accept review (Faculty accepts reviewer's score)
export const acceptReview = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.uid || req.user?.id || req.headers["x-user-id"];

    const docRef = db.collection("submissions").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const data = doc.data();

    // Verify this is the user's submission
    if (data.userId !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    if (data.status !== "reviewed") {
      return res.status(400).json({
        success: false,
        message: "Can only accept reviewed submissions",
      });
    }

    await docRef.update({
      status: "accepted",
      finalScore: data.reviewerScore,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user's total score in users collection
    if (
      userId &&
      data.reviewerScore !== null &&
      data.reviewerScore !== undefined
    ) {
      const userRef = db.collection("users").doc(userId);
      await userRef.update({
        totalScore: admin.firestore.FieldValue.increment(data.reviewerScore),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Review accepted successfully",
    });
  } catch (error) {
    console.error("acceptReview error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error accepting review",
    });
  }
};

// Get appeal queue
export const getAppealQueue = async (req, res) => {
  try {
    const { userRole, college, department } = await resolveReviewerScope(req);

    if (!userRole) {
      return res
        .status(401)
        .json({ success: false, message: "User role not found" });
    }

    if (isPrincipalRole(userRole) && !college) {
      return res.status(403).json({
        success: false,
        message: "Principal college not found. Please login again.",
      });
    }

    // Auto-approve any missed unreviewed submissions before processing appeals
    if (college) {
      await autoApproveUnreviewedForCollege(college);
    } else if (isCommitteeRole(userRole)) {
      await autoApproveAllColleges();
    }

    let query = db.collection("submissions").where("status", "==", "appealed");

    if (isPrincipalRole(userRole) && college) {
      query = query.where("college", "==", college);
    } else if (isInternalCommitteeRole(userRole) && college) {
      query = query.where("college", "==", college);
    } else if (!isCommitteeRole(userRole)) {
      if (college) query = query.where("college", "==", college);
      if (department) query = query.where("department", "==", department);
    }

    const snapshot = await query.get();
    const workflowRules = await loadWorkflowRules(college);

    const mappedAppeals = snapshot.docs.map((doc) => {
      const data = doc.data() || {};
      const currentAppealToRoleIds = Array.isArray(data.appealToRoleIds)
        ? data.appealToRoleIds
        : [];
      const effectiveAppealToRoleIds = getEffectiveAppealRoleIds(
        data,
        workflowRules,
      );

      const currentNormalized = Array.from(
        new Set(
          currentAppealToRoleIds
            .map((role) => normalizeRoleForWorkflow(role))
            .filter(Boolean),
        ),
      ).sort();
      const effectiveNormalized = [...effectiveAppealToRoleIds].sort();
      const shouldSyncAppealToRoles =
        JSON.stringify(currentNormalized) !==
        JSON.stringify(effectiveNormalized);

      return {
        id: doc.id,
        ...data,
        appealToRoleIds: effectiveAppealToRoleIds,
        shouldSyncAppealToRoles,
      };
    });

    const appeals = mappedAppeals.filter((item) =>
      item.appealToRoleIds.includes(userRole),
    );

    await Promise.all(
      appeals
        .filter((item) => item.shouldSyncAppealToRoles)
        .map(async (item) => {
          const docRef = db.collection("submissions").doc(item.id);
          await docRef.update({
            appealToRoleIds: item.appealToRoleIds,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }),
    );

    return res.status(200).json({
      success: true,
      data: appeals,
    });
  } catch (error) {
    console.error("getAppealQueue error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching appeal queue",
    });
  }
};

// Review an appeal
export const reviewAppeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { appealerScore, appealerReason } = req.body;
    const {
      userId: appealerId,
      userRole: appealerRole,
      college: reviewerCollege,
    } = await resolveReviewerScope(req);
    const normalizedAppealerRole = normalizeRoleForWorkflow(appealerRole);

    if (appealerScore === undefined) {
      return res
        .status(400)
        .json({ success: false, message: "Appealer score required" });
    }

    const docRef = db.collection("submissions").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res
        .status(404)
        .json({ success: false, message: "Appeal not found" });
    }

    const submissionData = doc.data() || {};

    // Phase check: appeal resolution allowed during appeal AND appeal-review phases
    const saDataForAppealReview = await getSuperadminConfig();
    const collegeDefForAppealReview = (saDataForAppealReview.colleges || []).find(
      (c) => String(c?.name || "").trim().toLowerCase() === String(submissionData?.college || "").trim().toLowerCase()
    );
    if (collegeDefForAppealReview) {
      const phase = getCollegePhase(collegeDefForAppealReview);
      if (phase === "submission" || phase === "evaluation") {
        return res.status(403).json({ success: false, message: "Appeal resolution is not available yet. Wait for the appeal period." });
      }
      if (phase === "locked") {
        return res.status(403).json({ success: false, message: "Scores are locked. The appeal review period has ended." });
      }
      // "appeal" and "appeal-review" both allow resolution — fall through
    }

    const appealToRoleIds = Array.isArray(submissionData.appealToRoleIds)
      ? submissionData.appealToRoleIds
      : [];
    const normalizedAppealRoles = appealToRoleIds.map((role) =>
      normalizeRoleForWorkflow(role),
    );

    if (
      !normalizedAppealerRole ||
      !normalizedAppealRoles.includes(normalizedAppealerRole)
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to review this appeal",
      });
    }

    if (
      isPrincipalRole(normalizedAppealerRole) ||
      isInternalCommitteeRole(normalizedAppealerRole)
    ) {
      if (!reviewerCollege) {
        return res.status(403).json({
          success: false,
          message: "Reviewer college not found. Please login again.",
        });
      }

      if (
        String(submissionData.college || "").trim() !==
        String(reviewerCollege || "").trim()
      ) {
        return res.status(403).json({
          success: false,
          message: "You can only review appeals from your own college",
        });
      }
    }

    await docRef.update({
      status: "appeal-resolved",
      appealerScore: Number(appealerScore),
      appealerReason: appealerReason || "",
      appealerId: appealerId || null,
      appealerRole: normalizedAppealerRole || null,
      finalScore: Number(appealerScore),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update user's total score in users collection
    const facultyUserId = submissionData.userId;
    if (
      facultyUserId &&
      appealerScore !== null &&
      appealerScore !== undefined
    ) {
      const userRef = db.collection("users").doc(facultyUserId);
      await userRef.update({
        totalScore: admin.firestore.FieldValue.increment(Number(appealerScore)),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Appeal reviewed successfully",
    });
  } catch (error) {
    console.error("reviewAppeal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error reviewing appeal",
    });
  }
};

// Get appeals resolved by the current appealer
export const getResolvedAppeals = async (req, res) => {
  try {
    const appealerId =
      req.user?.uid || req.user?.id || req.headers["x-user-id"];
    const college = req.user?.college || req.headers["x-college"];
    const department = req.user?.department || req.headers["x-department"];

    if (!appealerId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    let query = db
      .collection("submissions")
      .where("appealerId", "==", appealerId);

    if (college) query = query.where("college", "==", college);
    if (department) query = query.where("department", "==", department);

    const snapshot = await query.get();
    const resolved = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      data: resolved,
    });
  } catch (error) {
    console.error("getResolvedAppeals error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching resolved appeals",
    });
  }
};

// Get user total score
export const getUserTotal = async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.id || req.headers["x-user-id"];
    const { formId } = req.query;

    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    let query = db
      .collection("submissions")
      .where("userId", "==", userId)
      .where("status", "in", ["reviewed", "appeal-resolved", "auto-approved"]);

    if (formId) query = query.where("formId", "==", formId);

    const snapshot = await query.get();
    let totalScore = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      totalScore += Number(data.finalScore || 0);
    });

    return res.status(200).json({
      success: true,
      data: { totalScore, submissionCount: snapshot.size },
    });
  } catch (error) {
    console.error("getUserTotal error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Error calculating total score",
    });
  }
};

// Delete a submission so the faculty can resubmit fresh
export const deleteSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    const docRef = db.collection("submissions").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    await docRef.delete();

    return res.status(200).json({ success: true, message: "Submission deleted. Faculty can now resubmit." });
  } catch (error) {
    console.error("deleteSubmission error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
