import { useEffect, useState } from "react";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";

export type Phase = "submission" | "evaluation" | "appeal" | "appeal-review" | "locked";

const toEndOfDay = (s: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  d.setHours(23, 59, 59, 999);
  return d;
};

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export function useCollegePhase() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("submission");
  const [deadlineLabel, setDeadlineLabel] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .get("/api/colleges/user-deadline", {
        headers: {
          "x-user-id": user.uid || user.id || "",
          "x-user-role": user.role || "",
          "x-college": user.college || "",
        },
      })
      .then((res) => {
        if (!res.data?.success) return;
        const d = res.data.data;
        const now = new Date();
        const dl = toEndOfDay(d.assessmentEnd || d.deadline || null);
        const ev = toEndOfDay(d.evaluationEnd || null);
        const ap = toEndOfDay(d.appealEnd || null);
        const apRev = toEndOfDay(d.appealReviewEnd || null);
        if (!dl || now <= dl) {
          setPhase("submission");
          setDeadlineLabel(dl ? `Submission deadline: ${fmtDate(dl)}` : "");
        } else if (!ev || now <= ev) {
          setPhase("evaluation");
          setDeadlineLabel(ev ? `Evaluation ends: ${fmtDate(ev)}` : "");
        } else if (!ap || now <= ap) {
          setPhase("appeal");
          setDeadlineLabel(ap ? `Appeal deadline: ${fmtDate(ap)}` : "");
        } else if (!apRev || now <= apRev) {
          setPhase("appeal-review");
          setDeadlineLabel(apRev ? `Appeal review ends: ${fmtDate(apRev)}` : "");
        } else {
          setPhase("locked");
          setDeadlineLabel("All scores are locked.");
        }
      })
      .catch(() => {});
  }, [user?.id, user?.college]);

  return { phase, deadlineLabel };
}
