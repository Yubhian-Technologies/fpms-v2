import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Table2, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
  durationSourceColumns,
  isCalculatedColumn,
  normalizeTableColumns,
  type Task,
  type TableColumn,
} from "@/types/formBuilder";

interface TaskFormProps {
  task: Task;
  onChange: (updates: Partial<Task>) => void;
  onDelete: () => void;
  /** Number used when Task No. is left blank, e.g. 3.1.2 */
  autoNumber: string;
}

const EMPTY_COLUMN: TableColumn = { label: "", kind: "text", options: [], document: "none", maxUses: 0 };

// One Type dropdown covers both what faculty enter and document uploads
const COLUMN_TYPES: { value: string; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "date", label: "Date (calendar)" },
  { value: "month", label: "Month & Year" },
  { value: "select", label: "Dropdown" },
  { value: "days", label: "No. of Days (auto)" },
  { value: "years", label: "Years (auto)" },
  { value: "doc-required", label: "Document upload (required)" },
  { value: "doc-optional", label: "Document upload (optional)" },
];

const columnTypeValue = (column: TableColumn) =>
  column.document === "none" ? column.kind : `doc-${column.document}`;

const columnTypePatch = (value: string): Partial<TableColumn> =>
  value.startsWith("doc-")
    ? { document: value.slice(4) as TableColumn["document"], kind: "text" }
    : { document: "none", kind: value as TableColumn["kind"] };

// Dropdown choices typed comma-separated; committed on blur so commas can be typed
function OptionsInput({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  const [text, setText] = useState(options.join(", "));
  return (
    <Input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const next = [...new Set(text.split(",").map((o) => o.trim()).filter(Boolean))];
        setText(next.join(", "));
        onChange(next);
      }}
      placeholder="Choices, comma-separated, e.g. Ongoing, Completed"
    />
  );
}

// Table columns: label, type and duplicate limit
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
      <div className="hidden gap-2 px-1 text-xs text-muted-foreground md:grid md:grid-cols-[1fr_210px_120px_40px]">
        <span>Column</span>
        <span>Type</span>
        <span>Duplicate limit</span>
        <span />
      </div>
      {columns.map((column, i) => {
        const calculated = isCalculatedColumn(column);
        const source = calculated ? durationSourceColumns(columns, i) : null;
        return (
          <div key={i} className="space-y-1.5 rounded-md border p-2 md:border-0 md:p-0">
            <div className="grid gap-2 md:grid-cols-[1fr_210px_120px_40px]">
              <Input
                value={column.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="e.g. Programme Title / Type"
              />
              <select
                value={columnTypeValue(column)}
                onChange={(e) => update(i, columnTypePatch(e.target.value))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                title="Column type"
              >
                {COLUMN_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                max={50}
                value={column.maxUses}
                disabled={calculated}
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
            {column.document === "none" && column.kind === "select" && (
              <div className="md:pr-[178px]">
                <OptionsInput options={column.options} onChange={(options) => update(i, { options })} />
                {column.options.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">Add at least one choice.</p>
                )}
              </div>
            )}
            {calculated && (
              <p className={`text-xs ${source ? "text-muted-foreground" : "text-red-600"}`}>
                {source
                  ? `Calculated from "${columns[source[0]].label || "Date"}" to "${columns[source[1]].label || "Date"}".`
                  : "Needs two Date columns above it (From and To)."}
              </p>
            )}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...columns, { ...EMPTY_COLUMN }])}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Add column
      </Button>
      <p className="text-xs text-muted-foreground">
        No. of Days / Years are filled in automatically from the two Date columns above them (e.g. From Date, To Date).
        Document upload columns are shown at the end of the table; when the table has one, the separate task
        Evidence upload is not shown to faculty.
      </p>
      <p className="text-xs text-muted-foreground">
        Duplicate limit: <strong>0</strong> = no limit, <strong>1</strong> = unique, <strong>3</strong> = the same value (or the same
        uploaded file) may be entered by at most 3 faculty of a college in an academic year.
      </p>
    </div>
  );
}

export default function TaskForm({ task, onChange, onDelete, autoNumber }: TaskFormProps) {
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
        <CardTitle className="text-base">Task {task.taskNumber?.trim() || autoNumber}</CardTitle>
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
        <div className="grid gap-4 md:grid-cols-[140px_1fr_1fr]">
          <div className="space-y-2">
            <Label>Task No.</Label>
            <Input
              value={task.taskNumber || ""}
              onChange={(e) => onChange({ taskNumber: e.target.value })}
              placeholder={autoNumber}
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">Blank = {autoNumber}</p>
          </div>
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
