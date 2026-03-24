import { useState, useEffect, useCallback } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, DragOverlay, DragStartEvent } from '@dnd-kit/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useRunAgent } from '@/hooks/useRunAgent';
import { Button } from '@/components/ui/button';
import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { KanbanCardItem } from '@/components/kanban/KanbanCardItem';
import { CreateCardModal } from '@/components/kanban/CreateCardModal';
import { CardDetailDrawer } from '@/components/kanban/CardDetailDrawer';
import { KanbanCard, KanbanStatus, KANBAN_COLUMNS } from '@/types/kanban';
import { toast } from 'sonner';

export default function Kanban() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { runAgent, runningCardId } = useRunAgent();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Fetch cards
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['kanban-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kanban_cards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as KanbanCard[];
    },
  });

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, display_name, email');
      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('kanban-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kanban_cards' }, () => {
        queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Group cards by status — rejected/published go into the last column
  const getColumnCards = useCallback((colId: string) => {
    if (colId === 'approved') {
      return cards.filter((c) => ['approved', 'rejected', 'published'].includes(c.status));
    }
    return cards.filter((c) => c.status === colId);
  }, [cards]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const card = cards.find((c) => c.id === event.active.id);
    setActiveCard(card || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const cardId = active.id as string;
    const newStatus = over.id as KanbanStatus;

    // Only allow dropping into column droppables
    if (!KANBAN_COLUMNS.some((c) => c.id === newStatus)) return;

    const card = cards.find((c) => c.id === cardId);
    if (!card || card.status === newStatus) return;

    // Optimistic update
    queryClient.setQueryData<KanbanCard[]>(['kanban-cards'], (old) =>
      old?.map((c) => (c.id === cardId ? { ...c, status: newStatus } : c))
    );

    const { error } = await supabase
      .from('kanban_cards')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', cardId);

    if (error) {
      toast.error('Failed to move card');
      queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
    }
  };

  // Create card
  const handleCreate = async (data: { title: string; topic: string; platform: string; tone: string; assigned_to: string | null }) => {
    if (!user) return;
    const { error } = await supabase.from('kanban_cards').insert({
      ...data,
      user_id: user.id,
      status: 'todo',
    });
    if (error) {
      toast.error('Failed to create card');
      return;
    }
    toast.success('Card created!');
    queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
  };

  const handleRunAgent = (card: KanbanCard) => {
    if (card.status === 'todo') {
      runAgent(card, 'search');
    } else if (card.status === 'searching') {
      runAgent(card, 'content');
    } else if (card.status === 'drafting') {
      runAgent(card, 'policy');
    }
  };

  const handleRerunAgent = (card: KanbanCard, agentType: 'search' | 'content' | 'policy') => {
    runAgent(card, agentType);
    setDrawerOpen(false);
  };

  const handleViewCard = (card: KanbanCard) => {
    setSelectedCard(card);
    setDrawerOpen(true);
  };

  const handleApprove = async (card: KanbanCard) => {
    await supabase.from('kanban_cards').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', card.id);
    setDrawerOpen(false);
    queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
    toast.success('Card approved!');
  };

  const handleReject = async (card: KanbanCard) => {
    await supabase.from('kanban_cards').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', card.id);
    setDrawerOpen(false);
    queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
    toast.info('Card rejected');
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Content Pipeline</h1>
          <p className="text-sm text-muted-foreground">AI-powered Kanban board for content creation</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New Card
        </Button>
      </motion.div>

      {/* Board */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                emoji={col.emoji}
                cards={getColumnCards(col.id)}
                onViewCard={handleViewCard}
                onRunAgent={handleRunAgent}
                teamMembers={teamMembers}
              />
            ))}
          </div>

          <DragOverlay>
            {activeCard && (
              <div className="w-[260px]">
                <KanbanCardItem card={activeCard} onView={() => {}} teamMembers={teamMembers} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modals */}
      <CreateCardModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        teamMembers={teamMembers}
      />

      <CardDetailDrawer
        card={selectedCard}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onApprove={handleApprove}
        onReject={handleReject}
        onRerunAgent={handleRerunAgent}
        isAdmin={isAdmin}
      />
    </div>
  );
}
