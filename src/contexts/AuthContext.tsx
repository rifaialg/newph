import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import Spinner from '../components/ui/Spinner';
import { toast } from 'sonner';
import { UserRole } from '../types/database';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  session: Session | null;
  user: UserProfile | null;
  loading: boolean;
  hasPermission: (permission: PermissionType) => boolean;
  refreshProfile: () => Promise<void>; // Added refresh function
}

// RBAC Permissions Definition
export type PermissionType = 
  | 'manage_all'        // Super Admin / Owner
  | 'manage_inventory'  // Staff & Owner
  | 'view_reports'      // Owner & Manager
  | 'manage_users'      // Owner
  | 'place_orders'      // Outlet & Staff
  | 'view_own_outlet';  // Outlet

const ROLE_PERMISSIONS: Record<UserRole, PermissionType[]> = {
  owner: ['manage_all', 'manage_inventory', 'view_reports', 'manage_users', 'place_orders'],
  manager: ['manage_inventory', 'view_reports', 'place_orders'],
  staff: ['manage_inventory', 'place_orders'],
  outlet: ['place_orders', 'view_own_outlet']
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (supabaseUser: SupabaseUser | null, retryCount = 0) => {
    if (!supabaseUser) {
      setUser(null);
      return;
    }
    
    if (!navigator.onLine) {
      console.warn("Offline: Cannot fetch user profile.");
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .eq('id', supabaseUser.id)
        .single();
      
      if (error) {
        throw error;
      } else {
        setUser(data as UserProfile);
      }
    } catch (err: any) {
      console.error(`Error fetching user profile (Attempt ${retryCount + 1}):`, err);
      
      const isNetworkError = err.message === 'TypeError: Failed to fetch' || err.message?.includes('fetch');
      
      if (retryCount < 3 && isNetworkError) {
        const delay = 1000 * Math.pow(2, retryCount);
        setTimeout(() => {
          fetchUserProfile(supabaseUser, retryCount + 1);
        }, delay);
      }
    }
  };

  // Public function to manually refresh profile (e.g. after edit)
  const refreshProfile = async () => {
    if (session?.user) {
      await fetchUserProfile(session.user);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error("Session fetch error:", error);
            setSession(null);
        } else {
            setSession(session);
            if (session?.user) {
                await fetchUserProfile(session.user);
            }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(() => fetchUserProfile(session.user), 500);
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (permission: PermissionType): boolean => {
    if (!user) return false;
    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return userPermissions.includes(permission);
  };

  const value = {
    session,
    user,
    loading,
    hasPermission,
    refreshProfile
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
