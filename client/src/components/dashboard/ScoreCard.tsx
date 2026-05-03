import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ScoreCardProps {
  title: string;
  score: number;
  maxScore: number;
  icon?: React.ReactNode;
  className?: string;
}

export function ScoreCard({ title, score, maxScore, icon, className }: ScoreCardProps) {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  const getScoreColor = () => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-secondary';
    if (percentage >= 40) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-3xl font-bold font-display', getScoreColor())}>{score}</span>
          <span className="text-sm text-muted-foreground">/ {maxScore}</span>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
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
        <p className="mt-2 text-xs text-muted-foreground">{percentage.toFixed(1)}% achieved</p>
      </CardContent>
    </Card>
  );
}