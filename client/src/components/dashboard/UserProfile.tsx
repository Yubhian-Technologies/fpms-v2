import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, Mail, Building, GraduationCap, Briefcase } from "lucide-react";
import { cn, formatRoleLabel } from "@/lib/utils";

interface UserProfileProps {
  user: {
    id?: string;
    name: string;
    email: string;
    role: string;
    level?: number;
    college?: string;
    department?: string;
    designation?: string;
    avatarUrl?: string; // ← optional: add this to your user type later
  };
}

export function UserProfile({ user }: UserProfileProps) {
  // Simple role-based styling (customize as needed)
  const roleVariant =
    {
      student: "secondary",
      teacher: "default",
      admin: "destructive",
      faculty: "outline",
    }[user.role.toLowerCase()] ?? "secondary";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <Card
      className={cn(
        "overflow-hidden border shadow-sm transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5 ",
      )}
    >
      {/* Header with avatar & name */}
      <CardHeader className="bg-gradient-to-b from-muted/40 to-transparent pb-6 pt-8 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {user.name}
        </CardTitle>

        <Badge
          className={cn(
            "mt-1.5 px-3 py-1 text-sm font-medium bg-slate-100 text-black",
          )}
        >
          {formatRoleLabel(user.role)}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-5 px-6 pb-6 pt-2">
        <div className="grid gap-4 text-sm">
          <InfoRow icon={Mail} label="Email" value={user.email} />

          {user.college && (
            <InfoRow icon={Building} label="College" value={user.college} />
          )}

          {user.department && (
            <InfoRow
              icon={Building}
              label="Department"
              value={user.department}
            />
          )}

          {user.designation && (
            <InfoRow
              icon={Briefcase}
              label="Designation"
              value={user.designation}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/60">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  );
}
