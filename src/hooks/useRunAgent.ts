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

    // Use the new LangGraph pipeline for full runs, fallback to individual agents for reruns
    const isFullPipeline = agentType === 'search';
    const fnName = isFullPipeline
      ? 'run-pipeline'
      : agentType === 'content'
      ? 'run-content-agent'
      : 'run-policy-agent';

    try {
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { card_id: card.id },
      });

      if (error) {
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

      if (isFullPipeline) {
        const retries = data?.retries || 0;
        const score = data?.policyScore || 0;
        toast.success(
          `Pipeline complete! Score: ${score}/100${retries > 1 ? ` (${retries - 1} auto-retries)` : ''}`
        );
      } else {
        toast.success(`${agentType === 'content' ? 'Content' : 'Policy'} Agent completed!`);
      }

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
