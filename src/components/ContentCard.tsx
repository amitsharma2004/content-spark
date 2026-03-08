import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Linkedin, Twitter, BookOpen, Clock, CheckCircle2, FileEdit,
  AlertCircle, Copy, Check, ExternalLink, X, Wand2, Loader2,
  ImageIcon, Send, ShieldCheck, XCircle,
} from 'lucide-react';
import { ContentItem, ContentStatus } from '@/types/content';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useQueryClient } from '@tanstack/react-query';

const platformConfig = {
  linkedin: { icon: Linkedin, label: 'LinkedIn', color: 'text-blue-400' },
  twitter: { icon: Twitter, label: 'Twitter/X', color: 'text-sky-400' },
  blog: { icon: BookOpen, label: 'Blog', color: 'text-orange-400' },
};

const statusConfig: Record<ContentStatus, { icon: any; label: string; variant: any }> = {
  draft: { icon: FileEdit, label: 'Draft', variant: 'outline' as const },
  pending_approval: { icon: Clock, label: 'Pending Approval', variant: 'secondary' as const },
  approved: { icon: ShieldCheck, label: 'Approved', variant: 'default' as const },
  scheduled: { icon: Clock, label: 'Scheduled', variant: 'secondary' as const },
  published: { icon: CheckCircle2, label: 'Published', variant: 'default' as const },
  rejected: { icon: XCircle, label: 'Rejected', variant: 'destructive' as const },
  failed: { icon: AlertCircle, label: 'Failed', variant: 'destructive' as const },
};

const refineOptions = [
  { label: '🔥 Make it punchier', instruction: 'Make this punchier and more impactful. Stronger hooks, tighter sentences.' },
  { label: '✂️ Shorten it', instruction: 'Shorten this significantly while keeping the core message.' },
  { label: '😊 Add emojis', instruction: 'Add relevant emojis throughout to make it more engaging and visual.' },
  { label: '📊 Add data', instruction: 'Add plausible statistics or data points to make it more authoritative.' },
  { label: '🎯 Add CTA', instruction: 'Add a compelling call-to-action at the end.' },
  { label: '💬 More casual', instruction: 'Rewrite in a more casual, conversational tone.' },
];

interface ContentCardProps {
  item: ContentItem;
  index?: number;
  onContentUpdate?: (id: string, newContent: string) => void;
}

