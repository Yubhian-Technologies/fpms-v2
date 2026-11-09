import { db } from "../config/firebase.js";
import { recordYear } from "../config/academicYear.js";

// Tasks (sorted by order) with a display number: the typed Task No., else
// module number + position, e.g. 3.1 → 3.1.1, 3.1.2
export const withTaskNumbers = (tasks, moduleNumber) =>
  tasks.map((task, index) => ({
    ...task,
    taskNumber: String(task.taskNumber || "").trim() || `${moduleNumber || "-"}.${index + 1}`,
  }));

// ── Table column config ──────────────────────────────────────────────────────
// A column is { label, document: "none" | "optional" | "required", maxUses }.
// maxUses: 0 = no limit, 1 = unique, N = the same value may be entered N times
// across the college in one academic year. Plain strings (older format) are
// treated as text-only columns.
export const normalizeTableColumn = (column) => {
  const raw = typeof column === "string" ? { label: column } : column || {};
  return {
    label: String(raw.label ?? "").trim().slice(0, 300),
    document: ["optional", "required"].includes(raw.document) ? raw.document : "none",
    maxUses: Math.max(0, Math.min(50, Math.floor(Number(raw.maxUses) || 0))),
  };
};

export const normalizeTableColumns = (value) =>
  (Array.isArray(value) ? value : [])
    .map(normalizeTableColumn)
    .filter((column) => column.label)
    .slice(0, 12);

const normalizeText = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

// Fingerprint of a proof: the client's SHA-256 of an uploaded file, else the link itself
const proofFingerprint = (doc, clientHash) => {
  if (/^sha256:[0-9a-f]{64}$/.test(String(clientHash || ""))) return clientHash;
  const link = String(doc || "").trim().toLowerCase().replace(/\/+$/, "");
  return link ? `url:${link}` : "";
};

// ── Task definition ──────────────────────────────────────────────────────────
// Column rules always come from the form, never from the client.
export const loadTaskDefinition = async (formId, taskId) => {
  if (!formId || !taskId) return null;
  const doc = await db.collection("fpmsForms").doc(formId).collection("tasks").doc(taskId).get();
  if (!doc.exists) return null;
  const data = doc.data() || {};
  return {
    id: doc.id,
    tableColumns: normalizeTableColumns(data.tableColumns),
  };
};

// Table rows to store on a submission. Rows are
// { cells, docs, docHashes } — Firestore cannot nest arrays directly.
// `uniqueKeys` indexes the limited columns so duplicates can be found with
// one array-contains-any query.
// Rows shaped to the task's columns, blank rows kept so indexes match the client's grid
export const shapeTableRows = (rows, tableColumns) =>
  (Array.isArray(rows) ? rows : []).slice(0, 100).map((row) => {
    const cells = tableColumns.map((_, i) => String(row?.cells?.[i] ?? "").trim().slice(0, 2000));
    const docs = tableColumns.map((column, i) =>
      column.document === "none" ? "" : String(row?.docs?.[i] ?? "").trim().slice(0, 2000),
    );
    const docHashes = tableColumns.map((column, i) =>
      column.document === "none" ? "" : proofFingerprint(docs[i], row?.docHashes?.[i]),
    );
    return { cells, docs, docHashes };
  });

export const sanitizeTaskExtras = (body, taskDef) => {
  const tableColumns = taskDef?.tableColumns || [];

  const tableData = shapeTableRows(tableColumns.length ? body?.tableData : [], tableColumns).filter(
    (row) => row.cells.some(Boolean) || row.docs.some(Boolean),
  );

  return {
    tableColumns,
    tableData,
    uniqueKeys: buildUniqueEntries(taskDef?.id, tableColumns, tableData).map((entry) => entry.key),
  };
};

