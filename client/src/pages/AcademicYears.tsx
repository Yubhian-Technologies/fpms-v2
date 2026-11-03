import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarRange, CheckCircle2, Database, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

const nextYearOf = (year: string) => {
  const start = Number(year.slice(0, 4)) + 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
};

export default function AcademicYears() {
  const { currentYear, years, backfilled, reload } = useAcademicYear();
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ scanned: number; updated: number; collection: string } | null>(null);
  const [newYear, setNewYear] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [copyForms, setCopyForms] = useState(true);

  const proposedYear = newYear.trim() || nextYearOf(currentYear);
  const sortedYears = [...years].sort((a, b) => b.id.localeCompare(a.id));

  // Calls the resumable backfill until every collection is tagged
  const runBackfill = async () => {
    setIsBackfilling(true);
    let scanned = 0;
    let updated = 0;
    let next: { collection: string; cursor: string | null } | null = null;
    try {
      do {
        const res = await api.post("/api/academic-years/backfill", next || {});
        const data = res.data.data;
        scanned += data.scanned;
        updated += data.updated;
        setBackfillProgress({ scanned, updated, collection: data.collection });
        next = data.done ? null : data.next;
      } while (next);
      toast({ title: "Records tagged", description: `${updated} record(s) tagged as ${currentYear}.` });
      await reload();
    } catch (err: any) {
      toast({
        title: "Backfill stopped",
        description: `${err?.response?.data?.message || "Server error"}. Run it again — it resumes safely.`,
        variant: "destructive",
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  const runRollover = async () => {
    setIsRollingOver(true);
    try {
      const res = await api.post("/api/academic-years/rollover", { newYear: proposedYear, copyForms });
      const data = res.data.data;
      toast({
        title: `${data.currentYear} started`,
        description: `${data.closedYear} kept as history (${data.facultyCount} profiles frozen, ${data.formsCloned} form(s) copied).`,
      });
      setNewYear("");
      await reload();
    } catch (err: any) {
      toast({
        title: "Could not start new year",
        description: err?.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsRollingOver(false);
      setConfirmOpen(false);
    }
  };

  return (
    <DashboardLayout title="Academic Years" subtitle="Close the current year as history and open the next one">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarRange className="h-5 w-5" /> Years
            </CardTitle>
            <CardDescription>Closed years stay fully viewable from the year selector, read-only.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sortedYears.map((y) => (
              <div key={y.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="font-semibold">{y.id}</span>
                {y.id === currentYear ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Current</Badge>
                ) : (
                  <Badge variant="secondary">History</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {!backfilled ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" /> Step 1 — Tag existing records
              </CardTitle>
              <CardDescription>
                Marks every existing submission, form and appeal as <strong>{currentYear}</strong>. Nothing is deleted or
                changed apart from adding the year. Required once before starting a new year.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {backfillProgress && (
                <p className="text-sm text-muted-foreground">
                  {backfillProgress.collection}: scanned {backfillProgress.scanned}, tagged {backfillProgress.updated}
                </p>
              )}
              <Button onClick={runBackfill} disabled={isBackfilling}>
                {isBackfilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isBackfilling ? "Tagging…" : `Tag records as ${currentYear}`}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Start a new academic year
              </CardTitle>
              <CardDescription>
                {currentYear} becomes read-only history: its scores, phase dates, designation targets and faculty profiles
                are frozen. Principals then set the new year's deadlines.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-year">New academic year</Label>
                <Input
                  id="new-year"
                  placeholder={nextYearOf(currentYear)}
                  value={newYear}
                  onChange={(e) => setNewYear(e.target.value)}
                  className="max-w-[160px]"
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={copyForms}
                  onCheckedChange={(value) => setCopyForms(Boolean(value))}
                />
                <span>
                  Copy all {currentYear} forms into {proposedYear}
                  <span className="block text-xs text-muted-foreground">
                    Untick to start with no forms and pick them later with "Import from previous year" in the form builder.
                  </span>
                </span>
              </label>
              <Button onClick={() => setConfirmOpen(true)} disabled={isRollingOver}>
                Start {proposedYear}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close {currentYear} and start {proposedYear}?</AlertDialogTitle>
            <AlertDialogDescription>
              No submission is deleted. After this, {currentYear} can no longer be submitted, reviewed, appealed or edited,
              and every college's phase dates are cleared for the new year. Run this at a quiet time — other open sessions
              pick up the new year within 5 minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingOver}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runRollover();
              }}
              disabled={isRollingOver}
            >
              {isRollingOver && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start {proposedYear}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
