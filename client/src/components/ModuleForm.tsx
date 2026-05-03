import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import type { Module, Task } from "@/types/formBuilder";
import TaskForm from "@/components/TaskForm";

interface ModuleFormProps {
  module: Module;
  onModuleChange: (updates: Partial<Module>) => void;
  onDeleteModule: () => void;
  onAddTask: () => void;
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
}

export default function ModuleForm({
  module,
  onModuleChange,
  onDeleteModule,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: ModuleFormProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="px-0 hover:bg-transparent">
                {open ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                <CardTitle className="text-base">
                  Module {module.moduleNumber || "-"}:{" "}
                  {module.moduleName || "Untitled Module"}
                </CardTitle>
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Total: {module.totalMarks}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={onDeleteModule}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Module Number *</Label>
                <Input
                  type="number"
                  min={1}
                  value={module.moduleNumber}
                  onChange={(e) =>
                    onModuleChange({
                      moduleNumber: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Module Name *</Label>
                <Input
                  value={module.moduleName}
                  onChange={(e) =>
                    onModuleChange({ moduleName: e.target.value })
                  }
                  placeholder="Enter module name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Module Total Marks (Auto)</Label>
              <Input value={module.totalMarks} readOnly className="bg-muted" />
            </div>

            <div className="space-y-3">
              {module.tasks.map((task) => (
                <TaskForm
                  key={task.id}
                  task={task}
                  onChange={(updates) => onUpdateTask(task.id, updates)}
                  onDelete={() => onDeleteTask(task.id)}
                />
              ))}

              <Button onClick={onAddTask} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
