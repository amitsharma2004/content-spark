# Content Generator

AI-powered social media content generation platform.

## Features

- Generate LinkedIn posts, tweets, and blog ideas
- AI-powered content refinement
- Team collaboration with role-based access
- Content scheduling and queue management
- Brand profile customization

## Tech Stack

- React + TypeScript + Vite
- Supabase (Database, Auth, Storage)
- Google Gemini AI
- Tailwind CSS + shadcn/ui

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
GOOGLE_API_KEY=your-google-api-key
```

3. Run development server:
```bash
npm run dev
```

## Deployment

### Vercel
```bash
npm run build
vercel --prod
```

### Supabase Functions
```bash
supabase functions deploy
```

## License

MIT
