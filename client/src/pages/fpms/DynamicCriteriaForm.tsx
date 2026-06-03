import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { api } from "@/api/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Clock } from "lucide-react";
import { resolveEvidenceLink } from "@/lib/utils";

interface TaskItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  assessmentCriteria: string;
  evidence: string;
  reference: string;
  marks: number;       // max marks
  marksType?: "fixed" | "range";
  minMarks?: number;   // lower bound when marksType === "range"
  note?: string;
  order: number;
}

interface ModuleItem {
  id: string;
  moduleNumber: number;
  moduleName: string;
  totalMarks: number;
  order: number;
  tasks: TaskItem[];
}

interface CriteriaPayload {
  formId: string;
  formTitle: string;
  criteria: {
    id: string;
    criteriaName: string;
    totalMarks: number;
    modules: ModuleItem[];
  };
}

interface TaskProgress {
  claimedScore: number;
  evidenceUrl: string | File;
  description: string;
}

interface WorkflowTaskStatusItem {
  id: string;
  formId?: string;
  formTitle?: string;
  criteriaId?: string;
  criteriaName?: string;
  taskId: string;
  taskName?: string;
  moduleId?: string;
  status: string;
  claimedScore?: number;
  evidence?: string;
  description?: string;
  reviewerScore?: number;
  reviewerReason?: string;
  reviewerId?: string;
  reviewerRole?: string;
  isAppealed?: boolean;
  appealReason?: string;
  appealRequestedScore?: number;
  appealerScore?: number;
  appealerReason?: string;
  appealerId?: string;
  appealerRole?: string;
  finalScore?: number;
  submitToRoleIds?: string[];
  appealToRoleIds?: string[];
  maxMarks?: number;
}

type TaskStatus = "pending" | "submitted";
type TaskWorkflowStatus =
  | "pending"
  | "submitted"
  | "reviewed"
  | "accepted"
  | "appealed"
  | "appeal-resolved"
  | "auto-approved";

const COLLAPSE_LIMIT = 120;

function CollapsibleText({ text, className }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > COLLAPSE_LIMIT;
  return (
    <p className={className}>
      {isLong && !expanded ? text.slice(0, COLLAPSE_LIMIT).trimEnd() + "…" : text}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          className="ml-1 text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100"
        >
          {expanded ? "less" : "more"}
        </button>
      )}
    </p>
  );
}

function clampClaimedScore(value: number, task: TaskItem): number {
  if (!Number.isFinite(value)) return 0;
  const v = Math.max(0, value);
  // "range" (Ref) tasks have no hard cap — faculty can claim above the reference points
  if (task.marksType === "range") return v;
  // "fixed" (Max) tasks are hard-capped at task.marks
  const cap = Number(task.marks || 0);
  return cap > 0 ? Math.min(v, cap) : v;
}

