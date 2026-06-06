import { db } from "../config/firebase.js";
import { getSuperadminConfig } from "../config/superadminCache.js";

const getConfirmedScore = (sub) => {
  if (sub.status === "accepted" || sub.status === "appeal-resolved" || sub.status === "auto-approved") {
    return Number(sub.finalScore ?? sub.score ?? 0);
  }
  return 0;
};

export const getViewerStats = async (req, res) => {
  try {
    const normStr = (s) => String(s || "").trim().toLowerCase();

    const saData = await getSuperadminConfig();

    // Build designation target map and college code lookup
    const collegeDesignationMap = {};
    const collegeCodeMap = {}; // college name (lowercase) -> code
    (saData.colleges || []).forEach((c) => {
      const key = normStr(c?.name);
      collegeDesignationMap[key] = {};
      if (c?.code) collegeCodeMap[key] = String(c.code).trim().toUpperCase();
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

    // Fetch only the fields needed for aggregation — no cap, minimal transfer
    const [usersSnap, subsSnap] = await Promise.all([
      db.collection("users").select("uid", "college", "role", "department", "designation", "name", "email", "hasPhd").get(),
      db.collection("submissions").select("userId", "college", "status", "finalScore", "score").get(),
    ]);

    // Build submissions map: userId -> submissions[]
    const subsMap = new Map();
    subsSnap.docs.forEach((doc) => {
      const sub = { id: doc.id, ...doc.data() };
      if (!subsMap.has(sub.userId)) subsMap.set(sub.userId, []);
      subsMap.get(sub.userId).push(sub);
    });

    // Roles that are system/admin accounts — excluded from all stats
    const excludedRoles = new Set(["committee", "viewer", "superadmin", "internal committee"]);
    const isDeanRole = (r) => String(r || "").trim().toLowerCase().includes("dean");

    // Build enriched staff list — skip accounts with no college and system roles
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
          submissionCount: userSubs.length,
          acceptedCount: userSubs.filter(
            (s) => s.status === "accepted" || s.status === "appeal-resolved" || s.status === "auto-approved",
          ).length,
        };
      })
      .filter(Boolean);

    // --- College-wise aggregation ---
    const collegeMap = {};
    staff.forEach((s) => {
      const c = s.college;
      if (!collegeMap[c]) {
        const code = collegeCodeMap[normStr(c)] || "";
        collegeMap[c] = { college: c, code, total: 0, submitted: 0, totalScore: 0, totalTarget: 0 };
      }
      collegeMap[c].total++;
      if (s.submissionCount > 0) collegeMap[c].submitted++;
      collegeMap[c].totalScore += s.score;
      collegeMap[c].totalTarget += s.target;
    });
    const collegeStats = Object.values(collegeMap).map((c) => ({
      ...c,
      avgScore: c.total ? Math.round(c.totalScore / c.total) : 0,
      completionPct: c.totalTarget ? Math.round((c.totalScore / c.totalTarget) * 100) : 0,
    }));

    // --- Dept-wise aggregation (per college) — skip deans, they have no department ---
    const deptKey = (college, dept) => `${college}|||${dept}`;
    const deptMap = {};
    staff.filter((s) => !isDeanRole(s.role) && s.department).forEach((s) => {
      const key = deptKey(s.college, s.department);
      if (!deptMap[key]) {
        deptMap[key] = {
          college: s.college,
          department: s.department,
          total: 0,
          submitted: 0,
          totalScore: 0,
          totalTarget: 0,
        };
      }
      deptMap[key].total++;
      if (s.submissionCount > 0) deptMap[key].submitted++;
      deptMap[key].totalScore += s.score;
      deptMap[key].totalTarget += s.target;
    });
    const deptStats = Object.values(deptMap).map((d) => ({
      ...d,
      avgScore: d.total ? Math.round(d.totalScore / d.total) : 0,
      completionPct: d.totalTarget ? Math.round((d.totalScore / d.totalTarget) * 100) : 0,
    }));

    // --- Role-wise aggregation ---
    const roleMap = {};
    staff.forEach((s) => {
      const r = s.role || "unknown";
      if (!roleMap[r]) {
        roleMap[r] = { role: r, total: 0, submitted: 0, totalScore: 0, totalTarget: 0 };
      }
      roleMap[r].total++;
      if (s.submissionCount > 0) roleMap[r].submitted++;
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

    // --- Range-wise aggregation (% of target achieved) ---
    // Bands: 0%, 1-25%, 26-50%, 51-75%, 76-99%, 100%+
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

    // --- Summary totals ---
    const summary = {
      totalStaff: staff.length,
      totalColleges: collegeStats.length,
      totalSubmitted: staff.filter((s) => s.submissionCount > 0).length,
      overallAvgScore:
        staff.length ? Math.round(staff.reduce((sum, s) => sum + s.score, 0) / staff.length) : 0,
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
