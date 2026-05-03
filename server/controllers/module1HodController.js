import { db } from "../config/firebase.js";

export const hodSubmitSubsection = async (req, res) => {
  try {
    const { hodId, subId } = req.params;
    const { criteria, subsectionName } = req.body;

    if (!criteria || !Array.isArray(criteria) || criteria.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Criteria is required",
      });
    }

    if (req.hod.id !== hodId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const ref = db.collection("module1_hod").doc(hodId);
    const snap = await ref.get();

    let subsections = snap.exists ? snap.data().subsections || [] : [];
    const subIndex = subsections.findIndex((s) => s.id === subId);

    const criteriaMap = {};

    if (subIndex > -1) {
      (subsections[subIndex].criteria || []).forEach((c) => {
        criteriaMap[c.name] = c;
      });
    }

    criteria.forEach((c) => {
      const old = criteriaMap[c.name];

      if (old?.isVerified) return;

      criteriaMap[c.name] = {
        name: c.name,
        claimedScore: Number(c.claimedScore) || 0,
        maxScore: Number(c.maxScore) || 0,
        evidence: c.evidence || "",
        hodDescription: c.description || "",
        adminScore: old?.adminScore ?? null,
        adminDescription: old?.adminDescription ?? "",
        isVerified: false,
      };
    });

    const updatedCriteria = Object.values(criteriaMap);

    const subsectionData = {
      id: subId,
      name: subsectionName || `Subsection ${subId}`,
      maxScore: updatedCriteria.reduce((sum, c) => sum + (c.maxScore || 0), 0),
      criteria: updatedCriteria,
    };

    if (subIndex > -1) subsections[subIndex] = subsectionData;
    else subsections.push(subsectionData);

    await ref.set({ subsections }, { merge: true });

    res.status(200).json({
      success: true,
      message: "HOD subsection submitted successfully",
    });
  } catch (error) {
    console.error("HOD Submit Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const getHodSubsections = async (req, res) => {
  try {
    const { hodId } = req.params;

    if (req.hod.id !== hodId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const doc = await db.collection("module1_hod").doc(hodId).get();

    res.status(200).json({
      success: true,
      data: doc.exists ? doc.data().subsections || [] : [],
    });
  } catch (error) {
    console.error("Get HOD Subsections Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const adminViewHodSubmissions = async (req, res) => {
  try {
    const adminRole = String(req.admin?.role || "").toLowerCase();
    const hasAccess =
      adminRole === "admin" ||
      adminRole === "principle" ||
      adminRole === "principal";

    if (!req.admin || !hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Principal access only",
      });
    }

    const adminCollege = req.admin.college;

    if (!adminCollege) {
      return res.status(400).json({
        success: false,
        message: "Admin college not found in token",
      });
    }

    const hodSnap = await db
      .collection("hods")
      .where("college", "==", adminCollege)
      .get();

    const results = [];

    for (const hodDoc of hodSnap.docs) {
      const submissionSnap = await db
        .collection("module1_hod")
        .doc(hodDoc.id)
        .get();

      if (submissionSnap.exists) {
        results.push({
          hodId: hodDoc.id,
          hodName: hodDoc.data().name,
          department: hodDoc.data().department,
          college: hodDoc.data().college,
          subsections: submissionSnap.data().subsections || [],
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Admin View HOD Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const adminVerifyCriterion = async (req, res) => {
  try {
    const { hodId, subId, criterionName } = req.params;
    const { adminScore, adminDescription } = req.body;

    const adminRole = String(req.admin?.role || "").toLowerCase();
    const hasAccess =
      adminRole === "admin" ||
      adminRole === "principle" ||
      adminRole === "principal";

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const ref = db.collection("module1_hod").doc(hodId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const subsections = snap.data().subsections || [];
    const subsection = subsections.find((s) => s.id === subId);

    if (!subsection) {
      return res.status(404).json({
        success: false,
        message: "Subsection not found",
      });
    }

    const criterion = subsection.criteria.find((c) => c.name === criterionName);

    if (!criterion) {
      return res.status(404).json({
        success: false,
        message: "Criterion not found",
      });
    }

    criterion.adminScore = Number(adminScore) || 0;
    criterion.adminDescription = adminDescription || "";
    criterion.isVerified = true;

    await ref.update({ subsections });

    res.status(200).json({
      success: true,
      message: "Criterion verified successfully",
    });
  } catch (error) {
    console.error("Admin Verify Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
