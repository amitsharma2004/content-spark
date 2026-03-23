import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { KanbanPlatform, KanbanTone, PLATFORM_CONFIG, TONE_COLORS } from '@/types/kanban';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; topic: string; platform: KanbanPlatform; tone: KanbanTone; assigned_to: string | null }) => Promise<void>;
  teamMembers: { id: string; display_name: string | null; email: string | null }[];
}

const tones: KanbanTone[] = ['professional', 'casual', 'humorous', 'formal', 'persuasive'];
const platforms: KanbanPlatform[] = ['blog', 'linkedin', 'twitter', 'instagram', 'email'];

export function CreateCardModal({ open, onOpenChange, onSubmit, teamMembers }: Props) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState<KanbanPlatform>('blog');
  const [tone, setTone] = useState<KanbanTone>('professional');
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !topic.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ title, topic, platform, tone, assigned_to: assignedTo });
      setTitle('');
      setTopic('');
      setPlatform('blog');
      setTone('professional');
      setAssignedTo(null);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-[hsl(var(--kanban-surface))] border-border/50">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Create Content Card</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="e.g. 'AI in Healthcare 2026'"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Topic / Brief</Label>
            <Textarea
              placeholder="Describe what the content should cover…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
            />
          </div>

          {/* Tone selector */}
          <div className="space-y-2">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-2">
              {tones.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-all capitalize',
                    tone === t
                      ? cn(TONE_COLORS[t], 'ring-1 ring-primary/50')
                      : 'border-border/30 text-muted-foreground hover:border-border'
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div className="space-y-2">
            <Label>Target Platform</Label>
            <div className="flex flex-wrap gap-2">
              {platforms.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                    platform === p
                      ? cn(PLATFORM_CONFIG[p].color, 'ring-1 ring-primary/50')
                      : 'border-border/30 text-muted-foreground hover:border-border'
                  )}
                >
                  {PLATFORM_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Assign to */}
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={assignedTo || 'unassigned'} onValueChange={(v) => setAssignedTo(v === 'unassigned' ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {teamMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSubmit} disabled={!title.trim() || !topic.trim() || isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
