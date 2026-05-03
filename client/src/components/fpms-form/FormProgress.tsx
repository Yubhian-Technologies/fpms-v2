import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface FormProgressProps {
  steps: { id: string; name: string }[];
  currentStep: number;
  completedSteps: number[];
}

export function FormProgress({ steps, currentStep, completedSteps }: FormProgressProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index);
          const isCurrent = currentStep === index;

          return (
            <li key={step.id} className="relative flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold transition-all duration-300',
                    {
                      'border-primary bg-primary text-primary-foreground': isCurrent,
                      'border-success bg-success text-success-foreground': isCompleted && !isCurrent,
                      'border-muted bg-background text-muted-foreground': !isCompleted && !isCurrent,
                    }
                  )}
                >
                  {isCompleted && !isCurrent ? <Check className="h-5 w-5" /> : index + 1}
                </div>
                <span
                  className={cn('mt-2 text-xs font-medium text-center max-w-[80px]', {
                    'text-primary': isCurrent,
                    'text-success': isCompleted && !isCurrent,
                    'text-muted-foreground': !isCompleted && !isCurrent,
                  })}
                >
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn('absolute top-5 left-1/2 w-full h-0.5 -translate-y-1/2', {
                    'bg-success': isCompleted,
                    'bg-muted': !isCompleted,
                  })}
                  style={{ width: 'calc(100% - 2.5rem)', left: 'calc(50% + 1.25rem)' }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}