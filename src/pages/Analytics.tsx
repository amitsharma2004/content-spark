import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BarChart3, Eye, Heart, MessageCircle, Share2, MousePointerClick, TrendingUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const platformColors: Record<string, string> = {
  linkedin: 'bg-blue-500/20 text-blue-400',
  twitter: 'bg-sky-500/20 text-sky-400',
  blog: 'bg-orange-500/20 text-orange-400',
};

const Analytics = () => {
  const { user } = useAuth();

  const { data: analyticsData = [], isLoading } = useQuery({
    queryKey: ['post-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_analytics')
        .select('*, generated_content(platform, topic, content, status, created_at)')
        .order('impressions', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const totals = analyticsData.reduce(
    (acc, item) => ({
      likes: acc.likes + (item.likes || 0),
      comments: acc.comments + (item.comments || 0),
      shares: acc.shares + (item.shares || 0),
      impressions: acc.impressions + (item.impressions || 0),
      clicks: acc.clicks + (item.clicks || 0),
    }),
    { likes: 0, comments: 0, shares: 0, impressions: 0, clicks: 0 }
  );

  const statCards = [
    { label: 'Total Impressions', value: totals.impressions, icon: Eye, color: 'text-primary' },
    { label: 'Total Likes', value: totals.likes, icon: Heart, color: 'text-red-400' },
    { label: 'Total Comments', value: totals.comments, icon: MessageCircle, color: 'text-blue-400' },
    { label: 'Total Shares', value: totals.shares, icon: Share2, color: 'text-green-400' },
    { label: 'Total Clicks', value: totals.clicks, icon: MousePointerClick, color: 'text-accent' },
  ];

  const engagementRate = totals.impressions > 0
    ? (((totals.likes + totals.comments + totals.shares) / totals.impressions) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground">Post Analytics</h1>
        <p className="mt-1 text-muted-foreground">Track engagement metrics across your content</p>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Aggregated Stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {statCards.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 font-display text-2xl font-bold text-foreground">
                      {stat.value.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-secondary p-2">
                    <stat.icon className={cn('h-4 w-4', stat.color)} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Engagement Rate */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Overall Engagement Rate</p>
                <p className="font-display text-3xl font-bold text-foreground">{engagementRate}%</p>
              </div>
            </div>
          </motion.div>

          {/* Per-Post Analytics Table */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-xl overflow-hidden"
          >
            <div className="p-5 border-b border-border">
              <h2 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Per-Post Performance
              </h2>
            </div>

            {analyticsData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <BarChart3 className="mb-3 h-10 w-10 opacity-40" />
                <p>No analytics data yet.</p>
                <p className="text-xs mt-1">Metrics will appear here once your posts get engagement.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-5 py-3 font-medium">Content</th>
                      <th className="px-5 py-3 font-medium">Platform</th>
                      <th className="px-5 py-3 font-medium text-right">Impressions</th>
                      <th className="px-5 py-3 font-medium text-right">Likes</th>
                      <th className="px-5 py-3 font-medium text-right">Comments</th>
                      <th className="px-5 py-3 font-medium text-right">Shares</th>
                      <th className="px-5 py-3 font-medium text-right">Clicks</th>
                      <th className="px-5 py-3 font-medium text-right">Eng. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.map((row: any) => {
                      const post = row.generated_content;
                      const er = row.impressions > 0
                        ? (((row.likes + row.comments + row.shares) / row.impressions) * 100).toFixed(1)
                        : '0.0';
                      return (
                        <tr key={row.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="px-5 py-3 max-w-[250px]">
                            <p className="truncate text-foreground">{post?.content?.slice(0, 60) || '—'}...</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{post?.topic}</p>
                          </td>
                          <td className="px-5 py-3">
                            <Badge className={cn('text-xs', platformColors[post?.platform] || '')}>
                              {post?.platform}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right text-foreground font-medium">{row.impressions.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-foreground">{row.likes.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-foreground">{row.comments.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-foreground">{row.shares.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-foreground">{row.clicks.toLocaleString()}</td>
                          <td className="px-5 py-3 text-right">
                            <span className="text-primary font-medium">{er}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
};

export default Analytics;