export function ContentCard({ item, index = 0, onContentUpdate }: ContentCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [displayContent, setDisplayContent] = useState(item.content);
  const [imageUrl, setImageUrl] = useState(item.imageUrl);
  const [currentStatus, setCurrentStatus] = useState<ContentStatus>(item.status);
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const platform = platformConfig[item.platform];
  const status = statusConfig[currentStatus] || statusConfig.draft;
  const PlatformIcon = platform.icon;

  const handleCopy = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  const handleShareLinkedIn = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(displayContent);
    toast.success('Content copied! Opening LinkedIn...');
    window.open(`https://www.linkedin.com/feed/?shareActive=true`, '_blank');
  };

  const handleStatusChange = async (newStatus: ContentStatus) => {
    try {
      const { error } = await supabase
        .from('generated_content')
        .update({ status: newStatus })
        .eq('id', item.id);

      if (error) throw error;
      setCurrentStatus(newStatus);
      queryClient.invalidateQueries({ queryKey: ['generated-content'] });
      toast.success(`Content ${newStatus === 'approved' ? 'approved' : newStatus === 'rejected' ? 'rejected' : 'updated'}!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleRefine = async (instruction: string) => {
    setIsRefining(true);
    try {
      const { data, error } = await supabase.functions.invoke('refine-content', {
        body: { content: displayContent, instruction },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const refined = data.refined;
      if (refined) {
        setDisplayContent(refined);
        await supabase
          .from('generated_content')
          .update({ content: refined })
          .eq('id', item.id);
        onContentUpdate?.(item.id, refined);
        toast.success('Content refined with AI!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to refine content');
    } finally {
      setIsRefining(false);
    }
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImage(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { topic: item.topic, content: displayContent.substring(0, 300), contentId: item.id },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      if (data.image_url) {
        setImageUrl(data.image_url);
        toast.success('Image generated!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        onClick={() => setIsOpen(true)}
        className="glass group cursor-pointer rounded-xl p-4 transition-all hover:border-primary/30"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformIcon className={cn('h-4 w-4', platform.color)} />
            <span className="text-xs font-medium text-muted-foreground">{platform.label}</span>
          </div>
          <Badge variant={status.variant} className="text-xs">
            {status.label}
          </Badge>
        </div>
        {imageUrl && (
          <div className="mb-3 rounded-lg overflow-hidden">
            <img src={imageUrl} alt="Generated visual" className="w-full h-32 object-cover" />
          </div>
        )}
        <p className="line-clamp-3 text-sm leading-relaxed text-foreground/90">
          {displayContent}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{item.topic}</span>
          {item.scheduledAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {item.scheduledAt.toLocaleDateString()}
            </span>
          )}
        </div>
      </motion.div>

      {/* Full View Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="glass w-full max-w-lg rounded-2xl border border-border p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PlatformIcon className={cn('h-5 w-5', platform.color)} />
                  <span className="text-sm font-medium text-foreground">{platform.label}</span>
                  <Badge variant={status.variant} className="text-xs ml-2">
                    {status.label}
                  </Badge>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Image */}
              {imageUrl && (
                <div className="mb-4 rounded-xl overflow-hidden">
                  <img src={imageUrl} alt="Generated visual" className="w-full object-cover" />
                </div>
              )}

              {/* Full Content */}
              <div className="mb-4 rounded-xl bg-secondary/50 p-4 relative">
                {isRefining && (
                  <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 rounded-xl backdrop-blur-sm z-10">
                    <div className="flex items-center gap-2 text-sm text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Refining with AI...
                    </div>
                  </div>
                )}
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {displayContent}
                </p>
              </div>

              {/* Approval Workflow Actions */}
              {currentStatus === 'draft' && (
                <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">Ready for review?</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('pending_approval')}
                      className="gap-1.5 text-xs"
                    >
                      <Send className="h-3 w-3" />
                      Submit for Approval
                    </Button>
                  </div>
                </div>
              )}

              {currentStatus === 'pending_approval' && isAdmin && (
                <div className="mb-4 p-3 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-xs font-medium text-foreground mb-2">Admin Review</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange('approved')}
                      className="gap-1.5 text-xs"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStatusChange('rejected')}
                      className="gap-1.5 text-xs"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </Button>
                  </div>
                </div>
              )}

              {currentStatus === 'rejected' && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-destructive font-medium">This content was rejected</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStatusChange('draft')}
                      className="gap-1.5 text-xs"
                    >
                      Back to Draft
                    </Button>
                  </div>
                </div>
              )}

              {/* Refine with AI */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-foreground">Refine with AI</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {refineOptions.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => handleRefine(opt.instruction)}
                      disabled={isRefining}
                      className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-all disabled:opacity-50"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Meta */}
              <div className="mb-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="rounded-md bg-secondary px-2 py-1">{item.topic}</span>
                <span>{item.createdAt.toLocaleDateString()}</span>
                {item.scheduledAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {item.scheduledAt.toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                {item.platform === 'linkedin' && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleShareLinkedIn} className="gap-1.5">
                      <Linkedin className="h-3.5 w-3.5" />
                      Share on LinkedIn
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    {!imageUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateImage}
                        disabled={isGeneratingImage}
                        className="gap-1.5"
                      >
                        {isGeneratingImage ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ImageIcon className="h-3.5 w-3.5" />
                        )}
                        {isGeneratingImage ? 'Generating...' : 'Generate Visual'}
                      </Button>
                    )}
                  </>
                )}
                {item.platform === 'twitter' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(
                        `https://twitter.com/intent/tweet?text=${encodeURIComponent(displayContent)}`,
                        '_blank'
                      );
                    }}
                    className="gap-1.5"
                  >
                    <Twitter className="h-3.5 w-3.5" />
                    Post on X
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
