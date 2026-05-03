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
import type { Criteria, Module, Task } from "@/types/formBuilder";
import ModuleForm from "@/components/ModuleForm";

interface CriteriaFormProps {
  criteria: Criteria;
  onCriteriaChange: (updates: Partial<Criteria>) => void;
  onDeleteCriteria: () => void;
  onAddModule: () => void;
  onUpdateModule: (moduleId: string, updates: Partial<Module>) => void;
  onDeleteModule: (moduleId: string) => void;
  onAddTask: (moduleId: string) => void;
  onUpdateTask: (
    moduleId: string,
    taskId: string,
    updates: Partial<Task>,
  ) => void;
  onDeleteTask: (moduleId: string, taskId: string) => void;
}

export default function CriteriaForm({
  criteria,
  onCriteriaChange,
  onDeleteCriteria,
  onAddModule,
  onUpdateModule,
  onDeleteModule,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
}: CriteriaFormProps) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="px-0 hover:bg-transparent">
                {open ? (
                  <ChevronDown className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-2" />
                )}
                <CardTitle className="text-lg">
                  {criteria.criteriaName || "Untitled Criteria"}
                </CardTitle>
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Total: {criteria.totalMarks}</Badge>
              <Button
                variant="ghost"
                size="icon"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={onDeleteCriteria}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Criteria Name *</Label>
                <Input
                  value={criteria.criteriaName}
                  onChange={(e) =>
                    onCriteriaChange({ criteriaName: e.target.value })
                  }
                  placeholder="Enter criteria name"
                />
              </div>
              <div className="space-y-2">
                <Label>Criteria Total Marks (Auto)</Label>
                <Input
                  value={criteria.totalMarks}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-4">
              {criteria.modules.map((module) => (
                <ModuleForm
                  key={module.id}
                  module={module}
                  onModuleChange={(updates) =>
                    onUpdateModule(module.id, updates)
                  }
                  onDeleteModule={() => onDeleteModule(module.id)}
                  onAddTask={() => onAddTask(module.id)}
                  onUpdateTask={(taskId, updates) =>
                    onUpdateTask(module.id, taskId, updates)
                  }
                  onDeleteTask={(taskId) => onDeleteTask(module.id, taskId)}
                />
              ))}

              <Button onClick={onAddModule} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Module
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
