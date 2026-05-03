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
          <div className="space-y-2">
            <Label>Task Marks *</Label>
            <Input
              type="number"
              min={0}
              value={task.marks}
              onChange={(e) =>
                onChange({ marks: Math.max(0, Number(e.target.value) || 0) })
              }
              placeholder="0"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
