import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { User, UserRole } from '../types';
import { getCurrentUser, setCurrentUser as storageSetCurrentUser } from './storage';

interface AuthUser extends User {
  email?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchUser: (user: User) => void;
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
}

export type Permission =
  | 'view_dashboard'
  | 'manage_students'
  | 'manage_teachers'
  | 'manage_courses'
  | 'manage_classes'
  | 'manage_schedule'
  | 'take_attendance'
  | 'record_payment'
  | 'void_receipt'
  | 'view_reports'
  | 'export_pdf'
  | 'view_audit'
  | 'manage_users'
  | 'system_settings';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Admin: [
    'view_dashboard',
    'manage_students',
    'manage_teachers',
    'manage_courses',
    'manage_classes',
    'manage_schedule',
    'take_attendance',
    'record_payment',
    'void_receipt',
    'view_reports',
    'export_pdf',
    'view_audit',
    'manage_users',
    'system_settings',
  ],
  Staff: [
    'view_dashboard',
    'manage_students',
    'take_attendance',
    'record_payment',
    'view_reports',
    'export_pdf',
  ],
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount.
  //
  // Security: trusting the cached user object directly is a vulnerability
  // because an attacker with localStorage access can write `role: 'Admin'`
  // and gain full access. We now validate the session against Supabase when
  // available. In offline/mock mode we only rehydrate the user from the
  // encrypted cache if the same device previously completed a login in
  // this session — using a session-scoped marker that is cleared on logout.
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { getSupabaseClient } = await import('./supabase');
        const supabase = getSupabaseClient();

        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          if (data.session?.user) {
            // Resolve profile from Supabase — never trust localStorage for role.
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.session.user.id)
              .single();
            const authUser: AuthUser = {
              id: data.session.user.id,
              username: data.session.user.email?.split('@')[0] || '',
              fullName: profile?.full_name || data.session.user.email?.split('@')[0] || 'User',
              role: (profile?.role as UserRole) || 'Staff',
              email: data.session.user.email,
              createdAt: data.session.user.created_at,
            };
            setUser(authUser);
          } else {
            // No valid Supabase session — clear any stale persisted user.
            await storageSetCurrentUser({
              id: '',
              username: '',
              fullName: '',
              role: 'Staff',
              createdAt: '',
            });
            setUser(null);
          }
        } else {
          // Offline/mock mode: only restore the user if the same browser
          // session previously logged in. We use a session-storage marker
          // that is cleared on logout AND on tab close (per-tab lifetime).
          if (sessionStorage.getItem('allegro_session_marker') === 'active') {
            const stored = getCurrentUser();
            if (stored && stored.id) {
              setUser(stored);
            }
          }
        }
      } catch (err) {
        console.warn('Auth initialization failed:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { getSupabaseClient } = await import('./supabase');
      const supabase = getSupabaseClient();

      if (!supabase) {
        // Fallback: mock login for development without Supabase
        const mockUsers: Record<string, User> = {
          'admin@hieuvu.com': {
            id: 'usr_admin',
            username: 'vutrunghieu',
            fullName: 'VŨ TRUNG HIẾU',
            role: 'Admin',
            email: 'admin@hieuvu.com',
            createdAt: '2026-01-01',
          },
          'staff@hieuvu.com': {
            id: 'usr_staff',
            username: 'staff',
            fullName: 'Nhân Viên Thu Ngân',
            role: 'Staff',
            email: 'staff@hieuvu.com',
            createdAt: '2026-01-01',
          },
        };

        const mockPasswords: Record<string, string> = {
          'admin@hieuvu.com': 'admin',
          'staff@hieuvu.com': 'staff',
        };

        const foundUser = mockUsers[email];
        if (foundUser && mockPasswords[email] === password) {
          setUser({ ...foundUser, email });
          await storageSetCurrentUser(foundUser);
          sessionStorage.setItem('allegro_session_marker', 'active');
          return { success: true };
        }
        return { success: false, error: 'Email hoặc mật khẩu không đúng' };
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Fetch user profile from profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        const authUser: AuthUser = {
          id: data.user.id,
          username: data.user.email?.split('@')[0] || '',
          fullName: profile?.full_name || data.user.email?.split('@')[0] || 'User',
          role: (profile?.role as UserRole) || 'Staff',
          email: data.user.email,
          createdAt: data.user.created_at,
        };
        setUser(authUser);
        await storageSetCurrentUser(authUser);
        sessionStorage.setItem('allegro_session_marker', 'active');
        return { success: true };
      }

      return { success: false, error: 'Đăng nhập thất bại' };
    } catch (err) {
      return { success: false, error: 'Lỗi kết nối. Vui lòng thử lại.' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const { getSupabaseClient } = await import('./supabase');
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch { /* ignore */ }
    setUser(null);
    sessionStorage.removeItem('allegro_session_marker');
    // Wipe the encrypted user record so re-opening the app requires a fresh
    // login. In offline/mock mode the session-storage marker (already
    // removed) prevents re-hydration as a second line of defense.
    await storageSetCurrentUser({
      id: '',
      username: '',
      fullName: '',
      role: 'Staff',
      createdAt: '',
    });
  }, []);

  const switchUser = useCallback(async (newUser: User) => {
    setUser({ ...newUser, email: `${newUser.username}@allegro.vn` });
    await storageSetCurrentUser(newUser);
    sessionStorage.setItem('allegro_session_marker', 'active');
  }, []);

  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!user) return false;
    return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
  }, [user]);

  const hasRole = useCallback((role: UserRole | UserRole[]): boolean => {
    if (!user) return false;
    if (Array.isArray(role)) return role.includes(user.role);
    return user.role === role;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user && !!user.id,
      isLoading,
      login,
      logout,
      switchUser,
      hasPermission,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
