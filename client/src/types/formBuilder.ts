export interface Task {
  id: string;
  taskNumber?: string;   // manual override; blank = module number + position, e.g. "1.1.1"
  title: string;
  subtitle?: string;
  description?: string;
  assessmentCriteria?: string;
  evidence?: string;
  reference?: string;
  marks: number;          // max marks (used for module/criteria totals)
  marksType?: "fixed" | "range"; // fixed = single max; range = min–max
  minMarks?: number;      // lower bound when marksType === "range"
  note?: string;          // optional note shown to faculty above claimed score
  tableColumns?: TableColumn[]; // columns faculty fill in (S. No. is added automatically); empty = no table
  tableRows?: number;         // rows shown initially; faculty can add more
}

/** What faculty enter in a (non-document) column */
export type ColumnKind = "text" | "date" | "month" | "select" | "days" | "years";

export interface TableColumn {
  label: string;
  /** text, date picker, month & year picker, dropdown, or days / years calculated
   *  from the two Date columns before it */
  kind: ColumnKind;
  /** Dropdown choices (kind === "select") */
  options: string[];
  /** Per-row proof for this column: none, optional or required */
  document: "none" | "optional" | "required";
  /** 0 = no limit, 1 = unique, N = same value (or same proof) allowed N times per college per year */
  maxUses: number;
}

// One filled table row as stored on a submission (Firestore can't nest arrays)
export interface TaskTableRow {
  cells: string[];
  docs?: string[];      // proof link per column ("" when none)
  docHashes?: string[]; // proof fingerprint per column, for the duplicate limit
}

const COLUMN_KINDS: ColumnKind[] = ["text", "date", "month", "select", "days", "years"];

// Older forms stored columns as plain labels, without kind / options
export const normalizeTableColumns = (columns: unknown): TableColumn[] =>
  (Array.isArray(columns) ? columns : []).map((column: any) => {
    const raw = typeof column === "string" ? { label: column } : column || {};
    const document = raw.document === "optional" || raw.document === "required" ? raw.document : "none";
    const kind: ColumnKind = document === "none" && COLUMN_KINDS.includes(raw.kind) ? raw.kind : "text";
    return {
      label: String(raw.label ?? ""),
      kind,
      options: kind === "select" && Array.isArray(raw.options) ? raw.options.map(String) : [],
      document,
      maxUses: Math.max(0, Number(raw.maxUses) || 0),
    };
  });

export const isCalculatedColumn = (column: TableColumn) => column.kind === "days" || column.kind === "years";

// The From / To date columns a days / years column is calculated from (same rule as the server)
export const durationSourceColumns = (columns: TableColumn[], index: number): [number, number] | null => {
  const dates = columns
    .map((column, i) => (i < index && column.document === "none" && column.kind === "date" ? i : -1))
    .filter((i) => i !== -1);
  return dates.length >= 2 ? [dates[dates.length - 2], dates[dates.length - 1]] : null;
};

const isValidDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

// Inclusive day count (From = To is 1 day); years to one decimal. "" when not computable.
export const computeDuration = (kind: ColumnKind, from: string, to: string) => {
  if (!isValidDate(from || "") || !isValidDate(to || "")) return "";
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (days < 1) return "";
  return kind === "days" ? String(days) : String(Math.round((days / 365.25) * 10) / 10);
};

// Fills the calculated columns of one row's cells
export const withCalculatedCells = (columns: TableColumn[], cells: string[]) =>
  cells.map((value, i) => {
    if (!isCalculatedColumn(columns[i])) return value;
    const source = durationSourceColumns(columns, i);
    return source ? computeDuration(columns[i].kind, cells[source[0]], cells[source[1]]) : "";
  });

// "2026-03-05" → "05 Mar 2026", "2026-03" → "Mar 2026"; other values unchanged
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = MONTHS;
export const formatCellValue = (column: TableColumn, value: string) => {
  if (!value) return value;
  if (column.kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `${d} ${MONTHS[Number(m) - 1] || m} ${y}`;
  }
  if (column.kind === "month" && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-");
    return `${MONTHS[Number(m) - 1] || m} ${y}`;
  }
  if (column.kind === "years") return `${value} yr${value === "1" ? "" : "s"}`;
  return value;
};

// "3.1" + 2nd task → "3.1.2"; a typed Task No. wins
export const autoTaskNumber = (moduleNumber: number | string, index: number) =>
  `${moduleNumber || "-"}.${index + 1}`;

export const displayTaskNumber = (task: { taskNumber?: string }, moduleNumber: number | string, index: number) =>
  String(task.taskNumber || "").trim() || autoTaskNumber(moduleNumber, index);

export interface Module {
  id: string;
  moduleNumber: number;
  moduleName: string;
  totalMarks: number;
  tasks: Task[];
}

export interface Criteria {
  id: string;
  criteriaName: string;
  totalMarks: number;
  modules: Module[];
}

export interface FPMSForm {
  id: string;
  formTitle: string;
  /** Position in the sidebar and every form list (1, 2, 3…); 0 = not set */
  displayOrder?: number;
  applicableRoles: string[];
  totalMarks: number;
  criteria: Criteria[];
}

export const FPMS_FORM_STORAGE_KEY = "fpms_form_builder_forms";

export const FPMS_ROLE_OPTIONS = [
  "Assistant Professor",
  "Associate Professor",
  "Professor",
  "HoD",
  "Dean Academics",
  "Dean R&D",
  "Dean IQAC",
  "Dean T&P",
  "Dean Exams",
];
