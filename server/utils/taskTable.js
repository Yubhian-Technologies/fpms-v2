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
// A column is { label, kind, options, document: "none" | "optional" | "required", maxUses }.
// kind (non-document columns): text, date (YYYY-MM-DD), month (YYYY-MM),
// select (one of `options`), or days / years — calculated from the two Date
// columns before it (From, To). maxUses: 0 = no limit, 1 = unique, N = the
// same value may be entered N times across the college in one academic year.
// Plain strings (older format) are treated as text columns.
export const COLUMN_KINDS = ["text", "date", "month", "select", "days", "years"];

export const normalizeTableColumn = (column) => {
  const raw = typeof column === "string" ? { label: column } : column || {};
  const document = ["optional", "required"].includes(raw.document) ? raw.document : "none";
  const kind = document === "none" && COLUMN_KINDS.includes(raw.kind) ? raw.kind : "text";
  const options =
    kind === "select"
      ? [...new Set((Array.isArray(raw.options) ? raw.options : []).map((o) => String(o ?? "").trim().slice(0, 200)).filter(Boolean))].slice(0, 50)
      : [];
  return {
    label: String(raw.label ?? "").trim().slice(0, 300),
    kind,
    options,
    document,
    maxUses: Math.max(0, Math.min(50, Math.floor(Number(raw.maxUses) || 0))),
  };
};

export const normalizeTableColumns = (value) =>
  (Array.isArray(value) ? value : [])
    .map(normalizeTableColumn)
    .filter((column) => column.label)
    .slice(0, 12);

// ── Cell values ──────────────────────────────────────────────────────────────
const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const isValidMonth = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

// The From / To date columns a days / years column is calculated from
export const durationSourceColumns = (tableColumns, index) => {
  const dates = tableColumns
    .map((column, i) => (i < index && column.document === "none" && column.kind === "date" ? i : -1))
    .filter((i) => i !== -1);
  return dates.length >= 2 ? dates.slice(-2) : null;
};

// Inclusive day count (From = To is 1 day); years to one decimal. "" when not computable.
export const computeDuration = (kind, from, to) => {
  if (!isValidDate(from) || !isValidDate(to)) return "";
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (days < 1) return "";
  if (kind === "days") return String(days);
  return String(Math.round((days / 365.25) * 10) / 10);
};

const cleanCell = (column, value) => {
  if (column.kind === "date") return isValidDate(value) ? value : "";
  if (column.kind === "month") return isValidMonth(value) ? value : "";
  if (column.kind === "select") return column.options.includes(value) ? value : "";
  return value;
};

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
    const cells = tableColumns.map((column, i) =>
      cleanCell(column, String(row?.cells?.[i] ?? "").trim().slice(0, 2000)),
    );
    // Calculated columns are always recomputed here, never trusted from the client
    tableColumns.forEach((column, i) => {
      if (column.kind !== "days" && column.kind !== "years") return;
      const source = durationSourceColumns(tableColumns, i);
      cells[i] = source ? computeDuration(column.kind, cells[source[0]], cells[source[1]]) : "";
    });
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
  for (const [rowIndex, row] of (extras.tableData || []).entries()) {
    for (const [i, column] of tableColumns.entries()) {
      if (column.kind !== "days" && column.kind !== "years") continue;
      const source = durationSourceColumns(tableColumns, i);
      const [from, to] = source ? [row.cells?.[source[0]], row.cells?.[source[1]]] : [];
      if (from && to && to < from) {
        return `Row ${rowIndex + 1}: "${tableColumns[source[1]].label}" is before "${tableColumns[source[0]].label}".`;
      }
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
