// Module caps: a module may count for at most a set number of marks, whatever
// its tasks add up to (tasks total 10, cap 8 → a faculty's 10 counts as 8, 7 as 7).
// Caps for the selected academic year are loaded by AcademicYearProvider; every
// score total in the app goes through sumScores so the cap applies everywhere.

let moduleCaps: Record<string, number> = {};

export const setModuleCaps = (caps: Record<string, number> | null | undefined) => {
  moduleCaps = caps || {};
};

export const getModuleCap = (moduleId: string | null | undefined) =>
  (moduleId && moduleCaps[moduleId]) || 0;

/**
 * Sum of pick(item) over submissions, where each faculty's tasks in a capped
 * module count for at most that module's cap. Items without a moduleId (or in
 * modules with no cap) are summed as they are, so this equals a plain sum when
 * no caps are set.
 */
export function sumScores<T>(items: readonly T[] | null | undefined, pick: (item: T) => unknown): number {
  const capped = new Map<string, { cap: number; value: number }>();
  let total = 0;
  for (const item of items || []) {
    const value = Number(pick(item)) || 0;
    const record = item as { moduleId?: string; userId?: string };
    const cap = getModuleCap(record?.moduleId);
    if (!cap) {
      total += value;
      continue;
    }
    const key = `${record.userId || ""}|${record.moduleId}`;
    const entry = capped.get(key) || { cap, value: 0 };
    entry.value += value;
    capped.set(key, entry);
  }
  capped.forEach(({ cap, value }) => {
    total += Math.min(value, cap);
  });
  return total;
}

/**
 * reduce() callback form of sumScores: `items.reduce(cappedSum((s) => s.finalScore), 0)`.
 * The first call totals the whole array with module caps applied; later calls
 * pass that total through.
 */
export const cappedSum =
  <T,>(pick: (item: T) => unknown) =>
  (total: number, _item: T, index: number, array: readonly T[]): number =>
    index === 0 ? sumScores(array, pick) : total;
