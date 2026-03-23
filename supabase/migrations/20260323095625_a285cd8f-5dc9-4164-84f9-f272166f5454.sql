
-- Create kanban_cards table
CREATE TABLE public.kanban_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  topic text NOT NULL,
  platform text NOT NULL DEFAULT 'blog',
  tone text NOT NULL DEFAULT 'professional',
  status text NOT NULL DEFAULT 'todo',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  search_result text,
  draft_content text,
  policy_score integer,
  policy_feedback text[] DEFAULT '{}'::text[],
  suggested_edits text,
  final_content text,
  publish_url text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated users can CRUD their own cards, and view all cards (for team visibility)
CREATE POLICY "Users can view all kanban cards" ON public.kanban_cards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own kanban cards" ON public.kanban_cards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update kanban cards" ON public.kanban_cards
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admins can delete kanban cards" ON public.kanban_cards
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id OR has_role(auth.uid(), 'admin')
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_cards;