// One entry per (row, limited column, text-or-proof) that counts toward a limit
const buildUniqueEntries = (taskId, tableColumns, tableData) => {
  const entries = [];
  tableData.forEach((row, rowIndex) => {
    tableColumns.forEach((column, colIndex) => {
      if (!column.maxUses) return;
      const columnKey = `${taskId}|${normalizeText(column.label)}`;
      const text = normalizeText(row.cells[colIndex]);
      if (text) {
        entries.push({ key: `t|${columnKey}|${text}`, kind: "text", rowIndex, colIndex, column, value: row.cells[colIndex] });
      }
      const proof = row.docHashes?.[colIndex];
      if (proof) {
        entries.push({ key: `d|${columnKey}|${proof}`, kind: "document", rowIndex, colIndex, column, value: row.cells[colIndex] });
      }
    });
  });
  return entries;
};

// ── Rules ────────────────────────────────────────────────────────────────────
// Required documents always apply to filled rows. When marks are claimed, a
// table needs at least one filled row.
export const taskExtrasError = (taskDef, claimedScore, extras) => {
  if (!taskDef) return null;
  const tableColumns = taskDef.tableColumns || [];
  for (const [rowIndex, row] of (extras.tableData || []).entries()) {
    const missing = tableColumns.findIndex((column, i) => column.document === "required" && !row.docs?.[i]);
    if (missing !== -1) {
      return `Row ${rowIndex + 1}: upload the document for "${tableColumns[missing].label}".`;
    }
  }
  if (!(Number(claimedScore) > 0)) return null;
  if (tableColumns.length > 0 && !(extras.tableData || []).length) {
    return "Fill at least one row of the table when claiming marks.";
  }
  return null;
};

// Values in limited columns already used by faculty of the same college this
// academic year (and repeats inside this table). Returns one item per offending cell.
export const findTableDuplicates = async ({ taskDef, tableData, college, year, excludeSubmissionId }) => {
  const entries = buildUniqueEntries(taskDef?.id, taskDef?.tableColumns || [], tableData || []);
  if (!entries.length) return [];

  const duplicates = [];
  const firstRowByKey = new Map();
  entries.forEach((entry) => {
    if (firstRowByKey.has(entry.key)) {
      duplicates.push({
        ...describe(entry),
        message:
          entry.kind === "document"
            ? `Same document as row ${firstRowByKey.get(entry.key) + 1}.`
            : `"${entry.value}" is repeated in row ${firstRowByKey.get(entry.key) + 1}.`,
      });
    } else {
      firstRowByKey.set(entry.key, entry.rowIndex);
    }
  });

  const keys = [...firstRowByKey.keys()];
  const usedBy = new Map(); // key → number of other submissions using it
  for (let i = 0; i < keys.length; i += 30) {
    const snap = await db
      .collection("submissions")
      .where("uniqueKeys", "array-contains-any", keys.slice(i, i + 30))
      .get();
    snap.docs.forEach((doc) => {
      if (doc.id === excludeSubmissionId) return;
      const data = doc.data() || {};
      // College + year filtered here so no composite index is needed
      if (String(data.college || "").trim().toLowerCase() !== String(college || "").trim().toLowerCase()) return;
      if (recordYear(data) !== year) return;
      new Set(data.uniqueKeys || []).forEach((key) => {
        if (firstRowByKey.has(key)) usedBy.set(key, (usedBy.get(key) || 0) + 1);
      });
    });
  }

  entries.forEach((entry) => {
    if (firstRowByKey.get(entry.key) !== entry.rowIndex) return; // repeats reported above
    const used = usedBy.get(entry.key) || 0;
    const limit = entry.column.maxUses;
    if (used + 1 <= limit) return;
    const subject = entry.kind === "document" ? "This document" : `"${entry.value}"`;
    duplicates.push({
      ...describe(entry),
      message:
        limit === 1
          ? `${subject} already exists.`
          : `${subject} has already been used ${used} time${used === 1 ? "" : "s"} (limit ${limit}).`,
    });
  });

  return duplicates;
};

const describe = (entry) => ({
  row: entry.rowIndex,
  column: entry.colIndex,
  kind: entry.kind,
  label: entry.column.label,
});

export const duplicatesMessage = (duplicates) => {
  const first = duplicates[0];
  return `Row ${first.row + 1}, ${first.label}: ${first.message}`;
};
