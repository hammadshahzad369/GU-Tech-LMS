import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { send, setToken } from './api';
export type User = {
  id: string;
  fullName: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  mustChangePassword: boolean;
};
const Context = createContext<{
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}>({} as any);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      const r = await send('/auth/refresh', 'POST');
      setToken(r.data.accessToken);
      setUser(r.data.profile);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 45 * 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Context.Provider
      value={{
        user,
        loading,
        refresh,
        login: async (email, password) => {
          const r = await send('/auth/login', 'POST', { email, password });
          setToken(r.data.accessToken);
          setUser(r.data.profile);
        },
        logout: async () => {
          try {
            await send('/auth/logout', 'POST');
          } finally {
            setToken(null);
            setUser(null);
          }
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
