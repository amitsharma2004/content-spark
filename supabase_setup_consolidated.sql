-- 1. Create generated_content table & basic RLS policies
CREATE TABLE public.generated_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'blog')),
  content TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'failed')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content" ON public.generated_content
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content" ON public.generated_content
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content" ON public.generated_content
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own content" ON public.generated_content
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Create brand_profiles table & policies
CREATE TABLE public.brand_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_name text,
  company_bio text,
  brand_voice text,
  sample_posts text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own brand profile"
  ON public.brand_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own brand profile"
  ON public.brand_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own brand profile"
  ON public.brand_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own brand profile"
  ON public.brand_profiles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Extend generated_content and configure storage
ALTER TABLE public.generated_content ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('content-images', 'content-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view content images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-images');

CREATE POLICY "Authenticated users can upload content images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'content-images');

CREATE POLICY "Service role can upload content images"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'content-images');

-- 4. Create user roles and team invitations tables
CREATE TYPE public.app_role AS ENUM ('editor', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Anyone authenticated can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role app_role NOT NULL DEFAULT 'editor',
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email, status)
);

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invitations"
  ON public.team_invitations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Admins can create invitations"
  ON public.team_invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete invitations"
  ON public.team_invitations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5. Profiles and new user trigger setup
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invitation team_invitations%ROWTYPE;
  _is_first_user boolean;
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles LIMIT 1) INTO _is_first_user;
  
  IF _is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    SELECT * INTO _invitation FROM public.team_invitations
    WHERE email = NEW.email AND status = 'pending' LIMIT 1;
    
    IF FOUND THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _invitation.role);
      UPDATE public.team_invitations SET status = 'accepted' WHERE id = _invitation.id;
    ELSE
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'editor');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Post analytics table & policies
CREATE TABLE public.post_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL REFERENCES public.generated_content(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analytics" ON public.post_analytics
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analytics" ON public.post_analytics
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analytics" ON public.post_analytics
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_post_analytics_content_id ON public.post_analytics(content_id);

-- 7. Kanban cards table & policies
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

ALTER TABLE public.kanban_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all kanban cards" ON public.kanban_cards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own kanban cards" ON public.kanban_cards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Team members can update kanban cards" ON public.kanban_cards
  FOR UPDATE TO authenticated USING (
    auth.uid() = user_id OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can delete kanban cards" ON public.kanban_cards
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id OR has_role(auth.uid(), 'admin')
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.kanban_cards;

-- 8. Post Embeddings and Vector Search configuration
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE public.post_embeddings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tone TEXT NOT NULL,
  topic TEXT NOT NULL,
  style_tags TEXT[] DEFAULT '{}'::text[],
  post TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'twitter',
  combined_text TEXT NOT NULL,
  embedding extensions.vector(1536),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.post_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all embeddings"
  ON public.post_embeddings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own embeddings"
  ON public.post_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own embeddings"
  ON public.post_embeddings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own embeddings"
  ON public.post_embeddings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX post_embeddings_embedding_idx
  ON public.post_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops);

-- 9. Setup pg_trgm (Full-text Search helper) and optimize Match Post functionality
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

ALTER TABLE public.post_embeddings ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE public.post_embeddings ALTER COLUMN embedding DROP NOT NULL;

CREATE INDEX IF NOT EXISTS post_embeddings_search_idx ON public.post_embeddings USING gin(search_vector);
CREATE INDEX IF NOT EXISTS post_embeddings_trgm_idx ON public.post_embeddings USING gin(combined_text extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.update_post_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.tone, '') || ' ' || COALESCE(NEW.topic, '') || ' ' || COALESCE(NEW.post, '') || ' ' || COALESCE(array_to_string(NEW.style_tags, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE TRIGGER trg_post_embeddings_search_vector
  BEFORE INSERT OR UPDATE ON public.post_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_search_vector();

UPDATE public.post_embeddings SET search_vector = to_tsvector('english', COALESCE(tone, '') || ' ' || COALESCE(topic, '') || ' ' || COALESCE(post, '') || ' ' || COALESCE(array_to_string(style_tags, ' '), ''));

CREATE OR REPLACE FUNCTION public.match_posts(
  query_text TEXT,
  match_count INT DEFAULT 5,
  filter_tone TEXT DEFAULT NULL,
  filter_platform TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  tone TEXT,
  topic TEXT,
  style_tags TEXT[],
  post TEXT,
  platform TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.id,
    pe.tone,
    pe.topic,
    pe.style_tags,
    pe.post,
    pe.platform,
    (
      COALESCE(extensions.similarity(pe.combined_text, query_text), 0) * 0.6 +
      CASE WHEN pe.search_vector @@ plainto_tsquery('english', query_text) THEN 0.4 ELSE 0.0 END
    )::FLOAT AS similarity
  FROM public.post_embeddings pe
  WHERE
    (filter_tone IS NULL OR pe.tone = filter_tone)
    AND (filter_platform IS NULL OR pe.platform = filter_platform)
    AND (
      extensions.similarity(pe.combined_text, query_text) > 0.05
      OR pe.search_vector @@ plainto_tsquery('english', query_text)
    )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
