import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, Play, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KanbanCard, TONE_COLORS, PLATFORM_CONFIG, AGENT_STATUS_MAP } from '@/types/kanban';
import { Button } from '@/components/ui/button';

interface Props {
  card: KanbanCard;
  onView: (card: KanbanCard) => void;
  onRunAgent?: (card: KanbanCard) => void;
  teamMembers?: { id: string; display_name: string | null; email: string | null }[];
}

export function KanbanCardItem({ card, onView, onRunAgent, teamMembers }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { card },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 150ms ease',
  };

  const agentInfo = AGENT_STATUS_MAP[card.status];
  const isAgentActive = !!agentInfo;
  const assignee = teamMembers?.find((m) => m.id === card.assigned_to);

  // Progress: 3 agents — search, content, policy
  const agentsDone = [
    !!card.search_result,
    !!card.draft_content,
    card.policy_score !== null,
  ].filter(Boolean).length;

  const borderClass =
    card.status === 'rejected'
      ? 'border-l-2 border-l-red-500'
      : card.status === 'approved'
      ? 'border-l-2 border-l-emerald-500'
      : card.status === 'published'
      ? 'border-l-2 border-l-purple-500'
      : 'border-l-2 border-l-transparent';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group cursor-grab rounded-lg bg-[hsl(var(--kanban-card))] p-3 shadow-md transition-all hover:shadow-lg active:cursor-grabbing',
        borderClass,
        isDragging && 'opacity-50 shadow-xl ring-2 ring-primary/40'
      )}
    >
      {/* Title + Platform */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
          {card.title}
        </h4>
        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium', PLATFORM_CONFIG[card.platform].color)}>
          {PLATFORM_CONFIG[card.platform].label}
        </span>
      </div>

      {/* Tone tag */}
      <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium', TONE_COLORS[card.tone])}>
        {card.tone}
      </span>

      {/* Agent status */}
      {isAgentActive && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full animate-pulse', agentInfo.color)} />
          <span className="text-[10px] text-muted-foreground">{agentInfo.agent} working…</span>
        </div>
      )}

      {/* Published badge */}
      {card.status === 'published' && (
        <div className="mt-2">
          <span className="inline-block rounded-full bg-gradient-to-r from-purple-600 to-violet-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            🚀 Published
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-3 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors',
              i < agentsDone ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Assignee + Policy score */}
      <div className="mt-2 flex items-center justify-between">
        {assignee ? (
          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
            {assignee.display_name || assignee.email}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/50">Unassigned</span>
        )}
        {card.policy_score !== null && (
          <span
            className={cn(
              'text-[10px] font-bold',
              card.policy_score >= 75
                ? 'text-emerald-400'
                : card.policy_score >= 60
                ? 'text-amber-400'
                : 'text-red-400'
            )}
          >
            {card.policy_score}/100
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {card.status === 'todo' && onRunAgent && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px]"
            onClick={(e) => { e.stopPropagation(); onRunAgent(card); }}
          >
            <Play className="mr-1 h-3 w-3" /> Run Agent
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px]"
          onClick={(e) => { e.stopPropagation(); onView(card); }}
        >
          <Eye className="mr-1 h-3 w-3" /> View
        </Button>
        {card.status === 'approved' && (
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-purple-400">
            <Rocket className="mr-1 h-3 w-3" /> Publish
          </Button>
        )}
      </div>
    </div>
  );
}
