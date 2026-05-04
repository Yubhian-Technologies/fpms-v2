import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { Task } from "@/types/formBuilder";

interface TaskFormProps {
  task: Task;
  onChange: (updates: Partial<Task>) => void;
  onDelete: () => void;
}

export default function TaskForm({ task, onChange, onDelete }: TaskFormProps) {
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
                Fixed
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
                Range
              </button>
            </div>
          </div>
        </div>

        {/* Marks input — single field regardless of type */}
        <div className="max-w-xs space-y-2">
          <Label>{isRange ? "Min Marks *" : "Task Marks *"}</Label>
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

        {isRange && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
            Faculty can claim any marks ≥ <strong>{task.minMarks ?? 0}</strong> with no upper limit.
            This task counts as <strong>{task.minMarks ?? 0}</strong> marks in the total.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
