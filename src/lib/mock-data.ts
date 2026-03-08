import { ContentItem, DashboardStats } from '@/types/content';

export const mockStats: DashboardStats = {
  totalGenerated: 247,
  scheduled: 18,
  published: 156,
  drafts: 73,
};

export const mockContent: ContentItem[] = [
  {
    id: '1',
    platform: 'linkedin',
    content: '🚀 The future of AI in content creation is here. We\'ve seen a 340% increase in engagement when using AI-assisted copy. Here\'s what I learned...',
    status: 'published',
    createdAt: new Date('2026-03-07'),
    topic: 'AI Content Creation',
  },
  {
    id: '2',
    platform: 'twitter',
    content: 'Hot take: AI won\'t replace content creators. It\'ll make the good ones unstoppable. 🧵',
    status: 'scheduled',
    scheduledAt: new Date('2026-03-10T14:00:00'),
    createdAt: new Date('2026-03-07'),
    topic: 'AI Content Creation',
  },
  {
    id: '3',
    platform: 'blog',
    content: '10 Ways AI is Revolutionizing Social Media Marketing in 2026',
    status: 'draft',
    createdAt: new Date('2026-03-06'),
    topic: 'AI Marketing',
  },
  {
    id: '4',
    platform: 'linkedin',
    content: 'Just shipped our new content pipeline. From idea → published in under 60 seconds. The automation stack: AI generation + smart scheduling + auto-posting.',
    status: 'scheduled',
    scheduledAt: new Date('2026-03-09T09:00:00'),
    createdAt: new Date('2026-03-06'),
    topic: 'Automation',
  },
  {
    id: '5',
    platform: 'twitter',
    content: 'Your content strategy in 2026:\n\n1. Generate with AI\n2. Curate with taste\n3. Schedule with data\n4. Analyze & iterate\n\nSimple. Effective.',
    status: 'draft',
    createdAt: new Date('2026-03-05'),
    topic: 'Content Strategy',
  },
  {
    id: '6',
    platform: 'linkedin',
    content: 'We analyzed 10,000 LinkedIn posts. The #1 factor for engagement? Storytelling. Not hashtags. Not posting time. Stories.',
    status: 'published',
    createdAt: new Date('2026-03-04'),
    topic: 'LinkedIn Growth',
  },
  {
    id: '7',
    platform: 'twitter',
    content: 'Unpopular opinion: Consistency beats virality every single time. 📈',
    status: 'published',
    createdAt: new Date('2026-03-04'),
    topic: 'Growth',
  },
  {
    id: '8',
    platform: 'blog',
    content: 'The Complete Guide to Building a Content Factory with AI Tools',
    status: 'scheduled',
    scheduledAt: new Date('2026-03-11T08:00:00'),
    createdAt: new Date('2026-03-03'),
    topic: 'AI Tools',
  },
];

export function generateMockContent(topic: string): ContentItem[] {
  const linkedinPosts = Array.from({ length: 10 }, (_, i) => ({
    id: `gen-li-${i}`,
    platform: 'linkedin' as const,
    content: getLinkedInPost(topic, i),
    status: 'draft' as const,
    createdAt: new Date(),
    topic,
  }));

  const tweets = Array.from({ length: 10 }, (_, i) => ({
    id: `gen-tw-${i}`,
    platform: 'twitter' as const,
    content: getTweet(topic, i),
    status: 'draft' as const,
    createdAt: new Date(),
    topic,
  }));

  const blogs = Array.from({ length: 5 }, (_, i) => ({
    id: `gen-bl-${i}`,
    platform: 'blog' as const,
    content: getBlogIdea(topic, i),
    status: 'draft' as const,
    createdAt: new Date(),
    topic,
  }));

  return [...linkedinPosts, ...tweets, ...blogs];
}

