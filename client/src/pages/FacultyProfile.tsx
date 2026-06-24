import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, User, X, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";

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
  staffStatus: string;
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
    dateOfJoining: "",
    externalExperience: "",
    phone: "",
    subjectsHandled: [] as string[],
    subjectInput: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/faculty/profile");
        const d: ProfileData = res.data.data;
        setProfile(d);
        setForm({
          dateOfJoining: d.dateOfJoining || "",
          externalExperience: d.externalExperience != null ? String(d.externalExperience) : "",
          phone: d.phone || "",
          subjectsHandled: d.subjectsHandled || [],
          subjectInput: "",
        });
      } catch {
        toast({ title: "Failed to load profile", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const addSubject = () => {
    const val = form.subjectInput.trim();
    if (val && !form.subjectsHandled.includes(val)) {
      setForm((p) => ({ ...p, subjectsHandled: [...p.subjectsHandled, val], subjectInput: "" }));
    } else {
      setForm((p) => ({ ...p, subjectInput: "" }));
    }
    subjectInputRef.current?.focus();
  };

  const handleSubjectKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSubject(); }
  };

  const removeSubject = (s: string) =>
    setForm((p) => ({ ...p, subjectsHandled: p.subjectsHandled.filter((x) => x !== s) }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        phone: form.phone,
        subjectsHandled: form.subjectsHandled,
        dateOfJoining: form.dateOfJoining || undefined,
        externalExperience: form.externalExperience !== "" ? Number(form.externalExperience) : undefined,
      };
      // compute overallExperience
      const internal = form.dateOfJoining ? calculateExperience(form.dateOfJoining) : (profile?.experience ?? 0);
      const external = form.externalExperience !== "" ? Number(form.externalExperience) : 0;
      payload.overallExperience = internal + external;

      await api.put("/api/faculty/profile", payload);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              phone: form.phone,
              subjectsHandled: form.subjectsHandled,
              dateOfJoining: form.dateOfJoining,
              externalExperience: form.externalExperience !== "" ? Number(form.externalExperience) : null,
              overallExperience: payload.overallExperience,
              experience: internal,
            }
          : prev,
      );
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

  const internalExp = form.dateOfJoining ? calculateExperience(form.dateOfJoining) : (profile.experience ?? 0);
  const overallExp = internalExp + (form.externalExperience !== "" ? Number(form.externalExperience) : 0);

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

        {/* Read-only details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Profile Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {[
              { label: "Name", value: profile.name },
              { label: "Email", value: profile.email },
              { label: "College", value: profile.college },
              { label: "Department", value: profile.department },
              { label: "Designation", value: profile.designation },
              { label: "Has Ph.D.", value: profile.hasPhd ? "Yes" : "No" },
              { label: "Staff Status", value: profile.staffStatus || "—" },
              { label: "Internal Experience", value: `${internalExp} yrs` },
              { label: "Overall Experience", value: `${overallExp} yrs` },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <p className="text-sm font-medium">{value || "—"}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Editable fields */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Edit Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Date of Joining</Label>
              <Input
                type="date"
                value={form.dateOfJoining}
                onChange={(e) => setForm((p) => ({ ...p, dateOfJoining: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>External Experience (Years)</Label>
              <Input
                type="number"
                min={0}
                placeholder="Years at previous institutions"
                value={form.externalExperience}
                onChange={(e) => setForm((p) => ({ ...p, externalExperience: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input
                type="tel"
                placeholder="10-digit mobile number"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Subjects Handled incl. Labs (2025–2026)</Label>
              <div className="flex gap-2">
                <Input
                  ref={subjectInputRef}
                  placeholder="Type subject and press Enter"
                  value={form.subjectInput}
                  onChange={(e) => setForm((p) => ({ ...p, subjectInput: e.target.value }))}
                  onKeyDown={handleSubjectKeyDown}
                />
                <Button type="button" variant="outline" size="icon" onClick={addSubject}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {form.subjectsHandled.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {form.subjectsHandled.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1 pr-1 text-xs">
                      {s}
                      <button onClick={() => removeSubject(s)} className="ml-0.5 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

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
