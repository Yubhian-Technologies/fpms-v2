// src/components/DeadlineAlert.tsx
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/api/api";
import { useAuth } from "@/contexts/AuthContext";

interface DeadlineAlertProps {
  onCompleteClick?: () => void;
}

export function DeadlineAlert({ onCompleteClick }: DeadlineAlertProps) {
  const { user } = useAuth();

  const [deadline, setDeadline] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setError("No user logged in");
      return;
    }

    const userId = user.uid || user.id || "";
    const role = user.role || "";
    const college = user.college || "";

    if (!userId) {
      setIsLoading(false);
      setError("User ID missing");
      return;
    }

    const fetchDeadline = async () => {
      try {
        const res = await api.get("/api/colleges/user-deadline", {
          headers: {
            "x-user-id": userId,
            "x-user-role": role,
            "x-college": college,
          },
        });

        if (res.data.success && res.data.data?.deadline) {
          setDeadline(res.data.data.deadline);
        } else {
          setError("No deadline found");
        }
      } catch (err: any) {
        setError("Failed to load deadline");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDeadline();
  }, [user]);

  const getDaysRemaining = (deadlineStr: string | null): number | null => {
    if (!deadlineStr) return null;
    try {
      const due = new Date(deadlineStr);
      if (isNaN(due.getTime())) return null;
      due.setHours(23, 59, 59, 999);
      const now = new Date();
      const diffMs = due.getTime() - now.getTime();
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  };

  const days = getDaysRemaining(deadline);
  const noDeadline = days === null || error;

  // ────────────────────────────────────────────────
  // THEME LOGIC
  // ────────────────────────────────────────────────

  let cardClass =
    "overflow-hidden shadow-sm border-l-6 border border-r border-t border-b";
  let textClass = "";
  let iconBg = "";
  let iconColor = "";
  let buttonClass = "";
  let buttonVariant: "default" | "secondary" | "destructive" = "secondary";

  if (!noDeadline && days !== null) {
    if (days > 30) {
      // GREEN THEME
      cardClass += " border-l-green-600 border-left-6 bg-green-50 dark:bg-green-950/20";
      textClass = "text-green-700 dark:text-green-400";
      iconBg = "bg-green-100 dark:bg-green-900/30";
      iconColor = "text-green-600 dark:text-green-400";
      buttonVariant = "default";
      buttonClass =
        "bg-green-600 hover:bg-green-700 text-white";
    } else if (days > 15 && days <= 30) {
      // YELLOW THEME
      cardClass += " border-l-yellow-500 border-l-6 bg-yellow-50 dark:bg-yellow-950/20";
      textClass = "text-yellow-700 dark:text-yellow-400";
      iconBg = "bg-yellow-100 dark:bg-yellow-900/30";
      iconColor = "text-yellow-600 dark:text-yellow-400";
      buttonVariant = "default";
      buttonClass =
        "bg-yellow-500 hover:bg-yellow-600 text-white";
    } else {
      // RED THEME (<=15 days)
      cardClass += " border-l-red-600 bg-red-50 dark:bg-red-950/20";
      textClass = "text-red-700 dark:text-red-400";
      iconBg = "bg-red-100 dark:bg-red-900/30";
      iconColor = "text-red-600 dark:text-red-400";
      buttonVariant = "destructive";
      buttonClass =
        "bg-red-600 hover:bg-red-700 text-white";
    }
  }

  const formattedDate = deadline
    ? new Date(deadline).toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Not set";

  const message = isLoading
    ? "Loading deadline..."
    : error
    ? error
    : noDeadline
    ? "No deadline available"
    : `${days} day${days !== 1 ? "s" : ""} remaining`;

  return (
    <Card className={cn(cardClass)}>
      <CardContent className="flex items-center justify-between p-5 gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
              iconBg
            )}
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <CalendarClock className={cn("h-6 w-6", iconColor)} />
            )}
          </div>

          <div>
            <p className={cn("text-sm font-medium", textClass)}>
              Submission Deadline
            </p>
            <p className="text-xl font-bold mt-0.5">
              {isLoading ? "—" : formattedDate}
            </p>
            
          </div>
        </div>

        <p className={cn("text-md mt-1 font-bold", textClass)}>
              {message}
            </p>
      </CardContent>
    </Card>
  );
}