import { createClient } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  MessagesSquare,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, sessionToken } from '../lib/api';
import { useSession } from '../lib/session';
export function Layout() {
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const nav = useNavigate(),
    qc = useQueryClient();
  const feed = useQuery({
    queryKey: ['announcements', 1],
    queryFn: () => api('/announcements'),
    refetchInterval: 30000,
  });
  const complaints = useQuery({
    queryKey: ['complaint-notices'],
    queryFn: () => api('/complaints/mine?pageSize=100'),
    enabled: user?.role !== 'admin',
    refetchInterval: 15000,
  });
  const unread = (feed.data?.data || []).filter((x: any) => !x.isRead).length;
  const updates = (complaints.data?.data || []).filter((x: any) => x.status !== 'open').length;
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL,
      key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    void db.realtime.setAuth(sessionToken() || '');
    const ch = db
      .channel('announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => void qc.invalidateQueries({ queryKey: ['announcements'] }),
      )
      .subscribe();
    return () => {
      void db.removeChannel(ch);
    };
  }, [qc]);
  const links = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/courses', label: user?.role === 'teacher' ? 'My classes' : 'Courses', icon: BookOpen },
    ...(user?.role === 'admin' ? [{ to: '/users', label: 'User management', icon: Users }] : []),
    { to: '/announcements', label: 'Announcements', icon: Megaphone, count: unread },
    {
      to: '/marks',
      label: user?.role === 'student' ? 'My marks' : 'Gradebook',
      icon: ChartNoAxesCombined,
    },
    { to: '/chat', label: 'Classroom chat', icon: MessagesSquare },
    {
      to: '/complaints',
      label: user?.role === 'admin' ? 'Complaint desk' : 'Help & complaints',
      icon: LifeBuoy,
      count: updates,
    },
  ];
  return (
    <div className="app-shell">
      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <LinkBrand />
        <button
          className="mobile-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        >
          <X />
        </button>
        <div className="workspace-label">CAMPUS WORKSPACE</div>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={() => setOpen(false)}>
              <l.icon size={19} />
              <span>{l.label}</span>
              {!!l.count && <b>{l.count}</b>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure">
            <ShieldCheck size={18} />
            <div>
              Connected campus<small>Your learning, protected.</small>
            </div>
          </div>
          <button
            onClick={() => {
              void logout().then(() => {
                qc.clear();
                nav('/login');
              });
            }}
          >
            <LogOut size={18} />
            Sign out
          </button>
          <div className="sidebar-copyright">© 2026 GUTECH</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{' '}
            <strong>
              {user?.role === 'admin'
                ? 'Administration'
                : user?.role === 'teacher'
                  ? 'Faculty portal'
                  : 'Student portal'}
            </strong>
          </div>
          <div className="topbar-right">
            <NavLink
              className="notification"
              to="/announcements"
              aria-label={`${unread} unread announcements`}
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </NavLink>
            <div className="top-divider" />
            <NavLink to="/change-password" className="profile">
              <div className="avatar">
                {user?.fullName
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div>
                <strong>{user?.fullName}</strong>
                <small>{user?.role}</small>
              </div>
              <ChevronDown size={14} />
            </NavLink>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
        <footer className="main-footer">
          <span>GUTECH · A better campus experience</span>
          <span>Built for what’s next.</span>
        </footer>
      </div>
    </div>
  );
}
function LinkBrand() {
  return (
    <NavLink to="/" className="brand">
      <span className="brand-mark">
        GU<span>TECH</span>
      </span>
      <small>STUDENT & FACULTY PORTAL</small>
    </NavLink>
  );
}