export default function DynamicCriteriaForm() {
  const { formId, criteriaId } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [acceptingTaskId, setAcceptingTaskId] = useState<string | null>(null);
  const [appealingTaskId, setAppealingTaskId] = useState<string | null>(null);
  const [submittingModuleId, setSubmittingModuleId] = useState<string | null>(
    null,
  );
  const [payload, setPayload] = useState<CriteriaPayload | null>(null);
  const [editingTasks, setEditingTasks] = useState<Record<string, boolean>>({});
  const [taskProgress, setTaskProgress] = useState<
    Record<string, TaskProgress>
  >({});
  const [taskStatuses, setTaskStatuses] = useState<
    Record<string, TaskWorkflowStatus>
  >({});
  const [taskSubmittedRoles, setTaskSubmittedRoles] = useState<
    Record<string, string[]>
  >({});
  const [taskCanAppeal, setTaskCanAppeal] = useState<Record<string, boolean>>(
    {},
  );
  const [taskSubmissionIds, setTaskSubmissionIds] = useState<
    Record<string, string>
  >({});
  const [taskReviewData, setTaskReviewData] = useState<
    Record<string, { reviewerScore: number; reviewerReason: string }>
  >({});
  const [taskAppealData, setTaskAppealData] = useState<
    Record<string, { appealerScore: number; appealerReason: string }>
  >({});
  const [appealDialogOpen, setAppealDialogOpen] = useState(false);
  const [appealFormData, setAppealFormData] = useState({
    taskId: "",
    moduleId: "",
    reason: "",
  });

  // Deadline / phase state — currentPhase must be declared before submissionClosedLabel
  const [deadline, setDeadline] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  const [assessmentStart, setAssessmentStart] = useState<string | null>(null);
  const [assessmentEnd, setAssessmentEnd] = useState<string | null>(null);
  const [evaluationEnd, setEvaluationEnd] = useState<string | null>(null);
  const [appealEnd, setAppealEnd] = useState<string | null>(null);
  const [appealReviewEnd, setAppealReviewEnd] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<"submission" | "evaluation" | "appeal" | "appeal-review" | "locked">("submission");
  const submissionClosedLabel = currentPhase === "evaluation"
    ? "Evaluation in Progress"
    : currentPhase === "appeal"
    ? "Appeal Period Active"
    : currentPhase === "appeal-review"
    ? "Appeal Review in Progress"
    : currentPhase === "locked"
    ? "Scores Locked"
    : "Deadline Passed";

  const storageKey = useMemo(() => {
    const userId = user?.id || "anonymous";
    return `fpms-dynamic-progress-${userId}-${formId || ""}-${criteriaId || ""}`;
  }, [user?.id, formId, criteriaId]);

  const initializeProgress = (modules: ModuleItem[]) => {
    const fallback: Record<string, TaskProgress> = {};
    const statusFallback: Record<string, TaskWorkflowStatus> = {};
    modules.forEach((moduleItem) => {
      moduleItem.tasks.forEach((task) => {
        fallback[task.id] = {
          claimedScore: 0,
          evidenceUrl: "",
          description: "",
        };
        statusFallback[task.id] = "pending";
      });
    });

    setTaskProgress(fallback);
    setTaskStatuses(statusFallback);
  };

  const fetchCriteriaData = async () => {
    if (!formId || !criteriaId) return;

    setLoading(true);
    try {
      const response = await api.get(
        `/api/committee/forms/${formId}/criteria/${criteriaId}`,
      );
      const data = response.data?.data as CriteriaPayload;
      setPayload(data);
      initializeProgress(data?.criteria?.modules || []);

      // Sync workflow statuses after initializing progress
      await syncWorkflowStatuses();

      // Fetch deadline
      await fetchDeadline();
    } catch (error: any) {
      toast({
        title: "Failed to load criteria",
        description:
          error?.response?.data?.message || "Unable to load modules and tasks.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchDeadline = async () => {
    if (!user) return;
    try {
      const res = await api.get("/api/colleges/user-deadline", {
        headers: {
          "x-user-id": user.id || user.uid,
          "x-user-role": user.role,
          "x-college": user.college,
        },
      });
      if (res.data.success) {
        const d = res.data.data;
        const deadlineStr = d.deadline || null;
        setDeadline(deadlineStr);
        setAssessmentStart(d.assessmentStart || null);
        setAssessmentEnd(d.assessmentEnd || null);
        setEvaluationEnd(d.evaluationEnd || null);
        setAppealEnd(d.appealEnd || null);
        setAppealReviewEnd(d.appealReviewEnd || null);

        if (deadlineStr) {
          const due = new Date(deadlineStr);
          const now = new Date();
          const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          setDaysRemaining(diffDays);
          setIsDeadlinePassed(diffDays < 0);
        }

        // Derive current phase
        const toEnd = (s: string | null) => { if (!s) return null; const d2 = new Date(s); d2.setHours(23, 59, 59, 999); return d2; };
        const now = new Date();
        const dl = toEnd(d.deadline);
        const evEnd = toEnd(d.evaluationEnd);
        const apEnd = toEnd(d.appealEnd);
        const apRevEnd = toEnd(d.appealReviewEnd);
        if (!dl || now <= dl) setCurrentPhase("submission");
        else if (!evEnd || now <= evEnd) setCurrentPhase("evaluation");
        else if (!apEnd || now <= apEnd) setCurrentPhase("appeal");
        else if (!apRevEnd || now <= apRevEnd) setCurrentPhase("appeal-review");
        else setCurrentPhase("locked");
      }
    } catch (err) {
      console.error("Deadline fetch error:", err);
    }
  };

  useEffect(() => {
    fetchCriteriaData();
  }, [formId, criteriaId, user?.role]);

  const syncWorkflowStatuses = async () => {
    if (!formId || !criteriaId || !user?.id) return;

    try {
      const res = await api.get("/api/submissions/my-submissions", {
        params: {
          formId,
          criteriaId,
        },
      });

      const submissionsData: WorkflowTaskStatusItem[] = Array.isArray(
        res.data?.data,
      )
        ? res.data.data
        : [];

      console.log("Fetched submissions data:", submissionsData);
      console.log("Total submissions:", submissionsData.length);
      console.log("FormId:", formId, "CriteriaId:", criteriaId);

      // Build new state objects
      const nextStatuses: Record<string, TaskWorkflowStatus> = {};
      const nextSubmittedRoles: Record<string, string[]> = {};
      const nextCanAppeal: Record<string, boolean> = {};
      const nextSubmissionIds: Record<string, string> = {};
      const nextProgress: Record<string, TaskProgress> = {};
      const nextReviewData: Record<
        string,
        { reviewerScore: number; reviewerReason: string }
      > = {};
      const nextAppealData: Record<
        string,
        { appealerScore: number; appealerReason: string }
      > = {};
      submissionsData.forEach((submission) => {
        const taskId = submission.taskId;
        if (!taskId) return;

        // Map backend status to UI status
        let uiStatus: TaskWorkflowStatus = "pending";
        const backendStatus = String(submission.status || "").toLowerCase();

        if (backendStatus === "submitted") {
          uiStatus = "submitted";
        } else if (backendStatus === "reviewed") {
          uiStatus = "reviewed";
        } else if (backendStatus === "accepted") {
          uiStatus = "accepted";
        } else if (backendStatus === "appealed") {
          uiStatus = "appealed";
        } else if (backendStatus === "appeal-resolved") {
          uiStatus = "appeal-resolved";
        } else if (backendStatus === "auto-approved") {
          uiStatus = "auto-approved";
        }

        nextStatuses[taskId] = uiStatus;

        // Store submission ID
        if (submission.id) {
          nextSubmissionIds[taskId] = submission.id;
        }

        // Store submitted roles
        if (Array.isArray(submission.submitToRoleIds)) {
          nextSubmittedRoles[taskId] = submission.submitToRoleIds;
        }

        // Store appeal roles if appealed
        if (
          submission.isAppealed &&
          Array.isArray(submission.appealToRoleIds)
        ) {
          nextSubmittedRoles[taskId] = submission.appealToRoleIds;
        }

        // Determine if can appeal (reviewed status and not already appealed/accepted)
        nextCanAppeal[taskId] =
          backendStatus === "reviewed" && !submission.isAppealed && currentPhase === "appeal";
          // appeal-review phase: window closed, no new appeals accepted

        // Store review data
        if (
          submission.reviewerScore !== null &&
          submission.reviewerScore !== undefined
        ) {
          nextReviewData[taskId] = {
            reviewerScore: submission.reviewerScore,
            reviewerReason: submission.reviewerReason || "",
          };
        }

        // Store appeal data
        if (
          submission.appealerScore !== null &&
          submission.appealerScore !== undefined
        ) {
          nextAppealData[taskId] = {
            appealerScore: submission.appealerScore,
            appealerReason: submission.appealerReason || "",
          };
        }

        // Update progress with claimed data
        nextProgress[taskId] = {
          claimedScore: submission.claimedScore || 0,
          evidenceUrl: submission.evidence || "",
          description: submission.description || "",
        };
      });

      // Apply all state updates
      setTaskStatuses((prev) => ({ ...prev, ...nextStatuses }));
      setTaskSubmittedRoles((prev) => ({ ...prev, ...nextSubmittedRoles }));
      setTaskCanAppeal((prev) => ({ ...prev, ...nextCanAppeal }));
      setTaskSubmissionIds((prev) => ({ ...prev, ...nextSubmissionIds }));
      setTaskProgress((prev) => ({ ...prev, ...nextProgress }));
      setTaskReviewData((prev) => ({ ...prev, ...nextReviewData }));
      setTaskAppealData((prev) => ({ ...prev, ...nextAppealData }));

      console.log("Synced task statuses:", nextStatuses);
      console.log("Synced task progress:", nextProgress);
      console.log("Review data:", nextReviewData);
      console.log("Appeal data:", nextAppealData);
    } catch (error: any) {
      console.error("Failed to fetch submissions:", error);
    }
  };

  useEffect(() => {
    fetchCriteriaData();
  }, [formId, criteriaId, user?.role]);

  const allTasks = useMemo(() => {
    if (!payload) return [] as TaskItem[];
    return payload.criteria.modules.flatMap((moduleItem) => moduleItem.tasks);
  }, [payload]);

  const totalMaxMarks = useMemo(() => {
    return allTasks.reduce((sum, task) => sum + Number(task.marks || 0), 0);
  }, [allTasks]);

  const totalClaimedMarks = useMemo(() => {
    return allTasks.reduce((sum, task) => {
      const value = Number(taskProgress[task.id]?.claimedScore || 0);
      const bounded = clampClaimedScore(value, task);
      return sum + bounded;
    }, 0);
  }, [allTasks, taskProgress]);

  const completedTasks = useMemo(() => {
    return allTasks.filter(
      (task) => String(taskStatuses[task.id] || "pending") !== "pending",
    ).length;
  }, [allTasks, taskStatuses]);

  const submittedCount = useMemo(
    () =>
      allTasks.filter(
        (task) =>
          taskStatuses[task.id] === "submitted" ||
          taskStatuses[task.id] === "reviewed" ||
          taskStatuses[task.id] === "auto-approved",
      ).length,
    [allTasks, taskStatuses],
  );

  const appealedCount = useMemo(
    () =>
      allTasks.filter((task) => taskStatuses[task.id] === "appealed").length,
    [allTasks, taskStatuses],
  );

  const approvedCount = useMemo(
    () =>
      allTasks.filter(
        (task) =>
          taskStatuses[task.id] === "accepted" ||
          taskStatuses[task.id] === "appeal-resolved" ||
          taskStatuses[task.id] === "auto-approved",
      ).length,
    [allTasks, taskStatuses],
  );

  const totalFinalScore = useMemo(() => {
    return allTasks.reduce((sum, task) => {
      const status = taskStatuses[task.id];
      if (status === "accepted" && taskReviewData[task.id]) {
        return sum + Number(taskReviewData[task.id].reviewerScore || 0);
      } else if (status === "appeal-resolved" && taskAppealData[task.id]) {
        return sum + Number(taskAppealData[task.id].appealerScore || 0);
      } else if (status === "auto-approved" && taskReviewData[task.id]) {
        return sum + Number(taskReviewData[task.id].reviewerScore || 0);
      }
      return sum;
    }, 0);
  }, [allTasks, taskStatuses, taskReviewData, taskAppealData]);

  const progressPercent = useMemo(() => {
    if (!allTasks.length) return 0;
    return Math.round((completedTasks / allTasks.length) * 100);
  }, [allTasks.length, completedTasks]);

  const getTaskStatus = (taskId: string): TaskWorkflowStatus => {
    return taskStatuses[taskId] || "pending";
  };

  const isTaskFrozen = (taskId: string) => {
    const status = getTaskStatus(taskId);

    // Fully locked after reviewer action
    if (
      status === "reviewed" ||
      status === "accepted" ||
      status === "appealed" ||
      status === "appeal-resolved" ||
      status === "auto-approved"
    ) {
      return true;
    }

    if (status === "submitted" && !editingTasks[taskId]) {
      return true;
    }

    return false;
  };

  const isModuleFrozen = (moduleItem: ModuleItem) =>
    moduleItem.tasks.every((task) => isTaskFrozen(task.id));

  const getModuleClaimed = (moduleItem: ModuleItem) =>
    moduleItem.tasks.reduce((sum, task) => {
      const value = Number(taskProgress[task.id]?.claimedScore || 0);
      return sum + clampClaimedScore(value, task);
    }, 0);

  const getModuleStatus = (moduleItem: ModuleItem) => {
    const submittedCount = moduleItem.tasks.filter((task) => {
      const status = getTaskStatus(task.id);
      return (
        status === "submitted" ||
        status === "reviewed" ||
        status === "accepted" ||
        status === "appealed" ||
        status === "appeal-resolved" ||
        status === "auto-approved"
      );
    }).length;
    if (submittedCount === 0) return "not-started";
    if (submittedCount === moduleItem.tasks.length) return "completed";
    return "in-progress";
  };

  const updateTaskProgress = (taskId: string, patch: Partial<TaskProgress>) => {
    setTaskProgress((prev) => ({
      ...prev,
      [taskId]: {
        claimedScore: prev[taskId]?.claimedScore || 0,
        evidenceUrl: prev[taskId]?.evidenceUrl || "",
        description: prev[taskId]?.description || "",
        ...patch,
      },
    }));
  };

  const saveProgress = async () => {
    try {
      setSaving(true);
      toast({
        title: "Progress saved",
        description: "Your task progress is stored in memory.",
      });
    } finally {
      setSaving(false);
    }
  };

  const submitTask = async (moduleItem: ModuleItem, task: TaskItem) => {
    try {
      // const taskStatus = getTaskStatus(task.id);
      // if (taskStatus !== "pending") {
      //   toast({
      //     title: "Task already submitted",
      //     description: "This task has already been submitted to the workflow.",
      //   });
      //   return;
      // }

      const progress = taskProgress[task.id] || {
        claimedScore: 0,
        evidenceUrl: "",
        description: "",
      };

      const existingSubmissionId = taskSubmissionIds[task.id];

      const claimedNum = Number(progress.claimedScore || 0);

      if (claimedNum > 0 && !progress.evidenceUrl) {
        toast({
          title: "Evidence required",
          description:
            "Please provide evidence when claiming a score greater than 0.",
          variant: "destructive",
        });
        if (existingSubmissionId) {
          await syncWorkflowStatuses();
        }
        return false;
      }

      setSubmittingTaskId(task.id);

      // Upload file directly to Cloudinary to bypass Vercel's 4.5MB body limit
      let evidenceValue: string = progress.evidenceUrl instanceof File ? "" : (progress.evidenceUrl || "");
      if (progress.evidenceUrl instanceof File) {
        const signRes = await api.get("/api/submissions/cloudinary-sign");
        const { signature, timestamp, cloudName, apiKey } = signRes.data;

        const cloudForm = new FormData();
        cloudForm.append("file", progress.evidenceUrl);
        cloudForm.append("timestamp", String(timestamp));
        cloudForm.append("signature", signature);
        cloudForm.append("api_key", apiKey);
        cloudForm.append("folder", "task_evidence");

        const cloudRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
          { method: "POST", body: cloudForm }
        );
        if (!cloudRes.ok) throw new Error("File upload to Cloudinary failed");
        const cloudData = await cloudRes.json();
        evidenceValue = cloudData.secure_url;
      }

      const formData = new FormData();

      formData.append("formId", formId || "");
      formData.append("formTitle", payload?.formTitle || "");
      formData.append("criteriaId", criteriaId || "");
      formData.append("criteriaName", payload?.criteria?.criteriaName || "");
      formData.append("moduleId", moduleItem.id);
      formData.append("moduleName", moduleItem.moduleName);
      formData.append(
        "criteriaTotalMarks",
        String(payload?.criteria?.totalMarks || 0),
      );
      formData.append("moduleTotalMarks", String(moduleItem.totalMarks || 0));
      formData.append("taskId", task.id);
      formData.append("taskName", task.title);
      formData.append("maxMarks", String(task.marks || 0));
      formData.append("marksType", task.marksType || "fixed");
      formData.append("minMarks", String(task.minMarks ?? 0));
      formData.append("claimedScore", String(progress.claimedScore));
      formData.append("description", progress.description || "");
      formData.append("evidence", evidenceValue);

      let submitRes;

      if (existingSubmissionId) {
        // 🔄 UPDATE existing submission
        submitRes = await api.put(
          `/api/submissions/${existingSubmissionId}/update`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );

        toast({
          title: "Task updated successfully",
        });
      } else {
        // 🆕 FIRST TIME SUBMIT
        submitRes = await api.post("/api/submissions/submit", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        toast({
          title: "Task submitted successfully",
        });
      }

      const submissionData = submitRes.data?.data;
      const submitToRoleIds = Array.isArray(submissionData?.submitToRoleIds)
        ? submissionData.submitToRoleIds
        : [];
      const submissionId = submissionData?.id || submissionData?.submissionId;

      // Update local state
      setTaskStatuses((prev) => ({ ...prev, [task.id]: "submitted" }));
      setTaskSubmittedRoles((prev) => ({
        ...prev,
        [task.id]: submitToRoleIds,
      }));
      if (submissionId) {
        setTaskSubmissionIds((prev) => ({ ...prev, [task.id]: submissionId }));
      }

      toast({
        title: "Task submitted successfully",
        description: submitToRoleIds.length
          ? `Submitted to ${submitToRoleIds.join(", ")} for review.`
          : "Task submitted to workflow.",
      });
      return true;
    } catch (error: any) {
      toast({
        title: "Task submission failed",
        description:
          error?.response?.data?.message ||
          "Unable to submit task. Please try again.",
        variant: "destructive",
      });
      if (taskSubmissionIds[task.id]) {
        await syncWorkflowStatuses();
      }
      return false;
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const submitModuleSection = async (moduleItem: ModuleItem) => {
    try {
      if (isModuleFrozen(moduleItem)) {
        toast({
          title: "Section already submitted",
          description: "All tasks in this section are already locked.",
        });
        return;
      }

      setSubmittingModuleId(moduleItem.id);

      const nextStatuses = { ...taskStatuses };
      const nextSubmittedRoles = { ...taskSubmittedRoles };

      for (const task of moduleItem.tasks) {
        if (isTaskFrozen(task.id)) {
          continue;
        }

        const progress = taskProgress[task.id] || {
          claimedScore: 0,
          evidenceUrl: "",
          description: "",
        };

        const submitRes = await api.post(
          "/api/committee/workflow/submissions/task",
          {
            formId,
            criteriaId,
            moduleId: moduleItem.id,
            moduleName: moduleItem.moduleName,
            taskId: task.id,
            taskTitle: task.title,
            claimedScore: progress.claimedScore,
            maxMarks: Number(task.marks || 0),
            evidenceUrl: progress.evidenceUrl,
            description: progress.description,
          },
        );

        const submitToRoles = Array.isArray(submitRes.data?.data?.submitToRoles)
          ? submitRes.data.data.submitToRoles
              .map((role: string) => String(role || "").trim())
              .filter(Boolean)
          : [];

        nextSubmittedRoles[task.id] = submitToRoles;
        nextStatuses[task.id] = "submitted";
      }

      moduleItem.tasks.forEach((task) => {
        nextStatuses[task.id] = "submitted";
      });
      setTaskStatuses(nextStatuses);
      setTaskSubmittedRoles(nextSubmittedRoles);

      toast({
        title: "Section submitted",
        description: `${moduleItem.moduleName} submitted to workflow roles successfully.`,
      });
    } catch (error: any) {
      toast({
        title: "Section submission failed",
        description:
          error?.response?.data?.message ||
          "Unable to submit section. Please check workflow roles.",
        variant: "destructive",
      });
    } finally {
      setSubmittingModuleId(null);
    }
  };

  const acceptReview = async (task: TaskItem) => {
    try {
      const submissionId = taskSubmissionIds[task.id];
      if (!submissionId) {
        toast({
          title: "Cannot accept",
          description: "Submission ID not found.",
          variant: "destructive",
        });
        return;
      }

      setAcceptingTaskId(task.id);

      await api.post(`/api/submissions/${submissionId}/accept`);

      setTaskStatuses((prev) => ({ ...prev, [task.id]: "accepted" }));
      setTaskCanAppeal((prev) => ({ ...prev, [task.id]: false }));

      toast({
        title: "Review accepted",
        description: "The reviewer's score has been set as your final score.",
      });
    } catch (error: any) {
      toast({
        title: "Accept failed",
        description:
          error?.response?.data?.message || "Unable to accept review.",
        variant: "destructive",
      });
    } finally {
      setAcceptingTaskId(null);
    }
  };

  const submitTaskAppeal = async (moduleItem: ModuleItem, task: TaskItem) => {
    try {
      const taskStatus = getTaskStatus(task.id);
      if (taskStatus === "appealed" || taskStatus === "appeal-resolved") {
        toast({
          title: "Appeal already submitted",
          description: "This task is already in appeal workflow.",
        });
        return;
      }

      if (taskStatus !== "reviewed") {
        toast({
          title: "Appeal not allowed",
          description: "This task must be reviewed before appealing.",
          variant: "destructive",
        });
        return;
      }

      const submissionId = taskSubmissionIds[task.id];
      if (!submissionId) {
        toast({
          title: "Cannot appeal",
          description:
            "Submission ID not found. Please try submitting the task again.",
          variant: "destructive",
        });
        return;
      }

      // Open dialog for appeal
      setAppealFormData({
        taskId: task.id,
        moduleId: moduleItem.id,
        reason: "",
      });
      setAppealDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Unable to initiate appeal.",
        variant: "destructive",
      });
    }
  };

  const handleAppealSubmit = async () => {
    try {
      if (!appealFormData.reason.trim()) {
        toast({
          title: "Appeal reason required",
          description: "Please provide a reason for the appeal.",
          variant: "destructive",
        });
        return;
      }

      const submissionId = taskSubmissionIds[appealFormData.taskId];
      if (!submissionId) {
        toast({
          title: "Cannot appeal",
          description: "Submission ID not found.",
          variant: "destructive",
        });
        return;
      }

      setAppealingTaskId(appealFormData.taskId);

      const progress = taskProgress[appealFormData.taskId] || {
        claimedScore: 0,
        evidenceUrl: "",
        description: "",
      };

      const response = await api.post(
        `/api/submissions/${submissionId}/appeal`,
        {
          appealReason: appealFormData.reason,
          appealRequestedScore: progress.claimedScore,
        },
      );

      const appealToRoles = Array.isArray(response.data?.data?.appealToRoleIds)
        ? response.data.data.appealToRoleIds
        : [];

      setTaskStatuses((prev) => ({
        ...prev,
        [appealFormData.taskId]: "appealed",
      }));
      setTaskSubmittedRoles((prev) => ({
        ...prev,
        [appealFormData.taskId]: appealToRoles,
      }));
      setTaskCanAppeal((prev) => ({ ...prev, [appealFormData.taskId]: false }));

      setAppealDialogOpen(false);
      setAppealFormData({ taskId: "", moduleId: "", reason: "" });

      toast({
        title: "Appeal submitted",
        description:
          appealToRoles.length > 0
            ? `Appeal submitted to ${appealToRoles.join(", ")}.`
            : "Appeal submitted successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Appeal submission failed",
        description:
          error?.response?.data?.message ||
          "Unable to submit appeal for this task.",
        variant: "destructive",
      });
    } finally {
      setAppealingTaskId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Loading...">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading modules and tasks...</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!payload) {
    return (
      <DashboardLayout title="FPMS Form">
        <div className="text-center text-muted-foreground py-16">
          No criteria data found.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={
        payload.criteria.criteriaName || payload.formTitle || "FPMS Criteria"
      }
      subtitle={`${payload.formTitle} • Maximum ${payload.criteria.totalMarks || totalMaxMarks} Points`}
    >
      <div className="space-y-6">
        {/* Phase banner */}
        {(() => {
          const fmt = (s: string | null) =>
            s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";
          const phases: Record<string, { label: string; desc: string; border: string; bg: string; text: string; date: string | null }> = {
            submission: {
              label: "Submission Period",
              desc: daysRemaining !== null && daysRemaining >= 0
                ? `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining`
                : "Deadline passed",
              border: "border-l-amber-500",
              bg: "bg-amber-50",
              text: "text-amber-700",
              date: deadline,
            },
            evaluation: {
              label: "Evaluation Period",
              desc: `HODs are reviewing submissions. Appeals open after ${fmt(evaluationEnd)}.`,
              border: "border-l-blue-500",
              bg: "bg-blue-50",
              text: "text-blue-700",
              date: evaluationEnd,
            },
            appeal: {
              label: "Appeal Period",
              desc: `You can appeal reviewed scores until ${fmt(appealEnd)}.`,
              border: "border-l-purple-500",
              bg: "bg-purple-50",
              text: "text-purple-700",
              date: appealEnd,
            },
            "appeal-review": {
              label: "Appeal Review Period",
              desc: `Appeals are being reviewed by evaluators until ${fmt(appealReviewEnd)}.`,
              border: "border-l-orange-500",
              bg: "bg-orange-50",
              text: "text-orange-700",
              date: appealReviewEnd,
            },
            locked: {
              label: "Scores Locked",
              desc: "The appeal review period has ended. All scores are final.",
              border: "border-l-gray-500",
              bg: "bg-gray-50",
              text: "text-gray-700",
              date: null,
            },
          };
          const p = phases[currentPhase];
          return (
            <Card className={`border-l-4 ${p.border} ${p.bg}`}>
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <Clock className={`h-5 w-5 ${p.text}`} />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{p.label}</p>
                    <p className={`text-sm font-semibold ${p.text}`}>{p.desc}</p>
                  </div>
                </div>
                {p.date && (
                  <p className="text-xs text-muted-foreground">
                    Until {fmt(p.date)}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative group w-full h-4 rounded-full flex overflow-hidden">
              <div
                className="bg-emerald-600 h-4 transition-all"
                style={{
                  width: `${allTasks.length ? (approvedCount / allTasks.length) * 100 : 0}%`,
                }}
              />
              <div
                className="bg-amber-500 h-4 transition-all"
                style={{
                  width: `${allTasks.length ? (appealedCount / allTasks.length) * 100 : 0}%`,
                }}
              />
              <div
                className="bg-blue-600 h-4 transition-all"
                style={{
                  width: `${allTasks.length ? (submittedCount / allTasks.length) * 100 : 0}%`,
                }}
              />
              <div className="bg-gray-200 h-4 flex-1" />
              <div className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium mix-blend-difference pointer-events-none">
                {progressPercent}%
              </div>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <div className="flex flex-col gap-0.5">
                {totalFinalScore > 0 ? (
                  <span className="text-emerald-600 font-medium">
                    Final Score: {totalFinalScore} / {totalMaxMarks}
                  </span>
                ) : (
                  <span>
                    Claimed: {totalClaimedMarks} / {totalMaxMarks}
                  </span>
                )}
              </div>
              <span>
                Submitted: {completedTasks} • Tasks: {allTasks.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                <span className="text-muted-foreground">
                  Submitted: {submittedCount}
                </span>
              </div>
              <div className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">
                  Appealed: {appealedCount}
                </span>
              </div>
              <div className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                <span className="text-muted-foreground">
                  Approved: {approvedCount}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Accordion type="single" collapsible className="space-y-4">
          {payload.criteria.modules.map((moduleItem) => (
            <AccordionItem
              key={moduleItem.id}
              value={moduleItem.id}
              className="border rounded-lg"
            >
              <AccordionTrigger className="px-5 py-4">
                <div className="flex w-full justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1">
                      {moduleItem.moduleNumber || "M"}
                    </Badge>
                    <span className="font-semibold text-lg">
                      {moduleItem.moduleName}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {moduleItem.tasks.some((t) => t.marksType === "range")
                        ? `points: ${moduleItem.totalMarks}`
                        : `max points: ${moduleItem.totalMarks}`}
                    </span>
                    {getModuleStatus(moduleItem) === "completed" ? (
                      <Badge className="bg-blue-800 text-white">
                        Submitted
                      </Badge>
                    ) : getModuleStatus(moduleItem) === "in-progress" ? (
                      <Badge variant="secondary">In Progress</Badge>
                    ) : (
                      <Badge variant="destructive">Not Started</Badge>
                    )}
                  </div>
                </div>
              </AccordionTrigger>

              <AccordionContent className="px-5 pb-6 pt-4 space-y-6">
                {moduleItem.tasks.map((task) => {
                  const progress = taskProgress[task.id] || {
                    claimedScore: 0,
                    evidenceUrl: "",
                    description: "",
                  };
                  const frozenEvidenceLink =
                    typeof progress.evidenceUrl === "string"
                      ? resolveEvidenceLink(progress.evidenceUrl)
                      : null;
                  const taskStatus = getTaskStatus(task.id);
                  const taskFrozen = isTaskFrozen(task.id);

                  return (
                    <Card key={task.id} className="border">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">
                              {task.title || "Task"}
                            </CardTitle>
                            {task.subtitle ? (
                              <p className="text-sm text-muted-foreground italic">
                                {task.subtitle}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {taskStatus === "accepted" ? (
                              <Badge className="bg-emerald-600 text-white">
                                Accepted
                              </Badge>
                            ) : taskStatus === "auto-approved" ? (
                              <Badge className="bg-emerald-600 text-white">
                                Claim Accepted
                              </Badge>
                            ) : taskStatus === "appeal-resolved" ? (
                              <Badge className="bg-emerald-600 text-white">
                                Appeal Resolved
                              </Badge>
                            ) : taskStatus === "appealed" ? (
                              <Badge className={currentPhase === "locked" ? "bg-gray-500 text-white" : "bg-amber-500 text-white"}>
                                {currentPhase === "locked" ? "Appeal Expired" : "Appealed"}
                              </Badge>
                            ) : taskStatus === "reviewed" ? (
                              <Badge className="bg-blue-600 text-white">
                                Reviewed
                              </Badge>
                            ) : taskStatus === "submitted" ? (
                              <Badge variant="secondary">Submitted</Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {task.marksType === "range"
                                ? `points: ${task.minMarks || task.marks || 0}`
                                : `max points: ${task.marks || 0}`}
                            </span>
                            {Array.isArray(taskSubmittedRoles[task.id]) &&
                            taskSubmittedRoles[task.id].length > 0 ? (
                              <span className="text-[11px] text-blue-700 text-right max-w-[220px]">
                                {taskStatus === "appealed"
                                  ? "Appealed to"
                                  : "Submitted to"}
                                : {taskSubmittedRoles[task.id].join(", ")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          {task.description ? (
                            <div className="bg-blue-50 p-3 rounded border border-blue-200">
                              <h5 className="font-medium text-blue-900 text-sm mb-1">
                                Description
                              </h5>
                              <CollapsibleText text={task.description} className="text-sm text-gray-700 whitespace-pre-line" />
                            </div>
                          ) : null}

                          {task.assessmentCriteria ? (
                            <div className="bg-green-50 p-3 rounded border border-green-200">
                              <h5 className="font-medium text-green-900 text-sm mb-1">
                                Assessment Criteria
                              </h5>
                              <CollapsibleText text={task.assessmentCriteria} className="text-sm text-gray-700 whitespace-pre-line" />
                            </div>
                          ) : null}

                          {task.evidence ? (
                            <div className="bg-amber-50 p-3 rounded border border-amber-200">
                              <h5 className="font-medium text-amber-900 text-sm mb-1">
                                Required Evidence
                              </h5>
                              <CollapsibleText text={task.evidence} className="text-sm text-gray-700 whitespace-pre-line" />
                            </div>
                          ) : null}

                          {task.reference ? (
                            <div className="bg-purple-50 p-3 rounded border border-purple-200">
                              <h5 className="font-medium text-purple-900 text-sm mb-1">
                                Reference
                              </h5>
                              <CollapsibleText text={task.reference} className="text-sm text-gray-700 whitespace-pre-line" />
                            </div>
                          ) : null}
                        </div>

                        {task.note && (
                          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-900">
                            <span className="font-semibold">Note: </span>{task.note}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="text-sm font-medium block mb-1.5">
                              Claimed Score
                            </label>
                            {taskFrozen ? (
                              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                                {progress.claimedScore}
                                {task.marksType !== "range" && ` / ${task.marks}`}
                              </div>
                            ) : (
                              <Input
                                type="number"
                                min={0}
                                max={task.marksType === "fixed" ? (task.marks || undefined) : undefined}
                                value={progress.claimedScore}
                                className="w-full"
                                onChange={(e) =>
                                  updateTaskProgress(task.id, {
                                    claimedScore: clampClaimedScore(Number(e.target.value || 0), task),
                                  })
                                }
                              />
                            )}
                          </div>

                          <div>
                            <label className="text-sm font-medium block mb-1.5">
                              Evidence (Upload File or Paste Link)
                            </label>

                            {taskFrozen ? (
                              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                                {frozenEvidenceLink ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      window.open(
                                        frozenEvidenceLink,
                                        "_blank",
                                        "noopener,noreferrer",
                                      )
                                    }
                                    className=" bg-blue-900 p-1 text-white  hover:bg-blue-600"
                                  >
                                    View Evidence
                                  </button>
                                ) : progress.evidenceUrl instanceof File ? (
                                  <span>File Uploaded</span>
                                ) : (
                                  <span>No evidence provided</span>
                                )}
                              </div>
                            ) : (
                              <>
                                {/* File Upload */}
                                <Input
                                  type="file"
                                  className="w-full mb-2"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      updateTaskProgress(task.id, {
                                        evidenceUrl: file,
                                      });
                                    }
                                  }}
                                />

                                {/* OR Link */}
                                <Input
                                  value={
                                    typeof progress.evidenceUrl === "string"
                                      ? progress.evidenceUrl
                                      : ""
                                  }
                                  className="w-full"
                                  onChange={(e) =>
                                    updateTaskProgress(task.id, {
                                      evidenceUrl: e.target.value,
                                    })
                                  }
                                  placeholder="Or paste supporting link"
                                />
                              </>
                            )}
                          </div>

                          <div className="md:col-span-2">
                            <label className="text-sm font-medium block mb-1.5">
                              Description
                            </label>
                            {taskFrozen ? (
                              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm min-h-[100px] whitespace-pre-wrap">
                                {progress.description ||
                                  "No description provided"}
                              </div>
                            ) : (
                              <Textarea
                                value={progress.description}
                                onChange={(e) =>
                                  updateTaskProgress(task.id, {
                                    description: e.target.value,
                                  })
                                }
                                className="w-full min-h-[100px]"
                                placeholder="Explain how this task is satisfied..."
                                rows={4}
                              />
                            )}
                          </div>
                        </div>

                        {/* Reviewer Section */}
                        {taskStatus !== "pending" &&
                          taskReviewData[task.id] && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div>
                                <label className="text-sm font-medium block mb-1.5">
                                  Verified Score
                                </label>
                                <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900">
                                  {taskReviewData[task.id].reviewerScore}
                                  {task.marksType !== "range" && ` / ${task.marks}`}
                                </div>
                              </div>
                              <div className="md:col-span-1">
                                <label className="text-sm font-medium block mb-1.5">
                                  Reviewer Remarks
                                </label>
                                <div className="rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm min-h-[42px] text-blue-900 whitespace-pre-wrap">
                                  {taskReviewData[task.id].reviewerReason ||
                                    "No remarks provided"}
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Appeal expired notice */}
                        {taskStatus === "appealed" && currentPhase === "locked" && (
                          <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                            The appeal period has ended without resolution. Your original reviewed score stands.
                          </div>
                        )}

                        {/* Appeal Section */}
                        {taskStatus === "appeal-resolved" &&
                          taskAppealData[task.id] && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <div>
                                <label className="text-sm font-medium block mb-1.5">
                                  Final Appeal Score
                                </label>
                                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
                                  {taskAppealData[task.id].appealerScore}
                                  {task.marksType !== "range" && ` / ${task.marks}`}
                                </div>
                              </div>
                              <div className="md:col-span-1">
                                <label className="text-sm font-medium block mb-1.5">
                                  Appeal Resolution Remarks
                                </label>
                                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm min-h-[42px] text-emerald-900 whitespace-pre-wrap">
                                  {taskAppealData[task.id].appealerReason ||
                                    "No remarks provided"}
                                </div>
                              </div>
                            </div>
                          )}

                        <div className="flex justify-end pt-1">
                          <div className="flex items-center gap-2">
                            {taskStatus === "reviewed" ? (
                              <>
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    submitTaskAppeal(moduleItem, task)
                                  }
                                  disabled={appealingTaskId === task.id}
                                >
                                  {appealingTaskId === task.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : null}
                                  {appealingTaskId === task.id
                                    ? "Appealing..."
                                    : "Appeal"}
                                </Button>
                                <Button
                                  onClick={() => acceptReview(task)}
                                  disabled={acceptingTaskId === task.id}
                                >
                                  {acceptingTaskId === task.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : null}
                                  {acceptingTaskId === task.id
                                    ? "Accepting..."
                                    : "Accept"}
                                </Button>
                              </>
                            ) : taskStatus === "pending" ? (
                              <Button
                                onClick={() => submitTask(moduleItem, task)}
                                disabled={
                                  submittingTaskId === task.id ||
                                  isDeadlinePassed
                                }
                              >
                                {submittingTaskId === task.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : null}
                                {submittingTaskId === task.id
                                  ? "Submitting..."
                                  : isDeadlinePassed
                                    ? submissionClosedLabel
                                    : "Submit Task"}
                              </Button>
                            ) : taskStatus === "submitted" ? (
                              editingTasks[task.id] ? (
                                <Button
                                  onClick={async () => {
                                    const success = await submitTask(
                                      moduleItem,
                                      task,
                                    );
                                    if (!success) {
                                      return;
                                    }
                                    setEditingTasks((prev) => ({
                                      ...prev,
                                      [task.id]: false,
                                    }));
                                  }}
                                  disabled={
                                    submittingTaskId === task.id ||
                                    isDeadlinePassed
                                  }
                                >
                                  {submittingTaskId === task.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : null}
                                  {submittingTaskId === task.id
                                    ? "Updating..."
                                    : isDeadlinePassed
                                      ? submissionClosedLabel
                                      : "Update Task"}
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  onClick={() =>
                                    setEditingTasks((prev) => ({
                                      ...prev,
                                      [task.id]: true,
                                    }))
                                  }
                                  disabled={isDeadlinePassed}
                                >
                                  {isDeadlinePassed
                                    ? submissionClosedLabel
                                    : "Edit"}
                                </Button>
                              )
                            ) : (
                              <Badge className="bg-gray-600 text-white px-4 py-2">
                                {taskStatus === "accepted"
                                  ? "Accepted"
                                  : taskStatus === "auto-approved"
                                    ? "Claim Accepted"
                                    : taskStatus === "appeal-resolved"
                                      ? "Appeal Resolved"
                                      : taskStatus === "appealed"
                                        ? (currentPhase === "locked" ? "Appeal Expired" : "Under Appeal")
                                        : "Submitted"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => submitModuleSection(moduleItem)}
                    disabled={
                      submittingModuleId === moduleItem.id ||
                      isModuleFrozen(moduleItem) ||
                      isDeadlinePassed
                    }
                  >
                    {submittingModuleId === moduleItem.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {isModuleFrozen(moduleItem)
                      ? "Section Submitted"
                      : submittingModuleId === moduleItem.id
                        ? "Submitting..."
                        : isDeadlinePassed
                          ? submissionClosedLabel
                          : "Submit Section"}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="flex justify-end">
          <Button onClick={saveProgress} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving..." : "Save Progress"}
          </Button>
        </div>
      </div>

      {/* Appeal Dialog */}
      <Dialog open={appealDialogOpen} onOpenChange={setAppealDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Submit Appeal</DialogTitle>
            <DialogDescription>
              Provide a reason for appealing the reviewer's score. Your appeal
              will be sent to the designated appeal reviewers.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="appeal-reason" className="text-sm font-medium">
                Appeal Reason <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="appeal-reason"
                placeholder="Explain why you are appealing the reviewer's score..."
                value={appealFormData.reason}
                onChange={(e) =>
                  setAppealFormData((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                rows={5}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAppealDialogOpen(false);
                setAppealFormData({ taskId: "", moduleId: "", reason: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAppealSubmit}
              disabled={
                appealingTaskId !== null ||
                !appealFormData.reason.trim() ||
                isDeadlinePassed
              }
            >
              {appealingTaskId ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : isDeadlinePassed ? (
                submissionClosedLabel
              ) : (
                "Submit Appeal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
