import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  FPMSSubmission,
  FPMSModule,
  FPMS_MODULES,
  SubmissionStatus,
  ModuleEntry,
} from "@/types/fpms";
import { useAuth } from "./AuthContext";

interface FPMSContextType {
  submissions: FPMSSubmission[];
  currentSubmission: FPMSSubmission | null;
  academicYear: string;
  setAcademicYear: (year: string) => void;
  createSubmission: () => FPMSSubmission;
  updateModule: (moduleId: string, entries: ModuleEntry[]) => void;
  submitForReview: () => void;
  approveSubmission: (submissionId: string, remarks: string) => void;
  rejectSubmission: (submissionId: string, remarks: string) => void;
  lockSubmission: (submissionId: string) => void;
  getAllSubmissions: () => FPMSSubmission[];
  getDepartmentSubmissions: (department: string) => FPMSSubmission[];
}

const FPMSContext = createContext<FPMSContextType | undefined>(undefined);

const generateId = () => Math.random().toString(36).substring(2, 9);

const createDefaultModules = (): FPMSModule[] => {
  return FPMS_MODULES.map((mod) => ({
    id: mod.id,
    name: mod.name,
    maxPoints: mod.maxPoints,
    score: 0,
    entries: [],
  }));
};

// Mock submissions for demo
const MOCK_SUBMISSIONS: FPMSSubmission[] = [
  {
    id: "sub1",
    facultyId: "1",
    academicYear: "2023-24",
    status: "approved",
    modules: FPMS_MODULES.map((mod) => ({
      id: mod.id,
      name: mod.name,
      maxPoints: mod.maxPoints,
      score: Math.floor(mod.maxPoints * 0.75),
      entries: [],
    })),
    totalScore: 225,
    submittedAt: "2024-03-15",
    reviewedBy: "2",
    reviewedAt: "2024-03-20",
    remarks: "Excellent performance across all modules.",
  },
  {
    id: "sub2",
    facultyId: "5",
    academicYear: "2024-25",
    status: "submitted",
    modules: FPMS_MODULES.map((mod) => ({
      id: mod.id,
      name: mod.name,
      maxPoints: mod.maxPoints,
      score: Math.floor(mod.maxPoints * 0.65),
      entries: [],
    })),
    totalScore: 195,
    submittedAt: "2024-12-10",
  },
  {
    id: "sub3",
    facultyId: "6",
    academicYear: "2024-25",
    status: "under_review",
    modules: FPMS_MODULES.map((mod) => ({
      id: mod.id,
      name: mod.name,
      maxPoints: mod.maxPoints,
      score: Math.floor(mod.maxPoints * 0.8),
      entries: [],
    })),
    totalScore: 240,
    submittedAt: "2024-12-05",
  },
];

export function FPMSProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<FPMSSubmission[]>([]);
  const [academicYear, setAcademicYear] = useState("2024-25");

  useEffect(() => {
    // Load from localStorage or use mock data
    const stored = localStorage.getItem("fpms_submissions");
    if (stored) {
      try {
        setSubmissions(JSON.parse(stored));
      } catch {
        setSubmissions(MOCK_SUBMISSIONS);
      }
    } else {
      setSubmissions(MOCK_SUBMISSIONS);
    }
  }, []);

  useEffect(() => {
    if (submissions.length > 0) {
      localStorage.setItem("fpms_submissions", JSON.stringify(submissions));
    }
  }, [submissions]);

  const currentSubmission = user
    ? submissions.find(
        (s) => s.facultyId === user.id && s.academicYear === academicYear,
      ) || null
    : null;

  const createSubmission = (): FPMSSubmission => {
    if (!user) throw new Error("User not authenticated");

    const newSubmission: FPMSSubmission = {
      id: generateId(),
      facultyId: user.id,
      academicYear,
      status: "draft",
      modules: createDefaultModules(),
      totalScore: 0,
    };

    setSubmissions((prev) => [...prev, newSubmission]);
    return newSubmission;
  };

  const updateModule = (moduleId: string, entries: ModuleEntry[]) => {
    if (!currentSubmission) return;

    const moduleScore = entries.reduce((sum, e) => sum + e.claimedPoints, 0);
    const moduleMax =
      FPMS_MODULES.find((m) => m.id === moduleId)?.maxPoints || 0;
    const clampedScore = Math.min(moduleScore, moduleMax);

    setSubmissions((prev) =>
      prev.map((sub) => {
        if (sub.id !== currentSubmission.id) return sub;

        const updatedModules = sub.modules.map((mod) =>
          mod.id === moduleId ? { ...mod, entries, score: clampedScore } : mod,
        );

        return {
          ...sub,
          modules: updatedModules,
          totalScore: updatedModules.reduce((sum, m) => sum + m.score, 0),
        };
      }),
    );
  };

  const submitForReview = () => {
    if (!currentSubmission) return;

    setSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === currentSubmission.id
          ? {
              ...sub,
              status: "submitted" as SubmissionStatus,
              submittedAt: new Date().toISOString(),
            }
          : sub,
      ),
    );
  };

  const approveSubmission = (submissionId: string, remarks: string) => {
    if (!user) return;

    // Use case-insensitive role comparison
    const roleStr = String(user.role || "").toLowerCase();
    setSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === submissionId
          ? {
              ...sub,
              status:
                roleStr === "hod"
                  ? ("under_review" as SubmissionStatus)
                  : ("approved" as SubmissionStatus),
              reviewedBy: user.id,
              reviewedAt: new Date().toISOString(),
              remarks: roleStr === "hod" ? sub.remarks : remarks,
              hodRemarks: roleStr === "hod" ? remarks : sub.hodRemarks,
              committeeRemarks:
                roleStr === "committee" ? remarks : sub.committeeRemarks,
            }
          : sub,
      ),
    );
  };

  const rejectSubmission = (submissionId: string, remarks: string) => {
    if (!user) return;

    setSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === submissionId
          ? {
              ...sub,
              status: "rejected" as SubmissionStatus,
              reviewedBy: user.id,
              reviewedAt: new Date().toISOString(),
              remarks,
            }
          : sub,
      ),
    );
  };

  const lockSubmission = (submissionId: string) => {
    setSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === submissionId
          ? { ...sub, status: "locked" as SubmissionStatus }
          : sub,
      ),
    );
  };

  const getAllSubmissions = () => submissions;

  const getDepartmentSubmissions = (department: string) => {
    // In a real app, we'd filter by department
    return submissions;
  };

  return (
    <FPMSContext.Provider
      value={{
        submissions,
        currentSubmission,
        academicYear,
        setAcademicYear,
        createSubmission,
        updateModule,
        submitForReview,
        approveSubmission,
        rejectSubmission,
        lockSubmission,
        getAllSubmissions,
        getDepartmentSubmissions,
      }}
    >
      {children}
    </FPMSContext.Provider>
  );
}

export function useFPMS() {
  const context = useContext(FPMSContext);
  if (context === undefined) {
    throw new Error("useFPMS must be used within an FPMSProvider");
  }
  return context;
}
