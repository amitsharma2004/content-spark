import { motion } from 'framer-motion';
import { FileText, Clock, CheckCircle2, PenLine, TrendingUp, Sparkles, Loader2 } from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { ContentCard } from '@/components/ContentCard';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ContentItem, Platform, ContentStatus } from '@/types/content';

const Index = () => {
  const navigate = useNavigate();

  const { data: content = [], isLoading } = useQuery({
    queryKey: ['generated-content'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('generated_content')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((row): ContentItem => ({
        id: row.id,
        platform: row.platform as Platform,
        content: row.content,
        status: row.status as ContentStatus,
        topic: row.topic,
        scheduledAt: row.scheduled_at ? new Date(row.scheduled_at) : undefined,
        createdAt: new Date(row.created_at),
      }));
    },
  });

  const stats = {
    totalGenerated: content.length,
    scheduled: content.filter((i) => i.status === 'scheduled').length,
    published: content.filter((i) => i.status === 'published').length,
    drafts: content.filter((i) => i.status === 'draft').length,
  };

  // Activity chart: count content created per day for the last 14 days
  const activityData = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    date.setHours(0, 0, 0, 0);
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    return content.filter((item) => {
      const created = new Date(item.createdAt);
      return created >= date && created < nextDate;
    }).length;
  });

  const maxActivity = Math.max(...activityData, 1);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 13);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-end justify-between"
      >
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Your content factory at a glance</p>
        </div>
        <Button onClick={() => navigate('/generate')} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Generate Content
        </Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Generated" value={stats.totalGenerated} icon={FileText} />
        <StatCard label="Scheduled" value={stats.scheduled} icon={Clock} accentClass="text-chart-3" />
        <StatCard label="Published" value={stats.published} icon={CheckCircle2} />
        <StatCard label="Drafts" value={stats.drafts} icon={PenLine} accentClass="text-accent" />
      </div>

      {/* Activity Chart */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-foreground">Content Activity</h2>
          <div className="flex items-center gap-1 text-xs text-primary">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>{stats.totalGenerated} total pieces</span>
          </div>
        </div>
        <div className="flex h-48 items-end gap-2">
          {activityData.map((count, i) => {
            const height = count > 0 ? Math.max(10, (count / maxActivity) * 100) : 4;
            return (
              <motion.div
                key={i}
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                className="flex-1 rounded-t-md bg-primary/20 transition-colors hover:bg-primary/40"
                title={`${count} items`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </motion.div>

      {/* Recent Content */}
      <div>
        <h2 className="mb-4 font-display text-lg font-semibold text-foreground">Recent Content</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : content.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {content.slice(0, 6).map((item, i) => (
              <ContentCard key={item.id} item={item} index={i} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            No content yet. Generate some to get started!
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
