import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ModuleEntry, FPMSModule } from '@/types/fpms';
import { Plus, Trash2, Upload, Link as LinkIcon, FileText, Image } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModuleFormProps {
  module: FPMSModule;
  onUpdate: (entries: ModuleEntry[]) => void;
}

const CRITERIA_OPTIONS: Record<string, { criteria: string; maxPoints: number }[]> = {
  teaching: [
    { criteria: 'Course planning and delivery', maxPoints: 15 },
    { criteria: 'Use of ICT in teaching', maxPoints: 10 },
    { criteria: 'Course material development', maxPoints: 15 },
    { criteria: 'Student feedback', maxPoints: 15 },
    { criteria: 'Academic results', maxPoints: 15 },
  ],
  research: [
    { criteria: 'Research publications (Scopus/WoS)', maxPoints: 25 },
    { criteria: 'Funded research projects', maxPoints: 20 },
    { criteria: 'Patents filed/granted', maxPoints: 15 },
    { criteria: 'Consultancy work', maxPoints: 15 },
  ],
  professional: [
    { criteria: 'FDP/Workshop attended', maxPoints: 15 },
    { criteria: 'FDP/Workshop organized', maxPoints: 15 },
    { criteria: 'Professional membership', maxPoints: 10 },
    { criteria: 'Expert lectures delivered', maxPoints: 15 },
    { criteria: 'Additional qualifications', maxPoints: 10 },
  ],
  student: [
    { criteria: 'Mentoring activities', maxPoints: 10 },
    { criteria: 'Project guidance (UG/PG)', maxPoints: 15 },
    { criteria: 'Student club activities', maxPoints: 10 },
    { criteria: 'Placement support', maxPoints: 10 },
  ],
  institutional: [
    { criteria: 'Administrative duties', maxPoints: 15 },
    { criteria: 'Committee participation', maxPoints: 10 },
    { criteria: 'Event organization', maxPoints: 10 },
    { criteria: 'Accreditation contribution', maxPoints: 10 },
  ],
};

const generateId = () => Math.random().toString(36).substring(2, 9);

export function ModuleForm({ module, onUpdate }: ModuleFormProps) {
  const [entries, setEntries] = useState<ModuleEntry[]>(module.entries);

  const criteriaOptions = CRITERIA_OPTIONS[module.id] || [];
  const totalClaimed = entries.reduce((sum, e) => sum + e.claimedPoints, 0);
  const remaining = module.maxPoints - totalClaimed;

  const addEntry = () => {
    const newEntry: ModuleEntry = {
      id: generateId(),
      criteria: '',
      description: '',
      maxPoints: 0,
      claimedPoints: 0,
    };
    const updated = [...entries, newEntry];
    setEntries(updated);
    onUpdate(updated);
  };

  const updateEntry = (id: string, updates: Partial<ModuleEntry>) => {
    const updated = entries.map((e) => (e.id === id ? { ...e, ...updates } : e));
    setEntries(updated);
    onUpdate(updated);
  };

  const removeEntry = (id: string) => {
    const updated = entries.filter((e) => e.id !== id);
    setEntries(updated);
    onUpdate(updated);
  };

  const handleCriteriaChange = (id: string, criteria: string) => {
    const option = criteriaOptions.find((o) => o.criteria === criteria);
    updateEntry(id, { criteria, maxPoints: option?.maxPoints || 0 });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-display">{module.name}</CardTitle>
            <CardDescription>Maximum points: {module.maxPoints}</CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold font-display text-primary">{totalClaimed}</p>
            <p className="text-xs text-muted-foreground">Points claimed</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {entries.map((entry, index) => (
          <div key={entry.id} className="rounded-lg border bg-muted/30 p-4 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Entry {index + 1}</span>
              <Button variant="ghost" size="icon" onClick={() => removeEntry(entry.id)} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Criteria</Label>
                <Select value={entry.criteria} onValueChange={(v) => handleCriteriaChange(entry.id, v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select criteria" />
                  </SelectTrigger>
                  <SelectContent>
                    {criteriaOptions.map((opt) => (
                      <SelectItem key={opt.criteria} value={opt.criteria}>
                        {opt.criteria} ({opt.maxPoints} pts)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Points Claimed (Max: {entry.maxPoints})</Label>
                <Input
                  type="number"
                  min={0}
                  max={entry.maxPoints}
                  value={entry.claimedPoints}
                  onChange={(e) =>
                    updateEntry(entry.id, {
                      claimedPoints: Math.min(Number(e.target.value), entry.maxPoints),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description / Justification</Label>
              <Textarea
                placeholder="Provide details to support your claim..."
                value={entry.description}
                onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Evidence</Label>
              <div className="flex gap-2">
                <Select
                  value={entry.evidenceType || ''}
                  onValueChange={(v) => updateEntry(entry.id, { evidenceType: v as 'pdf' | 'image' | 'link' })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        PDF
                      </div>
                    </SelectItem>
                    <SelectItem value="image">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Image
                      </div>
                    </SelectItem>
                    <SelectItem value="link">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        Link
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder={entry.evidenceType === 'link' ? 'Enter URL...' : 'Upload file or enter path...'}
                  value={entry.evidence || ''}
                  onChange={(e) => updateEntry(entry.id, { evidence: e.target.value })}
                  className="flex-1"
                />
                {entry.evidenceType !== 'link' && (
                  <Button variant="outline" size="icon">
                    <Upload className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        <Button onClick={addEntry} variant="outline" className="w-full" disabled={remaining <= 0}>
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>

        {remaining < 0 && (
          <p className="text-sm text-destructive">
            You have exceeded the maximum points by {Math.abs(remaining)}. Please adjust your claims.
          </p>
        )}
      </CardContent>
    </Card>
  );
}