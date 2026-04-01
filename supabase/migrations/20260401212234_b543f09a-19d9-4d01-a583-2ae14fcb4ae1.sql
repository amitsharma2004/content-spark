
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create post_embeddings table
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

-- Enable RLS
ALTER TABLE public.post_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- HNSW index for fast cosine similarity search
CREATE INDEX post_embeddings_embedding_idx
  ON public.post_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops);

-- Match function for vector similarity search
CREATE OR REPLACE FUNCTION public.match_posts(
  query_embedding extensions.vector(1536),
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
    1 - (pe.embedding <=> query_embedding) AS similarity
  FROM public.post_embeddings pe
  WHERE
    (filter_tone IS NULL OR pe.tone = filter_tone)
    AND (filter_platform IS NULL OR pe.platform = filter_platform)
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
