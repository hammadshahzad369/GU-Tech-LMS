import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './app/Layout';
import { Empty, Loading } from './components/ui';
import { Marks, Users } from './features/Admin';
import { AuthPage } from './features/Auth';
import { Announcements, Chat, Complaints } from './features/Community';
import { CourseDetail, Courses } from './features/Courses';
import { Dashboard } from './features/Dashboard';
import { SessionProvider, useSession } from './lib/session';
import './styles.css';
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000, refetchOnWindowFocus: false } },
});
function Protected() {
  const { user, loading } = useSession();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Outlet />;
}
function AdminOnly() {
  const { user } = useSession();
  return user?.role === 'admin' ? <Users /> : <Empty title="This page is for administrators" />;
}
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="state">
        <h1>Something went wrong.</h1>
        <p>Please reload the portal and try again.</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Reload portal
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AuthPage />} />
              <Route path="/forgot-password" element={<AuthPage />} />
              <Route path="/reset-password" element={<AuthPage />} />
              <Route path="/change-password" element={<AuthPage />} />
              <Route element={<Protected />}>
                <Route element={<Layout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="courses" element={<Courses />} />
                  <Route path="courses/:id" element={<CourseDetail />} />
                  <Route path="users" element={<AdminOnly />} />
                  <Route path="announcements" element={<Announcements />} />
                  <Route path="marks" element={<Marks />} />
                  <Route path="chat" element={<Chat />} />
                  <Route path="complaints" element={<Complaints />} />
                  <Route path="admin" element={<Navigate to="/" replace />} />
                  <Route path="teacher" element={<Navigate to="/" replace />} />
                  <Route path="student" element={<Navigate to="/" replace />} />
                </Route>
              </Route>
              <Route
                path="*"
                element={
                  <Empty
                    title="404 · Page not found"
                    text="Use your campus portal navigation to continue."
                  />
                }
              />
            </Routes>
          </BrowserRouter>
        </SessionProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
