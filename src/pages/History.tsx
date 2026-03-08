import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ContentCard } from '@/components/ContentCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContentItem, Platform, ContentStatus } from '@/types/content';
import { cn } from '@/lib/utils';
import { Loader2, History as HistoryIcon } from 'lucide-react';

const platformFilters: { label: string; value: Platform | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Twitter', value: 'twitter' },
  { label: 'Blog', value: 'blog' },
];

const History = () => {
  const [activeFilter, setActiveFilter] = useState<Platform | 'all'>('all');

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

  const filtered = activeFilter === 'all'
    ? content
    : content.filter((item) => item.platform === activeFilter);

  const counts = {
    all: content.length,
    linkedin: content.filter((i) => i.platform === 'linkedin').length,
    twitter: content.filter((i) => i.platform === 'twitter').length,
    blog: content.filter((i) => i.platform === 'blog').length,
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground">Content History</h1>
        <p className="mt-1 text-muted-foreground">All your AI-generated content in one place</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2"
      >
        {platformFilters.map((filter) => (
          <Button
            key={filter.value}
            variant={activeFilter === filter.value ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveFilter(filter.value)}
            className="gap-1.5"
          >
            {filter.label}
            <Badge
              variant="outline"
              className={cn(
                'ml-1 text-[10px] px-1.5',
                activeFilter === filter.value && 'border-primary-foreground/30 text-primary-foreground'
              )}
            >
              {counts[filter.value as keyof typeof counts]}
            </Badge>
          </Button>
        ))}
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, i) => (
            <ContentCard key={item.id} item={item} index={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <HistoryIcon className="mb-3 h-10 w-10 opacity-40" />
          <p>No content yet. Generate some first!</p>
        </div>
      )}
    </div>
  );
};

export default History;
