import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FPMSModule } from '@/types/fpms';
import { cn } from '@/lib/utils';
import { BookOpen, Microscope, Award, Users, Building } from 'lucide-react';

const moduleIcons: Record<string, React.ReactNode> = {
  teaching: <BookOpen className="h-5 w-5" />,
  research: <Microscope className="h-5 w-5" />,
  professional: <Award className="h-5 w-5" />,
  student: <Users className="h-5 w-5" />,
  institutional: <Building className="h-5 w-5" />,
};

interface ModuleProgressProps {
  modules: FPMSModule[];
}

export function ModuleProgress({ modules }: ModuleProgressProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display">Module-wise Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {modules.map((module) => {
          const percentage = (module.score / module.maxPoints) * 100;

          return (
            <div key={module.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {moduleIcons[module.id]}
                  </div>
                  <span className="text-sm font-medium">{module.name}</span>
                </div>
                <span className="text-sm font-semibold">
                  {module.score}/{module.maxPoints}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', {
                    'bg-success': percentage >= 80,
                    'bg-secondary': percentage >= 60 && percentage < 80,
                    'bg-warning': percentage >= 40 && percentage < 60,
                    'bg-destructive': percentage < 40,
                  })}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}