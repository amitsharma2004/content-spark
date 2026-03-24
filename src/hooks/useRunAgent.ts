import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { KanbanCard } from '@/types/kanban';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function useRunAgent() {
  const [runningCardId, setRunningCardId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const runAgent = async (card: KanbanCard, agentType: 'search' | 'content' | 'policy' = 'search') => {
    setRunningCardId(card.id);

    const fnName = agentType === 'search'
      ? 'run-search-agent'
      : agentType === 'content'
      ? 'run-content-agent'
      : 'run-policy-agent';

    try {
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { card_id: card.id },
      });

      if (error) {
        // Check for rate limit / payment errors
        const msg = error.message || '';
        if (msg.includes('429') || msg.includes('rate')) {
          toast.error('Rate limited — please try again in a moment.');
        } else if (msg.includes('402') || msg.includes('credits')) {
          toast.error('AI credits exhausted. Please add funds in Settings.');
        } else {
          toast.error(`Agent failed: ${msg}`);
        }
        return;
      }

      toast.success(`${agentType === 'search' ? 'Search' : agentType === 'content' ? 'Content' : 'Policy'} Agent started! The pipeline will run automatically.`);
      queryClient.invalidateQueries({ queryKey: ['kanban-cards'] });
    } catch (err) {
      console.error('Run agent error:', err);
      toast.error('Failed to start agent pipeline.');
    } finally {
      setRunningCardId(null);
    }
  };

  return { runAgent, runningCardId };
}
