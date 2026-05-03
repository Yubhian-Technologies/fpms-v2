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

    // Fallback: if college not in headers, fetch from Firestore using userId
    if (!college && userId) {
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          college = String(userDoc.data()?.college || "").trim();
          console.log("[getDesignationsByCollege] college from Firestore fallback:", college);
        }
      } catch (err) {
        console.error("[getDesignationsByCollege] Firestore fallback error:", err);
      }
    }

    const { colleges } = await getSuperadminData();
    console.log("[getDesignationsByCollege] colleges count:", colleges.length, "| names:", colleges.map(c => c.name));

    if (role === "committee") {
      const result = colleges.map((c) => ({
        college: c.name,
        designations: Array.isArray(c.designations)
          ? c.designations.filter((d) => d && d.name && String(d.name).trim())
          : [],
      }));
      return res.status(200).json({ success: true, data: result });
    }

    if (!college) {
      console.log("[getDesignationsByCollege] No college found, returning empty");
      return res.status(200).json({ success: true, data: { college: "", designations: [] } });
    }

    const matched = colleges.find(
      (c) => String(c?.name || "").trim().toLowerCase() === college.toLowerCase()
    );

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
    console.log("DEBUG: req.user ->", req.user);

    if (!req.user) {
      console.log("No req.user found!");
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    let userCollege = req.user.college;
    console.log("DEBUG: userCollege from req.user ->", userCollege);

    // Fallback if college not in req.user
    if (!userCollege) {
      console.log("No college in req.user, fetching from DB...");
      const userDoc = await db.collection("users").doc(req.user.id).get();
      console.log("DEBUG: userDoc.exists ->", userDoc.exists);
      if (!userDoc.exists) {
        return res.status(404).json({ success: false, message: "User not found in DB" });
      }

      userCollege = userDoc.data()?.college;
      console.log("DEBUG: userCollege from DB ->", userCollege);
    }

    if (!userCollege) {
      console.log("User college is still not set!");
      return res.status(400).json({ success: false, message: "User college not set" });
    }

    // Fetch superadmin data (contains all colleges)
    const superadminData = await getSuperadminData();
    console.log("DEBUG: superadminData ->", superadminData);

    const colleges = Array.isArray(superadminData?.colleges) ? superadminData.colleges : [];
    console.log("DEBUG: colleges array ->", colleges.map(c => ({ name: c.name, deadline: c.deadline })));

    // Find college by name (case-insensitive)
    const collegeData = colleges.find(
      (c) => c?.name && c.name.toLowerCase() === userCollege.toLowerCase()
    );

    console.log("DEBUG: collegeData found ->", collegeData);

    if (!collegeData) {
      console.log("No matching college found for userCollege:", userCollege);
      return res.status(404).json({ success: false, message: "College data not found" });
    }

    console.log("Returning deadline:", collegeData.deadline);

    return res.status(200).json({
      success: true,
      data: {
        name: collegeData.name,
        deadline: collegeData.deadline || null,
      },
    });
  } catch (error) {
    console.error("Error fetching college deadline:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};