import { db } from "../config/firebase.js";
import { getSuperadminConfig } from "../config/superadminCache.js";

const getConfirmedScore = (sub) => {
  if (sub.status === "accepted" || sub.status === "appeal-resolved") {
    return Number(sub.finalScore ?? sub.score ?? 0);
  }
  return 0;
};

export const getViewerStats = async (req, res) => {
  try {
    const normStr = (s) => String(s || "").trim().toLowerCase();

    const saData = await getSuperadminConfig();

    // Build designation target map
    const collegeDesignationMap = {};
    (saData.colleges || []).forEach((c) => {
      const key = normStr(c?.name);
      collegeDesignationMap[key] = {};
      (c.designations || []).forEach((d) => {
        if (d?.name) collegeDesignationMap[key][normStr(d.name)] = Number(d.target) || 0;
      });
    });

    // Fetch all users and submissions (up to scale limits)
    const [usersSnap, subsSnap] = await Promise.all([
      db.collection("users").limit(2000).get(),
      db.collection("submissions").limit(5000).get(),
    ]);

    // Build submissions map: userId -> submissions[]
    const subsMap = new Map();
    subsSnap.docs.forEach((doc) => {
      const sub = { id: doc.id, ...doc.data() };
      if (!subsMap.has(sub.userId)) subsMap.set(sub.userId, []);
      subsMap.get(sub.userId).push(sub);
    });

    // Build enriched staff list
    const staff = usersSnap.docs.map((doc) => {
      const data = doc.data();
      const collegeKey = normStr(data.college);
      const desigMap = collegeDesignationMap[collegeKey] || {};
      const target = desigMap[normStr(data.designation)] || 0;
      const userSubs = subsMap.get(data.uid) || [];
      const score = userSubs.reduce((sum, s) => sum + getConfirmedScore(s), 0);
      return {
        uid: data.uid || doc.id,
        name: data.name || "",
        email: data.email || "",
        role: normStr(data.role),
        college: String(data.college || "").trim(),
        department: String(data.department || "").trim(),
        designation: String(data.designation || "").trim(),
        target,
        score,
        submissionCount: userSubs.length,
        acceptedCount: userSubs.filter(
          (s) => s.status === "accepted" || s.status === "appeal-resolved",
        ).length,
      };
    });

    // --- College-wise aggregation ---
    const collegeMap = {};
    staff.forEach((s) => {
      const c = s.college || "Unknown";
      if (!collegeMap[c]) {
        collegeMap[c] = { college: c, total: 0, submitted: 0, totalScore: 0, totalTarget: 0 };
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

    // --- Dept-wise aggregation (per college) ---
    const deptKey = (college, dept) => `${college}|||${dept || "No Department"}`;
    const deptMap = {};
    staff.forEach((s) => {
      const key = deptKey(s.college || "Unknown", s.department);
      if (!deptMap[key]) {
        deptMap[key] = {
          college: s.college || "Unknown",
          department: s.department || "No Department",
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
