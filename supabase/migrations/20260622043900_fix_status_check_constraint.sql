-- Update generated_content status check constraint to support approval workflow statuses
ALTER TABLE public.generated_content 
  DROP CONSTRAINT IF EXISTS generated_content_status_check;

ALTER TABLE public.generated_content 
  ADD CONSTRAINT generated_content_status_check 
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'rejected', 'failed'));
