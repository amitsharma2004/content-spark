import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Plus, Trash2, Upload, Search, Database, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const TONES = ['professional', 'charming', 'focused', 'witty', 'inspirational', 'casual', 'funny', 'sarcastic'];
const PLATFORMS = ['twitter', 'linkedin', 'blog', 'instagram', 'email'];

export default function RagDataset() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tone, setTone] = useState('funny');
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('twitter');
  const [styleTags, setStyleTags] = useState('');
  const [post, setPost] = useState('');
  const [bulkJson, setBulkJson] = useState('');
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: embeddings = [], isLoading } = useQuery({
    queryKey: ['post-embeddings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_embeddings')
        .select('id, tone, topic, style_tags, post, platform, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const handleAddSingle = async () => {
    if (!post.trim() || !topic.trim()) {
      toast.error('Post content and topic are required');
      return;
    }

    setIsEmbedding(true);
    try {
      const { data, error } = await supabase.functions.invoke('embed-posts', {
        body: {
          action: 'embed',
          posts: [{
            tone,
            topic,
            style_tags: styleTags.split(',').map(s => s.trim()).filter(Boolean),
            post,
            platform,
          }],
        },
      });

      if (error) throw error;
      toast.success(`Embedded ${data.embedded} post(s)!`);
      setPost('');
      setTopic('');
      setStyleTags('');
      queryClient.invalidateQueries({ queryKey: ['post-embeddings'] });
    } catch (err) {
      toast.error('Failed to embed post');
      console.error(err);
    } finally {
      setIsEmbedding(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkJson.trim()) {
      toast.error('Paste JSON array of posts');
      return;
    }

    setIsEmbedding(true);
    try {
      const posts = JSON.parse(bulkJson);
      if (!Array.isArray(posts)) throw new Error('Must be a JSON array');

      const { data, error } = await supabase.functions.invoke('embed-posts', {
        body: { action: 'embed', posts },
      });

      if (error) throw error;
      toast.success(`Embedded ${data.embedded} posts!`);
      setBulkJson('');
      queryClient.invalidateQueries({ queryKey: ['post-embeddings'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse/embed posts');
    } finally {
      setIsEmbedding(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('embed-posts', {
        body: {
          action: 'search',
          posts: [{ post: searchQuery, tone: tone || null, platform: platform || null }],
        },
      });
      if (error) throw error;
      setSearchResults(data.matches || []);
      if (!data.matches?.length) toast.info('No matching posts found');
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('post_embeddings').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['post-embeddings'] });
    toast.success('Deleted');
  };

  return (
    <div className="space-y-6 pb-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" /> RAG Dataset
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add example posts to train the AI pipeline. These are retrieved during content generation for style-matching.
        </p>
      </motion.div>

      {/* Add Single Post */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Example Post
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger><SelectValue placeholder="Tone" /></SelectTrigger>
              <SelectContent>
                {TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue placeholder="Platform" /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Topic (e.g. coding)" value={topic} onChange={e => setTopic(e.target.value)} />
          </div>
          <Input placeholder="Style tags (comma-separated, e.g. sarcastic, relatable)" value={styleTags} onChange={e => setStyleTags(e.target.value)} />
          <Textarea placeholder="Post content..." value={post} onChange={e => setPost(e.target.value)} rows={3} />
          <Button onClick={handleAddSingle} disabled={isEmbedding} className="gap-2">
            {isEmbedding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Embed Post
          </Button>
        </CardContent>
      </Card>

      {/* Bulk Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" /> Bulk Upload (JSON)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={`[{"tone":"funny","topic":"coding","style_tags":["sarcastic"],"post":"Fix one bug, get 3 new ones.","platform":"twitter"}]`}
            value={bulkJson}
            onChange={e => setBulkJson(e.target.value)}
            rows={4}
            className="font-mono text-xs"
          />
          <Button onClick={handleBulkUpload} disabled={isEmbedding} variant="outline" className="gap-2">
            {isEmbedding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload & Embed All
          </Button>
        </CardContent>
      </Card>

      {/* Search Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Test RAG Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Search query (e.g. funny coding bugs)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1" />
            <Button onClick={handleSearch} disabled={isSearching} variant="outline">
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map((r, i) => (
                <div key={i} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{r.tone}</Badge>
                    <Badge variant="secondary">{r.platform}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">{(r.similarity * 100).toFixed(0)}% match</span>
                  </div>
                  <p className="text-foreground">{r.post}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Embeddings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Stored Posts ({embeddings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : embeddings.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No example posts yet. Add some above!</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {embeddings.map((e) => (
                <div key={e.id} className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{e.tone}</Badge>
                      <Badge variant="secondary">{e.platform}</Badge>
                      <span className="text-xs text-muted-foreground">{e.topic}</span>
                    </div>
                    <p className="text-foreground truncate">{e.post}</p>
                    {e.style_tags?.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {e.style_tags.map((t: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
