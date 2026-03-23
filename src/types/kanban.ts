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
  professional: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  casual: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  humorous: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  formal: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  persuasive: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

export const PLATFORM_CONFIG: Record<KanbanPlatform, { label: string; color: string }> = {
  blog: { label: 'Blog', color: 'bg-orange-500/20 text-orange-400' },
  linkedin: { label: 'LinkedIn', color: 'bg-blue-600/20 text-blue-400' },
  twitter: { label: 'X / Twitter', color: 'bg-sky-500/20 text-sky-400' },
  instagram: { label: 'Instagram', color: 'bg-pink-500/20 text-pink-400' },
  email: { label: 'Newsletter', color: 'bg-violet-500/20 text-violet-400' },
};

export const AGENT_STATUS_MAP: Record<string, { agent: string; color: string }> = {
  searching: { agent: 'Search Agent', color: 'bg-cyan-400' },
  drafting: { agent: 'Content Agent', color: 'bg-emerald-400' },
  review: { agent: 'Policy Agent', color: 'bg-amber-400' },
};
