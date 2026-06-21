// src/components/dashboard/StatusCards.tsx
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Award,
  CheckCircle,
  BarChart2,
  AlertCircle,
  School,
  Users,
  User,
} from "lucide-react";

interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}

function StatusCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: StatusCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden shadow-sm transition-all py-1.5 hover:shadow-md hover:scale-[1.02]",
        "border-l-4 border-l-primary"  
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground tracking-tight">
              {title}
            </p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/5">
            <Icon className="h-5 w-5 text-primary/80" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatusCardsProps {
  role: string;
  submissions?: any[];
  committeeData?: any;
}

export function StatusCards({
  role,
  submissions = [],
  committeeData,
}: StatusCardsProps) {
  const isPrincipalRole =
    role === "principle" || role === "vice principle" || role === "director";

  // ── Principal / Vice Principal / Director: show college-wide aggregates ──
  if (isPrincipalRole) {
    const adminRoles = new Set(["committee", "principle", "vice principle", "director", "internal committee"]);
    const staff = (committeeData?.staff || []).filter(
      (s: any) => !adminRoles.has(String(s.role || "").toLowerCase()),
    );

    const totalStaff = staff.length;
    let totalScore = 0;
    let totalTarget = 0;
    let submittedFaculty = 0;
    let targetAchievers = 0;
    let needToAcceptCount = 0;
    let pendingReviewCount = 0;
    let appealedCount = 0;

    const FINALIZED = new Set(["accepted", "appeal-resolved", "auto-approved", "appeal-expired"]);

    staff.forEach((s: any) => {
      const subs = s.submissions || [];
      const target = Number(s.designationTarget || 0);
      totalTarget += target;

      subs.forEach((sub: any) => {
        if (FINALIZED.has(sub.status)) totalScore += Number(sub.finalScore ?? 0);
        if (sub.status === "reviewed") needToAcceptCount++;
        if (sub.status === "submitted") pendingReviewCount++;
        if (sub.status === "appealed") appealedCount++;
      });

      if (subs.length > 0) submittedFaculty++;

      const confirmedScore = subs.reduce(
        (sum: number, sub: any) => sum + (FINALIZED.has(sub.status) ? Number(sub.finalScore ?? 0) : 0),
        0,
      );
      if (target > 0 && confirmedScore >= target) targetAchievers++;
    });

    const submissionRate = totalStaff > 0 ? Math.round((submittedFaculty / totalStaff) * 100) : 0;

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatusCard
          title="Total Faculty"
          value={totalStaff}
          subtitle="enrolled in college"
          icon={Users}
        />
        <StatusCard
          title="Submitted"
          value={`${submittedFaculty} / ${totalStaff}`}
          subtitle={`${submissionRate}% submission rate`}
          icon={Award}
        />
        <StatusCard
          title="Target Achievers"
          value={targetAchievers}
          subtitle={`of ${totalStaff} faculty`}
          icon={CheckCircle}
        />
        <StatusCard
          title="Need to Accept"
          value={needToAcceptCount}
          subtitle="reviewed, awaiting faculty"
          icon={BarChart2}
        />
        <StatusCard
          title="Pending Review"
          value={pendingReviewCount}
          subtitle={appealedCount > 0 ? `${appealedCount} appealed` : "awaiting evaluator"}
          icon={AlertCircle}
        />
      </div>
    );
  }

  // ── Committee: show cross-college aggregates ──
  if (role === "committee") {
    const rawStaff = committeeData?.staff || [];
    const staffList = rawStaff.filter((s: any) => s.college && s.role !== "committee");

    const groupedData = staffList.reduce((acc: any, staff: any) => {
      const collegeName = staff.college || "Unknown College";
      const roleName = staff.role || "Unknown Role";
      if (!acc[collegeName]) acc[collegeName] = {};
      if (!acc[collegeName][roleName]) acc[collegeName][roleName] = [];
      acc[collegeName][roleName].push(staff);
      return acc;
    }, {});

    const totalColleges = Object.keys(groupedData).length;
    const totalRoles = [...new Set(staffList.map((s: any) => s.role))].length;
    const totalStaff = staffList.length;
    let totalSubmissions = 0;
    let totalAppealed = 0;
    staffList.forEach((staff: any) => {
      staff.submissions?.forEach(() => totalSubmissions++);
      staff.submissions?.forEach((sub: any) => {
        if (sub.status === "appealed" || sub.status === "appeal-resolved") totalAppealed++;
      });
    });

    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatusCard title="Total Colleges" value={totalColleges} icon={School} />
        <StatusCard title="Total Roles" value={totalRoles} icon={Users} />
        <StatusCard title="Total Staff" value={totalStaff} icon={User} />
        <StatusCard title="Total Submissions" value={totalSubmissions} icon={Award} />
        <StatusCard title="Appealed" value={totalAppealed} icon={AlertCircle} />
      </div>
    );
  }

  // ── HOD / Faculty: show personal submission stats ──
  const totalSubmissions = submissions.length;
  let overallScore = 0;
  let completedCount = 0;
  let appealedCount = 0;

  submissions.forEach((sub: any) => {
    const claimed = Number(sub.claimedScore ?? 0);
    const reviewer = sub.reviewerScore != null ? Number(sub.reviewerScore) : null;
    const final = sub.finalScore != null ? Number(sub.finalScore) : null;
    const appeal = sub.appealScore != null ? Number(sub.appealScore) : null;
    overallScore += appeal ?? final ?? reviewer ?? claimed;
    if (sub.status === "accepted" || sub.status === "appeal-resolved" || sub.status === "appeal-expired") completedCount++;
    if (sub.status === "appealed" || sub.status === "appeal-resolved") appealedCount++;
  });

  const completionRate = overallScore > 0 ? (overallScore / 300) * 100 : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatusCard title="Total Submissions" value={totalSubmissions} icon={Award} />
      <StatusCard title="Completed" value={completedCount} icon={CheckCircle} />
      <StatusCard title="Completion Rate" value={`${completionRate.toFixed(1)}%`} icon={BarChart2} />
      <StatusCard
        title="Overall Score"
        value={`${overallScore} / 300`}
        subtitle={`${completionRate.toFixed(1)}% achieved`}
        icon={AlertCircle}
      />
      <StatusCard title="Appealed" value={appealedCount} icon={AlertCircle} />
    </div>
  );
}