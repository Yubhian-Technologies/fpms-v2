import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Table2, Trash2, X } from "lucide-react";
import { normalizeTableColumns, type Task, type TableColumn } from "@/types/formBuilder";

interface TaskFormProps {
  task: Task;
  onChange: (updates: Partial<Task>) => void;
  onDelete: () => void;
}

const EMPTY_COLUMN: TableColumn = { label: "", document: "none", maxUses: 0 };

// Table columns: label, type (text or document upload) and duplicate limit
function ColumnListEditor({
  columns,
  onChange,
}: {
  columns: TableColumn[];
  onChange: (columns: TableColumn[]) => void;
}) {
  const update = (index: number, patch: Partial<TableColumn>) =>
    onChange(columns.map((column, i) => (i === index ? { ...column, ...patch } : column)));

  return (
    <div className="space-y-2">
      <div className="hidden gap-2 px-1 text-xs text-muted-foreground md:grid md:grid-cols-[1fr_190px_120px_40px]">
        <span>Column</span>
        <span>Type</span>
        <span>Duplicate limit</span>
        <span />
      </div>
      {columns.map((column, i) => (
        <div key={i} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1fr_190px_120px_40px] md:border-0 md:p-0">
          <Input
            value={column.label}
            onChange={(e) => update(i, { label: e.target.value })}
            placeholder="e.g. Programme Title / Type"
          />
          <select
            value={column.document}
            onChange={(e) => update(i, { document: e.target.value as TableColumn["document"] })}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            title="Column type"
          >
            <option value="none">Text</option>
            <option value="required">Document upload (required)</option>
            <option value="optional">Document upload (optional)</option>
          </select>
          <Input
            type="number"
            min={0}
            max={50}
            value={column.maxUses}
            onChange={(e) => update(i, { maxUses: Math.min(50, Math.max(0, Number(e.target.value) || 0)) })}
            title="0 = no limit, 1 = unique, N = same value allowed N times in the college this year"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => onChange(columns.filter((_, ci) => ci !== i))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...columns, { ...EMPTY_COLUMN }])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add column
      </Button>
      <p className="text-xs text-muted-foreground">
        Document upload columns are shown at the end of the table. When the table has one, the separate task
        Evidence upload is not shown to faculty.
      </p>
      <p className="text-xs text-muted-foreground">
        Duplicate limit: <strong>0</strong> = no limit, <strong>1</strong> = unique, <strong>3</strong> = the same value (or the same
        uploaded file) may be entered by at most 3 faculty of a college in an academic year.
      </p>
    </div>
  );
}

export default function TaskForm({ task, onChange, onDelete }: TaskFormProps) {
  const tableColumns = normalizeTableColumns(task.tableColumns);
  const marksType = task.marksType ?? "fixed";
  const isRange = marksType === "range";

  const handleMarksTypeChange = (type: "fixed" | "range") => {
    if (type === "fixed") {
      // Switch to fixed: clear minMarks, keep existing marks value
      onChange({ marksType: "fixed", minMarks: undefined });
    } else {
      // Switch to range: minMarks becomes the marks value (used for totals),
      // clear the fixed marks since there's no upper cap
      const currentMarks = task.marks ?? 0;
      onChange({ marksType: "range", minMarks: currentMarks, marks: currentMarks });
    }
  };

  const handleMinMarksChange = (value: number) => {
    const min = Math.max(0, value);
    // For range tasks, minMarks IS the marks used for totals
    onChange({ minMarks: min, marks: min });
  };

  return (
    <Card className="border-l-4 border-l-violet-500">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Task</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Task Title *</Label>
            <Input
              value={task.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Enter task title"
            />
          </div>
          <div className="space-y-2">
            <Label>Task Subtitle</Label>
            <Input
              value={task.subtitle || ""}
              onChange={(e) => onChange({ subtitle: e.target.value })}
              placeholder="Optional subtitle"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Task Description</Label>
            <Textarea
              rows={3}
              value={task.description || ""}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Describe the task"
            />
          </div>
          <div className="space-y-2">
            <Label>Assessment Criteria</Label>
            <Textarea
              rows={3}
              value={task.assessmentCriteria || ""}
              onChange={(e) => onChange({ assessmentCriteria: e.target.value })}
              placeholder="How this task is assessed"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Note (shown to faculty above claimed score)</Label>
          <Textarea
            rows={2}
            value={task.note || ""}
            onChange={(e) => onChange({ note: e.target.value })}
            placeholder="Optional note or instruction for faculty"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Evidence</Label>
            <Input
              value={task.evidence || ""}
              onChange={(e) => onChange({ evidence: e.target.value })}
              placeholder="Evidence required"
            />
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input
              value={task.reference || ""}
              onChange={(e) => onChange({ reference: e.target.value })}
              placeholder="Reference links / docs"
            />
          </div>

          {/* Marks Type Toggle */}
          <div className="space-y-2">
            <Label>Marks Type</Label>
            <div className="flex rounded-md border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => handleMarksTypeChange("fixed")}
                className={`flex-1 py-2 font-medium transition-colors ${
                  !isRange
                    ? "bg-violet-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Max
              </button>
              <button
                type="button"
                onClick={() => handleMarksTypeChange("range")}
                className={`flex-1 py-2 font-medium transition-colors ${
                  isRange
                    ? "bg-violet-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Ref
              </button>
            </div>
          </div>
        </div>

        {/* Optional fill-in table */}
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="flex items-center gap-1.5">
              <Table2 className="h-4 w-4" /> Table for faculty to fill
            </Label>
            {tableColumns.length ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onChange({ tableColumns: undefined, tableRows: undefined })}
              >
                Remove table
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange({ tableColumns: [{ ...EMPTY_COLUMN }], tableRows: 2 })}
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add table
              </Button>
            )}
          </div>
          {tableColumns.length ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Columns (S. No. is added automatically)</p>
                <ColumnListEditor columns={tableColumns} onChange={(next) => onChange({ tableColumns: next })} />
              </div>
              <div className="max-w-[200px] space-y-1.5">
                <p className="text-xs text-muted-foreground">Rows shown initially</p>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={task.tableRows ?? 2}
                  onChange={(e) =>
                    onChange({ tableRows: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })
                  }
                />
                <p className="text-xs text-muted-foreground">Faculty can add more rows.</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Marks input — single field regardless of type */}
        <div className="max-w-xs space-y-2">
          <Label>{isRange ? "Ref Marks *" : "Max Marks *"}</Label>
          {isRange ? (
            <Input
              type="number"
              min={0}
              value={task.minMarks ?? 0}
              onChange={(e) => handleMinMarksChange(Number(e.target.value) || 0)}
              placeholder="0"
            />
          ) : (
            <Input
              type="number"
              min={0}
              value={task.marks}
              onChange={(e) =>
                onChange({ marks: Math.max(0, Number(e.target.value) || 0) })
              }
              placeholder="0"
            />
          )}
        </div>

        {isRange ? (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
            <strong>Ref:</strong> Faculty can claim any marks ≥ <strong>{task.minMarks ?? 0}</strong> with no upper limit.
            This task contributes <strong>{task.minMarks ?? 0}</strong> marks to the criteria total.
          </p>
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            <strong>Max:</strong> Faculty cannot claim more than <strong>{task.marks ?? 0}</strong> marks for this task.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
