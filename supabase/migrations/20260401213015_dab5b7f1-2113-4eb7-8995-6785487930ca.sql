
-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Add tsvector column
ALTER TABLE public.post_embeddings ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Make embedding column nullable (no longer required)
ALTER TABLE public.post_embeddings ALTER COLUMN embedding DROP NOT NULL;

-- Create index for full-text search
CREATE INDEX IF NOT EXISTS post_embeddings_search_idx ON public.post_embeddings USING gin(search_vector);

-- Create trigram index on combined_text
CREATE INDEX IF NOT EXISTS post_embeddings_trgm_idx ON public.post_embeddings USING gin(combined_text extensions.gin_trgm_ops);

-- Function to update search_vector on insert/update
CREATE OR REPLACE FUNCTION public.update_post_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.tone, '') || ' ' || COALESCE(NEW.topic, '') || ' ' || COALESCE(NEW.post, '') || ' ' || COALESCE(array_to_string(NEW.style_tags, ' '), ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_post_embeddings_search_vector
  BEFORE INSERT OR UPDATE ON public.post_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_post_search_vector();

-- Backfill existing rows
UPDATE public.post_embeddings SET search_vector = to_tsvector('english', COALESCE(tone, '') || ' ' || COALESCE(topic, '') || ' ' || COALESCE(post, '') || ' ' || COALESCE(array_to_string(style_tags, ' '), ''));

-- Replace match_posts to use text search instead of vector
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
