import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Mail, Shield, Edit3, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  email: string;
  display_name: string;
  role: 'admin' | 'editor';
}

interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'editor';
  status: string;
  created_at: string;
}

const TeamManagement = () => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'admin'>('editor');
  const [inviting, setInviting] = useState(false);

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ['team-members'],
    queryFn: async () => {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (!roles?.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name');

      return (roles || []).map((r): TeamMember => {
        const profile = profiles?.find((p) => p.id === r.user_id);
        return {
          id: r.user_id,
          email: profile?.email || 'Unknown',
          display_name: profile?.display_name || 'Unknown',
          role: r.role as 'admin' | 'editor',
        };
      });
    },
  });

  const { data: invitations = [], isLoading: loadingInvites } = useQuery({
    queryKey: ['team-invitations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      return (data || []) as Invitation[];
    },
    enabled: isAdmin,
  });

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !user) return;
    setInviting(true);
    try {
      const { error } = await supabase
        .from('team_invitations')
        .insert({
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          invited_by: user.id,
        });

      if (error) throw error;

      // Send invitation email via edge function
      const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
          inviterName: user.user_metadata?.display_name || user.email?.split('@')[0] || 'A teammate',
        },
      });

      if (emailError) {
        console.warn('Invitation saved but email failed:', emailError);
        toast.warning(`Invitation saved but email could not be sent. Share the signup link manually.`);
      } else {
        toast.success(`Invitation email sent to ${inviteEmail}`);
      }

      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (id: string) => {
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to revoke invitation');
    } else {
      queryClient.invalidateQueries({ queryKey: ['team-invitations'] });
      toast.success('Invitation revoked');
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-3xl font-bold text-foreground">Team</h1>
          <p className="mt-1 text-muted-foreground">View your team members</p>
        </motion.div>

        <div className="glass rounded-xl p-6">
          <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Team Members
          </h2>
          {loadingMembers ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <div className="space-y-3">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.display_name}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <Badge variant={m.role === 'admin' ? 'default' : 'outline'} className="text-xs">
                    {m.role === 'admin' ? <><Shield className="h-3 w-3 mr-1" />Admin</> : <><Edit3 className="h-3 w-3 mr-1" />Editor</>}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Team Management
        </h1>
        <p className="mt-1 text-muted-foreground">Invite members and manage roles for your content team</p>
      </motion.div>

      {/* Invite Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-6"
      >
        <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          Invite Team Member
        </h2>
        <div className="flex gap-3">
          <Input
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 border-border bg-secondary/50"
          />
          <div className="flex gap-1">
            <button
              onClick={() => setInviteRole('editor')}
              className={`rounded-l-lg px-3 py-2 text-xs font-medium transition-all ${
                inviteRole === 'editor'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Editor
            </button>
            <button
              onClick={() => setInviteRole('admin')}
              className={`rounded-r-lg px-3 py-2 text-xs font-medium transition-all ${
                inviteRole === 'admin'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Admin
            </button>
          </div>
          <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="gap-1.5">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Invite
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Editors can create and submit content. Admins can approve, reject, and manage team.
        </p>
      </motion.div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass rounded-xl p-6"
        >
          <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
            <Mail className="h-4 w-4 text-accent" />
            Pending Invitations
          </h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-foreground">{inv.email}</span>
                  <Badge variant="outline" className="text-xs">{inv.role}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevokeInvite(inv.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Current Members */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-6"
      >
        <h2 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Team Members ({members.length})
        </h2>
        {loadingMembers ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {m.display_name}
                    {m.id === user?.id && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                <Badge variant={m.role === 'admin' ? 'default' : 'outline'} className="text-xs">
                  {m.role === 'admin' ? (
                    <><Shield className="h-3 w-3 mr-1" />Admin</>
                  ) : (
                    <><Edit3 className="h-3 w-3 mr-1" />Editor</>
                  )}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default TeamManagement;
