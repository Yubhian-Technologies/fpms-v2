import { db } from "../config/firebase.js";
import { getSuperadminConfig } from "../config/superadminCache.js";

const FINALIZED = new Set(["accepted", "appeal-resolved", "auto-approved", "appeal-expired"]);

const getConfirmedScore = (sub) => {
  if (FINALIZED.has(sub.status)) {
    return Number(sub.finalScore ?? sub.score ?? 0);
  }
  return 0;
};

export const getCollegeFaculty = async (req, res) => {
  try {
    const { college } = req.query;
    if (!college) return res.status(400).json({ success: false, message: "College is required" });
    const collegeName = String(college).trim();

    const excluded = new Set(["committee", "viewer", "superadmin", "internal committee", "principal", "principle", "vice principal", "vice principle", "vice-principal", "viceprincipal", "director"]);

    const normStr = (s) => String(s || "").trim().toLowerCase();
    const FINALIZED = new Set(["accepted", "appeal-resolved", "auto-approved", "appeal-expired"]);

    const [usersSnap, subsSnap, saData] = await Promise.all([
      db.collection("users")
        .where("college", "==", collegeName)
        .select("uid", "name", "email", "role", "department", "designation", "staffStatus", "statusNote", "hasPhd")
        .get(),
      db.collection("submissions")
        .where("college", "==", collegeName)
        .select("userId", "status", "claimedScore", "reviewerScore", "finalScore", "isAppealed")
        .get(),
      getSuperadminConfig(),
    ]);

    // Build designation → target map for this college (keyed by name__phd / name__nophd)
    const collegeConfig = (saData.colleges || []).find((c) => normStr(c?.name) === normStr(collegeName));
    const desigMap = {};
    (collegeConfig?.designations || []).forEach((d) => {
      if (!d?.name) return;
      const key = normStr(d.name);
      const phdKey = `${key}__${d.phd ? "phd" : "nophd"}`;
      desigMap[phdKey] = Number(d.target) || 0;
      // Fallback: store plain key only if not already set (first entry wins)
      if (!desigMap[key]) desigMap[key] = Number(d.target) || 0;
    });

    // Group submissions by userId
    const subsByUser = new Map();
    subsSnap.docs.forEach((doc) => {
      const s = { id: doc.id, ...doc.data() };
      if (!subsByUser.has(s.userId)) subsByUser.set(s.userId, []);
      subsByUser.get(s.userId).push(s);
    });

    const submittedUids = new Set(subsSnap.docs.map((d) => d.data().userId).filter(Boolean));

    const faculty = usersSnap.docs
      .map((doc) => {
        const d = doc.data();
        if (excluded.has(normStr(d.role))) return null;

        const subs = subsByUser.get(doc.id) || [];
        const designKey = normStr(d.designation);
        const phdKey = `${designKey}__${d.hasPhd ? "phd" : "nophd"}`;
        const targetScore = desigMap[phdKey] || desigMap[designKey] || 0;

        const claimedScore = subs.reduce((sum, s) => sum + (Number(s.claimedScore) || 0), 0);
        const reviewerScore = subs.reduce((sum, s) => sum + (s.reviewerScore != null ? Number(s.reviewerScore) : 0), 0);
        const finalScore = subs.reduce((sum, s) => FINALIZED.has(s.status) ? sum + Number(s.finalScore ?? s.score ?? 0) : sum, 0);
        const isAppealed = subs.some((s) => s.status === "appealed" || s.isAppealed);
        const percentage = targetScore > 0 ? Math.round((reviewerScore / targetScore) * 100) : null;

        const FINALIZED_SET = ["accepted", "appeal-resolved", "auto-approved", "appeal-expired"];
        const hasAppealed  = subs.some((s) => s.status === "appealed");
        const hasPending   = subs.some((s) => s.status === "submitted");
        const hasCompleted = subs.some((s) => FINALIZED_SET.includes(s.status));
        let overallStatus = "Not Submitted";
        if (subs.length > 0) {
          if (hasAppealed)       overallStatus = "Appealed";
          else if (hasPending)   overallStatus = "Pending Review";
          else if (hasCompleted) overallStatus = "Completed";
          else                   overallStatus = "Under Review";
        }

        return {
          uid: doc.id,
          name: d.name || "",
          email: d.email || "",
          role: d.role || "",
          department: d.department || "",
          designation: d.designation || "",
          staffStatus: d.staffStatus || null,
          statusNote: d.statusNote || null,
          hasPhd: Boolean(d.hasPhd),
          hasSubmitted: submittedUids.has(doc.id),
          submissionCount: subs.length,
          targetScore,
          claimedScore,
          reviewerScore,
          finalScore,
          isAppealed,
          percentage,
          overallStatus,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a.department || "").localeCompare(b.department || "") || (a.name || "").localeCompare(b.name || ""));

    return res.json({ success: true, data: faculty });
  } catch (err) {
    console.error("getCollegeFaculty error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getViewerStats = async (req, res) => {
  try {
    const normStr = (s) => String(s || "").trim().toLowerCase();

    const saData = await getSuperadminConfig();

    const collegeDesignationMap = {};
    const collegeCodeMap = {};
    const collegeDeadlineMap = {};
    (saData.colleges || []).forEach((c) => {
      const key = normStr(c?.name);
      collegeDesignationMap[key] = {};
      if (c?.code) collegeCodeMap[key] = String(c.code).trim().toUpperCase();
      collegeDeadlineMap[key] = {
        submissionStart: c?.assessmentStart || null,
        submissionEnd: c?.assessmentEnd || c?.deadline || null,
        evaluationEnd: c?.evaluationEnd || null,
        appealEnd: c?.appealEnd || null,
        appealReviewEnd: c?.appealReviewEnd || null,
      };
      (c.designations || []).forEach((d) => {
        if (!d?.name) return;
        const nameKey = normStr(d.name);
        const phdKey = `${nameKey}__${d.phd ? "phd" : "nophd"}`;
        collegeDesignationMap[key][phdKey] = Number(d.target) || 0;
        if (!collegeDesignationMap[key][nameKey]) {
          collegeDesignationMap[key][nameKey] = Number(d.target) || 0;
        }
      });
    });

    const [usersSnap, subsSnap] = await Promise.all([
      db.collection("users").select("uid", "college", "role", "department", "designation", "name", "email", "hasPhd", "staffStatus").get(),
      db.collection("submissions").select("userId", "college", "status", "finalScore", "score").get(),
    ]);

    const subsMap = new Map();
    subsSnap.docs.forEach((doc) => {
      const sub = { id: doc.id, ...doc.data() };
      if (!subsMap.has(sub.userId)) subsMap.set(sub.userId, []);
      subsMap.get(sub.userId).push(sub);
    });

    const excludedRoles = new Set(["committee", "viewer", "superadmin", "internal committee"]);
    const isDeanRole = (r) => { const n = String(r || "").trim().toLowerCase(); return n.includes("dean") || n.includes("training"); };

    const staff = usersSnap.docs
      .map((doc) => {
        const data = doc.data();
        const role = normStr(data.role);
        const college = String(data.college || "").trim();
        if (!college || excludedRoles.has(role)) return null;
        const collegeKey = normStr(college);
        const desigMap = collegeDesignationMap[collegeKey] || {};
        const nameKey = normStr(data.designation);
        const phdKey = `${nameKey}__${data.hasPhd ? "phd" : "nophd"}`;
        const target = desigMap[phdKey] || desigMap[nameKey] || 0;
        const userSubs = subsMap.get(data.uid) || [];
        const score = userSubs.reduce((sum, s) => sum + getConfirmedScore(s), 0);
        const INACTIVE_STATUSES = new Set(["long-leave", "maternity-leave"]);
        const isActive = !INACTIVE_STATUSES.has(normStr(data.staffStatus || ""));
        return {
          uid: data.uid || doc.id,
          name: data.name || "",
          email: data.email || "",
          role,
          college,
          department: String(data.department || "").trim(),
          designation: String(data.designation || "").trim(),
          target,
          score,
          isActive,
          submissionCount: userSubs.length,
          acceptedCount: userSubs.filter((s) => FINALIZED.has(s.status)).length,
          appealedCount: userSubs.filter((s) => s.status === "appealed").length,
          pendingReviewCount: userSubs.filter((s) => s.status === "submitted").length,
          reviewedCount: userSubs.filter((s) => s.status === "reviewed").length,
        };
      })
      .filter(Boolean);

    // College-wise aggregation
    const collegeMap = {};
    staff.forEach((s) => {
      const c = s.college;
      if (!collegeMap[c]) {
        const code = collegeCodeMap[normStr(c)] || "";
        collegeMap[c] = {
          college: c, code,
          total: 0, activeStaff: 0, submitted: 0,
          submissionCount: 0, acceptedCount: 0,
          appealedCount: 0, pendingReviewCount: 0, reviewedCount: 0,
          totalScore: 0, totalTarget: 0,
        };
      }
      collegeMap[c].total++;
      if (s.isActive) collegeMap[c].activeStaff++;
      if (s.submissionCount > 0) collegeMap[c].submitted++;
      collegeMap[c].submissionCount += s.submissionCount;
      collegeMap[c].acceptedCount += s.acceptedCount;
      collegeMap[c].appealedCount += s.appealedCount;
      collegeMap[c].pendingReviewCount += s.pendingReviewCount;
      collegeMap[c].reviewedCount += s.reviewedCount;
      collegeMap[c].totalScore += s.score;
      collegeMap[c].totalTarget += s.target;
    });
    const collegeStats = Object.values(collegeMap).map((c) => ({
      ...c,
      avgScore: c.total ? Math.round(c.totalScore / c.total) : 0,
      completionPct: c.totalTarget ? Math.round((c.totalScore / c.totalTarget) * 100) : 0,
      submissionRate: c.total ? Math.round((c.submitted / c.total) * 100) : 0,
      deadlines: collegeDeadlineMap[normStr(c.college)] || null,
    }));

    // Dept-wise aggregation
    const deptKey = (college, dept) => `${college}|||${dept}`;
    const deptMap = {};
    staff.filter((s) => !isDeanRole(s.role) && s.department).forEach((s) => {
      const key = deptKey(s.college, s.department);
      if (!deptMap[key]) {
        deptMap[key] = {
          college: s.college, department: s.department,
          total: 0, submitted: 0,
          submissionCount: 0, acceptedCount: 0, appealedCount: 0,
          totalScore: 0, totalTarget: 0,
        };
      }
      deptMap[key].total++;
      if (s.submissionCount > 0) deptMap[key].submitted++;
      deptMap[key].submissionCount += s.submissionCount;
      deptMap[key].acceptedCount += s.acceptedCount;
      deptMap[key].appealedCount += s.appealedCount;
      deptMap[key].totalScore += s.score;
      deptMap[key].totalTarget += s.target;
    });
    const deptStats = Object.values(deptMap).map((d) => ({
      ...d,
      avgScore: d.total ? Math.round(d.totalScore / d.total) : 0,
      completionPct: d.totalTarget ? Math.round((d.totalScore / d.totalTarget) * 100) : 0,
      submissionRate: d.total ? Math.round((d.submitted / d.total) * 100) : 0,
    }));

    // Role-wise aggregation
    const roleMap = {};
    staff.forEach((s) => {
      const r = s.role || "unknown";
      if (!roleMap[r]) {
        roleMap[r] = {
          role: r, total: 0, submitted: 0,
          submissionCount: 0, acceptedCount: 0,
          totalScore: 0, totalTarget: 0,
        };
      }
      roleMap[r].total++;
      if (s.submissionCount > 0) roleMap[r].submitted++;
      roleMap[r].submissionCount += s.submissionCount;
      roleMap[r].acceptedCount += s.acceptedCount;
      roleMap[r].totalScore += s.score;
      roleMap[r].totalTarget += s.target;
    });
    const roleStats = Object.values(roleMap)
      .map((r) => ({
        ...r,
        avgScore: r.total ? Math.round(r.totalScore / r.total) : 0,
        completionPct: r.totalTarget ? Math.round((r.totalScore / r.totalTarget) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Range-wise aggregation
    const rangeBands = [
      { label: "0%", min: 0, max: 0 },
      { label: "1–25%", min: 1, max: 25 },
      { label: "26–50%", min: 26, max: 50 },
      { label: "51–75%", min: 51, max: 75 },
      { label: "76–99%", min: 76, max: 99 },
      { label: "100%+", min: 100, max: Infinity },
    ];
    const rangeCounts = rangeBands.map((b) => ({ ...b, count: 0 }));
    staff.forEach((s) => {
      const pct = s.target > 0 ? Math.round((s.score / s.target) * 100) : 0;
      for (const band of rangeCounts) {
        if (pct >= band.min && pct <= band.max) {
          band.count++;
          break;
        }
      }
    });

    const totalSubmissions = staff.reduce((sum, s) => sum + s.submissionCount, 0);
    const totalAppealed = staff.reduce((sum, s) => sum + s.appealedCount, 0);
    const totalPendingReview = staff.reduce((sum, s) => sum + s.pendingReviewCount, 0);
    const totalReviewed = staff.reduce((sum, s) => sum + s.reviewedCount, 0);
    const totalAccepted = staff.reduce((sum, s) => sum + s.acceptedCount, 0);
    const uniqueDepts = new Set(
      staff.filter((s) => s.department && !isDeanRole(s.role)).map((s) => `${s.college}|||${s.department}`)
    ).size;

    const summary = {
      totalStaff: staff.length,
      totalColleges: collegeStats.length,
      totalDepts: uniqueDepts,
      totalSubmitted: staff.filter((s) => s.submissionCount > 0).length,
      totalSubmissions,
      totalAppealed,
      totalPendingReview,
      totalReviewed,
      totalAccepted,
      overallAvgScore: staff.length ? Math.round(staff.reduce((sum, s) => sum + s.score, 0) / staff.length) : 0,
    };

    return res.json({
      success: true,
      data: { summary, collegeStats, deptStats, roleStats, rangeStats: rangeCounts },
    });
  } catch (err) {
    console.error("[getViewerStats]", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
