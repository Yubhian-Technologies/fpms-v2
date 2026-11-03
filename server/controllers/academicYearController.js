import admin from "firebase-admin";
import { db } from "../config/firebase.js";
import {
  getSuperadminConfigSnapshot,
  invalidateSuperadminCache,
} from "../config/superadminCache.js";
import {
  LEGACY_ACADEMIC_YEAR,
  getYearScope,
  isValidAcademicYear,
  nextAcademicYear,
} from "../config/academicYear.js";

// Collections whose records belong to one academic year
const YEAR_SCOPED_COLLECTIONS = ["submissions", "fpmsForms", "appeals", "workflowSubmissionReviews"];
const BACKFILL_PAGE_SIZE = 1200;
const BATCH_SIZE = 400;

// College fields that describe one year's assessment cycle
const PHASE_DATE_FIELDS = ["assessmentStart", "assessmentEnd", "deadline", "evaluationEnd", "appealEnd", "appealReviewEnd"];

const SNAPSHOT_EXCLUDED_ROLES = new Set(["superadmin", "viewer", "guest", "committee"]);

const commitInBatches = async (ops) => {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = db.batch();
    ops.slice(i, i + BATCH_SIZE).forEach((op) => op(batch));
    await batch.commit();
  }
};

const generateFormId = () =>
  `form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// GET /api/academic-years — the year list every role uses for its year selector
export const getAcademicYears = async (req, res) => {
  try {
    const scope = await getYearScope();
    const years = [...scope.years].sort((a, b) => String(b.id).localeCompare(String(a.id)));
    return res.json({
      success: true,
      data: { current: scope.current, years, backfilled: scope.filterReady },
    });
  } catch (err) {
    console.error("getAcademicYears error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/academic-years/backfill — tags pre-existing records with the legacy year.
// Resumable: each call handles one page and returns where to continue, so it fits
// inside a serverless time limit. The client calls it until `done` is true.
export const backfillAcademicYear = async (req, res) => {
  try {
    const collection = String(req.body?.collection || YEAR_SCOPED_COLLECTIONS[0]);
    const cursor = req.body?.cursor ? String(req.body.cursor) : null;
    const collectionIndex = YEAR_SCOPED_COLLECTIONS.indexOf(collection);
    if (collectionIndex === -1) {
      return res.status(400).json({ success: false, message: "Unknown collection" });
    }

    let query = db
      .collection(collection)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BACKFILL_PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();

    const untagged = snap.docs.filter((doc) => !doc.data()?.academicYear);
    await commitInBatches(
      untagged.map((doc) => (batch) => batch.update(doc.ref, { academicYear: LEGACY_ACADEMIC_YEAR })),
    );

    const pageDone = snap.size < BACKFILL_PAGE_SIZE;
    const nextCollection = pageDone ? YEAR_SCOPED_COLLECTIONS[collectionIndex + 1] || null : collection;
    const nextCursor = pageDone ? null : snap.docs[snap.docs.length - 1].id;
    const done = pageDone && !nextCollection;

    if (done) {
      const configDoc = await getSuperadminConfigSnapshot();
      const config = configDoc.exists ? configDoc.data() || {} : {};
      const current = config.currentAcademicYear || LEGACY_ACADEMIC_YEAR;
      const years = Array.isArray(config.academicYears) && config.academicYears.length
        ? config.academicYears
        : [{ id: current, status: "active" }];
      await configDoc.ref.set(
        {
          academicYearBackfilled: true,
          currentAcademicYear: current,
          academicYears: years,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      invalidateSuperadminCache();
    }

    return res.json({
      success: true,
      data: {
        collection,
        scanned: snap.size,
        updated: untagged.length,
        next: done ? null : { collection: nextCollection, cursor: nextCursor },
        done,
      },
    });
  } catch (err) {
    console.error("backfillAcademicYear error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
};

// Freezes everyone's year-dependent profile fields under academicYears/{year}/faculty
const snapshotFaculty = async (year) => {
  const usersSnap = await db.collection("users").get();
  const facultyRef = db.collection("academicYears").doc(year).collection("faculty");
  const ops = usersSnap.docs
    .filter((doc) => {
      const d = doc.data() || {};
      return d.college && !SNAPSHOT_EXCLUDED_ROLES.has(String(d.role || "").trim().toLowerCase());
    })
    .map((doc) => {
      const d = doc.data();
      const snapshot = {
        name: d.name || "",
        email: d.email || "",
        role: d.role || "",
        level: d.level ?? null,
        college: d.college || "",
        department: d.department || "",
        designation: d.designation || "",
        hasPhd: Boolean(d.hasPhd),
        staffStatus: d.staffStatus || null,
        statusNote: d.statusNote || null,
        subjectsHandled: Array.isArray(d.subjectsHandled) ? d.subjectsHandled : [],
        dateOfJoining: d.dateOfJoining || null,
      };
      return (batch) => batch.set(facultyRef.doc(doc.id), snapshot);
    });
  await commitInBatches(ops);
  return ops.length;
};

// Copies a year's forms (with criteria/modules/tasks, keeping their ids so task
// references stay valid) into another year — all of them, or only `formIds`.
// Skips forms already copied, so a retry never duplicates them.
const cloneFormsToYear = async (fromYear, toYear, formIds = null) => {
  const forms = db.collection("fpmsForms");
  const [sourceSnap, existingSnap] = await Promise.all([
    forms.where("academicYear", "==", fromYear).get(),
    forms.where("academicYear", "==", toYear).get(),
  ]);
  const alreadyCloned = new Set(existingSnap.docs.map((d) => d.data()?.clonedFrom).filter(Boolean));
  const wanted = formIds ? new Set(formIds) : null;

  let cloned = 0;
  for (const formDoc of sourceSnap.docs) {
    if (wanted && !wanted.has(formDoc.id)) continue;
    if (alreadyCloned.has(formDoc.id)) continue;
    const newRef = forms.doc(generateFormId());
    const [criteria, modules, tasks] = await Promise.all(
      ["criteria", "modules", "tasks"].map((sub) => formDoc.ref.collection(sub).get()),
    );
    const ops = [];
    for (const [name, snap] of [["criteria", criteria], ["modules", modules], ["tasks", tasks]]) {
      snap.docs.forEach((child) => {
        ops.push((batch) => batch.set(newRef.collection(name).doc(child.id), child.data()));
      });
    }
    await commitInBatches(ops);
    // Parent written last: a half-copied form never shows up for the new year
    await newRef.set({
      ...formDoc.data(),
      academicYear: toYear,
      clonedFrom: formDoc.id,
      version: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      // Keep the original updatedAt so the form builder order carries over
      updatedAt: formDoc.data()?.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
    });
    cloned++;
  }
  return cloned;
};

// POST /api/academic-years/rollover { newYear } — closes the current year as
// history and opens the next one. No submission is modified.
export const rolloverAcademicYear = async (req, res) => {
  try {
    const configDoc = await getSuperadminConfigSnapshot();
    const config = configDoc.exists ? configDoc.data() || {} : {};

    if (config.academicYearBackfilled !== true) {
      return res.status(409).json({
        success: false,
        message: "Tag existing records with their academic year (backfill) before starting a new year.",
      });
    }

    const current = String(config.currentAcademicYear || LEGACY_ACADEMIC_YEAR);
    const newYear = String(req.body?.newYear || nextAcademicYear(current)).trim();
    const years = Array.isArray(config.academicYears) ? config.academicYears : [];

    if (!isValidAcademicYear(newYear)) {
      return res.status(400).json({ success: false, message: "Academic year must look like 2026-27" });
    }
    if (newYear <= current) {
      return res.status(400).json({ success: false, message: `New year must be after ${current}` });
    }
    if (years.some((y) => y?.id === newYear)) {
      return res.status(409).json({ success: false, message: `${newYear} already exists` });
    }

    const closedBy = req.superadmin?.uid || "superadmin";
    const facultyCount = await snapshotFaculty(current);

    await db.collection("academicYears").doc(current).set(
      {
        id: current,
        status: "closed",
        closedAt: admin.firestore.FieldValue.serverTimestamp(),
        closedBy,
        // Frozen config: phase dates, designation targets and workflow rules as they were
        colleges: config.colleges || [],
        workflowRules: config.workflowRules || [],
        collegeWorkflowRules: config.collegeWorkflowRules || {},
        facultyCount,
      },
      { merge: true },
    );

    // Forms can also be imported later, selectively, from the form builder
    const copyForms = req.body?.copyForms !== false;
    const formsCloned = copyForms ? await cloneFormsToYear(current, newYear) : 0;

    await db.collection("academicYears").doc(newYear).set({
      id: newYear,
      status: "active",
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
      openedBy: closedBy,
    });

    // Live config now describes the new year: dates cleared for principals to set, targets kept
    const nextColleges = (config.colleges || []).map((c) => {
      const next = { ...c };
      PHASE_DATE_FIELDS.forEach((field) => { next[field] = null; });
      return next;
    });
    const nextYears = [
      ...years.filter((y) => y?.id !== current),
      { id: current, status: "closed" },
      { id: newYear, status: "active" },
    ];
    await configDoc.ref.set(
      {
        currentAcademicYear: newYear,
        academicYears: nextYears,
        colleges: nextColleges,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    invalidateSuperadminCache();

    return res.json({
      success: true,
      message: `${current} closed and kept as history. ${newYear} is now the current academic year.`,
      data: { closedYear: current, currentYear: newYear, facultyCount, formsCloned },
    });
  } catch (err) {
    console.error("rolloverAcademicYear error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
};

// POST /api/academic-years/import-forms { fromYear, formIds } — copies chosen
// forms from a past year into the current year so they need not be rebuilt.
export const importFormsFromYear = async (req, res) => {
  try {
    const scope = await getYearScope();
    if (!scope.filterReady) {
      return res.status(409).json({
        success: false,
        message: "Tag existing records with their academic year (backfill) first.",
      });
    }
    const fromYear = String(req.body?.fromYear || "").trim();
    if (fromYear === scope.current || !scope.years.some((y) => y?.id === fromYear)) {
      return res.status(400).json({ success: false, message: "Choose a previous academic year" });
    }
    const formIds = (Array.isArray(req.body?.formIds) ? req.body.formIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    if (!formIds.length) {
      return res.status(400).json({ success: false, message: "Select at least one form" });
    }

    const copied = await cloneFormsToYear(fromYear, scope.current, formIds);
    return res.json({
      success: true,
      message: copied
        ? `${copied} form(s) copied from ${fromYear} into ${scope.current}.`
        : "Selected forms were already copied.",
      data: { copied, skipped: formIds.length - copied, toYear: scope.current },
    });
  } catch (err) {
    console.error("importFormsFromYear error:", err);
    return res.status(500).json({ success: false, message: err?.message || "Server error" });
  }
};
