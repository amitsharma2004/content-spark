export type Platform = 'linkedin' | 'twitter' | 'blog';
export type ContentStatus = 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'published' | 'rejected' | 'failed';

export interface ContentItem {
  id: string;
  platform: Platform;
  content: string;
  imageUrl?: string;
  status: ContentStatus;
  scheduledAt?: Date;
  createdAt: Date;
  topic: string;
}

export interface GenerationRequest {
  topic: string;
  linkedinCount: number;
  twitterCount: number;
  blogCount: number;
}

export interface DashboardStats {
  totalGenerated: number;
  scheduled: number;
  published: number;
  drafts: number;
}
