export type KanbanStatus = 'todo' | 'searching' | 'drafting' | 'review' | 'approved' | 'rejected' | 'published';
export type KanbanPlatform = 'blog' | 'linkedin' | 'twitter' | 'instagram' | 'email';
export type KanbanTone = 'professional' | 'casual' | 'humorous' | 'formal' | 'persuasive';

export interface KanbanCard {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  platform: KanbanPlatform;
  tone: KanbanTone;
  status: KanbanStatus;
  assigned_to: string | null;
  search_result: string | null;
  draft_content: string | null;
  policy_score: number | null;
  policy_feedback: string[] | null;
  suggested_edits: string | null;
  final_content: string | null;
  publish_url: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const KANBAN_COLUMNS: { id: KanbanStatus; label: string; emoji: string }[] = [
  { id: 'todo', label: 'Todo', emoji: '📋' },
  { id: 'searching', label: 'Searching', emoji: '🔍' },
  { id: 'drafting', label: 'Drafting', emoji: '✍️' },
  { id: 'review', label: 'Policy Review', emoji: '🔎' },
  { id: 'approved', label: 'Approved', emoji: '✅' },
];

export const REJECTED_STATUS = 'rejected' as const;
export const PUBLISHED_STATUS = 'published' as const;

export const TONE_COLORS: Record<KanbanTone, string> = {
  professional: 'bg-blue-50 text-blue-700 border-blue-200',
  casual: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  humorous: 'bg-amber-50 text-amber-700 border-amber-200',
  formal: 'bg-slate-100 text-slate-700 border-slate-200',
  persuasive: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const PLATFORM_CONFIG: Record<KanbanPlatform, { label: string; color: string }> = {
  blog: { label: 'Blog', color: 'bg-orange-50 text-orange-700' },
  linkedin: { label: 'LinkedIn', color: 'bg-blue-50 text-blue-700' },
  twitter: { label: 'X / Twitter', color: 'bg-sky-50 text-sky-700' },
  instagram: { label: 'Instagram', color: 'bg-pink-50 text-pink-700' },
  email: { label: 'Newsletter', color: 'bg-violet-50 text-violet-700' },
};

export const AGENT_STATUS_MAP: Record<string, { agent: string; color: string }> = {
  searching: { agent: 'Search Agent', color: 'bg-cyan-500' },
  drafting: { agent: 'Content Agent', color: 'bg-emerald-500' },
  review: { agent: 'Policy Agent', color: 'bg-amber-500' },
};
