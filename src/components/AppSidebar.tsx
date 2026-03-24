import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Sparkles, Calendar, ListTodo, History, Fingerprint, Users, LogOut, BarChart3, Kanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/kanban', icon: Kanban, label: 'Pipeline' },
  { to: '/generate', icon: Sparkles, label: 'Generate' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/queue', icon: ListTodo, label: 'Queue' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/brand', icon: Fingerprint, label: 'Brand DNA' },
  { to: '/team', icon: Users, label: 'Team' },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-display text-sm font-bold">
          C
        </div>
        <span className="font-display text-lg font-bold text-foreground tracking-tight">
          ContentForge
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 pt-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-primary/8 text-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-3 space-y-0.5">
        {user && (
          <div className="px-3 py-1.5 text-xs text-muted-foreground truncate">
            {user.email}
          </div>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