function getLinkedInPost(topic: string, index: number): string {
  const templates = [
    `🚀 Let's talk about ${topic}.\n\nI've spent the last 3 months deep-diving into this space, and here are my top insights:\n\n1. The market is shifting faster than most realize\n2. Early adopters are seeing 3-5x returns\n3. The tools available today are game-changing\n\nWhat's your take? Drop a comment below 👇`,
    `The biggest misconception about ${topic}?\n\nThat it's only for big companies.\n\nI've helped 50+ startups implement ${topic} strategies. The results speak for themselves:\n\n✅ 40% increase in efficiency\n✅ 2x faster time-to-market\n✅ 60% cost reduction\n\nHere's the playbook (thread) 🧵`,
    `Hot take on ${topic}: Most people are overthinking it.\n\nThe fundamentals haven't changed:\n→ Understand your audience\n→ Deliver genuine value\n→ Be consistent\n→ Measure everything\n\nThe tools are better. The strategy is timeless.`,
    `I asked 100 experts about ${topic}.\n\n90% agreed on one thing: We're still in the early innings.\n\nHere's what they see coming in the next 12 months... 🔮`,
    `"${topic} is just a trend."\n\nI heard this same thing about:\n- Social media in 2008\n- Mobile in 2010\n- Cloud in 2012\n- AI in 2020\n\nPattern recognition > skepticism.`,
    `My ${topic} journey in numbers:\n\n📊 Day 1: Zero knowledge\n📊 Month 1: First experiment\n📊 Month 3: First win\n📊 Month 6: Consistent results\n📊 Year 1: Complete transformation\n\nIt's never too late to start.`,
    `The ${topic} landscape is evolving rapidly.\n\n3 trends I'm watching closely:\n\n1️⃣ Automation is becoming accessible\n2️⃣ Personalization at scale is real\n3️⃣ Data-driven decisions win every time\n\nWhich trend excites you most?`,
    `Unpopular opinion about ${topic}:\n\nExecution > Strategy.\n\nI've seen perfect strategies fail because of poor execution. I've seen mediocre strategies succeed because of relentless execution.\n\nStop planning. Start doing.`,
    `If you're not leveraging ${topic} in 2026, you're leaving money on the table.\n\nHere's a simple 5-step framework to get started:\n\nStep 1: Audit your current approach\nStep 2: Identify quick wins\nStep 3: Build your tech stack\nStep 4: Test and iterate\nStep 5: Scale what works`,
    `I was skeptical about ${topic} 6 months ago.\n\nToday? It's the cornerstone of our growth strategy.\n\nThe turning point was realizing it's not about replacing humans—it's about amplifying them.\n\nSometimes the best growth comes from changing your mindset. 💡`,
  ];
  return templates[index % templates.length];
}

function getTweet(topic: string, index: number): string {
  const templates = [
    `${topic} in 2026 is like the internet in 1999.\n\nEarly. Messy. Full of opportunity.\n\nThe builders who start now will own the next decade.`,
    `Stop scrolling. Start building.\n\n${topic} is the biggest unlock for creators right now. 🔓`,
    `3 ${topic} tools I can't live without:\n\n1. Content generation\n2. Smart scheduling\n3. Analytics dashboard\n\nThe trifecta. 🎯`,
    `"But what about ${topic}?"\n\nI get this question 10x a day.\n\nShort answer: Yes. Do it now.`,
    `${topic} hot take:\n\nThe people worried about it are the ones not using it.\n\nThe people using it? They're too busy winning.`,
    `Spent 3 hours studying ${topic} trends.\n\nThe #1 takeaway?\n\nConsistency compounds. Start today. 📈`,
    `${topic} myth: You need to be technical.\n\nReality: You need to be curious.\n\nCuriosity > credentials. Always.`,
    `The ${topic} playbook is simple:\n\n→ Learn the basics\n→ Apply immediately\n→ Share what you learn\n→ Repeat\n\nComplexity is the enemy of execution.`,
    `If I had to start over with ${topic}, I'd focus on:\n\n1. One platform\n2. One audience\n3. One message\n\nSimplicity scales. Complexity kills.`,
    `Everyone's talking about ${topic}.\n\nFew are actually doing it.\n\nBe a doer, not a talker. 🏗️`,
  ];
  return templates[index % templates.length];
}

function getBlogIdea(topic: string, index: number): string {
  const templates = [
    `The Ultimate Guide to ${topic}: Everything You Need to Know in 2026`,
    `${topic} for Beginners: A Step-by-Step Framework`,
    `Why ${topic} Will Define the Next Decade of Digital Marketing`,
    `Case Study: How We Used ${topic} to 10x Our Content Output`,
    `${topic} vs Traditional Methods: A Data-Driven Comparison`,
  ];
  return templates[index % templates.length];
}
