import express from 'express';
import { getSuperadminData } from './superAdminController.js';
import { db } from '../config/firebase.js';

// New endpoint: any authenticated role can read their college's designations/targets
export const getDesignationsByCollege = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    let college = String(req.user?.college || "").trim();
    const userId = String(req.user?.id || req.user?.uid || "").trim();

    console.log("[getDesignationsByCollege] role:", role, "| college from header:", college, "| userId:", userId);

    const { colleges } = await getSuperadminData();

    if (role === "committee") {
      const result = colleges.map((c) => ({
        college: c.name,
        designations: Array.isArray(c.designations)
          ? c.designations.filter((d) => d && d.name && String(d.name).trim())
          : [],
      }));
      return res.status(200).json({ success: true, data: result });
    }

    const findMatch = (name) =>
      name ? colleges.find((c) => String(c?.name || "").trim().toLowerCase() === String(name).toLowerCase()) : null;

    let matched = findMatch(college);

    // If not found, header college may be blank or stale after a rename — re-read from Firestore
    if (!matched && userId) {
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          college = String(userDoc.data()?.college || "").trim();
          matched = findMatch(college);
        }
      } catch (err) {
        console.error("[getDesignationsByCollege] Firestore fallback error:", err);
      }
    }

    if (!college) {
      return res.status(200).json({ success: true, data: { college: "", designations: [] } });
    }

    console.log("[getDesignationsByCollege] matched college:", matched?.name || "NONE");

    const designations = matched && Array.isArray(matched.designations)
      ? matched.designations.filter((d) => d && d.name && String(d.name).trim())
      : [];

    console.log("[getDesignationsByCollege] returning designations:", designations);

    return res.status(200).json({ success: true, data: { college, designations } });
  } catch (error) {
    console.error("[getDesignationsByCollege] ERROR:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getUserCollegeDeadline = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    let userCollege = req.user.college;

    const superadminData = await getSuperadminData();
    const colleges = Array.isArray(superadminData?.colleges) ? superadminData.colleges : [];

    const findCollege = (name) =>
      name ? colleges.find((c) => c?.name && c.name.toLowerCase() === String(name).toLowerCase()) : null;

    let collegeData = findCollege(userCollege);

    // Header college may be stale (e.g. after a rename) — re-fetch from Firestore
    if (!collegeData && req.user.id) {
      const userDoc = await db.collection("users").doc(req.user.id).get();
      if (!userDoc.exists) {
        return res.status(404).json({ success: false, message: "User not found in DB" });
      }
      userCollege = userDoc.data()?.college;
      collegeData = findCollege(userCollege);
    }

    if (!userCollege) {
      return res.status(400).json({ success: false, message: "User college not set" });
    }

    if (!collegeData) {
      return res.status(404).json({ success: false, message: "College data not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        name: collegeData.name,
        deadline: collegeData.deadline || null,
        assessmentStart: collegeData.assessmentStart || null,
        assessmentEnd: collegeData.assessmentEnd || null,
        evaluationEnd: collegeData.evaluationEnd || null,
        appealEnd: collegeData.appealEnd || null,
        appealReviewEnd: collegeData.appealReviewEnd || null,
      },
    });
  } catch (error) {
    console.error("Error fetching college deadline:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};