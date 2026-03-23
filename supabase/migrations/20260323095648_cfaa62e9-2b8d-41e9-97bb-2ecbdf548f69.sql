
-- Replace overly permissive UPDATE policy with a scoped one
DROP POLICY "Authenticated users can update kanban cards" ON public.kanban_cards;

CREATE POLICY "Team members can update kanban cards" ON public.kanban_cards
  FOR UPDATE TO authenticated USING (
    auth.uid() = user_id OR has_role(auth.uid(), 'admin')
  );
