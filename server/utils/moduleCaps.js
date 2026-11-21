// Module caps: a module may count for at most `maxMarks`, whatever its tasks
// add up to (e.g. tasks total 10, cap 8 → a faculty's 10 counts as 8, 7 as 7).
// Caps are stored on each module and mirrored on the form as
// `moduleCaps: { [moduleId]: cap }`, so a year's caps load with one query.

export const normalizeModuleCap = (value) => {
  const cap = Number(value);
  return Number.isFinite(cap) && cap > 0 ? Math.round(Math.min(cap, 10000) * 100) / 100 : 0;
};

// { moduleId: cap } for the modules of the given (normalized) criteria that have a cap
export const moduleCapsOf = (criteria) => {
  const caps = {};
  (criteria || []).forEach((criteriaItem) =>
    (criteriaItem.modules || []).forEach((moduleItem) => {
      if (moduleItem.maxMarks) caps[moduleItem.id] = moduleItem.maxMarks;
    }),
  );
  return caps;
};

const cache = new Map(); // year → { at, caps }
const TTL_MS = 60 * 1000;

export const invalidateModuleCaps = () => cache.clear();

// All module caps of the scope's academic year
export const getModuleCaps = async (scope) => {
  const hit = cache.get(scope.year);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.caps;
  const snap = await scope.forms().get();
  const caps = {};
  snap.docs.forEach((doc) => Object.assign(caps, doc.data()?.moduleCaps || {}));
  cache.set(scope.year, { at: Date.now(), caps });
  return caps;
};

// Sum of pick(item) where each faculty's tasks in a capped module count for at
// most that module's cap. Items are submissions (need userId + moduleId);
// items in modules without a cap are summed as they are.
export const sumWithModuleCaps = (items, pick, caps) => {
  const capped = new Map();
  let total = 0;
  for (const item of items || []) {
    const value = Number(pick(item)) || 0;
    const cap = caps?.[item?.moduleId];
    if (!cap) {
      total += value;
      continue;
    }
    const key = `${item.userId || ""}|${item.moduleId}`;
    capped.set(key, (capped.get(key) || 0) + value);
  }
  capped.forEach((value, key) => {
    total += Math.min(value, caps[key.slice(key.indexOf("|") + 1)]);
  });
  return total;
};
