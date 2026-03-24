import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { KanbanCard, PLATFORM_CONFIG, TONE_COLORS, AGENT_STATUS_MAP } from '@/types/kanban';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, RefreshCw, Rocket, Search, PenLine, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Props {
  card: KanbanCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (card: KanbanCard) => void;
  onReject?: (card: KanbanCard) => void;
  onRerunAgent?: (card: KanbanCard, agentType: 'search' | 'content' | 'policy') => void;
  isAdmin?: boolean;
}

export function CardDetailDrawer({ card, open, onOpenChange, onApprove, onReject, onRerunAgent, isAdmin }: Props) {
  const [editableContent, setEditableContent] = useState('');

  useEffect(() => {
    if (card) setEditableContent(card.final_content || card.draft_content || '');
  }, [card]);

  if (!card) return null;

  const scoreColor = card.policy_score !== null
    ? card.policy_score >= 75 ? 'text-chart-3' : card.policy_score >= 60 ? 'text-accent' : 'text-destructive'
    : 'text-muted-foreground';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg bg-background border-border overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-display text-lg leading-tight">{card.title}</SheetTitle>
          <div className="flex items-center gap-2 pt-1">
            <span className={cn('rounded px-2 py-0.5 text-[10px] font-medium', PLATFORM_CONFIG[card.platform].color)}>
              {PLATFORM_CONFIG[card.platform].label}
            </span>
            <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize', TONE_COLORS[card.tone])}>
              {card.tone}
            </span>
            <Badge variant="outline" className="text-[10px] capitalize">{card.status}</Badge>
          </div>
        </SheetHeader>

        {/* Agent status indicator */}
        {AGENT_STATUS_MAP[card.status] && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
            <span className={cn('h-2.5 w-2.5 rounded-full animate-pulse', AGENT_STATUS_MAP[card.status].color)} />
            <span className="text-xs text-muted-foreground">{AGENT_STATUS_MAP[card.status].agent} is working…</span>
          </div>
        )}

        {/* Policy score */}
        {card.policy_score !== null && (
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-muted px-3 py-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Policy Score:</span>
            <span className={cn('text-lg font-bold', scoreColor)}>{card.policy_score}</span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="research" className="mt-2">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="research" className="text-xs gap-1">
              <Search className="h-3 w-3" /> Research
            </TabsTrigger>
            <TabsTrigger value="draft" className="text-xs gap-1">
              <PenLine className="h-3 w-3" /> Draft
            </TabsTrigger>
            <TabsTrigger value="policy" className="text-xs gap-1">
              <Shield className="h-3 w-3" /> Policy
            </TabsTrigger>
          </TabsList>

          <TabsContent value="research" className="mt-3">
            {card.search_result ? (
              <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {card.search_result}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No research yet. Run the Search Agent to start.</p>
            )}
          </TabsContent>

          <TabsContent value="draft" className="mt-3">
            {card.draft_content ? (
              <div className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap font-mono text-xs leading-relaxed">
                {card.draft_content}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No draft yet. The Content Agent will create one after research.</p>
            )}
          </TabsContent>

          <TabsContent value="policy" className="mt-3 space-y-3">
            {card.policy_feedback && card.policy_feedback.length > 0 ? (
              <div className="space-y-1">
                {card.policy_feedback.map((fb, i) => (
                  <div key={i} className="flex items-start gap-2 rounded bg-muted px-3 py-2 text-xs">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>{fb}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No policy review yet.</p>
            )}

            {card.suggested_edits && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
                <p className="text-[10px] font-semibold text-accent mb-1">Suggested Edits</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{card.suggested_edits}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Editable final content */}
        {(card.draft_content || card.final_content) && (
          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold text-foreground">Final Content</label>
            <Textarea
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2 pb-4">
          {card.status === 'review' && isAdmin && (
            <>
              <Button
                size="sm"
                className="gap-1"
                onClick={() => onApprove?.(card)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1"
                onClick={() => onReject?.(card)}
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onRerunAgent?.(card, 'search')}>
            <RefreshCw className="h-3 w-3" /> Re-run Search
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onRerunAgent?.(card, 'content')}>
            <RefreshCw className="h-3 w-3" /> Re-run Content
          </Button>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => onRerunAgent?.(card, 'policy')}>
            <RefreshCw className="h-3 w-3" /> Re-run Policy
          </Button>
          {card.status === 'approved' && (
            <Button size="sm" className="gap-1">
              <Rocket className="h-3.5 w-3.5" /> Publish
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
