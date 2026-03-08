import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Linkedin, Twitter, BookOpen, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContentCard } from '@/components/ContentCard';
import { ContentItem, Platform } from '@/types/content';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';

const Generate = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState('professional');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<ContentItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tones = [
    { value: 'professional', label: '💼 Professional' },
    { value: 'charming', label: '✨ Charming' },
    { value: 'focused', label: '🎯 Focused' },
    { value: 'witty', label: '😏 Witty' },
    { value: 'inspirational', label: '🔥 Inspirational' },
    { value: 'casual', label: '😎 Casual' },
  ];

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setGenerated([]);

    try {
      const { data, error } = await supabase.functions.invoke('generate-content', {
        body: { topic, tone },
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate content');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const items: ContentItem[] = [];

      (data.linkedin || []).forEach((content: string, i: number) => {
        items.push({
          id: `gen-li-${i}`,
          platform: 'linkedin',
          content,
          status: 'draft',
          createdAt: new Date(),
          topic,
        });
      });

      (data.twitter || []).forEach((content: string, i: number) => {
        items.push({
          id: `gen-tw-${i}`,
          platform: 'twitter',
          content,
          status: 'draft',
          createdAt: new Date(),
          topic,
        });
      });

      (data.blog || []).forEach((content: string, i: number) => {
        items.push({
          id: `gen-bl-${i}`,
          platform: 'blog',
          content,
          status: 'draft',
          createdAt: new Date(),
          topic,
        });
      });

      // Persist to database
      if (user) {
        const rows = items.map((item) => ({
          user_id: user.id,
          platform: item.platform,
          content: item.content,
          topic: item.topic,
          status: item.status,
        }));

        const { error: insertError } = await supabase
          .from('generated_content')
          .insert(rows);

        if (insertError) {
          console.error('Failed to save content:', insertError);
          toast.error('Content generated but failed to save to history');
        } else {
          queryClient.invalidateQueries({ queryKey: ['generated-content'] });
        }
      }

      setGenerated(items);
      toast.success(`Generated ${items.length} pieces of content with AI!`);
    } catch (err: any) {
      console.error('Generation error:', err);
      toast.error(err.message || 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard');
  };

  const filterByPlatform = (platform: Platform) =>
    generated.filter((item) => item.platform === platform);

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground">
          AI Content Generator
        </h1>
        <p className="mt-1 text-muted-foreground">
          Enter a topic and generate content for all platforms with Gemini AI
        </p>
      </motion.div>

      {/* Generator Input */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-6"
      >
        <div className="flex gap-3">
          <Input
            placeholder="Enter a topic... (e.g., 'AI in healthcare', 'Remote work culture')"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleGenerate()}
            className="flex-1 border-border bg-secondary/50 text-foreground placeholder:text-muted-foreground"
            disabled={isGenerating}
          />
          <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2 px-6">
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate
              </>
            )}
          </Button>
        </div>

        {/* Tone selector */}
        <div className="mt-4 flex flex-wrap gap-2">
          {tones.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              disabled={isGenerating}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                tone === t.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Loading state */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>AI is generating 10 LinkedIn · 10 Twitter · 5 Blog ideas...</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: '0%' }}
                  animate={{ width: '90%' }}
                  transition={{ duration: 8, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Output summary */}
        {generated.length > 0 && !isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 flex gap-4 text-sm"
          >
            <div className="flex items-center gap-1.5 text-blue-400">
              <Linkedin className="h-4 w-4" />
              <span>{filterByPlatform('linkedin').length} posts</span>
            </div>
            <div className="flex items-center gap-1.5 text-sky-400">
              <Twitter className="h-4 w-4" />
              <span>{filterByPlatform('twitter').length} tweets</span>
            </div>
            <div className="flex items-center gap-1.5 text-orange-400">
              <BookOpen className="h-4 w-4" />
              <span>{filterByPlatform('blog').length} ideas</span>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Generated Content */}
      {generated.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <Tabs defaultValue="linkedin" className="space-y-4">
            <TabsList className="bg-secondary">
              <TabsTrigger value="linkedin" className="gap-1.5">
                <Linkedin className="h-3.5 w-3.5" /> LinkedIn ({filterByPlatform('linkedin').length})
              </TabsTrigger>
              <TabsTrigger value="twitter" className="gap-1.5">
                <Twitter className="h-3.5 w-3.5" /> Twitter ({filterByPlatform('twitter').length})
              </TabsTrigger>
              <TabsTrigger value="blog" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" /> Blog ({filterByPlatform('blog').length})
              </TabsTrigger>
            </TabsList>

            {(['linkedin', 'twitter', 'blog'] as Platform[]).map((platform) => (
              <TabsContent key={platform} value={platform}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filterByPlatform(platform).map((item, i) => (
                    <div key={item.id} className="group relative">
                      <ContentCard item={item} index={i} />
                      <button
                        onClick={() => handleCopy(item.id, item.content)}
                        className="absolute right-3 top-3 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 bg-secondary hover:bg-secondary/80"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </motion.div>
      )}
    </div>
  );
};

export default Generate;
