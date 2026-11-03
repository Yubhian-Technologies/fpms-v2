import { db } from "./firebase.js";
import { getSuperadminConfig } from "./superadminCache.js";

// Every record created before multi-year support belongs to this year
export const LEGACY_ACADEMIC_YEAR = "2025-26";

// "2026-27" — second part must be the year after the first
export const isValidAcademicYear = (value) => {
  const match = /^(\d{4})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) return false;
  return (Number(match[1]) + 1) % 100 === Number(match[2]);
};

export const nextAcademicYear = (year) => {
  const start = Number(String(year).slice(0, 4)) + 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

// "2025-26" → "2025 – 2026" (used in report headers)
export const formatAcademicYearLong = (year) => {
  const start = Number(String(year).slice(0, 4));
  return `${start} – ${start + 1}`;
};

const listYears = (saData, current) => {
  const years = Array.isArray(saData.academicYears) ? saData.academicYears : [];
  if (years.some((y) => y?.id === current)) return years;
  return [...years, { id: current, status: "active" }];
};

// Resolves which academic year a request is about.
// Until the backfill has tagged every existing record with `academicYear`,
// year filters are not applied (all data is the legacy year at that point),
// so deploying this code before the backfill changes nothing.
export const getYearScope = async (requestedYear) => {
  const saData = await getSuperadminConfig();
  const current = String(saData.currentAcademicYear || LEGACY_ACADEMIC_YEAR);
  const filterReady = saData.academicYearBackfilled === true;
  const years = listYears(saData, current);

  const requested = String(requestedYear || "").trim();
  const known = years.some((y) => y?.id === requested);
  const year = filterReady && known ? requested : current;

  return {
    year,
    current,
    isCurrent: year === current,
    filterReady,
    years,
    submissions: () =>
      filterReady
        ? db.collection("submissions").where("academicYear", "==", year)
        : db.collection("submissions"),
    forms: () =>
      filterReady
        ? db.collection("fpmsForms").where("academicYear", "==", year)
        : db.collection("fpmsForms"),
  };
};

export const yearScopeFromReq = (req) =>
  getYearScope(req.query?.year || req.body?.academicYear);

export const recordYear = (data) => String(data?.academicYear || LEGACY_ACADEMIC_YEAR);

// Records from a closed year are history — no submit / review / appeal changes
export const isClosedYearRecord = (data, scope) => recordYear(data) !== scope.current;

export const CLOSED_YEAR_MESSAGE =
  "This record belongs to a closed academic year and is read-only.";

// Closed years are immutable, so their frozen config is cached for the process lifetime
const frozenYearCache = new Map();

export const getFrozenYear = async (year) => {
  if (frozenYearCache.has(year)) return frozenYearCache.get(year);
  const doc = await db.collection("academicYears").doc(year).get();
  const data = doc.exists ? doc.data() || null : null;
  if (data?.status === "closed") frozenYearCache.set(year, data);
  return data;
};

// College configs (phase dates + designation targets) as they were for `year`.
// The live superadmin config always describes the current year.
export const getCollegesForYear = async (scope) => {
  const saData = await getSuperadminConfig();
  if (scope.isCurrent) return saData.colleges || [];
  const frozen = await getFrozenYear(scope.year);
  return Array.isArray(frozen?.colleges) ? frozen.colleges : saData.colleges || [];
};

// Faculty profile snapshots (designation, PhD, department…) for a closed year, keyed by uid
export const getFacultySnapshotsForYear = async (scope) => {
  if (scope.isCurrent) return null;
  const snap = await db.collection("academicYears").doc(scope.year).collection("faculty").get();
  if (snap.empty) return null;
  const map = new Map();
  snap.docs.forEach((doc) => map.set(doc.id, doc.data()));
  return map;
};
