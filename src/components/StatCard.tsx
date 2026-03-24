import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  trend?: string;
  accentClass?: string;
}

export function StatCard({ label, value, icon: Icon, trend, accentClass }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] text-muted-foreground">{label}</p>
          <p className="mt-1.5 font-display text-3xl font-bold text-foreground">{value}</p>
          {trend && (
            <p className={cn('mt-1 text-xs font-medium', accentClass || 'text-primary')}>
              {trend}
            </p>
          )}
        </div>
        <div className={cn('rounded-lg p-2.5', accentClass ? 'bg-muted' : 'bg-primary/8')}>
          <Icon className={cn('h-5 w-5', accentClass || 'text-primary')} />
        </div>
      </div>
    </motion.div>
  );
}
