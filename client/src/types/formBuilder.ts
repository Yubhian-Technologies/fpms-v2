export interface Task {
  id: string;
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
}

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
