import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

interface YearForm {
  id: string;
  formTitle: string;
  totalMarks: number;
  criteriaCount: number;
  applicableRoles: string[];
}

interface ImportFormsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

// Copies forms built in a previous academic year into the current one
export default function ImportFormsDialog({ open, onOpenChange, onImported }: ImportFormsDialogProps) {
  const { toast } = useToast();
  const { currentYear, years } = useAcademicYear();
  const pastYears = useMemo(
    () => years.filter((y) => y.id !== currentYear).map((y) => y.id).sort().reverse(),
    [years, currentYear],
  );

  const [fromYear, setFromYear] = useState("");
  const [forms, setForms] = useState<YearForm[]>([]);
  const [alreadyCopied, setAlreadyCopied] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    if (open && !fromYear && pastYears.length) setFromYear(pastYears[0]);
  }, [open, fromYear, pastYears]);

  useEffect(() => {
    if (!open || !fromYear) return;
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const [pastRes, currentRes] = await Promise.all([
          api.get("/api/superadmin/forms", { params: { year: fromYear } }),
          api.get("/api/superadmin/forms", { params: { year: currentYear } }),
        ]);
        if (cancelled) return;
        const pastForms: YearForm[] = pastRes.data?.data ?? [];
        const copied = new Set<string>(
          (currentRes.data?.data ?? []).map((f: any) => f.clonedFrom).filter(Boolean),
        );
        setForms(pastForms);
        setAlreadyCopied(copied);
        setSelected(new Set(pastForms.filter((f) => !copied.has(f.id)).map((f) => f.id)));
      } catch (error: any) {
        if (!cancelled) {
          toast({
            title: "Could not load forms",
            description: error?.response?.data?.message || "Server error",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, fromYear, currentYear, toast]);

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const importSelected = async () => {
    setIsImporting(true);
    try {
      const res = await api.post("/api/academic-years/import-forms", {
        fromYear,
        formIds: [...selected],
      });
      toast({ title: "Forms imported", description: res.data?.message });
      onImported();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Import failed",
        description: error?.response?.data?.message || "Server error",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !isImporting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import forms from a previous year</DialogTitle>
          <DialogDescription>
            Selected forms are copied into {currentYear} with all criteria, modules, tasks, tables and evidence
            checkboxes. Edit the copies freely — the originals stay unchanged as history.
          </DialogDescription>
        </DialogHeader>

        {pastYears.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            There is no previous academic year yet. Forms can be imported after a new year is started.
          </p>
        ) : (
          <div className="space-y-4">
            <Select value={fromYear} onValueChange={setFromYear}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Academic year" />
              </SelectTrigger>
              <SelectContent>
                {pastYears.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading forms…
              </div>
            ) : forms.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No forms in {fromYear}.</p>
            ) : (
              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {forms.map((form) => {
                  const copied = alreadyCopied.has(form.id);
                  return (
                    <label
                      key={form.id}
                      className={`flex items-start gap-3 rounded-md border p-3 ${copied ? "opacity-60" : "cursor-pointer hover:bg-muted/40"}`}
                    >
                      <Checkbox
                        className="mt-0.5"
                        checked={selected.has(form.id)}
                        disabled={copied}
                        onCheckedChange={(value) => toggle(form.id, Boolean(value))}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{form.formTitle || "Untitled Form"}</span>
                          {copied && <Badge variant="secondary">Already in {currentYear}</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Marks: {form.totalMarks} • Criteria: {form.criteriaCount}
                          {form.applicableRoles?.length ? ` • ${form.applicableRoles.join(", ")}` : ""}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Cancel
          </Button>
          <Button onClick={importSelected} disabled={isImporting || selected.size === 0 || pastYears.length === 0}>
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Copy {selected.size} form{selected.size === 1 ? "" : "s"} to {currentYear}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
