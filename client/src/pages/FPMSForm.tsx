import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFPMS } from '@/contexts/FPMSContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FormProgress } from '@/components/fpms-form/FormProgress';
import { ModuleForm } from '@/components/fpms-form/ModuleForm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { FPMS_MODULES, ModuleEntry } from '@/types/fpms';
import { ChevronLeft, ChevronRight, Send, Save, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const STEPS = FPMS_MODULES.map((m) => ({ id: m.id, name: m.name }));

export default function FPMSForm() {
  const { user } = useAuth();
  const { currentSubmission, createSubmission, updateModule, submitForReview, academicYear } = useFPMS();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Create submission if none exists
  const submission = currentSubmission || createSubmission();

  if (!user) return null;

  const isLocked = submission.status !== 'draft';
  const currentModule = submission.modules[currentStep];

  const handleModuleUpdate = (entries: ModuleEntry[]) => {
    if (isLocked) return;
    updateModule(currentModule.id, entries);
  };

  const handleNext = () => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    submitForReview();
    toast({
      title: 'Submission successful',
      description: 'Your FPMS form has been submitted for review.',
    });
    navigate('/dashboard');
  };

  const totalScore = submission.modules.reduce((sum, m) => sum + m.score, 0);
  const maxScore = FPMS_MODULES.reduce((sum, m) => sum + m.maxPoints, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">FPMS Evaluation Form</h1>
            <p className="text-muted-foreground mt-1">Academic Year: {academicYear}</p>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge status={submission.status} />
            <div className="text-right">
              <p className="text-2xl font-bold font-display text-primary">{totalScore}</p>
              <p className="text-xs text-muted-foreground">of {maxScore} points</p>
            </div>
          </div>
        </div>

        {isLocked && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-warning" />
              <p className="text-sm">
                This submission is <strong>{submission.status}</strong> and cannot be edited.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Progress */}
        <FormProgress steps={STEPS} currentStep={currentStep} completedSteps={completedSteps} />

        {/* Module Form */}
        <ModuleForm key={currentModule.id} module={currentModule} onUpdate={handleModuleUpdate} />

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="flex gap-3">
            {!isLocked && (
              <Button variant="outline">
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
            )}

            {currentStep === STEPS.length - 1 ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={isLocked}>
                    <Send className="mr-2 h-4 w-4" />
                    Submit for Review
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Submit FPMS Form?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You are about to submit your FPMS evaluation form with a total score of{' '}
                      <strong>{totalScore} points</strong>. Once submitted, you cannot edit the form until it's
                      reviewed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSubmit}>Submit</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button onClick={handleNext}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}