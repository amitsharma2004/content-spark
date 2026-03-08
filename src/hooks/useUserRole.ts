import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type AppRole = 'editor' | 'admin';

export function useUserRole() {
  const { user } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ['user-role', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch role:', error);
        return 'editor' as AppRole;
      }
      return (data?.role as AppRole) || 'editor';
    },
    enabled: !!user,
  });

  return {
    role: role || 'editor' as AppRole,
    isAdmin: role === 'admin',
    isLoading,
  };
}
