import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Fingerprint, Save, Loader2, Plus, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

const BrandProfile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyBio, setCompanyBio] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [samplePosts, setSamplePosts] = useState<string[]>([]);
  const [newPost, setNewPost] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setCompanyName(data.company_name || '');
        setCompanyBio(data.company_bio || '');
        setBrandVoice(data.brand_voice || '');
        setSamplePosts(data.sample_posts || []);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        company_name: companyName,
        company_bio: companyBio,
        brand_voice: brandVoice,
        sample_posts: samplePosts,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('brand_profiles')
        .upsert(payload, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Brand profile saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addSamplePost = () => {
    if (!newPost.trim()) return;
    setSamplePosts((prev) => [...prev, newPost.trim()]);
    setNewPost('');
  };

  const removeSamplePost = (index: number) => {
    setSamplePosts((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
          <Fingerprint className="h-8 w-8 text-primary" />
          Brand Voice DNA
        </h1>
        <p className="mt-1 text-muted-foreground">
          Define your brand's personality so AI-generated content sounds like you
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-6 space-y-6"
      >
        {/* Company Name */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Company / Brand Name</label>
          <Input
            placeholder="e.g. Acme Corp"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="border-border bg-secondary/50"
          />
        </div>

        {/* Company Bio */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Company Bio / About</label>
          <Textarea
            placeholder="Describe what your company does, your mission, target audience..."
            value={companyBio}
            onChange={(e) => setCompanyBio(e.target.value)}
            className="min-h-[100px] border-border bg-secondary/50"
          />
        </div>

        {/* Brand Voice */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Brand Voice Guidelines</label>
          <Textarea
            placeholder="Describe your brand's tone: e.g. 'We're bold yet approachable. We avoid jargon. We use humor sparingly but effectively. We always back claims with data.'"
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            className="min-h-[100px] border-border bg-secondary/50"
          />
        </div>

        {/* Sample Posts */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-foreground">
            Sample Posts (Your Best-Performing Content)
          </label>
          <p className="text-xs text-muted-foreground">
            Paste your top posts so AI can learn your style
          </p>

          {samplePosts.map((post, i) => (
            <div key={i} className="group relative rounded-lg bg-secondary/50 p-3">
              <p className="text-sm text-foreground/80 pr-8 whitespace-pre-wrap">{post}</p>
              <button
                onClick={() => removeSamplePost(i)}
                className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary transition-all"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <div className="flex gap-2">
            <Textarea
              placeholder="Paste a high-performing post here..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="min-h-[80px] border-border bg-secondary/50 flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={addSamplePost}
              disabled={!newPost.trim()}
              className="self-end gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Brand Profile
          </Button>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Your brand DNA will be injected into every AI generation
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default BrandProfile;
