// Forms are listed by their Form Order (1, 2, 3…) everywhere — sidebar, form
// builder, review and My Submissions. Forms without one come after, most
// recently saved first. Sorted in memory: the academicYear filter plus an
// orderBy would need a composite index.

const toMillis = (value) =>
  value?.toMillis ? value.toMillis() : new Date(value || 0).getTime() || 0;

export const normalizeDisplayOrder = (value) => {
  const order = Math.floor(Number(value));
  return Number.isFinite(order) && order > 0 ? Math.min(order, 999) : 0;
};

const orderKey = (data) => normalizeDisplayOrder(data?.displayOrder) || Infinity;

export const sortFormDocs = (docs) =>
  [...docs].sort((a, b) => {
    const orderA = orderKey(a.data());
    const orderB = orderKey(b.data());
    if (orderA !== orderB) return orderA < orderB ? -1 : 1;
    return toMillis(b.data().updatedAt) - toMillis(a.data().updatedAt);
  });
