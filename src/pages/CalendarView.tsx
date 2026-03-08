import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Linkedin, Twitter, BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const platformIcons: Record<string, any> = {
  linkedin: Linkedin,
  twitter: Twitter,
  blog: BookOpen,
};

const platformColors: Record<string, string> = {
  linkedin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  twitter: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  blog: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const CalendarView = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const { data: scheduledContent = [], isLoading } = useQuery({
    queryKey: ['calendar-content', year, month],
    queryFn: async () => {
      const startOfMonth = new Date(year, month, 1).toISOString();
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('generated_content')
        .select('*')
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', startOfMonth)
        .lte('scheduled_at', endOfMonth);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const getContentForDay = (day: number) => {
    return scheduledContent.filter((item) => {
      if (!item.scheduled_at) return false;
      const d = new Date(item.scheduled_at);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const days = Array.from({ length: 42 }, (_, i) => {
    const dayNum = i - firstDay + 1;
    if (dayNum < 1 || dayNum > daysInMonth) return null;
    return dayNum;
  });

  const today = new Date();
  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground">Content Calendar</h1>
        <p className="mt-1 text-muted-foreground">Schedule and manage your content pipeline</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-6"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold text-foreground">{monthName}</h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2">{d}</div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px rounded-lg bg-border/30 overflow-hidden">
            {days.map((day, i) => {
              const content = day ? getContentForDay(day) : [];
              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[100px] bg-card/40 p-2 transition-colors',
                    day && 'hover:bg-card/80 cursor-pointer',
                    !day && 'bg-background/20'
                  )}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
                          isToday(day) && 'bg-primary text-primary-foreground font-bold'
                        )}
                      >
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {content.map((item) => {
                          const Icon = platformIcons[item.platform] || BookOpen;
                          const colors = platformColors[item.platform] || 'bg-muted text-muted-foreground border-border';
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                'flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] truncate',
                                colors
                              )}
                            >
                              <Icon className="h-2.5 w-2.5 flex-shrink-0" />
                              <span className="truncate">{item.content.slice(0, 30)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CalendarView;
