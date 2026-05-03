export type UserRole = "faculty" | "hod" | "committee" | "principle";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department: string;
  designation: string;
  experience: number;
  hasPhD: boolean;
  avatar?: string;
}

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "locked";

export interface FPMSModule {
  id: string;
  name: string;
  maxPoints: number;
  score: number;
  entries: ModuleEntry[];
}

export interface ModuleEntry {
  id: string;
  criteria: string;
  description: string;
  maxPoints: number;
  claimedPoints: number;
  evidence?: string;
  evidenceType?: "pdf" | "image" | "link";
}

export interface FPMSSubmission {
  id: string;
  facultyId: string;
  academicYear: string;
  status: SubmissionStatus;
  modules: FPMSModule[];
  totalScore: number;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  remarks?: string;
  hodRemarks?: string;
  committeeRemarks?: string;
}

export interface AcademicYear {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export const FPMS_MODULES = [
  { id: "teaching", name: "Teaching & Learning", maxPoints: 70 },
  { id: "research", name: "Research & Consultancy", maxPoints: 75 },
  { id: "professional", name: "Professional Development", maxPoints: 65 },
  { id: "student", name: "Student Development", maxPoints: 45 },
  { id: "institutional", name: "Institutional Development", maxPoints: 45 },
] as const;

export const STATUS_CONFIG: Record<
  SubmissionStatus,
  { label: string; color: string; bgColor: string }
> = {
  draft: {
    label: "Draft",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
  },
  submitted: { label: "Submitted", color: "text-info", bgColor: "bg-info/10" },
  under_review: {
    label: "Under Review",
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  approved: {
    label: "Approved",
    color: "text-success",
    bgColor: "bg-success/10",
  },
  rejected: {
    label: "Rejected",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  locked: { label: "Locked", color: "text-primary", bgColor: "bg-primary/10" },
};
