import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";

type StaffStatus =
  | "active"
  | "inactive"
  | "long-leave"
  | "maternity-leave"
  | "recently-joined"
  | "retainership"
  | "other";

const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  "long-leave": "Long Leave",
  "maternity-leave": "Maternity Leave",
  "recently-joined": "Recently Joined",
  retainership: "Retainership",
  other: "Other",
};

function calculateExperience(dateOfJoining: string): number {
  if (!dateOfJoining) return 0;
  const doj = new Date(dateOfJoining);
  if (isNaN(doj.getTime())) return 0;
  const now = new Date();
  const years = now.getFullYear() - doj.getFullYear();
  const monthDiff = now.getMonth() - doj.getMonth();
  return monthDiff < 0 || (monthDiff === 0 && now.getDate() < doj.getDate())
    ? years - 1
    : years;
}

interface ProfileData {
  name: string;
  email: string;
  college: string;
  department: string;
  designation: string;
  hasPhd: boolean;
  staffStatus: StaffStatus;
  statusNote: string;
  dateOfJoining: string;
  phone: string;
  subjectsHandled: string[];
  experience: number | null;
  externalExperience: number | null;
  overallExperience: number | null;
}

export default function FacultyProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({
    name: "",
    designation: "",
    hasPhd: false,
    staffStatus: "active" as StaffStatus,
    statusNote: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/faculty/profile");
        const d: ProfileData = res.data.data;
        setProfile(d);
        setForm({
          name: d.name,
          designation: d.designation,
          hasPhd: d.hasPhd,
          staffStatus: (d.staffStatus as StaffStatus) || "active",
          statusNote: d.statusNote || "",
        });
      } catch {
        toast({ title: "Failed to load profile", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.put("/api/faculty/profile", form);
      setProfile((prev) => prev ? { ...prev, ...form } : prev);
      toast({ title: "Profile updated successfully" });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) return null;

  const internalExp = profile.dateOfJoining
    ? calculateExperience(profile.dateOfJoining)
    : profile.experience ?? 0;
  const overallExp = internalExp + (profile.externalExperience ?? 0);

  const dojDisplay = profile.dateOfJoining
    ? new Date(profile.dateOfJoining).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{profile.name || "My Profile"}</h1>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>

        {/* Read-only info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Institution Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">College</Label>
              <p className="text-sm font-medium">{profile.college || "—"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Department</Label>
              <p className="text-sm font-medium">{profile.department || "—"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Date of Joining</Label>
              <p className="text-sm font-medium">{dojDisplay}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Phone</Label>
              <p className="text-sm font-medium">{profile.phone || "—"}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Internal Experience</Label>
              <p className="text-sm font-medium">{internalExp} yrs</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">External Experience</Label>
              <p className="text-sm font-medium">
                {profile.externalExperience != null ? `${profile.externalExperience} yrs` : "—"}
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Overall Experience</Label>
              <p className="text-sm font-medium">{overallExp} yrs</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <p className="text-sm font-medium">{profile.email || "—"}</p>
            </div>
            {profile.subjectsHandled.length > 0 && (
              <div className="col-span-2 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Subjects Handled incl. Labs (2025–2026)
                </Label>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {profile.subjectsHandled.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editable fields */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Edit Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label>Designation</Label>
              <Input
                value={form.designation}
                onChange={(e) => setForm((p) => ({ ...p, designation: e.target.value }))}
                placeholder="e.g. Assistant Professor"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="hasPhd"
                checked={form.hasPhd}
                onCheckedChange={(v) => setForm((p) => ({ ...p, hasPhd: Boolean(v) }))}
              />
              <Label htmlFor="hasPhd">Has Ph.D.</Label>
            </div>

            <div className="space-y-2">
              <Label>Staff Status</Label>
              <Select
                value={form.staffStatus}
                onValueChange={(v) => setForm((p) => ({ ...p, staffStatus: v as StaffStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STAFF_STATUS_LABELS) as StaffStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STAFF_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.staffStatus === "other" && (
              <div className="space-y-2">
                <Label>Status Note</Label>
                <Input
                  value={form.statusNote}
                  onChange={(e) => setForm((p) => ({ ...p, statusNote: e.target.value }))}
                  placeholder="Describe your status"
                />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
