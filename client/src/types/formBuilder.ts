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

export interface TableColumn {
  label: string;
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

// Older forms stored columns as plain labels
export const normalizeTableColumns = (columns: unknown): TableColumn[] =>
  (Array.isArray(columns) ? columns : []).map((column: any) =>
    typeof column === "string"
      ? { label: column, document: "none", maxUses: 0 }
      : {
          label: String(column?.label ?? ""),
          document: column?.document === "optional" || column?.document === "required" ? column.document : "none",
          maxUses: Math.max(0, Number(column?.maxUses) || 0),
        },
  );

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
