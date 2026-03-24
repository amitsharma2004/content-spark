import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { KanbanCard } from '@/types/kanban';
import { KanbanCardItem } from './KanbanCardItem';

interface Props {
  id: string;
  label: string;
  emoji: string;
  cards: KanbanCard[];
  onViewCard: (card: KanbanCard) => void;
  onRunAgent?: (card: KanbanCard) => void;
  teamMembers?: { id: string; display_name: string | null; email: string | null }[];
}

export function KanbanColumn({ id, label, emoji, cards, onViewCard, onRunAgent, teamMembers }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className={cn(
        'flex h-full w-[280px] shrink-0 flex-col rounded-xl bg-muted/50 border border-border/60 transition-colors',
        isOver && 'ring-2 ring-primary/30 bg-primary/5'
      )}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border/40">
        <span className="text-base">{emoji}</span>
        <h3 className="text-[13px] font-semibold text-foreground">{label}</h3>
        <span className="ml-auto rounded-full bg-background border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCardItem
              key={card.id}
              card={card}
              onView={onViewCard}
              onRunAgent={onRunAgent}
              teamMembers={teamMembers}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            Drop cards here
          </div>
        )}
      </div>
    </div>
  );
}
